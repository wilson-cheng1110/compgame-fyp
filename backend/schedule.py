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


# ---------------------------------------------------------------------------
# Editing a lecture date, from the teacher panel.
#
# Until now the ONLY way to move a lecture was to hand-edit topic_schedule.json on
# the box and restart nothing (the loader re-reads on mtime). That is fine for the
# person who wrote the file and untenable for a course team in November: section C's
# session 5 already falls on National Day, and the fix for that has been a to-do
# item rather than a two-click change.
#
# ONE FIELD IS EDITABLE AND NO OTHERS: sessions[<n>][<section>], the date of one
# lecture for one section. Every window in the study derives from it -- the config's
# own comment says "holiday displacements are edited HERE and nowhere else" -- so
# exposing this one date exposes the whole capability without exposing the
# derivation. opens_days_before, the topic->session mapping and the section days
# stay in the file, where changing them is a design decision and not an operational
# one.
#
# THIS MUTATES THE INDEPENDENT VARIABLE'S TIMING, which is why it returns a preview
# instead of just doing it. Moving a date FORWARD can put a currently-open topic
# back behind a lock, i.e. take away something a student is halfway through; moving
# it BACKWARD only ever makes topics late, and late is still enterable by design.
# The caller gets both the state delta and any new validation problems, and decides.


def _atomic_write(cfg: dict) -> None:
    """Write the config so a crash mid-write cannot leave it unparseable.

    A half-written topic_schedule.json is not a degraded study, it is a stopped one:
    every route that asks for a topic state raises and every student sees an error.
    Write beside it, fsync, then rename -- rename is atomic on both NTFS and POSIX.
    """
    tmp = CONFIG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=1, ensure_ascii=False)
        fh.write(chr(10))
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, CONFIG_PATH)


def session_grid() -> dict:
    """The editable surface: every session, its date per section, and its topics."""
    cfg = _load()
    by_session: dict[str, list[str]] = {}
    for t in cfg["topics"]:
        by_session.setdefault(str(t["session"]), []).append(t["id"])
    return {
        "sections": cfg.get("sections", {}),
        "sessions": [
            {"session": int(n), "dates": dict(d), "topics": by_session.get(n, [])}
            for n, d in sorted(cfg["sessions"].items(), key=lambda kv: int(kv[0]))
        ],
        "problems": validate(),
    }


def set_session_date(session: int, section: str, date: str, *, commit: bool) -> dict:
    """Preview (commit=False) or apply (commit=True) a lecture-date change.

    Returns {ok, old, new, problems, added_problems, affected} -- never raises for
    bad input, because this is called straight off an HTTP body.
    """
    cfg = _load()
    key = str(session)
    if key not in cfg["sessions"]:
        return {"ok": False, "reason": "no_such_session"}
    if section not in cfg.get("sections", {}):
        return {"ok": False, "reason": "no_such_section"}
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return {"ok": False, "reason": "bad_date"}

    old = cfg["sessions"][key].get(section)
    if old == date:
        return {"ok": False, "reason": "unchanged"}

    before = set(validate())

    # A DECLARED NO-CLASS DAY IS NEVER A VALID TARGET, even an acknowledged one.
    # validate() skips acknowledged holidays, and correctly: all four in the config
    # are acknowledged, three because no section has class that weekday anyway and
    # the fourth (National Day) because Wilson accepted the collision in writing on
    # 2026-08-27. But that acknowledgement was granted for the arrangement that
    # EXISTS. It is not a licence to move a lecture onto the date later, which is a
    # new decision and has to be made deliberately. So this is checked here, on the
    # edit, rather than by loosening validate() for everyone.
    holiday = (cfg.get("no_class_dates") or {}).get(date)
    edit_problems = set()
    if holiday:
        why = holiday.get("why") if isinstance(holiday, dict) else holiday
        edit_problems.add(
            f"{date} is not a teaching day: {why}")

    # Deep-enough copy: only the one dict we touch has to be independent, and
    # rebinding the module cache to the trial config is what lets validate() and
    # topic_states() read it without a second code path.
    trial = dict(cfg)
    trial["sessions"] = {k: dict(v) for k, v in cfg["sessions"].items()}
    trial["sessions"][key][section] = date

    global _config, _config_mtime
    saved_cfg, saved_mtime = _config, _config_mtime
    try:
        _config, _config_mtime = trial, _config_mtime
        after = set(validate())
        # Which topics change state for a student in this section, right now. This
        # is the sentence the teacher actually needs: "two topics that are open
        # today would be locked again."
        was = {t["topic_id"]: t["state"] for t in topic_states("PREVIEW", section)}
        _config, _config_mtime = saved_cfg, saved_mtime
        now_ = {t["topic_id"]: t["state"] for t in topic_states("PREVIEW", section)}
        _config, _config_mtime = trial, _config_mtime
        affected = [
            {"topic_id": k, "from": now_[k], "to": was[k]}
            for k in was if was[k] != now_.get(k)
        ]
    finally:
        _config, _config_mtime = saved_cfg, saved_mtime

    result = {
        "ok": True,
        "old": old,
        "new": date,
        "problems": sorted(after),
        "added_problems": sorted((after - before) | edit_problems),
        "affected": affected,
        "committed": False,
    }
    if not commit:
        return result

    # Refuse to write a change that INTRODUCES a validation problem. Pre-existing
    # ones (National Day) must not block the very edit that fixes them, so the test
    # is "worse than before", not "clean".
    if (after - before) or edit_problems:
        return {**result, "ok": False, "reason": "would_add_problems"}

    cfg["sessions"][key][section] = date
    _atomic_write(cfg)
    _config = None          # force a re-read; mtime alone can tie within a second
    _config_mtime = None
    return {**result, "committed": True}


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
