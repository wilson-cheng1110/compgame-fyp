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

        arm = (schedule.arm_for(sid, idx[topic])
               if topic in idx else None)
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
    for r in rows:
        by[r["verdict"]] += 1
    paces = sorted(r["sec_per_item"] for r in timed)
    return {
        "submissions": len(rows),
        "timed": len(timed),
        "untimed": len(rows) - len(timed),
        "verdicts": dict(by),
        "median_sec_per_item": paces[len(paces) // 2] if paces else None,
        "fastest_sec_per_item": paces[0] if paces else None,
        "straight_lined": sum(1 for r in rows if r["straight_lined"]),
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
    integers. Labels come from the bank so the panel never re-hardcodes them."""
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
            out_items.append({
                "id": iid, "text": it["text"], "kind": "age",
                "answered": len(nums), "declined": n - len(nums),
                "min": nums[0] if nums else None,
                "max": nums[-1] if nums else None,
                "median": nums[len(nums) // 2] if nums else None,
                "mean": round(sum(nums) / len(nums), 1) if nums else None,
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
        arm = schedule.arm_for(r["participant_id"], idx[tid])
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
    tutor transcript (+ turnQuality, directAnswers, endReason -- reflection-dialog.tsx), so
    this reports live ENGAGEMENT: how many reflected vs skipped, mean human turns, the
    direct-answer ('just tell me') rate. It is the live PROXY both papers show now. Paper
    03's coded reflection DEPTH is the offline code_batch.py human double-coding pass
    (pending), NOT derived here -- engagement volume is not depth."""
    rows = _meta_events(["reflection_complete", "reflection_skipped"], db_path)
    rows, dropped = enrolled_only(rows)
    completed = [r for r in rows if r["event_type"] == "reflection_complete"]
    skipped = [r for r in rows if r["event_type"] == "reflection_skipped"]

    human_turns = []
    direct_used = 0
    for r in completed:
        tr = r["meta"].get("transcript")
        if isinstance(tr, list):
            human_turns.append(sum(1 for t in tr
                                   if isinstance(t, dict) and t.get("role") == "human"))
        da = r["meta"].get("directAnswers")
        if isinstance(da, int) and not isinstance(da, bool) and da > 0:
            direct_used += 1

    who_reflected = {r["participant_id"] for r in completed}
    return {
        "reflections": len(completed),
        "skipped": len(skipped),
        "participants_reflected": len(who_reflected),
        "mean_human_turns": round(sum(human_turns) / len(human_turns), 1) if human_turns else None,
        "direct_answer_rate": round(direct_used / len(completed), 2) if completed else None,
        "test_traffic_excluded": dropped,
    }


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
         "arm": schedule.arm_for(sid, idx[topic]) if topic in idx else None,
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
    rows, dropped = enrolled_only(_meta_events(["questionnaire_affect_recall"], db_path))

    ITEMS = ("AR1", "AR2", "AR3")
    by_arm = {schedule.FLIP: defaultdict(list), schedule.CONTROL: defaultdict(list)}
    who = {schedule.FLIP: set(), schedule.CONTROL: set()}
    by_topic: dict = defaultdict(lambda: defaultdict(list))

    for r in rows:
        tid = r["topic_id"]
        if tid not in idx:
            continue
        arm = schedule.arm_for(r["participant_id"], idx[tid])
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
