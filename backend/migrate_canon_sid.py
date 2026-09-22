"""One-time, idempotent SID canonicalisation migration.

Companion to the `auth_store._canon_sid` fix (docs: the 2026-09-22 check-letter
bug). Case was ALREADY normalised everywhere (`.strip().upper()` at every
identity boundary) -- "12345678d" and "12345678D" already stored identically.
The actual live bug axis is letter PRESENCE vs ABSENCE: with no active roster
(self-enroll mode), `create_account` happily stores whatever shape the student
typed, so an account can legitimately sit in `users.sid` as `\\d{8}[A-Za-z]`
(check-letter kept) instead of the canonical 8-digit form every boundary now
produces via `_canon_sid`. **DO NOT ASSUME THIS IS A NO-OP.** This deployment
has run with the roster off (self-enroll, CLAUDE.md's Auth & data model
section) for its whole live rollout, which is exactly the condition under
which letter-suffixed rows get created -- treat "a large fraction of accounts
need this" as the working assumption for a live box, not "likely zero". Do
not trust a specific headcount relayed second-hand (including in a chat
message, a ticket, or this docstring) over the number this script's own dry
run reports against the REAL database -- that dry run, run directly against
the box being migrated, is the only authoritative count. This script finds
every matching row and folds it back onto its canonical key -- except where
that key is already taken (below).

**DEPLOY ORDERING -- READ BEFORE SHIPPING THE `_canon_sid` CODE.** Once the
fixed `auth_store.py` is live, EVERY identity lookup (`start_session`,
`create_account`'s existing-row check, `resolve_session` via `users.sid`,
`is_admin`/`is_researcher`) canonicalises the SID it was GIVEN before querying
-- but an un-migrated row's PRIMARY KEY still has the letter. A student typing
either form then looks up a row that does not exist under that key, which
`start_session` cannot distinguish from "no such account" (that indistinguish-
ability is deliberate, load-bearing, security behaviour elsewhere -- see its
docstring -- and it applies here too, which is exactly why this is dangerous:
it fails SILENT, as a login students will just report as broken). Concretely:
deploying the canon fix without migrating first LOCKS OUT every account still
sitting on a letter-suffixed sid, the instant the new code starts serving
requests. Run `migrate_canon_sid.py` (dry run, read it, THEN `--apply`) as
part of the SAME deploy step that ships the `_canon_sid` code -- before it
starts taking real traffic, not after the first login complaint.

NARROW, MATCHES `_canon_sid` EXACTLY: only `\\d{8}[A-Za-z]` is a candidate. A
pure-numeric account, "Admin", a test SID like "24E00001A" (the letter is not the
9th trailing character) are never touched -- they are not even inspected, because
they do not match the shape `_canon_sid` itself strips.

SAFE BY CONSTRUCTION:
  * DRY RUN BY DEFAULT. `--apply` is required to write anything. The dry run
    still opens both DBs read-only in effect (no write statement runs) so the
    reported plan is exactly what --apply would do.
  * IDEMPOTENT for every pair it actually writes. A second run finds nothing
    LEFT TO REMAP, because every migrated `users.sid` is now the canonical
    8-digit form and no longer matches `\\d{8}[A-Za-z]`. It is deliberately
    NOT idempotent-to-silence for a COLLIDING pair: those are reported again
    on every run until a human resolves them (see below) -- repetition here
    is the intended behaviour, not a bug.
  * REFUSES ON COLLISION rather than merging, and this is EXPECTED to fire,
    not a hypothetical, on a self-enroll deployment: the same student
    registering twice -- once with the check-letter, once without, e.g. on
    two different devices -- is a realistic way for BOTH `12345678D` and
    `12345678` to already exist as separate `users` rows with separate
    progress/events. When that happens the pair is reported as `colliding`
    and BOTH sides are left completely untouched -- never auto-merged,
    because there is no safe automatic answer to "which account's progress
    is the real one". A human (Wilson / the PI) has to look at the two
    accounts and decide. Same treatment if a rename would instead collide on
    the once-only unique index over `research_events` (e.g. both accounts
    already hold a `topic_pretest` row for the same topic): caught as a
    SQLite IntegrityError, rolled back for that one account only, reported as
    colliding, and every other candidate still proceeds.
  * ONE TRANSACTION PER ACCOUNT. `users`, `sessions`, `admin_audit`
    (admin_sid AND target_sid) in the auth DB, plus `research_events.events
    .participant_id` in the research DB (ATTACHed to the same connection so
    the rename is atomic across both files), all inside one SAVEPOINT. A
    failure on one candidate cannot half-migrate it and cannot touch the
    others.
  * AUDITED. Each successful migration writes its own `admin_audit` row
    (admin_sid="MIGRATION", action="sid_canon_migrate", target_sid=<new sid>,
    detail="from=<old sid>") in the SAME transaction as the rename, so the
    audit trail and the rename can never disagree about whether it happened.

READS `AUTH_DB_PATH` / `RESEARCH_DB_PATH` exactly like `auth_store.py` /
`research_store.py` (imported, not re-implemented, so there is one source of
truth for both the DB location and the canonicalisation rule itself).

KNOWN, DELIBERATELY OUT OF SCOPE (flagged, not fixed, here): `schedule.arm_for`
derives a participant's FLIP/CONTROL arm PURELY from `hash(sid)` with nothing
stored -- "deterministic from the SID alone... survives a reload... with
nothing stored" (schedule.py's own docstring). Migrating a participant's sid
changes that hash, so any topic NOT YET released to a migrated account would
compute a DIFFERENT arm after migration than it would have before. Topics
already released/recorded are unaffected in the sense that their arm is
whatever `arm_for` returns for a given (sid, topic_index) at read time -- but
that means a re-run of `measures.py` against OLD events (pre-migration
participant_id, still on disk until this script runs) vs NEW events
(post-migration) for the SAME already-completed topic could disagree on which
arm that topic was in, if `arm_for` is ever recomputed after migrating that
account. Check this is empty (it should be, per the grounding above) before
trusting `--apply` on the live box, and treat any non-empty --apply as a
reason to review `measures.py` output for the migrated SIDs' already-released
topics before analysis.

Usage:
    python backend/migrate_canon_sid.py             # dry run, report only
    python backend/migrate_canon_sid.py --apply      # actually migrate
"""

import argparse
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)  # so `python migrate_canon_sid.py` works from any CWD

import auth_store        # noqa: E402  (path insert must come first)
import research_store    # noqa: E402  -- lightweight: no chromadb/langchain import

AUTH_DB_PATH = auth_store.DB_PATH
RESEARCH_DB_PATH = research_store.DB_PATH

_LETTER_SID = re.compile(r"\d{8}[A-Za-z]")


def _find_candidates(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    """(old_sid, target_sid) for every `users.sid` matching the check-letter shape.

    Uses `auth_store._canon_sid` itself for the target -- not a re-implementation
    of the regex -- so this script can never drift from the rule it is migrating
    accounts onto.
    """
    rows = conn.execute("SELECT sid FROM users").fetchall()
    out = []
    for (sid,) in rows:
        sid = sid or ""
        if _LETTER_SID.fullmatch(sid):
            target = auth_store._canon_sid(sid)
            if target != sid:
                out.append((sid, target))
    return out


def run(apply: bool) -> dict:
    """Report (and, with apply=True, perform) the migration. Returns a summary
    dict rather than only printing, so tests can assert on it directly.

    Three buckets, not two -- a human operator reading the dry-run output must
    be able to tell "safe to auto-apply" from "needs a decision" at a glance:

      found       every users.sid matching \\d{8}[A-Za-z] -- the full candidate set.
      remappable  of those, the ones with NO existing account at the canonical
                  target. These are the ONLY ones --apply ever writes.
      colliding   of those, the ones where a SEPARATE account already sits at
                  the canonical target (the same person plausibly signed up
                  twice -- once with the check-letter, once without, e.g. on
                  two devices, during a roster-OFF window). NEVER auto-merged:
                  both the old and the target row are left completely
                  untouched, every run, until a human decides which one keeps
                  the progress. A colliding pair stays in `found` and in
                  `colliding` on every subsequent run -- that repetition is
                  the point, not a bug, until someone resolves it by hand.
    """
    summary = {"found": 0, "remappable": [], "colliding": [], "migrated": 0}

    if not os.path.exists(AUTH_DB_PATH):
        print(f"[migrate] no auth DB at {AUTH_DB_PATH} -- nothing to do.")
        return summary

    has_research = os.path.exists(RESEARCH_DB_PATH)
    if not has_research:
        print(f"[migrate] NOTE: no research DB at {RESEARCH_DB_PATH} -- "
              f"only users/sessions/admin_audit will be considered.")

    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        if has_research:
            conn.execute("ATTACH DATABASE ? AS research", (RESEARCH_DB_PATH,))

        candidates = _find_candidates(conn)
        summary["found"] = len(candidates)

        if not candidates:
            print(r"[migrate] 0 accounts match \d{8}[A-Za-z]. Nothing to do.")
            return summary

        print(f"[migrate] {len(candidates)} candidate account(s) found "
              f"({'APPLYING' if apply else 'DRY RUN -- pass --apply to migrate'}):")

        # PASS 1: classify every candidate BEFORE any write happens, against the
        # DB state as it stood when this run started -- so the dry-run report
        # and what --apply actually does can never disagree.
        remappable, colliding = [], []
        for old, target in candidates:
            existing = conn.execute("SELECT 1 FROM users WHERE sid = ?", (target,)).fetchone()
            if existing:
                print(f"    COLLIDING    {old} -> {target}  "
                      f"(a SEPARATE users row for {target} already exists -- "
                      f"left UNTOUCHED on both sides; needs a human decision)")
                colliding.append((old, target))
            else:
                print(f"    REMAPPABLE   {old} -> {target}"
                      f"{'' if apply else '  (would migrate)'}")
                remappable.append((old, target))
        summary["colliding"] = colliding

        # PASS 2: only ever touches the `remappable` bucket. `colliding` pairs
        # are never written to, in dry-run OR --apply.
        for old, target in remappable:
            if not apply:
                continue
            try:
                conn.execute("SAVEPOINT sid_migrate")
                conn.execute("UPDATE users SET sid = ? WHERE sid = ?", (target, old))
                conn.execute("UPDATE sessions SET sid = ? WHERE sid = ?", (target, old))
                conn.execute("UPDATE admin_audit SET admin_sid = ? WHERE admin_sid = ?", (target, old))
                conn.execute("UPDATE admin_audit SET target_sid = ? WHERE target_sid = ?", (target, old))
                if has_research:
                    conn.execute(
                        "UPDATE research.events SET participant_id = ? WHERE participant_id = ?",
                        (target, old),
                    )
                conn.execute(
                    "INSERT INTO admin_audit (at, admin_sid, action, target_sid, detail)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (datetime.now(timezone.utc).isoformat(), "MIGRATION", "sid_canon_migrate",
                     target, f"from={old}"),
                )
                conn.execute("RELEASE sid_migrate")
                print(f"    MIGRATED     {old} -> {target}")
                summary["migrated"] += 1
            except sqlite3.IntegrityError as exc:
                # A collision the upfront `users` check could not see (e.g. the
                # once-only research_events index) -- rolled back for THIS pair
                # only, reclassified as colliding, everything else proceeds.
                conn.execute("ROLLBACK TO sid_migrate")
                conn.execute("RELEASE sid_migrate")
                print(f"    COLLIDING    {old} -> {target}  "
                      f"(integrity error migrating dependent rows: {exc} -- "
                      f"rolled back, left UNTOUCHED)")
                colliding.append((old, target))
                summary["colliding"] = colliding

        if apply:
            conn.commit()

        summary["remappable"] = remappable
        n_remap, n_collide, n_mig = len(remappable), len(colliding), summary["migrated"]
        print(f"\n[migrate] SUMMARY: found={summary['found']}  remappable={n_remap}  "
              f"colliding={n_collide}  migrated={n_mig}"
              f"{'  (DRY RUN -- nothing written)' if not apply else ''}")
        if colliding:
            print("[migrate] COLLIDING pairs are untouched on BOTH sides and need a human decision "
                  "(which account keeps the progress) -- they are not auto-merged, ever:")
            for old, target in colliding:
                print(f"             {old}  <->  {target}")
        if not apply and n_remap:
            print("[migrate] DRY RUN -- no changes were written. Re-run with --apply to migrate "
                  "the REMAPPABLE pairs only.")
        return summary
    finally:
        try:
            if has_research:
                conn.execute("DETACH DATABASE research")
        except sqlite3.Error:
            pass
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true",
                        help="actually mutate the DBs (default: dry run, report only)")
    args = parser.parse_args()
    run(args.apply)
    sys.exit(0)
