"""Background, single-flight launcher for the OFFLINE blind short-answer grading pass.

This module is the ONLY new thing between the admin panel and grade_batch, and it is
deliberately thin. It adds NO grading logic: `start()` calls `grade_batch.run()`, the
same `collect -> grade.blind -> run_batch -> summarise -> write` path the
`python grade_batch.py` CLI runs. Blindness is structural and lives one layer down in
`grade.blind()`, which strips the FLIP/CONTROL arm and the participant id BEFORE any
prompt is built -- so a pass launched from the panel grades identically, and just as
blind, to one launched from a 3am shell. Only the invocation is new, never the
judgement.

Two properties this module owns, and nothing else:

  * OFF THE EVENT LOOP. The pass is heavy -- an LLM call per short answer. `start()`
    spawns a daemon thread and returns immediately, so the request that triggered it is
    never blocked and the cohort-facing server keeps serving.
  * SINGLE-FLIGHT. A second `start()` while one pass is in flight returns
    "already_running" and starts NOTHING. One grading pass writes into reports/grades at
    a time; two concurrent passes would race on that directory and waste the GPU. The
    check-and-set is done under a lock so two near-simultaneous triggers cannot both win.

It NEVER exposes a grade, an answer, a SID or an arm. `start()` returns only a coarse
verb ("started"/"already_running"); `status()` returns only a coarse state
(idle/running/done/error) plus timestamps and, on failure, the exception TYPE (never its
message, which could name a path or a row). The per-student report is written to disk by
grade_batch, exactly as the CLI writes it, and read only by the offline tooling that
already owns that boundary (the researcher panel reads the aggregate kappa.json, never
this).
"""

import threading
from datetime import datetime, timezone

import grade_batch

_lock = threading.Lock()
_running = False
_thread: threading.Thread | None = None
# Coarse status only. NEVER a grade, an answer, a SID or an arm.
_last: dict = {"state": "idle"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_running() -> bool:
    with _lock:
        return _running


def status() -> dict:
    """A copy of the coarse last-known state. Safe to return to a caller."""
    with _lock:
        return dict(_last)


def _run(topic: str | None, seed: str) -> None:
    global _running, _last
    started = _now()
    result = {"state": "error", "started_at": started, "finished_at": _now()}
    try:
        # grade_batch.run writes the per-student report to reports/grades itself; its
        # return value is a small, participant-free summary. We keep NONE of it here --
        # even that summary stays out of the exposed status, so status() cannot leak.
        grade_batch.run(topic=topic, seed=seed, dry=False)
        result = {"state": "done", "started_at": started, "finished_at": _now()}
    except Exception as e:
        # Only the exception TYPE. A message could carry a filesystem path or a value.
        result = {"state": "error", "started_at": started,
                  "finished_at": _now(), "error": type(e).__name__}
    finally:
        with _lock:
            _running = False
            _last = result


def start(topic: str | None = None, seed: str = "compgame") -> str:
    """Trigger one blind grading pass in the background.

    Returns "started" when this call launched a pass, or "already_running" when one was
    already in flight (single-flight -- nothing new is launched in that case). The heavy
    work runs in a daemon thread; this returns at once.
    """
    global _running, _thread, _last
    with _lock:
        if _running:
            return "already_running"
        _running = True
        _last = {"state": "running", "started_at": _now()}
        t = threading.Thread(target=_run, args=(topic, seed),
                             name="grade-batch-run", daemon=True)
        _thread = t
    # Start OUTSIDE the lock: the flag is already set, so a concurrent start() will see
    # "already_running" regardless of whether the thread has begun.
    t.start()
    return "started"


def join(timeout: float | None = None) -> None:
    """Wait for the current pass to finish. For tests and orderly shutdown only."""
    t = _thread
    if t is not None:
        t.join(timeout)
