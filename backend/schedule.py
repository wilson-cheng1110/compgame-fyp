"""Release windows and FLIP/CONTROL assignment. See docs/revamp.md Parts 7 and 10.

This module is where the independent variable actually gets manipulated, so two
things matter more than anything else here:

1. **It is server-authoritative.** Topic availability and order IS the IV. A gate in
   localStorage or the client bundle is a suggestion, and the flip-learning claim
   rests on it not being bypassable.
2. **Assignment is deterministic and balanced**, not random per request -- a student
   who reloads must get the same arm, or the design silently breaks.

Stdlib only, like auth_store / research_store. Hot-reloads on mtime so the lecturer
can move a holiday-displaced session without a restart.

    python schedule.py --validate     # check config sanity, exit 1 on problems
    python schedule.py --preview      # print all windows x sections
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

CONFIG_PATH = os.environ.get("TOPIC_SCHEDULE_PATH",
                             os.path.join(os.path.dirname(__file__), "topic_schedule.json"))

FLIP = "FLIP"        # Understanding game BEFORE the post-check
CONTROL = "CONTROL"  # Understanding game AFTER the post-check

_config: dict | None = None
_config_mtime: float | None = None


def _load() -> dict:
    global _config, _config_mtime
    mtime = os.path.getmtime(CONFIG_PATH)
    if _config is None or mtime != _config_mtime:
        with open(CONFIG_PATH, encoding="utf-8") as fh:
            _config = json.load(fh)
        _config_mtime = mtime
    return _config


def _tz(cfg: dict) -> timezone:
    raw = cfg.get("timezone_offset", "+08:00")
    sign = 1 if raw[0] == "+" else -1
    hh, mm = int(raw[1:3]), int(raw[4:6])
    return timezone(sign * timedelta(hours=hh, minutes=mm))


# ── the independent variable ──────────────────────────────────────────────────

def arm_for(sid: str, topic_index: int) -> str:
    """FLIP or CONTROL for this student on this topic. Deterministic and balanced.

    Systematic alternation, NOT a coin flip per (student, topic):

        parity = hash(sid) & 1          # ~50/50 across the cohort
        arm    = FLIP if (parity + topic_index) % 2 == 0 else CONTROL

    Why this rather than hashing (sid, topic) directly:

      * WITHIN student -- arms alternate down the topic list, so every participant
        gets 7 of one condition and 6 of the other across 13 topics. A per-pair hash
        would leave some students with 10/3, which is wasted within-subject power.
      * BETWEEN students -- because parity splits the cohort ~50/50, each topic is
        seen in both conditions by ~half the class. That is what deconfounds topic
        difficulty from condition.
      * Topic x condition is fully crossed, which is the property the Latin square
        was there to buy (docs/revamp.md Part 18) -- it just extends to 13 topics,
        which a 2x2 Latin square does not.

    Deterministic from the SID alone, so it survives a reload, a new session, a
    different device, and a server restart, with nothing stored.
    """
    parity = int(hashlib.sha256(sid.strip().upper().encode()).hexdigest(), 16) & 1
    return FLIP if (parity + topic_index) % 2 == 0 else CONTROL


# ── windows ───────────────────────────────────────────────────────────────────

def _window_for(cfg: dict, topic: dict, section: str):
    """(opens, closes, session_start) for one topic in one section, or None if the
    session date is missing from config."""
    sess = cfg["sessions"].get(str(topic["session"]), {})
    day = sess.get(section)
    if not day:
        return None
    tz = _tz(cfg)
    start = datetime.fromisoformat(day).replace(
        hour=cfg.get("session_hour", 9), minute=0, tzinfo=tz)
    opens = (start - timedelta(days=cfg["window"]["opens_days_before"])).replace(
        hour=cfg.get("session_hour", 9), minute=0)
    closes = start - timedelta(hours=cfg["window"]["closes_hours_before"])
    return opens, closes, start


def sections() -> dict[str, dict]:
    """The section codes this cohort runs, with their lecture day.

    Exposed because signup now asks the student which section they are in -- with
    no class list that choice is the ONLY source of the release window, so the
    picker and the validator have to read the same config the windows do.
    """
    return dict(_load()["sections"])


def topic_states(sid: str, section: str, now: datetime | None = None) -> list[dict]:
    """Per-topic state for one student, in lecture-notes release order.

    States: `locked` (before opens) · `open` · `late` (past close, still enterable
    but every submission is flagged) · `unscheduled` (no date in config yet).

    `late` implements the Part 7.4 policy: locking students out of coursework
    generates email nobody has time for; silently including them contaminates the
    data. So let them in, flag the row, exclude from the primary gain.
    """
    cfg = _load()
    now = now or datetime.now(_tz(cfg))
    out = []

    for idx, topic in enumerate(cfg["topics"]):
        win = _window_for(cfg, topic, section)
        arm = arm_for(sid, idx)
        base = {
            "topic_id": topic["id"],
            "order": idx + 1,
            "session": topic["session"],
            "arm": arm,
            "plays_game_first": arm == FLIP,
            "lecture_terms": topic.get("lecture_terms", []),
            "session_provisional": topic.get("session_provisional", False),
        }
        if win is None:
            out.append({**base, "state": "unscheduled",
                        "opens": None, "closes": None, "late": False})
            continue

        opens, closes, _ = win
        if now < opens:
            state, late = "locked", False
        elif now <= closes:
            state, late = "open", False
        else:
            state, late = "late", True
        out.append({**base, "state": state, "late": late,
                    "opens": opens.isoformat(), "closes": closes.isoformat()})
    return out


def topic_state(sid: str, section: str, topic_id: str, now: datetime | None = None) -> dict | None:
    for st in topic_states(sid, section, now):
        if st["topic_id"] == topic_id:
            return st
    return None


def is_enterable(sid: str, section: str, topic_id: str, now: datetime | None = None) -> bool:
    """The server-side gate. `locked` and `unscheduled` mean no."""
    st = topic_state(sid, section, topic_id, now)
    return bool(st and st["state"] in ("open", "late"))


# ── validation ────────────────────────────────────────────────────────────────

def validate() -> list[str]:
    """Config problems, worst first. Empty list means the schedule is sane."""
    cfg = _load()
    problems: list[str] = []
    sections = list(cfg["sections"])

    seen = set()
    for topic in cfg["topics"]:
        if topic["id"] in seen:
            problems.append(f"duplicate topic id: {topic['id']}")
        seen.add(topic["id"])
        if str(topic["session"]) not in cfg["sessions"]:
            problems.append(f"{topic['id']}: session {topic['session']} has no date entry")

    for sess_no, by_section in cfg["sessions"].items():
        for sec in sections:
            if sec not in by_section:
                problems.append(f"session {sess_no}: no date for section {sec}")

    # The staggering invariant (docs/revamp.md Part 17). If a holiday displacement
    # collapses two sections onto the same close time, the evening load stops being
    # split three ways and triples -- silently.
    for topic in cfg["topics"]:
        closes = {}
        for sec in sections:
            win = _window_for(cfg, topic, sec)
            if win:
                closes.setdefault(win[1].isoformat(), []).append(sec)
        for when, secs in closes.items():
            if len(secs) > 1:
                problems.append(
                    f"{topic['id']}: sections {'+'.join(secs)} share a close time ({when}) "
                    f"-- sections no longer stagger, peak load multiplies")

    # A lecture date that lands on a public holiday. The comment above already
    # anticipates 'holiday displacement' -- this is what notices one. Without it
    # --validate reported the config 'sane' while section C's session 5 sat on
    # Thursday 1 Oct 2026, National Day: a lecture that does not happen, and a
    # release window derived from it.
    closed = cfg.get("no_class_dates", {})
    for sess_no, by_section in cfg["sessions"].items():
        for sec, day in by_section.items():
            entry = closed.get(day)
            if entry and not (isinstance(entry, dict) and entry.get("acknowledged")):
                why = entry.get("why") if isinstance(entry, dict) else entry
                problems.append(
                    f"session {sess_no}/{sec} is scheduled on {day}, which is not a "
                    f"teaching day: {why}")

    # A window that opens after it closes is a date-entry error, not a design choice.
    for topic in cfg["topics"]:
        for sec in sections:
            win = _window_for(cfg, topic, sec)
            if win and win[0] >= win[1]:
                problems.append(f"{topic['id']}/{sec}: opens ({win[0]}) is not before closes ({win[1]})")

    return problems


def _has_bank(topic_id: str) -> bool:
    """Ask the item bank, not the config.

    This column used to read a per-topic `mc_bank` flag out of the schedule JSON,
    which was a SECOND source of truth for a fact checks.py already owns. On
    2026-08-30 nine banks were authored and the flag was not updated, so this
    preview told a lecturer that stroop, hicks-law, fitts-law, visual-perception
    and mental-model had no questions when all five did. Nothing read the flag
    anywhere else, which is exactly when to delete it rather than fix it.
    """
    try:
        import checks
        return checks.has_bank(topic_id)
    except Exception:
        return False


def _preview() -> None:
    cfg = _load()
    print(f"{cfg['cohort']}  --  {len(cfg['topics'])} topics x {len(cfg['sections'])} sections\n")
    print(f"{'#':>2}  {'topic':<19}{'sess':>5}  {'section A closes':<26}{'bank':>5}")
    for idx, topic in enumerate(cfg["topics"]):
        win = _window_for(cfg, topic, "A")
        closes = win[1].strftime("%a %d %b %H:%M") if win else "-- unscheduled --"
        bank = "yes" if _has_bank(topic["id"]) else "no"
        print(f"{idx+1:>2}  {topic['id']:<19}{topic['session']:>5}  {closes:<26}{bank:>5}")

    print("\narm assignment sample (first 4 topics):")
    for sid in ("24012345D", "24067890X", "24099999Z"):
        arms = [arm_for(sid, i)[0] for i in range(len(cfg["topics"]))]
        print(f"  {sid}  {' '.join(arms)}   FLIP={arms.count('F')} CONTROL={arms.count('C')}")


if __name__ == "__main__":
    if "--validate" in sys.argv:
        found = validate()
        if found:
            print(f"FAIL  {len(found)} problem(s):")
            for p in found:
                print(f"  - {p}")
            sys.exit(1)
        print("PASS  schedule config is sane.")
    elif "--preview" in sys.argv:
        _preview()
    else:
        print(__doc__)
