"""Is the study actually recording what the paper is going to need?

    python check_measurement_coverage.py           # the table
    python check_measurement_coverage.py --quiet   # CI: exit 1 if a signal is broken

THE FAILURE THIS EXISTS TO CATCH. `understanding_complete` and `assessment_complete`
stopped arriving on 2026-06-23 and nobody noticed until 2026-08-30 -- ten weeks in
which units completed, checks were graded, consent was recorded, and the behavioural
half of the dataset was silently empty
(docs/incident-2026-08-30-completion-events-lost.md).

Nothing could have noticed, because absence of an event and absence of the behaviour
are the same byte. The unit even DISPLAYED the broken flag -- "We have not seen the
activity finish yet" -- next to a button that let the student past regardless, so a
permanently-false signal read exactly like a student choosing to skip.

RELATIVE staleness is the whole trick. "No `understanding_complete` in 14 days" means
nothing on its own -- the study may not have started. "No `understanding_complete` in
14 days WHILE 37 `topic_pretest` rows arrived" means the pipe is severed, and that is
a statement this script can make on its own. Absolute thresholds would have stayed
green through the entire outage.

Reads the sqlite sink directly: no server, no Ollama. A check that needs the stack
running is a check nobody runs (same reasoning as check_corpus_coverage.py).
"""

import argparse
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

import measures

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DB = os.environ.get("RESEARCH_DB_PATH",
                    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "research_events.db"))

WINDOW_DAYS = 14

# event type -> (what it measures, which claim needs it, status)
#
# REQUIRED  a claim in the paper rests on it; if it stops, the study is losing data
#           right now and the exit code says so.
# FLAG      a data-quality marker. Zero of them is good news, not a broken pipe.
# NOT BUILT named here on purpose. A gap you can see beats a gap you rediscover --
#           and it stops the check crying wolf about something nobody wired yet,
#           which is how a checker gets ignored.
SIGNALS = {
    "consent_recorded":       ("consent given",              "ethics precondition",        "REQUIRED"),
    "pre_test_complete":      ("baseline pre-test",           "covariate / prior knowledge","REQUIRED"),
    "topic_pretest":          ("pre-check answers",           "H1 numerator",               "REQUIRED"),
    "topic_posttest":         ("post-check answers",          "H1 normalized gain",         "REQUIRED"),
    "understanding_complete": ("the activity was played",     "MANIPULATION CHECK",         "REQUIRED"),
    "assessment_complete":    ("the scored round was played", "secondary DV",               "REQUIRED"),
    "topic_probe":            ("short answer, pre",           "H1 qualitative",             "REQUIRED"),
    "topic_probe_post":       ("short answer, post",          "H1 qualitative",             "REQUIRED"),
    "reflection_complete":    ("a real tutor reflection",     "H3 interaction (CoI)",       "REQUIRED"),
    "topic_complete":         ("unit finished",               "attrition / denominator",    "REQUIRED"),

    "reflection_skipped":     ("tutor dialog dismissed",      "H3 complement",              "FLAG"),
    "activity_not_recorded":  ("went past a dead activity",   "exclusion flag",             "FLAG"),
    "assessment_not_recorded":("went past a dead assessment", "exclusion flag",             "FLAG"),
    "reflection_not_recorded":("went past a dead tutor",      "exclusion flag",             "FLAG"),
    "consent_withdrawn":      ("withdrawal",                  "ethics / deletion",          "FLAG"),
}

NOT_BUILT = {
    "questionnaire_imi":  ("IMI motivation battery",     "H2 motivation"),
    "questionnaire_coi":  ("CoI, reworded",              "H3 interaction"),
    "questionnaire_arcs": ("ARCS-S satisfaction",        "H4 satisfaction"),
    "paas_load":          ("Paas cognitive load, 1 item","load bonus"),
}


def counts(db_path=None):
    conn = sqlite3.connect(db_path or DB)
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)).isoformat()
        total = {r[0]: (r[1], r[2]) for r in conn.execute(
            "SELECT event_type, COUNT(*), MAX(server_ts) FROM events GROUP BY 1")}
        recent = {r[0]: r[1] for r in conn.execute(
            "SELECT event_type, COUNT(*) FROM events WHERE server_ts > ? GROUP BY 1", (cutoff,))}
        return total, recent
    finally:
        conn.close()


def summary(db_path=None) -> dict:
    """Every signal this check computes, as ONE aggregate-only dict — the same logic
    ``main()`` prints, factored out so the CLI and the /researcher health endpoint read
    a single source of truth (mirrors how ``grade_batch.run()`` was exposed for its CLI).

    AGGREGATE-ONLY by construction: counts, statuses, event-type names and MAX(server_ts)
    timestamps — never a participant_id. The withdrawal check counts DISTINCT stuck
    participants and keeps the SIDs it looks them up by strictly internal. `problems` is
    the exit-code driver (any entry → the CLI returns 1); it carries no SID either."""
    total, recent = counts(db_path)
    active = sum(recent.values())

    signals, broken, never = [], [], []
    for ev, (what, needed_for, kind) in SIGNALS.items():
        n, last = total.get(ev, (0, None))
        rec = recent.get(ev, 0)
        if n == 0:
            status = "NEVER" if kind == "REQUIRED" else "none"
            if kind == "REQUIRED":
                never.append((ev, needed_for))
        elif kind == "REQUIRED" and active > 0 and rec == 0:
            # The signature of the ten-week outage: other events flowing, this one
            # dead. Absolute staleness would have called this healthy.
            status = "BROKEN"
            broken.append((ev, needed_for, last))
        else:
            status = "ok"
        signals.append({"event": ev, "what": what, "needed_for": needed_for,
                        "kind": kind, "n": n, "recent": rec, "last": last,
                        "status": status})

    not_built = [{"event": ev, "what": what, "needed_for": needed_for}
                 for ev, (what, needed_for) in NOT_BUILT.items()]

    # The headline. Not "did events arrive" but "can the manipulation check be made".
    cov = measures.coverage(db_path)
    det, pairs = cov["determinable"], cov["pairs"]
    pct = (100 * det / pairs) if pairs else 0
    manipulation = {
        "pairs": pairs, "determinable": det, "determinable_pct": round(pct, 1),
        "complied": cov["complied"], "no_activity": cov["no_activity"],
        "no_posttest": cov["no_posttest"], "took_escape": cov["took_escape"],
    }

    # ── effort: is a response a response at all ───────────────────────────
    eff = measures.effort_summary(db_path)
    rg = eff["verdicts"].get("rapid guess", 0)
    effort = {
        "submissions": eff["submissions"], "timed": eff["timed"], "untimed": eff["untimed"],
        "median_sec_per_item": eff["median_sec_per_item"],
        "fastest_sec_per_item": eff["fastest_sec_per_item"],
        "straight_lined": eff["straight_lined"], "rapid_guess": rg,
        "rapid_guess_rate": round(rg / eff["timed"], 3) if eff["timed"] else None,
        "verdicts": eff["verdicts"], "threshold_s_per_item": measures.THRESHOLD_S_PER_ITEM,
    }

    # ── the backup, which cannot report its own absence ───────────────────
    #
    # Every other check here asks "is the data right". This one asks "will the data
    # still exist tomorrow", and it is the only failure on the list that costs the
    # whole study rather than one variable. A scheduled task that stops firing looks
    # exactly like one that is working.
    hb_age = None
    try:
        import backup_sink
        hb = os.path.getmtime(backup_sink.HEARTBEAT)
        hb_age = (datetime.now(timezone.utc)
                  - datetime.fromtimestamp(hb, timezone.utc)).total_seconds() / 3600
    except (ImportError, OSError):
        hb_age = None
    backup = {"hours_since": round(hb_age, 1) if hb_age is not None else None}

    # Withdrawn participants whose rows are still in the sink (export now filters
    # them, but a --forget purge should still run so disk erasure actually happens).
    # COUNT ONLY — the SIDs used to look them up never leave this function.
    stuck = 0
    try:
        import auth_store, sqlite3 as _sq
        w = auth_store.withdrawn_sids()
        if w:
            conn = _sq.connect(db_path or DB)
            placeholders = ",".join("?" * len(w))
            stuck = conn.execute(
                f"SELECT COUNT(DISTINCT participant_id) FROM events WHERE participant_id IN ({placeholders})",
                tuple(w)).fetchone()[0]
            conn.close()
    except Exception:
        stuck = 0

    problems = []
    if hb_age is None:
        problems.append("no backup has ever completed -- the entire dataset is one sqlite "
                        "file with no copy. `python backup_sink.py --dest <other disk>`")
    elif hb_age > 26:
        problems.append(f"the last successful backup was {hb_age:.0f} hours ago; the hourly "
                        f"task has stopped and nothing else would have said so")

    if eff["timed"] and rg / max(eff["timed"], 1) > 0.5:
        problems.append(f"{rg} of {eff['timed']} timed check submissions look like rapid "
                        f"guessing (median {eff['median_sec_per_item']}s/item). Either the "
                        f"cohort is clicking through, or TEST TRAFFIC is in this sink -- "
                        f"e2e writes here unless RESEARCH_DB_PATH points elsewhere")
    if eff["untimed"]:
        problems.append(f"{eff['untimed']} check submission(s) carry no duration, so they "
                        f"cannot be screened for effort at all")
    for ev, needed in never:
        problems.append(f"{ev} has NEVER arrived -- {needed} cannot be computed")
    for ev, needed, last in broken:
        problems.append(f"{ev} stopped arriving (last {str(last)[:19]}) while "
                        f"{active} other events came in -- {needed} is losing data NOW")
    if pairs >= 10 and pct < 50:
        problems.append(f"the manipulation check is determinable for only {det} of {pairs} "
                        f"pairs ({pct:.0f}%) -- a FLIP/CONTROL comparison over this is "
                        f"uninterpretable")

    return {
        "window_days": WINDOW_DAYS,
        "active": active,
        "signals": signals,
        "not_built": not_built,
        "manipulation": manipulation,
        "effort": effort,
        "backup": backup,
        "withdrawals": {"stuck_in_sink": stuck},
        "problems": problems,
        "ok": not problems,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true", help="exit 1 on any broken signal")
    ap.add_argument("--db")
    args = ap.parse_args()

    s = summary(args.db)
    active, window = s["active"], s["window_days"]

    if not args.quiet:
        print(f"\nSink activity in the last {window} days: {active} event(s)\n")
        print(f"{'event':26} {'n':>6} {'recent':>7}  {'status':9} what it measures")
        print("-" * 96)
        for r in s["signals"]:
            print(f"{r['event']:26} {r['n']:>6} {r['recent']:>7}  {r['status']:9} "
                  f"{r['what']}  [{r['needed_for']}]")

        print(f"\n{'not built yet -- named so the gap is visible, not rediscovered':<60}")
        for r in s["not_built"]:
            print(f"{r['event']:26} {'-':>6} {'-':>7}  {'TODO':9} "
                  f"{r['what']}  [{r['needed_for']}]")

        m = s["manipulation"]
        print(f"\nManipulation check -- the number to watch")
        print(f"  participant x topic pairs with any event : {m['pairs']}")
        print(f"  played_first DETERMINABLE                : {m['determinable']}  "
              f"({m['determinable_pct']:.0f}%)")
        print(f"  complied with their assigned arm         : {m['complied']}")
        print(f"  undeterminable, activity never recorded  : {m['no_activity']}")
        print(f"  undeterminable, post-check not sat       : {m['no_posttest']}")
        print(f"  took the unit's logged escape            : {m['took_escape']}")

        eff = s["effort"]
        if eff["submissions"]:
            v = eff["verdicts"]
            print(f"\nEffort -- time set against accuracy, which a score alone cannot give you")
            print(f"  check submissions                        : {eff['submissions']}")
            print(f"  with timing                              : {eff['timed']}"
                  f"   (no timing: {eff['untimed']})")
            print(f"  median seconds per item                  : {eff['median_sec_per_item']}")
            print(f"  same option for every item               : {eff['straight_lined']}")
            for k in ("engaged", "struggling", "fast and correct", "rapid guess", "no timing"):
                if v.get(k):
                    print(f"    {k:38}: {v[k]}")
            print(f"  (threshold {eff['threshold_s_per_item']}s/item -- a DEFAULT. Set it from"
                  f" the cohort's own\n   distribution before analysis; the median above is the"
                  f" place to start.)")

        hb = s["backup"]["hours_since"]
        print(f"\nBackups")
        print(f"  last successful backup                   : "
              + ("never" if hb is None else f"{hb:.1f} hours ago"))

        stuck = s["withdrawals"]["stuck_in_sink"]
        if stuck:
            print(f"\nWithdrawals: {stuck} withdrawn participant(s) still have rows in the "
                  f"sink. The export excludes them, but run "
                  f"`python research_store.py --forget <SID> --yes` to erase from disk.")

    if s["problems"]:
        print("\nPROBLEMS")
        for p in s["problems"]:
            print(f"  - {p}")
        return 1
    if not args.quiet:
        print("\nPASS  every required signal is arriving.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
