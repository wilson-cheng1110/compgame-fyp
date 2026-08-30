"""Operations layer: concurrency gate, rate limiting, health.

Implements stage2-deployment-plan.md Loop A (§A3, §A4) and the parts of Loop C
that live in the process. Stdlib + fastapi only -- no slowapi, no redis. At 300
students on one box, in-memory state is correct: there is exactly one process, and
anything that outlives a restart belongs in sqlite, not here.

WHY A GATE AND NOT JUST "MORE WORKERS": the 3090 can serve ~4 concurrent Ollama
requests (OLLAMA_NUM_PARALLEL). Beyond that, extra concurrency doesn't add
throughput -- it adds queueing inside Ollama where we can't see it, and every
student's request slows down together. Bounding it here means the wait is
*visible* and refusals are *honest*, which is the whole point of §A3: a saturated
evening currently presents as a hung page, and a hung page generates email.
"""

import asyncio
import os
import sqlite3
import time
from collections import deque

# Matches the Ollama setting. Keep these two numbers in sync or the gate is
# either pointless (too high) or wastes the GPU (too low).
MAX_CONCURRENT = int(os.environ.get("OLLAMA_NUM_PARALLEL", "4"))
# Past this many WAITING requests we refuse rather than enqueue. A queue with no
# bound is just a slower way to time out, and a student who is told "try again in
# a minute" is better served than one watching a spinner for four.
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "40"))
# Rough per-request cost used only for the honest wait estimate shown to students.
EST_SECONDS_PER_CALL = float(os.environ.get("EST_SECONDS_PER_CALL", "12"))

_sem: asyncio.Semaphore | None = None
_waiting = 0
_served = 0
_refused = 0
_latencies: deque[float] = deque(maxlen=200)


def _semaphore() -> asyncio.Semaphore:
    # Created lazily: a Semaphore binds to the running loop, and at import time
    # under uvicorn there isn't one yet.
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(MAX_CONCURRENT)
    return _sem


class Saturated(Exception):
    """Raised instead of enqueuing when the queue is already at MAX_QUEUE."""

    def __init__(self, waiting: int, est_wait_s: int):
        self.waiting = waiting
        self.est_wait_s = est_wait_s
        super().__init__(f"queue full ({waiting} waiting, ~{est_wait_s}s)")


def estimated_wait_seconds() -> int:
    """Honest estimate for the UI: how long a request arriving now would wait."""
    ahead = _waiting
    per_slot = (sum(_latencies) / len(_latencies)) if _latencies else EST_SECONDS_PER_CALL
    return int((ahead / max(MAX_CONCURRENT, 1)) * per_slot)


class gpu_slot:
    """`async with gpu_slot():` around every Ollama call.

    Refuses immediately when saturated rather than joining an unbounded queue.
    """

    async def __aenter__(self):
        global _waiting, _refused
        if _waiting >= MAX_QUEUE:
            _refused += 1
            raise Saturated(_waiting, estimated_wait_seconds())
        _waiting += 1
        self._t0 = time.monotonic()
        try:
            await _semaphore().acquire()
        finally:
            _waiting -= 1
        self._start = time.monotonic()
        return self

    async def __aexit__(self, *exc):
        global _served
        _served += 1
        _latencies.append(time.monotonic() - self._start)
        _semaphore().release()
        return False


async def run_gated(fn, *args, **kwargs):
    """Run a BLOCKING call under the concurrency gate, off the event loop.

    Two bugs in one helper (stage2-deployment-plan.md §A2, §A3):

    * LangChain's `.invoke()` is synchronous. Called directly from an async
      handler it blocks the whole event loop for the duration -- so one student's
      12-second tutor reply stalls every other request on the server, including
      cheap ones like /api/topics. §A2 calls this "the biggest load bug", and
      `asyncio.to_thread` is the fix.
    * Unbounded concurrency past OLLAMA_NUM_PARALLEL just moves the queue inside
      Ollama where it can't be measured or reported. The semaphore keeps it here.

    Raises `Saturated` (never blocks forever) when the queue is already full.
    """
    async with gpu_slot():
        return await asyncio.to_thread(fn, *args, **kwargs)


# ── heavy admin jobs (report generation) ──────────────────────────────────────
# A DIFFERENT bound from the GPU slot. `/api/admin/reports/generate` shells out to a
# generator that runs up to 120 s and occupies a shared threadpool worker the whole
# time (finding S3). It is NOT Ollama work, so it must not consume the tutor's
# concurrency (gpu_slot) -- but left completely unbounded on the default executor, a
# burst of admin clicks could tie up the pool that sign-in (scrypt), record_event and
# the now-threaded session reads all share, stalling the cohort for minutes. So it
# gets its own tiny semaphore: at most ONE report subprocess at a time, off the loop.
# NOTE what this does and does not do: it bounds how many report jobs run CONCURRENTLY
# (default 1) — it does NOT reserve a dedicated thread, so the single running report
# still occupies one worker of the shared default executor for up to 120 s. That
# footprint (one worker, not a growing pile) is the acceptable part; the unbounded part
# it removes is many reports stacking. The per-admin rate limit stops one teacher
# self-stacking; across the ~3-teacher roster a short serial queue can still form,
# which is fine for an admin action (it is not a cohort-facing path).
_report_sem: asyncio.Semaphore | None = None
REPORT_MAX_CONCURRENT = int(os.environ.get("REPORT_MAX_CONCURRENT", "1"))


def _report_semaphore() -> asyncio.Semaphore:
    global _report_sem
    if _report_sem is None:
        _report_sem = asyncio.Semaphore(REPORT_MAX_CONCURRENT)
    return _report_sem


async def run_report_job(fn, *args, **kwargs):
    """Run one heavy admin subprocess job off the event loop AND bounded (see above)."""
    async with _report_semaphore():
        return await asyncio.to_thread(fn, *args, **kwargs)


def queue_stats() -> dict:
    return {
        "max_concurrent": MAX_CONCURRENT,
        "max_queue": MAX_QUEUE,
        "waiting": _waiting,
        "served": _served,
        "refused": _refused,
        "p50_seconds": round(sorted(_latencies)[len(_latencies) // 2], 1) if _latencies else None,
        "estimated_wait_seconds": estimated_wait_seconds(),
    }


# ── rate limiting ─────────────────────────────────────────────────────────────
# Not a security control -- there is no credential to protect (docs/revamp.md
# Part 0). It exists so one stuck client in a retry loop cannot starve a cohort.

# SINGLE-WORKER ASSUMPTION (finding C4). `_buckets` is one in-process dict, so the
# whole rate limiter is correct ONLY while there is exactly one uvicorn worker --
# which deploy/start.ps1 guarantees (it launches uvicorn with NO --workers flag, i.e.
# one process). Under `--workers N` each process would get its OWN `_buckets`, so a
# key's real ceiling silently becomes N× the configured number and the limiter no
# longer bounds what it claims to. If this ever needs multiple workers, the buckets
# have to move to a shared store (sqlite/redis); do not just add --workers. Same note
# applies to the queue counters above -- they are per-process too.
_buckets: dict[str, tuple[float, float]] = {}   # key -> (tokens, last_refill)
# THREAD-SAFE. The read-modify-write below is not atomic, and since record_event and
# the auth hashes now run in a threadpool (asyncio.to_thread), many requests hit
# allow() on real OS threads at once. Unlocked, 30 concurrent callers all read the
# same token count and each write count-1, so ~29 decrements are LOST and the bucket
# barely moves — the limiter silently does nothing under exactly the concurrent load
# it exists to bound (found while testing the /signup limit, 2026-08-30). One lock
# around the tiny critical section fixes it; the arithmetic is microseconds.
import threading
_bucket_lock = threading.Lock()


def allow(key: str, per_minute: int = 30, burst: int = 10) -> bool:
    """Token bucket. Returns False when the caller should back off."""
    now = time.monotonic()
    with _bucket_lock:
        tokens, last = _buckets.get(key, (float(burst), now))
        tokens = min(burst, tokens + (now - last) * (per_minute / 60.0))
        if tokens < 1.0:
            _buckets[key] = (tokens, now)
            return False
        _buckets[key] = (tokens - 1.0, now)
        return True


def forget_old(max_keys: int = 5000) -> None:
    """Keep the bucket table from growing without bound on a long-running box."""
    if len(_buckets) > max_keys:
        cutoff = time.monotonic() - 3600
        for k in [k for k, (_, last) in _buckets.items() if last < cutoff]:
            _buckets.pop(k, None)


# ── health ────────────────────────────────────────────────────────────────────

def _sqlite_ok(path: str, table: str) -> dict:
    if not os.path.exists(path):
        return {"ok": False, "detail": "missing"}
    try:
        conn = sqlite3.connect(path)
        # WAIT, don't false-alarm. This opens its OWN connection (not via the stores'
        # _connect), so without this PRAGMA it has busy_timeout=0 and a momentary
        # collision with an in-flight write (record_event_status / create_account,
        # now on threadpool workers) raises "database is locked" instantly — which the
        # broad except below turns into {"ok": False} and flips /api/health to "down".
        # That endpoint feeds the deploy watchdog / dead-man's-switch, so a transient
        # write contention would fire a false outage alarm. Wait for the lock instead.
        conn.execute("PRAGMA busy_timeout = 5000")
        try:
            # A REAL READ, not SELECT 1. The chaos sweep corrupted the DB file and
            # deleted it outright, and in BOTH cases this reported "ok": SELECT 1
            # touches no table and no page, so a monitor polling /api/health would
            # never notice that the irreplaceable study data had gone bad — the exact
            # failure the health check exists to catch. `PRAGMA quick_check` reads the
            # b-tree structure (far cheaper than a full integrity_check, still a real
            # read of the actual pages), and a count of a KNOWN table confirms the
            # schema is present — a freshly-recreated 0-byte file has no such table.
            # `table` is a hardcoded caller constant, never user input.
            qc = conn.execute("PRAGMA quick_check(1)").fetchone()
            if not qc or qc[0] != "ok":
                return {"ok": False, "detail": "quick_check_failed",
                        "size_bytes": os.path.getsize(path)}
            conn.execute(f"SELECT count(*) FROM {table}").fetchone()
            return {"ok": True, "size_bytes": os.path.getsize(path)}
        finally:
            conn.close()
    except Exception as e:
        # Includes "no such table" (deleted/recreated DB) and
        # "database disk image is malformed" (corruption) — both now surface as
        # unhealthy instead of lying "ok".
        return {"ok": False, "detail": type(e).__name__,
                "size_bytes": os.path.getsize(path) if os.path.exists(path) else 0}


def health_snapshot(rag_loaded: bool) -> dict:
    """Cheap enough to poll every 30s from an uptime monitor.

    Deliberately carries NO participant identifiers -- this endpoint is
    unauthenticated so it can be probed from outside.
    """
    here = os.path.dirname(__file__)
    sink = _sqlite_ok(os.environ.get("RESEARCH_DB_PATH", os.path.join(here, "research_events.db")), "events")
    accounts = _sqlite_ok(os.environ.get("AUTH_DB_PATH", os.path.join(here, "auth_store.db")), "users")

    # IS THIS A THROWAWAY SINK OR THE REAL ONE?
    #
    # `node e2e/run.mjs` signs up students, sits checks and submits probes. Against a
    # backend on the default paths it writes all of that into the SAME
    # research_events.db the paper will be written from, and nothing says so. The
    # effort screen on this box currently reads a median of 0.4 s per item and 75
    # straight-lined submissions; that is the test suite, not a cohort.
    #
    # A boolean here lets the suite refuse to run against a real sink instead of
    # quietly polluting it. No path is exposed -- this endpoint is unauthenticated
    # and a filesystem layout is not something it should hand out.
    default_sink = os.path.join(here, "research_events.db")
    is_default = os.path.abspath(
        os.environ.get("RESEARCH_DB_PATH", default_sink)) == os.path.abspath(default_sink)
    sink = {**sink, "is_default_path": is_default}

    components = {
        "research_sink": sink,
        "accounts": accounts,
        "rag_model": {"ok": rag_loaded,
                      "detail": None if rag_loaded else "not loaded (tutor disabled)"},
    }

    try:
        import schedule
        problems = schedule.validate()
        components["schedule"] = {"ok": not problems, "problems": problems[:3]}
    except Exception as e:
        components["schedule"] = {"ok": False, "detail": type(e).__name__}

    try:
        import auth_store
        n = len(auth_store._enrolment) if auth_store._enrolment else 0
        auth_store._refresh_enrolment()
        n = len(auth_store._enrolment)
        components["enrolment"] = {"ok": n > 0, "enrolled": n}
    except Exception as e:
        components["enrolment"] = {"ok": False, "detail": type(e).__name__}

    # The sink and accounts are what make the study recoverable; the tutor is a
    # feature. Losing the tutor is "degraded", losing the sink is "down".
    critical_ok = sink["ok"] and accounts["ok"]
    all_ok = critical_ok and all(c.get("ok") for c in components.values())

    return {
        "status": "ok" if all_ok else ("degraded" if critical_ok else "down"),
        "components": components,
        "queue": queue_stats(),
    }
