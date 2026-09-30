"""reinstate_account.py: dry run writes nothing, --apply un-withdraws + audits once,
idempotent, unknown SID exits 1, a check-lettered SID resolves to its canonical row."""
import os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_reinstatetest")
os.makedirs(d, exist_ok=True)
AUTH_DB = os.path.join(d, "auth.db")
if os.path.exists(AUTH_DB):
    os.remove(AUTH_DB)
os.environ["AUTH_DB_PATH"] = AUTH_DB
os.environ["ENROLMENT_PATH"] = os.path.join(d, "enrolled.txt")   # absent -- roster OFF
os.environ["PARTICIPANT_SECRET_PATH"] = os.path.join(d, ".secret")
os.environ["ADMIN_PATH"] = os.path.join(d, "admin.txt")
os.environ["RESEARCHER_PATH"] = os.path.join(d, "researcher.txt")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import auth_store as A
import reinstate_account as R

A.init_db()

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1; print(f"  ok   {label}")
    else:
        fail += 1; print(f"  FAIL {label} {extra}")

def withdrawn(sid):
    return {r["sid"]: r["withdrawn"] for r in A.list_participants()}[sid]

def reinstates(sid):
    return [e for e in A.audit_log() if e["action"] == "reinstate" and e["target_sid"] == sid]

ok_, _ = A.create_account("24113538", "pw-long-enough-1", section="A")
check("setup: account created", ok_)
A.withdraw("24113538")
check("setup: withdrawn", withdrawn("24113538") == 1)

check("dry run exits 0", R.main(["24113538D"]) == 0)
check("dry run writes nothing", withdrawn("24113538") == 1 and not reinstates("24113538"))

check("apply (letter form) exits 0", R.main(["24113538D", "--apply", "--note", "PI ok"]) == 0)
check("apply un-withdraws the canonical row", withdrawn("24113538") == 0)
a = reinstates("24113538")
check("apply audits once with the note", len(a) == 1 and a[0]["detail"] == "PI ok", a)

check("re-apply exits 0", R.main(["24113538", "--apply"]) == 0)
check("re-apply is a no-op (no second audit row)", len(reinstates("24113538")) == 1)

check("unknown SID exits 1", R.main(["99999999", "--apply"]) == 1)
check("admin can reset the password once reinstated",
      A.set_password("24113538", "another-long-pw-2")[0])

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
