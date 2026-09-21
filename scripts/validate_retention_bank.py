"""Standalone structural validator for docs/retention-item-banks.md (Form C, retention).

Does NOT touch backend/checks.py, docs/quiz-item-banks.md, or topic_schedule.json, and does not
wire Form C into any live route. It only *reads* backend/checks.py to reuse its already-trusted
`_parse_options` (so option-parsing logic isn't duplicated/drifted) and its `_TOPIC_RE` /
`_SHARED_OPTS_RE` patterns (topic headers and Gestalt's shared-option-list layout are identical
between quiz-item-banks.md and retention-item-banks.md by construction).

`_ITEM_RE` / `_FORM_RE` / `_ITEM_SHARED_RE` in checks.py hard-code the `[AB]` letter class, so
they cannot match "C1", "C2", ... -- this script defines its own Form-C equivalents rather than
editing checks.py (that edit is deliberately left for whoever wires Form C in later).

Checks, per topic that has an A/B bank in quiz-item-banks.md:
  1. The topic has a Form C block in retention-item-banks.md.
  2. Exactly 6 Form C items.
  3. Each item has exactly one option marked correct (via checks._parse_options, which raises on
     zero or more-than-one ✓).
  4. Each item's option count matches that topic's A/B option count (4, or 5 for Gestalt).
  5. The *Answer key C: ...* line lists exactly 6 entries and agrees with the ✓ marks actually
     found (mirrors the cross-check checks.py's own _load() does for Forms A/B).
  6. No extra/unknown topic ids appear in retention-item-banks.md that aren't in the A/B bank.

Usage: python scripts/validate_retention_bank.py
Exit code 0 = all checks passed, 1 = at least one failure.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_BACKEND = os.path.join(_ROOT, "backend")
sys.path.insert(0, _BACKEND)
import checks as C  # noqa: E402  (backend/checks.py -- the live pre/post-check parser)

RETENTION_PATH = os.path.join(_ROOT, "docs", "retention-item-banks.md")

# Form-C equivalents of checks.py's Form-A/B-only regexes. Same shape, letter class widened to C.
_FORM_C_RE = re.compile(r"^###\s+Form\s+C\b", re.M)
_ITEM_C_RE = re.compile(
    r"^\*\*(C\d+)\.\*\*\s*(.+?)\n\s*([a-e]\).+?)(?=\n\s*\n|\n\*\*|\n\*Answer|\Z)",
    re.M | re.S,
)
_ITEM_SHARED_C_RE = re.compile(r"^\*\*(C\d+)\.\*\*\s*(.+?)\s*→\s*✓\s*\*\*([a-e])\)", re.M)
_ANSWER_KEY_C_RE = re.compile(r"\*Answer key C:([^*]+)\*")

ok = fail = 0


def check(label, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}  {extra}")


def parse_retention_bank(text: str) -> dict:
    """{topic_id: [item, ...]} for every Form C block found, item = {id, options, correct}."""
    out: dict[str, list] = {}
    marks = [(m.start(), m.group(1)) for m in C._TOPIC_RE.finditer(text)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[start:end]

        fmatch = _FORM_C_RE.search(chunk)
        if not fmatch:
            continue
        body = chunk[fmatch.start():]

        shared = C._SHARED_OPTS_RE.search(chunk)
        shared_options = C._parse_options(shared.group(1), expect_correct=False)[0] if shared else None

        items = []
        for item_id, stem, opts in _ITEM_C_RE.findall(body):
            options, correct = C._parse_options(opts)
            items.append({"id": item_id, "options": options, "correct": correct})

        if not items and shared_options:
            for item_id, stem, correct in _ITEM_SHARED_C_RE.findall(body):
                items.append({"id": item_id, "options": shared_options, "correct": correct})

        key_match = _ANSWER_KEY_C_RE.search(body)
        key_entries = [p.strip() for p in key_match.group(1).split(",") if p.strip()] if key_match else []

        out[topic_id] = {"items": items, "key_entries": key_entries}
    return out


def main() -> int:
    ab_report = C.bank_report()  # {topic_id: {A, B, balanced, n_options, chance_pct}}

    if not os.path.exists(RETENTION_PATH):
        print(f"FAIL: {RETENTION_PATH} does not exist")
        return 1

    with open(RETENTION_PATH, encoding="utf-8") as fh:
        retention_text = fh.read()

    retention = parse_retention_bank(retention_text)

    print("-- coverage --")
    check(
        "every A/B topic has a Form C block",
        set(ab_report) <= set(retention),
        sorted(set(ab_report) - set(retention)),
    )
    check(
        "no unknown topic ids in retention-item-banks.md",
        set(retention) <= set(ab_report),
        sorted(set(retention) - set(ab_report)),
    )

    print("\n-- per-topic structure --")
    for topic_id in sorted(ab_report):
        entry = retention.get(topic_id)
        if entry is None:
            check(f"{topic_id}: Form C present", False, "missing entirely")
            continue

        items = entry["items"]
        expected_n_options = ab_report[topic_id]["n_options"]
        if isinstance(expected_n_options, list):
            # A/B itself wasn't uniform -- shouldn't happen post-2026-08-30 rebalance, but don't
            # let this validator silently pass a topic where the baseline is already ambiguous.
            check(f"{topic_id}: A/B option count is uniform (prerequisite for comparison)", False,
                  expected_n_options)
            continue

        check(f"{topic_id}: exactly 6 Form C items", len(items) == 6,
              f"found {len(items)}: {[it['id'] for it in items]}")

        for it in items:
            check(f"{topic_id}/{it['id']}: exactly one correct answer",
                  it["correct"] is not None, it)
            check(f"{topic_id}/{it['id']}: option count matches A/B ({expected_n_options})",
                  len(it["options"]) == expected_n_options,
                  f"got {len(it['options'])}")

        # Answer-key line agrees with the ✓ marks actually parsed (count + per-item value).
        key_map = {}
        for pair in entry["key_entries"]:
            if "-" in pair:
                k, v = pair.rsplit("-", 1)
                key_map[k.strip()] = v.strip()
        check(f"{topic_id}: answer key lists 6 entries", len(entry["key_entries"]) == 6,
              entry["key_entries"])
        mismatches = [
            (it["id"], it["correct"], key_map.get(it["id"]))
            for it in items
            if key_map.get(it["id"]) != it["correct"]
        ]
        check(f"{topic_id}: answer key agrees with inline ✓ marks", not mismatches, mismatches)

    print(f"\n{ok} passed, {fail} failed")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
