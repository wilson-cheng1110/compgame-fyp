"""Generate the tutorial decks that are DUE, so a fresh one is waiting for the
teacher before every class without anyone remembering to click Generate.

    python make_tutorial_decks.py                 # generate whatever's due now
    python make_tutorial_decks.py --dry-run       # list what it WOULD generate
    python make_tutorial_decks.py --now 2026-10-06 --dry-run   # test a class day

WHAT "DUE" MEANS. A topic's tutorial for a section happens at that section's lecture
datetime (schedule._window_for(...)[2]). The online module CLOSES 48 h before it, so
the data the deck needs is complete well ahead of class. This picks every (topic,
section) whose lecture starts inside [now - grace, now + horizon] and builds its deck.

Run early each morning from a Scheduled Task (deploy/install-services.ps1 registers
COMPGame-Decks). With horizon 30 h a 5 a.m. run makes today's 9 a.m. classes AND
tomorrow morning's, so the deck is on the /admin page the night before.

Always exits 0: a scheduled task that returns non-zero gets retried, and "no classes
today" is not a failure. Skips a topic with no data yet rather than writing an empty
deck. --llm adds the short-answer themes slide (needs Ollama); the deck's teaching is
authored, so it is complete without it.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta

import schedule
import generate_tutorial_deck as deck

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def due(now: datetime, horizon_hours: float, grace_hours: float) -> list[tuple]:
    """(topic_id, section, lecture_start) for every lecture inside the window."""
    cfg = schedule._load()
    lo, hi = now - timedelta(hours=grace_hours), now + timedelta(hours=horizon_hours)
    items = []
    for topic in cfg.get("topics", []):
        for sec in cfg.get("sections", {}):
            win = schedule._window_for(cfg, topic, sec)
            if win and lo <= win[2] <= hi:
                items.append((topic["id"], sec, win[2]))
    items.sort(key=lambda x: x[2])
    return items


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--horizon-hours", type=float, default=30.0)
    ap.add_argument("--grace-hours", type=float, default=3.0)
    ap.add_argument("--now", help="ISO date/time to treat as now (testing)")
    ap.add_argument("--llm", action="store_true", help="add a themes slide (needs Ollama)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cohort", default=os.environ.get("COHORT", "COMP3423"))
    a = ap.parse_args()

    tz = schedule._tz(schedule._load())
    now = (datetime.fromisoformat(a.now).replace(tzinfo=tz) if a.now
           else datetime.now(tz))

    items = due(now, a.horizon_hours, a.grace_hours)
    print(f"{now.isoformat()}  {len(items)} lecture(s) in "
          f"[-{a.grace_hours:g}h, +{a.horizon_hours:g}h]")

    made = skipped = 0
    for topic, sec, start in items:
        if a.dry_run:
            print(f"  would build {topic} / {sec}  (class {start.isoformat()})")
            continue
        res = deck.generate(topic, sec, a.cohort, a.llm)
        if res["ok"]:
            made += 1
            extra = f"  (themes fell back: {res['llm_error']})" if res.get("llm_error") else ""
            print(f"  [ok]   {topic}/{sec} -> {res['path']}{extra}")
        else:
            skipped += 1
            print(f"  [skip] {topic}/{sec}: {res['reason']}")

    if not a.dry_run:
        print(f"done: {made} generated, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
