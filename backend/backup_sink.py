"""Back up the study's databases. Run from a scheduled task, hourly.

stage2-deployment-plan.md §D5. Right now the entire dataset a paper depends on is
ONE sqlite file on a home PC with no copy anywhere. A failed disk, a bad shutdown
mid-write, or an accidental `git clean` and the study is gone with no way to
re-collect it — the students only sit each topic once.

Uses sqlite3's ONLINE BACKUP API rather than copying the file. A plain copy of a
database being written to can capture a torn page and produce a backup that only
fails when you finally need it. `conn.backup()` takes a consistent snapshot of a
live database, which is exactly the situation here.

    python backup_sink.py                 # write a timestamped snapshot, prune old
    python backup_sink.py --verify        # also open each snapshot and count rows
    python backup_sink.py --dest D:/bak   # somewhere that is NOT this disk

Scheduled task (run hourly, survives reboot):
    schtasks /create /tn COMPGameBackup /sc hourly /tr ^
      "python C:\\path\\to\\backend\\backup_sink.py --dest D:\\compgame-backups"
"""

import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))

# The two that cannot be reconstructed. The vector store is NOT here on purpose:
# it is rebuildable from the committed PDFs (`python rebuild_db.py`), so backing
# it up hourly would just burn disk.
SOURCES = {
    "research_events.db": os.environ.get("RESEARCH_DB_PATH", os.path.join(HERE, "research_events.db")),
    "auth_store.db": os.environ.get("AUTH_DB_PATH", os.path.join(HERE, "auth_store.db")),
}

# The HMAC secret is NOT copied here. It must be backed up, but by hand and
# somewhere separate — if it sits next to the pseudonymised data, the
# pseudonymisation is decorative (docs/revamp.md Part 13).
SECRET_REMINDER = os.path.join(HERE, ".participant_secret")


def snapshot(src: str, dest_dir: str, stamp: str) -> tuple[str, int] | None:
    if not os.path.exists(src):
        return None
    name = os.path.basename(src)
    out = os.path.join(dest_dir, f"{name}.{stamp}.bak")
    source = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    target = sqlite3.connect(out)
    try:
        source.backup(target)          # consistent snapshot of a live DB
        rows = 0
        for (t,) in target.execute("SELECT name FROM sqlite_master WHERE type='table'"):
            try:
                rows += target.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except sqlite3.Error:
                pass
        return out, rows
    finally:
        source.close()
        target.close()


def prune(dest_dir: str, keep: int) -> int:
    """Keep the newest `keep` snapshots per database."""
    removed = 0
    by_db: dict[str, list[str]] = {}
    for f in os.listdir(dest_dir):
        if f.endswith(".bak"):
            by_db.setdefault(f.split(".db.")[0], []).append(f)
    for _, files in by_db.items():
        for old in sorted(files, reverse=True)[keep:]:
            os.remove(os.path.join(dest_dir, old))
            removed += 1
    return removed


# Written on every successful run, read by check_measurement_coverage.py.
HEARTBEAT = os.environ.get(
    "BACKUP_HEARTBEAT",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), ".last-backup"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dest", default=os.environ.get("BACKUP_DIR", os.path.join(HERE, "..", "backups")))
    ap.add_argument("--keep", type=int, default=48)      # 48 hourly = 2 days
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args()

    dest = os.path.abspath(args.dest)
    os.makedirs(dest, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if os.path.abspath(dest).startswith(os.path.abspath(HERE)):
        print("[backup] WARNING: destination is inside backend/ — same disk, same "
              "directory as the thing it protects. Pass --dest to somewhere else.")

    total = 0
    for label, src in SOURCES.items():
        result = snapshot(src, dest, stamp)
        if result is None:
            print(f"[backup] skip  {label:<22} (not created yet)")
            continue
        out, rows = result
        size = os.path.getsize(out)
        total += 1
        print(f"[backup] ok    {label:<22} {rows:>6} rows  {size:>8} bytes -> {os.path.basename(out)}")
        if args.verify:
            c = sqlite3.connect(out)
            try:
                ok = c.execute("PRAGMA integrity_check").fetchone()[0]
                print(f"[backup]       integrity_check: {ok}")
            finally:
                c.close()

    pruned = prune(dest, args.keep)
    free = shutil.disk_usage(dest).free // (1024 * 1024)
    print(f"[backup] {total} snapshot(s) in {dest}; pruned {pruned}; {free} MB free")

    # HEARTBEAT. A backup that stops running is the definition of a silent failure:
    # nothing changes, nothing errors, and you find out on the day you need it. The
    # scheduled task cannot report its own absence, so success leaves a dated stamp
    # and check_measurement_coverage.py fails when the stamp goes stale.
    if total:
        try:
            with open(HEARTBEAT, "w", encoding="utf-8") as fh:
                fh.write(datetime.now(timezone.utc).isoformat())
        except OSError as e:
            print(f"[backup] WARNING could not write heartbeat {HEARTBEAT}: {e}")

    if os.path.exists(SECRET_REMINDER):
        print("[backup] NOTE: .participant_secret is deliberately NOT copied here. "
              "Back it up by hand, somewhere separate — stored beside the data it "
              "pseudonymises, it protects nothing.")
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
