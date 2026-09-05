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
