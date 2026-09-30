"""Reverse a consent withdrawal -- ONLY on the PI's explicit instruction.

Withdrawal (`auth_store.withdraw`) is the study-exit tombstone, and the teacher panel
deliberately has no un-withdraw button: reversing a participant's choice to leave is
a research-ethics decision, not a support action. When the PI does make that call
(HAN 24115097 on 2026-09-24, Huang Xin 24113538 on 2026-10-01) it used to be a
hand-typed UPDATE on the box with no audit row. This is that UPDATE, made
repeatable and audited:

    python reinstate_account.py 24113538                 # dry run: shows state, writes nothing
    python reinstate_account.py 24113538 --apply --note "PI-approved 2026-10-01"

Idempotent: an account that is not withdrawn is left alone and nothing is logged.
It does NOT reset the password -- do that from /admin afterwards (audited there),
and it cannot, because the teacher types the new one. Sessions stay killed; the
student signs in fresh. Their `consent_withdrawn` research event stays in the sink
as history; the exports filter on `users.withdrawn`, so their rows come back in.
Exit 1 if any SID is unknown, so update.ps1 fails loudly on a typo.
"""
import argparse
import sys

import auth_store


def reinstate(raw_sid: str, apply: bool, note: str | None) -> str:
    sid = auth_store._canon_sid(raw_sid)
    with auth_store._lock:
        conn = auth_store._connect()
        try:
            row = conn.execute("SELECT withdrawn FROM users WHERE sid = ?", (sid,)).fetchone()
            if row is None:
                return "unknown"
            if not row["withdrawn"]:
                return "not_withdrawn"
            if apply:
                conn.execute("UPDATE users SET withdrawn = 0 WHERE sid = ?", (sid,))
                conn.commit()
        finally:
            conn.close()
    if not apply:
        return "would_reinstate"
    auth_store.audit("ADMIN", "reinstate", sid, note or "PI-approved")
    return "reinstated"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("sids", nargs="+")
    ap.add_argument("--apply", action="store_true", help="write (default is a dry run)")
    ap.add_argument("--note", help="audit detail, e.g. 'PI-approved 2026-10-01'")
    a = ap.parse_args(argv)
    auth_store.init_db()
    bad = False
    for raw in a.sids:
        result = reinstate(raw, a.apply, a.note)
        bad |= result == "unknown"
        print(f"{auth_store._canon_sid(raw)}: {result}")
    if not a.apply:
        print("dry run -- nothing written. Re-run with --apply.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
