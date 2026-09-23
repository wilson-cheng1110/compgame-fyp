"""Analysis-ready measures, DERIVED from the sink instead of claimed by a client.

WHY THIS FILE EXISTS.

`played_understanding_first` was one column carrying TWO different variables,
populated by whichever writer happened to touch the row:

    topic_pretest / topic_posttest / topic_probe   <- topic_api.py sets it from
        `st["plays_game_first"]`, i.e. the condition the server ASSIGNED.
    assessment_complete                            <- progress-context.tsx sets it
        from `current.understandingCompleted`, i.e. what the student DID, read out
        of a localStorage blob on their own device.
    understanding_complete / topic_complete        <- NULL.

So reading the column tells you nothing unless you also know which row you are on,
and half of it depended on client state that broke silently on 2026-06-23 and stayed
broken for ten weeks (docs/incident-2026-08-30-completion-events-lost.md). Every
`assessment_complete` row in that window says `puf=0` -- not because students played
in the other order, but because the blob the client read was empty.

THE FIX IS NOT A BETTER CLIENT FLAG. It is to stop asking the client, and derive the
thing from what the server already timestamps:

    arm          ASSIGNED. schedule.arm_for(sid, index) -- deterministic from the
                 SID, recomputable forever, never travelled through a browser.
    played_first OBSERVED. ts(understanding_complete) < ts(topic_posttest), both
                 server_ts, both written by the server on receipt.
    complied     Do those two agree? This is the manipulation check, and it is the
                 question a FLIP-vs-CONTROL comparison is uninterpretable without:
                 you otherwise know what each student was ASKED to do and not what
                 they did.

Three named things instead of one overloaded one. And because `played_first` is
derived, it is RECOMPUTABLE over data already collected, and -- the property that
matters most -- it is COUNTABLE. "For how many participant x topic pairs can we
determine this?" is a number, and for the last ten weeks that number was zero.
A silent failure becomes a reading you can look at.

    python measures.py                 # per-topic table
    python measures.py --participant 22074221D

Reads the sqlite sink directly: no server, no Ollama. A check that needs the stack
running is a check nobody runs (same reasoning as check_corpus_coverage.py).
"""

import argparse
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime

import checks
import schedule

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DB = os.environ.get("RESEARCH_DB_PATH",
                    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "research_events.db"))

# The activity landing before the post-check is what "flipped" means, so these two
# event types are the whole derivation.
ACTIVITY = "understanding_complete"
POSTTEST = "topic_posttest"

# The migration's frozen-arm marker (migrate_canon_sid.py). See _resolved_arm.
ARM_ASSIGNED = "topic_arm_assigned"


def _frozen_arms(db_path=None) -> dict:
    """(participant_id, topic_id) -> the arm FROZEN at SID-canon migration time.

    migrate_canon_sid.py writes a `topic_arm_assigned` event -- keyed by
    participant_id, so its own participant_id remap carries it from the letter key to
    the numeric one -- for every already-released topic of an account whose SID it
    folds from `\\d{8}[LETTER]` to the 8-digit form. schedule.arm_for keys on the SID
    STRING (its sha256 parity), so stripping the check-letter would otherwise flip the
    assigned arm for ~half of the migrated students on every topic. This is the
    preserved ground truth; _resolved_arm reads it in preference to re-deriving.
    First row per pair wins (the migration writes exactly one, but a hand-seeded
    double must not matter)."""
    out: dict = {}
    for r in _meta_events([ARM_ASSIGNED], db_path):
        arm = (r["meta"] or {}).get("arm")
        if arm in (schedule.FLIP, schedule.CONTROL):
            out.setdefault((r["participant_id"], r["topic_id"]), arm)
    return out


def _resolved_arm(participant_id, topic_id, topic_idx, frozen):
    """The arm to USE in analysis for one (participant, topic).

    FROZEN row if the migration recorded one -- a migrated account's already-released
    topics keep the arm they were actually run under. Otherwise schedule.arm_for(sid,
    idx): unchanged for every non-migrated account, and the right source for a migrated
    account's topics released AFTER migration (served from the new numeric sid too).

    arm_for's sha256 formula is deliberately NOT canonicalised through _canon_sid: the
    frozen rows ARE the letter-parity history, and canonicalising the input would make
    arm_for(letter) == arm_for(numeric), collapsing the frozen arm into the fallback
    and erasing the very thing being preserved."""
    if topic_idx is None:
        return None
    fa = frozen.get((participant_id, topic_id))
    if fa in (schedule.FLIP, schedule.CONTROL):
        return fa
    return schedule.arm_for(participant_id, topic_idx)


def _rows(db_path=None):
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    # Wait for a momentary write lock rather than raising "database is locked" instantly.
    # Harmless for the offline CLI, load-bearing now that /api/researcher/monitor reaches
    # this from a live endpoint while students concurrently write to the sink (ops.py
    # documents this exact hazard for its own separate connection).
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        return conn.execute(
            "SELECT participant_id, event_type, topic_id, score, server_ts"
            "  FROM events WHERE participant_id IS NOT NULL AND topic_id IS NOT NULL"
            "  ORDER BY server_ts"
        ).fetchall()
    finally:
        conn.close()


def topic_index() -> dict:
    """topic_id -> its position in the release order, which is what arm_for keys on."""
    return {t["id"]: i for i, t in enumerate(schedule._load()["topics"])}


def per_topic(db_path=None) -> list[dict]:
    """One row per (participant, topic) that has any event at all."""
    idx = topic_index()
    frozen = _frozen_arms(db_path)

    # first occurrence of each event type, per pair. FIRST, not last: a student who
    # replays the activity after finishing the unit must not retro-actively turn a
    # CONTROL run into a FLIP one. The sequence that counts is the one they lived.
    first: dict = defaultdict(dict)
    score: dict = defaultdict(dict)
    for r in _rows(db_path):
        key = (r["participant_id"], r["topic_id"])
        if r["event_type"] not in first[key]:
            first[key][r["event_type"]] = r["server_ts"]
            if r["score"] is not None:
                score[key][r["event_type"]] = r["score"]

    out = []
    for (sid, topic), evs in sorted(first.items()):
        activity_at = evs.get(ACTIVITY)
        posttest_at = evs.get(POSTTEST)

        if activity_at and posttest_at:
            played_first, basis = activity_at < posttest_at, "timestamps"
        elif not activity_at:
            # The ten-week failure looked exactly like this, for every pair.
            played_first, basis = None, "activity never recorded"
        else:
            played_first, basis = None, "post-check not sat"

        arm = _resolved_arm(sid, topic, idx.get(topic), frozen)
        out.append({
            "participant_id": sid,
            "topic_id": topic,
            "arm": arm,
            "played_first": played_first,
            "played_first_basis": basis,
            "complied": None if (played_first is None or arm is None)
                        else (played_first == (arm == schedule.FLIP)),
            "pre_score": score[(sid, topic)].get("topic_pretest"),
            "post_score": score[(sid, topic)].get(POSTTEST),
            "assess_score": score[(sid, topic)].get("assessment_complete"),
            "activity_at": activity_at,
            "posttest_at": posttest_at,
            "complete_at": evs.get("topic_complete"),
            # Set when the student took the unit's logged escape rather than the
            # activity recording. Distinguishes "did not play" from "played and the
            # game failed to report", which absence alone cannot.
            "skipped_activity": "activity_not_recorded" in evs,
            "skipped_assessment": "assessment_not_recorded" in evs,
            "skipped_reflection": "reflection_not_recorded" in evs,
            "reflected": "reflection_complete" in evs,
        })
    return out


# ── effort: time against accuracy ────────────────────────────────────────────
#
# A score on its own cannot tell a student who thought about six items from one who
# clicked the same option six times in two seconds, and the two need OPPOSITE
# responses -- one is a teaching problem, the other is a data problem. The dashboard
# says "None of it is graded", which is honest and necessary and also removes the
# main reason not to click straight through, so rapid guessing is the EXPECTED
# failure mode here rather than an edge case.
#
# Both inputs are already in the sink and have been all along: `duration_ms` on the
# check event, and `meta.answers` for the pattern. So this is computable RETROACTIVELY
# over everything collected so far, with no client change. Real rows today include a
# six-item post-check answered in 2.0 s with every answer "d".
#
# Whole-check timing, not per item. Per-item would be better (Wise & Kong's response
# time effort is defined per item) and would need a client change; total time over
# item count is the standard coarse form and is enough to separate the two cases.
#
# THRESHOLD_S_PER_ITEM is a default, not a truth. Best practice is to set it from the
# cohort's own response-time distribution, which is why `effort()` reports the
# distribution alongside the flags rather than only a verdict.

THRESHOLD_S_PER_ITEM = 5.0

CHECK_EVENTS = {"topic_pretest": "A", "topic_posttest": "B"}


def _classify(sec_per_item, correct, total, chance, straight):
    """The 2x2 a score alone cannot give you."""
    if sec_per_item is None:
        return "no timing"
    fast = sec_per_item < THRESHOLD_S_PER_ITEM
    above_chance = correct > chance
    if straight and fast:
        return "rapid guess"          # same option, no time: not a response
    if fast and not above_chance:
        return "rapid guess"          # chance-level at speed
    if fast and above_chance:
        return "fast and correct"     # already knew it, or the item is too easy
    if not fast and not above_chance:
        return "struggling"           # took the time, still wrong -- a TEACHING signal
    return "engaged"


def effort(db_path=None) -> list[dict]:
    """One row per check submission, with time set against accuracy."""
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")   # see _rows(): live callers now exist
    try:
        rows = conn.execute(
            "SELECT participant_id, event_type, topic_id, duration_ms, server_ts, meta"
            "  FROM events WHERE event_type IN ('topic_pretest','topic_posttest')"
            "  ORDER BY server_ts").fetchall()
    finally:
        conn.close()

    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"] or "{}")
        except (ValueError, TypeError):
            meta = {}
        answers = meta.get("answers") or {}
        form = meta.get("form") or CHECK_EVENTS[r["event_type"]]
        n_items = len(answers)

        correct = total = None
        try:
            g = checks.grade_submission(r["topic_id"], form, answers, reveal=True)
            correct, total = g["correct"], g["total"]
        except Exception:
            pass

        n_opt = meta.get("n_options")
        chance = (total / n_opt) if (total and n_opt) else None
        secs = (r["duration_ms"] / 1000.0) if r["duration_ms"] is not None else None
        per_item = (secs / n_items) if (secs is not None and n_items) else None
        # 4+ items so a genuine run of two identical answers is not called a pattern.
        straight = bool(n_items >= 4 and len(set(answers.values())) == 1)

        out.append({
            "participant_id": r["participant_id"],
            "topic_id": r["topic_id"],
            "form": form,
            "phase": "pre" if r["event_type"] == "topic_pretest" else "post",
            "seconds": round(secs, 1) if secs is not None else None,
            "sec_per_item": round(per_item, 1) if per_item is not None else None,
            "correct": correct,
            "total": total,
            "chance": round(chance, 1) if chance is not None else None,
            "straight_lined": straight,
            "verdict": _classify(per_item, correct or 0, total, chance or 0, straight),
            "at": r["server_ts"],
        })
    return out


def effort_summary(db_path=None) -> dict:
    rows = effort(db_path)
    timed = [r for r in rows if r["sec_per_item"] is not None]
    by = defaultdict(int)
    # The process->performance link a verdict-count alone drops: the mean score % of the
    # submissions IN each verdict class. `effort()` already computes correct/total per
    # submission; here it is turned into accuracy and grouped by the verdict. A submission
    # whose grading failed (correct is None -- no bank, or an off-schedule topic) carries no
    # accuracy and is excluded from the mean, so each verdict's accuracy has its OWN n
    # (`n`, the graded submissions in that class) beside the overall verdict count in
    # `verdicts`. Aggregate-only: a mean %, never a participant.
    acc: dict = defaultdict(list)
    for r in rows:
        by[r["verdict"]] += 1
        if r["correct"] is not None and r["total"]:
            acc[r["verdict"]].append(100.0 * r["correct"] / r["total"])
    paces = sorted(r["sec_per_item"] for r in timed)
    accuracy_by_verdict = {
        v: {"n": len(xs), "mean_score_pct": round(sum(xs) / len(xs), 1)}
        for v, xs in acc.items()
    }
    return {
        "submissions": len(rows),
        "timed": len(timed),
        "untimed": len(rows) - len(timed),
        "verdicts": dict(by),
        "accuracy_by_verdict": accuracy_by_verdict,
        "median_sec_per_item": paces[len(paces) // 2] if paces else None,
        "fastest_sec_per_item": paces[0] if paces else None,
        "straight_lined": sum(1 for r in rows if r["straight_lined"]),
    }


# ── per-item behavioural telemetry (paper 04) ─────────────────────────────────
#
# The check events carry, when TELEMETRY_ENABLED was on, a per-item behavioural snapshot
# under meta["telemetry"] -- a dict KEYED BY ITEM ID, each value an ItemTelemetry object
# (frontend/lib/telemetry.ts): total_time_ms, hover_dwell_ms (a per-option map),
# direction_changes, selection_changes, longest_pause_ms, paste_detected, tab_blur_count,
# time_to_first_input_ms, and more. This reduces the whole cohort's per-item records to a
# handful of means + rates -- the behavioural companion to effort()'s time-vs-accuracy view.
#
# TOLERANT OF ABSENCE. Telemetry ships OFF until the HSESC amendment lands, so on a box
# where it never ran there are simply no `telemetry` keys: this returns items=0 with empty
# means rather than erroring, exactly like game_result_summary reads zero trials.

_CHECK_TELEMETRY_EVENTS = ["topic_pretest", "topic_posttest"]


def check_behavior_summary(db_path=None) -> dict:
    """Per-item behavioural telemetry on the pre/post checks, aggregated across every item and
    participant into means + rates. n = the number of item-telemetry records (an item on one
    submission), each statistic's denominator.

    AGGREGATE-ONLY: means/rates only, never a participant or a per-item row. Filtered through
    enrolled_only like every other slice, so non-roster / e2e traffic drops when a roster is
    active. Returns zeros/empty (never an error) when telemetry was off -- `meta.telemetry` is
    simply absent, so nothing is collected."""
    rows, dropped = enrolled_only(_meta_events(_CHECK_TELEMETRY_EVENTS, db_path))

    times, dirs, sels, pauses, firsts, hovers = [], [], [], [], [], []
    paste = blur = n = 0

    def _num(v):
        return v if (isinstance(v, (int, float)) and not isinstance(v, bool)) else None

    for r in rows:
        tel = r["meta"].get("telemetry")
        if not isinstance(tel, dict):
            continue
        for _item_id, t in tel.items():
            if not isinstance(t, dict):
                continue
            n += 1
            for src, dst in ((t.get("total_time_ms"), times),
                             (t.get("direction_changes"), dirs),
                             (t.get("selection_changes"), sels),
                             (t.get("longest_pause_ms"), pauses),
                             (t.get("time_to_first_input_ms"), firsts)):
                v = _num(src)
                if v is not None:
                    dst.append(v)
            hd = t.get("hover_dwell_ms")
            if isinstance(hd, dict):
                hovers.append(sum(v for v in (_num(x) for x in hd.values()) if v is not None))
            if t.get("paste_detected") is True:
                paste += 1
            tb = _num(t.get("tab_blur_count"))
            if tb is not None and tb > 0:
                blur += 1

    def _mean(xs, nd=1):
        return round(sum(xs) / len(xs), nd) if xs else None

    def _rate(count):
        return round(count / n, 3) if n else None

    return {
        "items": n,
        "mean_time_ms": _mean(times),
        "mean_direction_changes": _mean(dirs, 2),
        "mean_selection_changes": _mean(sels, 2),
        "mean_longest_pause_ms": _mean(pauses),
        "mean_time_to_first_input_ms": _mean(firsts),
        "mean_hover_dwell_ms": _mean(hovers),
        "paste_rate": _rate(paste),
        "blur_rate": _rate(blur),
        "test_traffic_excluded": dropped,
        "note": "Per-item behavioural telemetry on the pre/post checks, aggregated across all "
                "items/participants (means + rates; n = item-telemetry records). Empty when "
                "TELEMETRY_ENABLED was off. Aggregate-only -- never a participant.",
    }


def enrolled_only(rows, key="participant_id"):
    """Drop anything that is not a real enrolled student.

    THE SINK DOES NOT SEPARATE TEST TRAFFIC FROM PARTICIPANTS. `node e2e/run.mjs`
    signs up students, sits checks and submits probes against the SAME
    research_events.db unless RESEARCH_DB_PATH is pointed elsewhere, and on this box
    it is not. So the effort screen currently reports a median of 0.4 s per item and
    73 straight-lined submissions -- which is a true statement about the DATABASE and
    a false one about students.

    The roster is the only honest separator: a SID that is not on the class list did
    not sit the study. Names like TEST0001 and REFL178214128 are self-evidently
    synthetic; e2e SIDs look exactly like real ones and are not.

    The real fix is to point the suite at its own files. This is the guard for data
    already mixed, and the reason `--enrolled` exists on both scripts.
    """
    try:
        import auth_store
        auth_store._refresh_enrolment()
        roster = set(auth_store._enrolment)
    except Exception:
        return rows, None
    if not roster:
        return rows, None
    keep = [r for r in rows if (r[key] or "").strip().upper() in roster]
    return keep, len(rows) - len(keep)


def coverage(db_path=None) -> dict:
    """How much of the derivation is actually determinable. The headline number."""
    rows = per_topic(db_path)
    determinable = [r for r in rows if r["played_first"] is not None]
    complied = [r for r in determinable if r["complied"]]
    return {
        "pairs": len(rows),
        "determinable": len(determinable),
        "complied": len(complied),
        "no_activity": sum(1 for r in rows if r["played_first_basis"] == "activity never recorded"),
        "no_posttest": sum(1 for r in rows if r["played_first_basis"] == "post-check not sat"),
        "took_escape": sum(1 for r in rows if r["skipped_activity"]),
    }


def gain_detail(db_path=None) -> list[dict]:
    """Per (topic_id, ASSIGNED arm): the pre/post learning DV in the detail the headline
    aggregate hides -- pair count, pre/post means, mean normalised gain <g>, the CEILING
    shares (post >= 90 and == 100, the compression the end-of-study battery exists to
    escape), and DIFFERENTIAL ATTRITION (no_activity / no_posttest counts by the arm each
    pair was ASSIGNED).

    Reuses per_topic()'s rows and its already-resolved arm (which honours the SID-canon
    frozen-arm ground truth via _resolved_arm), so nothing about the arm is recomputed
    here. Attrition is split by ASSIGNED arm -- assignable even for a pair with no
    activity, because the arm is deterministic per (participant, topic) -- mirroring how
    coverage() enumerates pairs, but per arm.

    AGGREGATE-ONLY: every row is counts + means for a (topic, arm) cell, never a
    participant. Each statistic carries its own denominator (`assigned` for attrition,
    `n_pairs` for the ceiling shares, `gain_n` for <g>, since a pre==100 pair cannot
    contribute a normalised gain). Filtered through enrolled_only, like the other
    dashboard slices, so non-roster/e2e traffic is dropped when a roster is active."""
    idx = topic_index()
    rows, _ = enrolled_only(per_topic(db_path))

    agg: dict = defaultdict(lambda: {
        "assigned": 0, "pre": [], "post": [], "gains": [],
        "ceil90": 0, "ceil100": 0, "no_activity": 0, "no_posttest": 0})
    for r in rows:
        tid = r["topic_id"]
        arm = r["arm"]
        if tid not in idx or arm not in (schedule.FLIP, schedule.CONTROL):
            continue
        b = agg[(tid, arm)]
        b["assigned"] += 1
        if r["played_first_basis"] == "activity never recorded":
            b["no_activity"] += 1
        elif r["played_first_basis"] == "post-check not sat":
            b["no_posttest"] += 1
        pre, post = r["pre_score"], r["post_score"]
        if pre is not None and post is not None:
            b["pre"].append(pre)
            b["post"].append(post)
            if pre < 100:
                b["gains"].append((post - pre) / (100 - pre))
            if post >= 90:
                b["ceil90"] += 1
            if post == 100:
                b["ceil100"] += 1

    def _mean(xs, ndigits):
        return round(sum(xs) / len(xs), ndigits) if xs else None

    def _share(count, total):
        return round(count / total, 3) if total else None

    out = []
    for (tid, arm), b in sorted(
            agg.items(),
            key=lambda kv: (idx.get(kv[0][0], 999), 0 if kv[0][1] == schedule.FLIP else 1)):
        n_pairs = len(b["pre"])
        out.append({
            "topic_id": tid,
            "arm": arm,
            "assigned": b["assigned"],
            "n_pairs": n_pairs,
            "pre_mean": _mean(b["pre"], 1),
            "post_mean": _mean(b["post"], 1),
            "gain": _mean(b["gains"], 3),
            "gain_n": len(b["gains"]),
            # Sample SD of the normalised gain for this (topic, arm) cell -- the spread the
            # single ⟨g⟩ mean hides. Reuses _sample_sd (n-1; None for <2 gains, so a single-
            # pair cell reads '—' rather than a misleading 0), the same helper the
            # population×arm and subscale slices use.
            "gain_sd": _sample_sd(b["gains"], 3),
            "ceiling_ge90": b["ceil90"],
            "ceiling_ge90_share": _share(b["ceil90"], n_pairs),
            "ceiling_eq100": b["ceil100"],
            "ceiling_eq100_share": _share(b["ceil100"], n_pairs),
            "no_activity": b["no_activity"],
            "no_posttest": b["no_posttest"],
        })
    return out


def sink_census(db_path=None) -> list[dict]:
    """Per-event-type capture census: one row per event_type with its row count, the
    number of DISTINCT participants who produced it, and the first/last time it was seen.
    The stale-event-type / capture-gap detector -- an event_type that has gone quiet
    while the rest of the sink flows is the exact signature of the 2026 completion-events
    loss, and a whole event_type that was never wired shows up as simply absent.

    One GROUP BY, cheap. AGGREGATE-ONLY: it COUNTs distinct participants, it never
    projects participant_id, so no SID can leave through it (test asserts this)."""
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")   # see _rows(): live callers exist
    try:
        rows = conn.execute(
            "SELECT event_type,"
            "       COUNT(*) AS n,"
            "       COUNT(DISTINCT participant_id) AS participants,"
            "       MIN(server_ts) AS first_seen,"
            "       MAX(server_ts) AS last_seen"
            "  FROM events GROUP BY event_type ORDER BY event_type").fetchall()
    finally:
        conn.close()
    return [{"event_type": r["event_type"], "n": r["n"], "participants": r["participants"],
             "first_seen": r["first_seen"], "last_seen": r["last_seen"]} for r in rows]


_SID_CHECK_LETTER = re.compile(r"\d{8}[A-Za-z]")


def _canon_sid_local(raw: str) -> str:
    """The SID-canon rule (auth_store._canon_sid), inlined as an offline fallback: strip
    the check-letter for the exact 8-digits-then-one-letter shape, else strip+upper.
    Prefer auth_store's own function when it imports (sink_reconcile does)."""
    s = (raw or "").strip()
    return s[:8] if _SID_CHECK_LETTER.fullmatch(s) else s.upper()


def sink_reconcile(db_path=None) -> dict:
    """Data-hygiene reconcile of sink participant STREAMS against auth ACCOUNTS -- COUNTS
    ONLY, never a SID. Canonicalises the check-letter on BOTH sides (the same _canon_sid
    rule) so a person recorded as both `12345678` and `12345678D` is one canonical person,
    and matched against accounts on the same canonical key.

    Reads the auth DB read-only (auth_store.list_participants); if the auth stack is
    unavailable it degrades to sink-side counts only (accounts empty). NEVER returns or
    prints a participant_id/SID: every field is an integer (test asserts absence)."""
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        raw = [r["participant_id"] for r in conn.execute(
            "SELECT DISTINCT participant_id FROM events"
            "  WHERE participant_id IS NOT NULL").fetchall()]
    finally:
        conn.close()

    canon = _canon_sid_local
    accounts: set = set()
    try:
        import auth_store
        canon = auth_store._canon_sid
        accounts = {auth_store._canon_sid(p["sid"]) for p in auth_store.list_participants()}
    except Exception:
        pass

    fold: dict = defaultdict(int)   # canonical key -> number of raw streams folding onto it
    for p in raw:
        fold[canon(p)] += 1
    canonical = set(fold)
    return {
        "sink_streams": len(raw),
        "sink_canonical_people": len(canonical),
        "accounts_canonical": len(accounts),
        "matched_to_account": len(canonical & accounts),
        "excess_no_account": len(canonical - accounts),
        "split_by_check_letter": sum(1 for v in fold.values() if v > 1),
    }


# ── the research-papers dashboard slices (aggregate-only) ─────────────────────
#
# These feed /researcher's per-paper live panels. EVERY function here returns COUNTS
# and DISTRIBUTIONS, never a participant row or a SID -- the pseudonymised export
# (research_api.pseudonymised_rows) stays the one identified-data path, and the
# researcher_api routes that call these add nothing that could carry an identity.
# test_measures.py asserts the no-SID-leak property directly.

BANK_PATH = os.environ.get(
    "QUESTIONNAIRE_BANK",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "questionnaires.json"))


def _instrument(name: str) -> dict | None:
    """The item bank for one instrument, read straight from questionnaires.json so this
    file needs no fastapi import (it must stay runnable offline, like the rest of it)."""
    try:
        with open(BANK_PATH, encoding="utf-8") as fh:
            return json.load(fh).get("instruments", {}).get(name)
    except (OSError, ValueError):
        return None


def _meta_events(event_types, db_path=None, where_meta=None) -> list[dict]:
    """Rows for the given event_type(s), WITH meta parsed. Separate from _rows() because
    that one deliberately omits meta (it only needs score/ts); the questionnaire, game and
    reflection slices all live in meta."""
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        if where_meta:
            sql = ("SELECT participant_id, event_type, topic_id, meta, server_ts FROM events"
                   " WHERE meta LIKE ? ORDER BY server_ts")
            rows = conn.execute(sql, (where_meta,)).fetchall()
        else:
            qs = ",".join("?" * len(event_types))
            rows = conn.execute(
                f"SELECT participant_id, event_type, topic_id, meta, server_ts FROM events"
                f"  WHERE event_type IN ({qs}) ORDER BY server_ts",
                tuple(event_types)).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        try:
            meta = json.loads(r["meta"] or "{}")
        except (ValueError, TypeError):
            meta = {}
        out.append({"participant_id": r["participant_id"], "event_type": r["event_type"],
                    "topic_id": r["topic_id"], "meta": meta, "at": r["server_ts"]})
    return out


def _first_per_participant(rows) -> dict:
    """One answer-map per participant, first submission wins. The partial unique index
    already makes a second questionnaire submission impossible, but a legacy or hand-seeded
    double must never double-count a person in a distribution."""
    seen: dict = {}
    for r in rows:
        seen.setdefault(r["participant_id"], r["meta"].get("answers") or {})
    return seen


def demographics_summary(db_path=None) -> dict:
    """The once-per-participant demographics gate, as distributions. Shared top of the
    papers dashboard. Per single item: the count against each labelled option (GENDER's
    'Prefer not to say' is one such option, so its decline rate is a real bar); AGE (a
    bounded text item) reports answered/declined + min/max/median/mean over the typed
    integers, PLUS a value->count distribution and the quartiles (q1/q3/IQR) so a junk
    upper tail (a stray '99'/'100') is visible rather than hidden inside the mean. Labels
    come from the bank so the panel never re-hardcodes them."""
    inst = _instrument("demographics")
    items = (inst or {}).get("items", [])
    rows = _meta_events(["questionnaire_demographics"], db_path)
    rows, dropped = enrolled_only(rows)
    per = _first_per_participant(rows)
    answer_maps = list(per.values())
    n = len(answer_maps)

    out_items = []
    for it in items:
        iid = it["id"]
        itype = it.get("type", "likert")
        present = [a[iid] for a in answer_maps
                   if iid in a and str(a[iid]).strip() != ""]
        if itype == "text" and isinstance(it.get("min"), int):
            nums = []
            for v in present:
                try:
                    nums.append(int(str(v).strip()))
                except (ValueError, TypeError):
                    pass
            nums.sort()

            def _pctile(xs, p):
                """Linear-interpolated percentile (numpy 'linear'/type-7). None on empty."""
                if not xs:
                    return None
                if len(xs) == 1:
                    return xs[0]
                k = (len(xs) - 1) * p
                lo = int(k)
                hi = min(lo + 1, len(xs) - 1)
                val = xs[lo] + (xs[hi] - xs[lo]) * (k - lo)
                return round(val, 1)

            q1 = _pctile(nums, 0.25)
            q3 = _pctile(nums, 0.75)
            dist = defaultdict(int)
            for v in nums:
                dist[v] += 1
            out_items.append({
                "id": iid, "text": it["text"], "kind": "age",
                "answered": len(nums), "declined": n - len(nums),
                "min": nums[0] if nums else None,
                "max": nums[-1] if nums else None,
                "median": nums[len(nums) // 2] if nums else None,
                "mean": round(sum(nums) / len(nums), 1) if nums else None,
                "q1": q1, "q3": q3,
                "iqr": (round(q3 - q1, 1) if (q1 is not None and q3 is not None) else None),
                # value -> count, ascending by value; the junk tail is now inspectable.
                "distribution": [{"value": v, "count": dist[v]} for v in sorted(dist)],
            })
        else:
            opts = it.get("options", [])
            counts = [0] * len(opts)
            other = 0
            for v in present:
                if isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= len(opts):
                    counts[v - 1] += 1
                else:
                    other += 1
            out_items.append({
                "id": iid, "text": it["text"], "kind": "single",
                "answered": sum(counts),
                "options": [{"label": lab, "count": counts[i]} for i, lab in enumerate(opts)],
                "other": other,
            })
    return {"n": n, "items": out_items, "test_traffic_excluded": dropped}


def questionnaire_by_arm(db_path=None) -> dict:
    """Paper 02 (affective outcomes). PAAS mental effort is per-topic, so it splits by the
    arm ASSIGNED for that topic -- the one true arm split the within-subjects design allows.
    IMI / CoI / ARCS are administered ONCE across all topics (topic_id is null), so they
    have no single arm to split on: reported as cohort completion + a raw item mean, and
    that limit is stated, not faked. Reverse-scoring / subscale means are deliberately NOT
    applied here -- the raw mean is descriptive monitor colour; the codebook scores at
    analysis time (same principle as questionnaire_api storing raw responses)."""
    idx = topic_index()
    frozen = _frozen_arms(db_path)

    def _cohort(name):
        rows, _ = enrolled_only(_meta_events([f"questionnaire_{name}"], db_path))
        per = _first_per_participant(rows)
        vals = [v for ans in per.values() for v in ans.values()
                if isinstance(v, int) and not isinstance(v, bool)]
        return {"scope": "cohort", "n": len(per),
                "mean_raw": round(sum(vals) / len(vals), 2) if vals else None,
                "note": "cohort-level (one submission spans all topics) — no per-arm split; "
                        "reverse-scoring + subscales at analysis"}

    out = {name: _cohort(name) for name in ("imi", "coi", "arcs")}

    paas, _ = enrolled_only(_meta_events(["questionnaire_paas"], db_path))
    bucket = {schedule.FLIP: [], schedule.CONTROL: []}
    who = {schedule.FLIP: set(), schedule.CONTROL: set()}
    for r in paas:
        tid = r["topic_id"]
        if tid not in idx:
            continue
        arm = _resolved_arm(r["participant_id"], tid, idx.get(tid), frozen)
        v = (r["meta"].get("answers") or {}).get("P1")
        if arm in bucket and isinstance(v, int) and not isinstance(v, bool):
            bucket[arm].append(v)
            who[arm].add(r["participant_id"])

    def _mean(xs):
        return round(sum(xs) / len(xs), 2) if xs else None

    out["paas"] = {
        "scope": "per_topic", "scale_max": 9,
        "flip": {"responses": len(bucket[schedule.FLIP]),
                 "participants": len(who[schedule.FLIP]),
                 "mean_effort": _mean(bucket[schedule.FLIP])},
        "control": {"responses": len(bucket[schedule.CONTROL]),
                    "participants": len(who[schedule.CONTROL]),
                    "mean_effort": _mean(bucket[schedule.CONTROL])},
        "note": "Paas single-item mental effort (1..9), split by the arm assigned per topic",
    }
    return out


def reflection_summary(db_path=None) -> dict:
    """Papers 03 (metacognition) and 07 (AI tutor). reflection_complete meta carries the
    tutor transcript plus the reflection-gate outputs (insight, countedTurns, endReason,
    turnQuality, directAnswers -- reflection-dialog.tsx's `finish`), so this reports live
    ENGAGEMENT: how many reflected vs skipped, mean human/counted turns, the insight rate,
    the end-reason split (reached insight vs hit the turn floor), a turn-quality roll-up
    (share of turns the model flagged as counting / as understood), the direct-answer ('just
    tell me') rate, and mean per-turn latency (consecutive transcript `ts` deltas). It is the
    live PROXY both papers show now. Paper 03's coded reflection DEPTH is the offline
    code_batch.py human double-coding pass (pending), NOT derived here -- engagement volume is
    not depth. AGGREGATE-ONLY: counts + rates + means, never a participant."""
    rows = _meta_events(["reflection_complete", "reflection_skipped"], db_path)
    rows, dropped = enrolled_only(rows)
    completed = [r for r in rows if r["event_type"] == "reflection_complete"]
    skipped = [r for r in rows if r["event_type"] == "reflection_skipped"]

    human_turns, counted_turns, turn_latencies = [], [], []
    direct_used = insight_count = 0
    end_reasons: dict = defaultdict(int)
    tq_total = tq_counts_true = tq_understood_true = 0

    def _int(v):
        return v if (isinstance(v, int) and not isinstance(v, bool)) else None

    for r in completed:
        m = r["meta"]
        tr = m.get("transcript")
        if isinstance(tr, list):
            human_turns.append(sum(1 for t in tr
                                   if isinstance(t, dict) and t.get("role") == "human"))
            # Mean per-turn latency for THIS reflection, from consecutive `ts` deltas (each
            # transcript turn carries a client ISO `ts`). Negative/unparseable deltas are
            # dropped; a reflection with no usable timestamps contributes nothing.
            stamps = [t.get("ts") for t in tr if isinstance(t, dict) and t.get("ts")]
            deltas = [d for d in (_seconds_between(a, b) for a, b in zip(stamps, stamps[1:]))
                      if d is not None and d >= 0]
            if deltas:
                turn_latencies.append(sum(deltas) / len(deltas))
        ct = _int(m.get("countedTurns"))
        if ct is not None:
            counted_turns.append(ct)
        da = _int(m.get("directAnswers"))
        if da is not None and da > 0:
            direct_used += 1
        if m.get("insight") is True:
            insight_count += 1
        er = m.get("endReason")
        if isinstance(er, str) and er:
            end_reasons[er] += 1
        tq = m.get("turnQuality")
        if isinstance(tq, list):
            for t in tq:
                if not isinstance(t, dict):
                    continue
                tq_total += 1
                if t.get("counts") is True:
                    tq_counts_true += 1
                if t.get("understood") is True:
                    tq_understood_true += 1

    who_reflected = {r["participant_id"] for r in completed}
    n_comp = len(completed)

    def _mean(xs, nd=1):
        return round(sum(xs) / len(xs), nd) if xs else None

    def _rate(count, total, nd=2):
        return round(count / total, nd) if total else None

    return {
        "reflections": n_comp,
        "skipped": len(skipped),
        "participants_reflected": len(who_reflected),
        "mean_human_turns": _mean(human_turns),
        "mean_counted_turns": _mean(counted_turns),
        "direct_answer_rate": _rate(direct_used, n_comp),
        "insight_rate": _rate(insight_count, n_comp),
        # Reached insight vs stopped at the turn floor -- the two ways `finish` unlocks.
        "end_reasons": dict(end_reasons),
        # Share of tutor turns the model flagged as counting / as showing understanding,
        # over all turns across all completed reflections (tq_total is the denominator).
        "turn_quality": {
            "turns": tq_total,
            "counts_rate": _rate(tq_counts_true, tq_total),
            "understood_rate": _rate(tq_understood_true, tq_total),
        },
        "mean_turn_latency_s": _mean(turn_latencies, 1),
        "test_traffic_excluded": dropped,
    }


def ask_turn_summary(db_path=None) -> dict:
    """Paper 07's FREE-CHAT aggregate: the floating AI-tutor widget logs one `ask_turn` per
    question (ai-chat-widget.tsx, persisted since 2026-09-21 -- research_api gates it on
    TELEMETRY_ENABLED). Each carries METADATA ONLY, never the question text: `duration_ms`
    (latency, the events column) plus meta.chars (message length) and meta.sources (retrieved-
    source count). This reduces them to distinct participants, total turns, mean/p50 latency,
    mean chars, mean sources, and a per-topic table -- the one tutor channel that had no
    reporting (reflection already had reflection_summary).

    AGGREGATE-ONLY: counts + means, never a participant. Filtered through enrolled_only like
    every other slice. Empty (zeros) when TELEMETRY_ENABLED was off -- there are simply no
    ask_turn rows -- never an error."""
    conn = sqlite3.connect(db_path or DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 5000")   # see _rows(): live callers exist
    try:
        raw = conn.execute(
            "SELECT participant_id, topic_id, duration_ms, meta FROM events"
            "  WHERE event_type = 'ask_turn' ORDER BY server_ts").fetchall()
    finally:
        conn.close()

    parsed = []
    for r in raw:
        try:
            meta = json.loads(r["meta"] or "{}")
        except (ValueError, TypeError):
            meta = {}
        parsed.append({"participant_id": r["participant_id"], "topic_id": r["topic_id"],
                       "duration_ms": r["duration_ms"], "meta": meta})
    rows, dropped = enrolled_only(parsed)

    idx = topic_index()

    def _num(v):
        return v if (isinstance(v, (int, float)) and not isinstance(v, bool)) else None

    durations, chars, sources = [], [], []
    who = set()
    by_topic: dict = defaultdict(lambda: {"turns": 0, "who": set(), "durations": []})
    for r in rows:
        who.add(r["participant_id"])
        # Latency is the events COLUMN (the widget sends it as a top-level field); tolerate a
        # copy in meta for any client that put it there.
        d = _num(r["duration_ms"])
        if d is None:
            d = _num(r["meta"].get("duration_ms"))
        c = _num(r["meta"].get("chars"))
        s = _num(r["meta"].get("sources"))
        if d is not None:
            durations.append(d)
        if c is not None:
            chars.append(c)
        if s is not None:
            sources.append(s)
        b = by_topic[r["topic_id"] or "—"]
        b["turns"] += 1
        b["who"].add(r["participant_id"])
        if d is not None:
            b["durations"].append(d)

    def _mean(xs, nd=1):
        return round(sum(xs) / len(xs), nd) if xs else None

    def _p50(xs):
        return sorted(xs)[len(xs) // 2] if xs else None

    topics = [{"topic_id": t, "turns": b["turns"], "participants": len(b["who"]),
               "mean_duration_ms": _mean(b["durations"])}
              for t, b in sorted(by_topic.items(), key=lambda kv: idx.get(kv[0], 999))]

    return {
        "turns": len(rows),
        "participants": len(who),
        "mean_duration_ms": _mean(durations),
        "p50_duration_ms": _p50(durations),
        "mean_chars": _mean(chars, 1),
        "mean_sources": _mean(sources, 2),
        "by_topic": topics,
        "test_traffic_excluded": dropped,
        "note": "Free-chat AI-tutor usage (ask_turn) -- metadata only (latency, message length, "
                "retrieved-source count), never the question text. Empty when TELEMETRY_ENABLED "
                "was off. Aggregate-only.",
    }


def _seconds_between(earlier_iso: str | None, later_iso: str | None) -> float | None:
    """Seconds between two ISO timestamps, or None if either is missing/unparseable. Used for
    reflection per-turn latency (consecutive transcript `ts` deltas) -- never an identifier, so
    it carries no SID-leak risk of its own. Tolerates a trailing 'Z'."""
    if not earlier_iso or not later_iso:
        return None
    try:
        a = datetime.fromisoformat(str(earlier_iso).replace("Z", "+00:00"))
        b = datetime.fromisoformat(str(later_iso).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return (b - a).total_seconds()


def _weeks_between(earlier_iso: str | None, later_iso: str | None) -> float | None:
    """Whole-ish weeks between two ISO server timestamps, or None if either is
    missing/unparseable. Used ONLY for the retention interval covariate -- never a
    participant identifier, so it carries no SID-leak risk of its own."""
    if not earlier_iso or not later_iso:
        return None
    try:
        a = datetime.fromisoformat(earlier_iso.replace("Z", "+00:00"))
        b = datetime.fromisoformat(later_iso.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return round((b - a).total_seconds() / (7 * 86400), 2)


def retention_summary(db_path=None) -> dict:
    """Paper 01's DELAYED-retention stat block (docs/end-of-study-battery-plan.md):
    `topic_retention` (Form C, weeks after the topic's own post-check) score by
    ASSIGNED arm, plus the retention interval itself -- weeks between a topic's
    `topic_posttest` and this re-test -- reported as a distribution, the continuous
    covariate the plan calls for. Fixes the ceiling problem in the immediate
    post-test DV: a delayed re-test at a genuinely different difficulty/decay point
    can still separate FLIP from CONTROL even when the immediate post-test cannot.
    Aggregate-only, no SID (test_measures.py asserts this like every slice here)."""
    idx = topic_index()
    frozen = _frozen_arms(db_path)
    posttest_at: dict = {}
    retention: dict = {}
    for r in _rows(db_path):
        key = (r["participant_id"], r["topic_id"])
        if r["event_type"] == "topic_posttest" and key not in posttest_at:
            posttest_at[key] = r["server_ts"]
        elif r["event_type"] == "topic_retention" and key not in retention:
            retention[key] = {"score": r["score"], "at": r["server_ts"]}

    rows = [
        {"participant_id": sid, "topic_id": topic, "score": v["score"],
         "arm": _resolved_arm(sid, topic, idx.get(topic), frozen),
         "weeks_since_post": _weeks_between(posttest_at.get((sid, topic)), v["at"])}
        for (sid, topic), v in retention.items()
    ]
    rows, dropped = enrolled_only(rows)

    by_arm = {schedule.FLIP: [], schedule.CONTROL: []}
    for r in rows:
        if r["arm"] in by_arm and r["score"] is not None:
            by_arm[r["arm"]].append(r["score"])
    intervals = [r["weeks_since_post"] for r in rows if r["weeks_since_post"] is not None]

    def _mean(xs):
        return round(sum(xs) / len(xs), 2) if xs else None

    return {
        "n": len(rows),
        "flip": {"n": len(by_arm[schedule.FLIP]), "mean_score": _mean(by_arm[schedule.FLIP])},
        "control": {"n": len(by_arm[schedule.CONTROL]), "mean_score": _mean(by_arm[schedule.CONTROL])},
        "mean_weeks_since_post": _mean(intervals),
        "with_interval": len(intervals),
        "test_traffic_excluded": dropped,
        "note": "Form-C delayed retention score by assigned arm, with the post-check-to-"
                "retest interval (weeks) as a covariate -- the delayed DV productive-"
                "failure theory predicts should separate FLIP from CONTROL where the "
                "immediate post-test ceilings.",
    }


def affect_recall_summary(db_path=None) -> dict:
    """Paper 02's RETROSPECTIVE affect block: AR1 enjoyment / AR2 perceived learning /
    AR3 mental effort (`questionnaire_affect_recall`, per topic, taken at the end of
    the study), means by ASSIGNED arm and by topic. The retrospective twin of PAAS's
    prospective per-topic mean in questionnaire_by_arm() -- same per-topic arm-split
    reasoning applies (arm is randomised PER TOPIC, so only a per-topic split is
    meaningful). Aggregate-only, raw means only -- no reverse-scoring here, same
    principle as questionnaire_api storing raw responses."""
    idx = topic_index()
    frozen = _frozen_arms(db_path)
    rows, dropped = enrolled_only(_meta_events(["questionnaire_affect_recall"], db_path))

    ITEMS = ("AR1", "AR2", "AR3")
    by_arm = {schedule.FLIP: defaultdict(list), schedule.CONTROL: defaultdict(list)}
    who = {schedule.FLIP: set(), schedule.CONTROL: set()}
    by_topic: dict = defaultdict(lambda: defaultdict(list))

    for r in rows:
        tid = r["topic_id"]
        if tid not in idx:
            continue
        arm = _resolved_arm(r["participant_id"], tid, idx.get(tid), frozen)
        answers = r["meta"].get("answers") or {}
        for item_id in ITEMS:
            v = answers.get(item_id)
            if not (isinstance(v, int) and not isinstance(v, bool)):
                continue
            by_topic[tid][item_id].append(v)
            if arm in by_arm:
                by_arm[arm][item_id].append(v)
                who[arm].add(r["participant_id"])

    def _mean(xs):
        return round(sum(xs) / len(xs), 2) if xs else None

    def _arm_block(arm):
        return {
            "participants": len(who[arm]),
            "items": {i: {"n": len(by_arm[arm][i]), "mean": _mean(by_arm[arm][i])} for i in ITEMS},
        }

    by_topic_out = [
        {"topic_id": tid,
         "items": {i: {"n": len(by_topic[tid][i]), "mean": _mean(by_topic[tid][i])} for i in ITEMS}}
        for tid in sorted(by_topic, key=lambda t: idx.get(t, 999))
    ]

    return {
        "scale_max": 5,
        "flip": _arm_block(schedule.FLIP),
        "control": _arm_block(schedule.CONTROL),
        "by_topic": by_topic_out,
        "test_traffic_excluded": dropped,
        "note": "AR1 enjoyment / AR2 perceived learning / AR3 mental effort, retrospective "
                "(end of study) -- the retrospective twin of PAAS's prospective per-topic "
                "mean. Raw means; no reverse-scoring (none of the three items are reversed).",
    }


def game_result_summary(db_path=None) -> dict:
    """Paper 09 (the game IS the experiment). game_result is game-specific and untyped in the
    sink (research_api attaches it under meta.game_result, TELEMETRY_ENABLED-gated), so this
    reports COVERAGE -- trial payloads and distinct participants per topic, and the metric
    KEYS present -- and does NOT invent per-paradigm aggregates (Stroop RT, Hick RT×n, Fitts
    MT×ID, Weber JND need game-specific parsers, a later step). If TELEMETRY was off in prod
    there are simply zero rows, which total_trials=0 states honestly rather than papering
    over."""
    rows = _meta_events(None, db_path, where_meta='%"game_result"%')
    rows, dropped = enrolled_only(rows)
    per_topic_agg: dict = defaultdict(lambda: {"trials": 0, "participants": set(), "keys": set()})
    total = 0
    for r in rows:
        gr = r["meta"].get("game_result")
        if not isinstance(gr, dict):
            continue
        total += 1
        b = per_topic_agg[r["topic_id"] or "—"]
        b["trials"] += 1
        b["participants"].add(r["participant_id"])
        b["keys"].update(str(k) for k in gr.keys())
    topics = [{"topic_id": t, "trials": b["trials"],
               "participants": len(b["participants"]),
               "metric_keys": sorted(b["keys"])[:12]}
              for t, b in sorted(per_topic_agg.items())]
    return {
        "total_trials": total, "topics": topics, "test_traffic_excluded": dropped,
        "note": "coverage only; per-paradigm stats (Stroop RT, Hick RT×n, Fitts MT×ID, "
                "Weber JND) need game-specific parsers. Zero trials = telemetry off in prod.",
    }


def _sample_sd(xs, ndigits=3):
    """Sample SD (n-1). None for < 2 points, where a spread is undefined -- so a single-
    respondent cell reads '—' rather than a misleading 0. Shared by the three DV-completer
    slices below."""
    if len(xs) < 2:
        return None
    m = sum(xs) / len(xs)
    var = sum((x - m) ** 2 for x in xs) / (len(xs) - 1)
    return round(var ** 0.5, ndigits)


def _population_of(section) -> str | None:
    """UG (undergraduate sections A/B/C pooled) vs MSc (the MSC cross-population cohort).

    None for an unknown/absent section, so it drops out of the population split rather than
    forming a phantom third population. The mapping is the study design (docs/revamp.md; the
    MSC section is COMP5517), read here from the SECTION each account is in -- not re-derived."""
    s = (section or "").strip().upper()
    if s in ("A", "B", "C"):
        return "UG"
    if s == "MSC":
        return "MSc"
    return None


def gain_by_population_arm(db_path=None, section_map=None) -> dict:
    """Paper 05's cross-population INTERACTION DV: normalised gain <g> per (population, arm),
    where population is UG (undergraduate sections A/B/C pooled) vs MSc (the MSC cohort) and arm
    is the ASSIGNED FLIP/CONTROL. This is the interaction hypothesis's actual dependent variable
    -- does the flip effect (the FLIP-CONTROL gain gap) differ between undergraduates and
    master's students? -- which the section coverage/compliance table alone cannot answer and
    which was, until now, uncomputed.

    Reuses per_topic()'s rows and their already-resolved arm (honouring the SID-canon frozen arm
    via _resolved_arm, like every other slice), joined to each participant's SECTION via
    section_map. section_map defaults to {sid -> section} from auth_store.list_participants();
    it is injectable so the offline test can supply sections without an auth DB. Same gain
    formula as paper 01 -- (post-pre)/(100-pre), excluding pre==100 which has no normalised gain
    -- and each cell carries gain_n beside <g> plus the population's sample SD of gain.

    AGGREGATE-ONLY: every row is counts + means for a (population, arm) cell, never a
    participant. Filtered through enrolled_only like the other dashboard slices, so non-roster /
    e2e traffic is dropped when a roster is active."""
    if section_map is None:
        section_map = {}
        try:
            import auth_store
            section_map = {p["sid"]: p.get("section") for p in auth_store.list_participants()}
        except Exception:
            section_map = {}

    rows, _ = enrolled_only(per_topic(db_path))

    agg: dict = defaultdict(lambda: {"pre": [], "post": [], "gains": []})
    for r in rows:
        arm = r["arm"]
        if arm not in (schedule.FLIP, schedule.CONTROL):
            continue
        pop = _population_of(section_map.get(r["participant_id"]))
        if pop is None:
            continue
        pre, post = r["pre_score"], r["post_score"]
        if pre is None or post is None:
            continue
        b = agg[(pop, arm)]
        b["pre"].append(pre)
        b["post"].append(post)
        if pre < 100:
            b["gains"].append((post - pre) / (100 - pre))

    def _mean(xs, nd):
        return round(sum(xs) / len(xs), nd) if xs else None

    cells = []
    for (pop, arm), b in sorted(
            agg.items(),
            key=lambda kv: (0 if kv[0][0] == "UG" else 1,
                            0 if kv[0][1] == schedule.FLIP else 1)):
        cells.append({
            "population": pop,
            "arm": arm,
            "n": len(b["pre"]),
            "pre_mean": _mean(b["pre"], 1),
            "post_mean": _mean(b["post"], 1),
            "gain": _mean(b["gains"], 3),
            "gain_n": len(b["gains"]),
            "gain_sd": _sample_sd(b["gains"], 3),
        })

    # The headline: the FLIP-CONTROL gain gap for each population, and the difference of the
    # two gaps (the interaction -- the cross-population effect itself). None where a needed
    # cell is missing, so a half-collected read never fabricates an interaction.
    by = {(c["population"], c["arm"]): c["gain"] for c in cells}

    def _gap(pop):
        f, c = by.get((pop, schedule.FLIP)), by.get((pop, schedule.CONTROL))
        return round(f - c, 3) if (f is not None and c is not None) else None

    ug_gap, msc_gap = _gap("UG"), _gap("MSc")
    interaction = (round(ug_gap - msc_gap, 3)
                   if (ug_gap is not None and msc_gap is not None) else None)

    return {
        "cells": cells,
        "ug_gain_gap": ug_gap,
        "msc_gain_gap": msc_gap,
        "interaction": interaction,
        "note": "Normalised gain <g> = (post-pre)/(100-pre) per (population, arm); UG = sections "
                "A/B/C pooled, MSc = the MSC cohort. The interaction is the difference of the two "
                "FLIP-CONTROL gain gaps -- the cross-population DV. Aggregate-only; pre==100 pairs "
                "are excluded from <g> (gain_n).",
    }


def game_psychophysics_summary(db_path=None) -> dict:
    """Paper 09's per-paradigm DV, split by the ASSIGNED arm -- the reframed dependent variable
    game_result_summary() only counted. That function reports COVERAGE (trial payloads + metric
    keys per topic); this parses the four psychophysics games' game_result payloads into the
    metric each law is actually about and splits FLIP vs CONTROL:

      * Stroop  -- consistent vs inconsistent mean RT (ms) + the congruency delta (the Stroop
                   interference effect). Reads game_result.consistent_avg_ms / inconsistent_avg_ms
                   (stroop-understanding game-client.tsx), falling back to averaging trials[].rt_ms
                   by block.
      * Hick    -- mean choice RT (ms) by number of choices. Reads game_result.trials[].rt_ms; the
                   choice count comes from a single n_choices/n field when present, else from the
                   comparison game's n_choices_a / n_choices_b (the RT of comparing two menus is
                   recorded against each option-count -- coverage colour, not a precise fit).
      * Fitts   -- mean movement time (ms) by condition (distance / size). game_result.distance /
                   size are {target -> catch_ms} maps (the two Fitts manipulations, amplitude and
                   width); there is no numeric ID in the payload, so condition is the ID bucket.
      * Weber   -- mean just-noticeable-difference (JND, % of base). Reads game_result.trials[].
                   jnd_pct, falling back to the jnd {attribute -> pct} map.

    Arm resolved via _resolved_arm + _frozen_arms exactly as affect_recall_summary does, so the
    SID-canon frozen arm is honoured; a row whose topic is off-schedule or whose arm cannot be
    resolved is skipped. Missing/absent fields are tolerated -- a paradigm with no parseable rows
    reports zero N, and telemetry-off in prod means every paradigm is empty. AGGREGATE-ONLY: means
    + counts per (paradigm, arm), never a participant (test asserts the no-SID property)."""
    idx = topic_index()
    frozen = _frozen_arms(db_path)
    rows, dropped = enrolled_only(_meta_events(None, db_path, where_meta='%"game_result"%'))

    stroop = {schedule.FLIP: {"cons": [], "incons": [], "who": set()},
              schedule.CONTROL: {"cons": [], "incons": [], "who": set()}}
    hick = {schedule.FLIP: {"by_n": defaultdict(list), "who": set()},
            schedule.CONTROL: {"by_n": defaultdict(list), "who": set()}}
    fitts = {schedule.FLIP: {"by_cond": defaultdict(list), "who": set()},
             schedule.CONTROL: {"by_cond": defaultdict(list), "who": set()}}
    weber = {schedule.FLIP: {"jnd": [], "who": set()},
             schedule.CONTROL: {"jnd": [], "who": set()}}

    def _num(v):
        return v if (isinstance(v, (int, float)) and not isinstance(v, bool)) else None

    def _int(v):
        return v if (isinstance(v, int) and not isinstance(v, bool)) else None

    for r in rows:
        gr = r["meta"].get("game_result")
        if not isinstance(gr, dict):
            continue
        tid = r["topic_id"]
        if tid not in idx:
            continue
        arm = _resolved_arm(r["participant_id"], tid, idx.get(tid), frozen)
        if arm not in (schedule.FLIP, schedule.CONTROL):
            continue
        game = str(gr.get("game") or "").lower()
        pid_ = r["participant_id"]
        trials = gr.get("trials") if isinstance(gr.get("trials"), list) else []

        if game == "stroop":
            c, i = _num(gr.get("consistent_avg_ms")), _num(gr.get("inconsistent_avg_ms"))
            if c is None or i is None:
                cons = [_num(t.get("rt_ms")) for t in trials
                        if isinstance(t, dict) and t.get("block") == "consistent"]
                inc = [_num(t.get("rt_ms")) for t in trials
                       if isinstance(t, dict) and t.get("block") == "inconsistent"]
                cons = [x for x in cons if x is not None]
                inc = [x for x in inc if x is not None]
                if c is None and cons:
                    c = sum(cons) / len(cons)
                if i is None and inc:
                    i = sum(inc) / len(inc)
            b = stroop[arm]
            if c is not None:
                b["cons"].append(c)
            if i is not None:
                b["incons"].append(i)
            if c is not None or i is not None:
                b["who"].add(pid_)

        elif game == "hicks":
            b = hick[arm]
            counted = False
            for t in trials:
                if not isinstance(t, dict):
                    continue
                rt = _num(t.get("rt_ms"))
                if rt is None:
                    continue
                single = _int(t.get("n_choices"))
                if single is None:
                    single = _int(t.get("n"))
                ns = [single] if single is not None else [
                    n for n in (_int(t.get("n_choices_a")), _int(t.get("n_choices_b")))
                    if n is not None]
                for n in ns:
                    b["by_n"][n].append(rt)
                    counted = True
            if counted:
                b["who"].add(pid_)

        elif game == "fitts":
            b = fitts[arm]
            counted = False
            for cond in ("distance", "size"):
                m = gr.get(cond)
                if not isinstance(m, dict):
                    continue
                for v in m.values():
                    mt = _num(v)
                    if mt is not None:
                        b["by_cond"][cond].append(mt)
                        counted = True
            if counted:
                b["who"].add(pid_)

        elif game == "weber":
            vals = [_num(t.get("jnd_pct")) for t in trials if isinstance(t, dict)]
            vals = [x for x in vals if x is not None]
            if not vals and isinstance(gr.get("jnd"), dict):
                vals = [x for x in (_num(v) for v in gr["jnd"].values()) if x is not None]
            if vals:
                b = weber[arm]
                b["jnd"].extend(vals)
                b["who"].add(pid_)

    def _mean(xs, nd=1):
        return round(sum(xs) / len(xs), nd) if xs else None

    def _stroop_arm(arm):
        b = stroop[arm]
        cons, inc = _mean(b["cons"]), _mean(b["incons"])
        delta = round(inc - cons, 1) if (cons is not None and inc is not None) else None
        return {"n": len(b["who"]), "consistent_ms": cons, "inconsistent_ms": inc,
                "congruency_delta_ms": delta}

    def _hick_arm(arm):
        b = hick[arm]
        return {"n": len(b["who"]),
                "by_n_choices": [{"n_choices": n, "mean_rt_ms": _mean(b["by_n"][n]),
                                  "trials": len(b["by_n"][n])} for n in sorted(b["by_n"])]}

    def _fitts_arm(arm):
        b = fitts[arm]
        return {"n": len(b["who"]),
                "by_condition": [{"condition": cond, "mean_mt_ms": _mean(b["by_cond"][cond]),
                                  "trials": len(b["by_cond"][cond])} for cond in sorted(b["by_cond"])]}

    def _weber_arm(arm):
        b = weber[arm]
        return {"n": len(b["who"]), "mean_jnd_pct": _mean(b["jnd"], 2), "trials": len(b["jnd"])}

    return {
        "stroop": {"flip": _stroop_arm(schedule.FLIP), "control": _stroop_arm(schedule.CONTROL)},
        "hick": {"flip": _hick_arm(schedule.FLIP), "control": _hick_arm(schedule.CONTROL)},
        "fitts": {"flip": _fitts_arm(schedule.FLIP), "control": _fitts_arm(schedule.CONTROL)},
        "weber": {"flip": _weber_arm(schedule.FLIP), "control": _weber_arm(schedule.CONTROL)},
        "test_traffic_excluded": dropped,
        "note": "Per-paradigm DV split by assigned arm: Stroop consistent/inconsistent RT + "
                "congruency delta, Hick RT by n_choices, Fitts MT by condition (distance/size), "
                "Weber JND (% of base). Empty when TELEMETRY_ENABLED was off (zero game_result "
                "rows). Aggregate-only.",
    }


def questionnaire_subscales(db_path=None) -> dict:
    """Paper 02's REAL H2/H3 instrument scoring: reverse-applied SUBSCALE means for IMI (4
    subscales), CoI (2) and ARCS (2), computed from the `reverse` + `subscales` metadata already
    in questionnaires.json. questionnaire_by_arm() reports only ONE raw item mean per instrument
    (deliberately -- monitor colour); this is the scored form the H2/H3 analysis actually needs,
    and it does NOT change questionnaire_by_arm.

    Per instrument per subscale: the cohort mean over each participant's mean of that subscale's
    reverse-corrected items (standard subscale scoring), the respondent n, and the sample SD.
    Reverse scoring flips a reverse-keyed item (IMI's M9/M11) to (scale_min + scale_max) - v using
    the instrument's own scale length, so it counts in the same direction as the rest of its
    subscale.

    Aggregate-only, COHORT-level: IMI/CoI/ARCS are each administered ONCE across all topics
    (topic_id null), so there is no per-arm split -- a real design limit, kept as a note (the same
    limit questionnaire_by_arm states). No SID leaves (test asserts it)."""
    out: dict = {}
    for name in ("imi", "coi", "arcs"):
        inst = _instrument(name) or {}
        scale_len = len(inst.get("scale") or [])
        reverse = set(inst.get("reverse") or [])
        subscales = inst.get("subscales") or {}

        rows, _ = enrolled_only(_meta_events([f"questionnaire_{name}"], db_path))
        per = _first_per_participant(rows)   # participant -> answer map, first submission wins

        def _score(item_id, v, _reverse=reverse, _scale_len=scale_len):
            if not (isinstance(v, int) and not isinstance(v, bool)):
                return None
            return (_scale_len + 1 - v) if (item_id in _reverse and _scale_len) else v

        sub_out = []
        for sub_name, item_ids in subscales.items():
            per_person = []
            for ans in per.values():
                vals = [s for iid in item_ids
                        for s in (_score(iid, ans.get(iid)),) if s is not None]
                if vals:
                    per_person.append(sum(vals) / len(vals))
            sub_out.append({
                "subscale": sub_name,
                "items": list(item_ids),
                "n": len(per_person),
                "mean": round(sum(per_person) / len(per_person), 2) if per_person else None,
                "sd": _sample_sd(per_person, 3),
            })
        out[name] = {
            "title": inst.get("title"),
            "scale_max": scale_len or None,
            "reverse_items": sorted(reverse),
            "subscales": sub_out,
            "n_respondents": len(per),
        }
    out["note"] = ("Reverse-applied subscale means (cohort-level). IMI/CoI/ARCS are each "
                   "administered once across all topics, so there is no per-arm split. Reverse "
                   "items are flipped to (min+max)-v using each instrument's scale length.")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--participant")
    ap.add_argument("--db")
    args = ap.parse_args()

    rows = per_topic(args.db)
    if args.participant:
        want = args.participant.strip().upper()
        rows = [r for r in rows if r["participant_id"].upper() == want]

    print(f"{'participant':14} {'topic':20} {'arm':8} {'played 1st':11} {'complied':9} basis")
    print("-" * 92)
    for r in rows[:200]:
        pf = "-" if r["played_first"] is None else ("yes" if r["played_first"] else "no")
        cp = "-" if r["complied"] is None else ("yes" if r["complied"] else "NO")
        print(f"{r['participant_id'][:13]:14} {r['topic_id'][:19]:20} {str(r['arm']):8} "
              f"{pf:11} {cp:9} {r['played_first_basis']}")

    c = coverage(args.db)
    print(f"\n{c['pairs']} participant x topic pairs with any event")
    print(f"  manipulation check determinable : {c['determinable']}")
    print(f"  of those, complied with the arm : {c['complied']}")
    print(f"  undeterminable, no activity ever: {c['no_activity']}")
    print(f"  undeterminable, no post-check   : {c['no_posttest']}")
    print(f"  took the unit's logged escape   : {c['took_escape']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
