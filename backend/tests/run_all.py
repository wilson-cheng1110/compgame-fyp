"""Run every backend suite. `python backend/tests/run_all.py`, exit 1 on any failure.

Stdlib + fastapi only -- deliberately no pytest. The RAG stack (chromadb,
langchain) is NOT installed on every box that needs to run these, and none of the
modules under test import it; adding a test dependency the app itself doesn't need
would make the tests the reason the suite can't run.
"""
import os, subprocess, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
SUITES = ["test_auth.py", "test_auth_api.py", "test_schedule.py",
          "test_checks.py", "test_topic_api.py", "test_research_api.py",
          "test_module_integrity.py", "test_grade.py"]

total = failures = 0
for suite in SUITES:
    p = subprocess.run([sys.executable, os.path.join(HERE, suite)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    line = ""
    for m in re.finditer(r"^(\d+) passed, (\d+) failed", p.stdout or "", re.M):
        line = m.group(0); total += int(m.group(1)); failures += int(m.group(2))
    status = "ok" if p.returncode == 0 else "FAIL"
    print(f"  {status:>4}  {suite:<22} {line}")
    if p.returncode != 0:
        failures = max(failures, 1)
        print((p.stdout or "")[-1500:]); print((p.stderr or "")[-800:])

print(f"\n{total} assertions, {failures} failure(s)")
sys.exit(1 if failures else 0)
