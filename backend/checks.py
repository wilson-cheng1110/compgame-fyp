"""Pre-check and post-check items: parsing, serving, and server-side grading.

See docs/revamp.md Parts 2 and 8.5.

THE ONE RULE THIS MODULE EXISTS TO ENFORCE: the pre-check answer key must never
reach the client. `items_for_student()` strips the correct answer; only
`grade_submission()` -- which runs here, server-side -- ever sees it. If the key
ships in the bundle it is one devtools tab away, and a class of CS students will
find it within a week.

Source of truth is `docs/quiz-item-banks.md` itself, parsed at load time rather
than compiled into a separate JSON. That file is what Wilson edits and what the
paper cites; a generated copy would drift from it silently. Only 4 of 13 topics
have banks today (docs/revamp.md Part 8.4) -- the rest return None and the unit
renders without an MC step.

Parsing is STRICT. A malformed item raises rather than being skipped: a silently
dropped item is a measurement bug that shows up as an inexplicable score ceiling
weeks later.
"""

import os
import re

BANK_PATH = os.environ.get(
    "ITEM_BANK_PATH",
    os.path.join(os.path.dirname(__file__), "..", "docs", "quiz-item-banks.md"),
)

_banks: dict | None = None
_banks_mtime: float | None = None

_TOPIC_RE = re.compile(r"^##\s+\d+\.\s+.*?\(`([a-z-]+)`\)", re.M)
_FORM_RE = re.compile(r"^###\s+Form\s+([AB])\b", re.M)

# The bank uses TWO layouts and both are legitimate:
#
#   (1) per-item options, 4 per item, correct one marked ✓ on its own line
#       **A1.** stem
#        a) x  b) ✓ y  c) z  d) w
#
#   (2) options declared once for the whole topic (5 of them, matching the game's
#       5-button UI), each item one line with the answer inline
#       **Options for every item below:** a) Similarity  b) Proximity ...
#       **A1.** stem → ✓ **b) Proximity**
#
# Layout 2 is Gestalt only. NOTE the consequence for analysis: Gestalt items have
# 5 options (chance = 20%) while the other three banks have 4 (chance = 25%). Raw
# percentages are therefore NOT directly comparable across topics -- see
# `bank_report()`, which surfaces the option count per topic for exactly this reason.
_ITEM_RE = re.compile(r"^\*\*([AB]\d+)\.\*\*\s*(.+?)\n\s*([a-e]\).+?)(?=\n\s*\n|\n\*\*|\n\*Answer|\Z)",
                      re.M | re.S)
_OPT_RE = re.compile(r"([a-e])\)\s*(✓\s*)?(.*?)(?=\s\s+[a-e]\)|$)", re.S)

_SHARED_OPTS_RE = re.compile(r"\*\*Options for every item below:\*\*\s*(.+)")
_ITEM_SHARED_RE = re.compile(r"^\*\*([AB]\d+)\.\*\*\s*(.+?)\s*→\s*✓\s*\*\*([a-e])\)", re.M)


def _parse_options(raw: str, expect_correct: bool = True) -> tuple[list[dict], str | None]:
    """-> ([{letter, text}], correct_letter). Raises if the option set is malformed."""
    flat = " ".join(raw.split("\n")).strip()
    options, correct = [], None
    for letter, tick, text in _OPT_RE.findall(flat):
        text = text.strip().strip("*")
        if not text:
            continue
        options.append({"letter": letter, "text": text})
        if tick:
            if correct is not None:
                raise ValueError(f"more than one correct option marked: {flat[:90]}")
            correct = letter
    if not 4 <= len(options) <= 5:
        raise ValueError(f"expected 4-5 options, got {len(options)}: {flat[:90]}")
    if expect_correct and correct is None:
        raise ValueError(f"no option marked ✓: {flat[:90]}")
    return options, correct


def _load() -> dict:
    """{topic_id: {"A": [item...], "B": [item...]}}; item = {id, stem, options, correct}."""
    global _banks, _banks_mtime
    mtime = os.path.getmtime(BANK_PATH)
    if _banks is not None and mtime == _banks_mtime:
        return _banks

    with open(BANK_PATH, encoding="utf-8") as fh:
        text = fh.read()

    # Slice the file into per-topic chunks, then per-form chunks inside each.
    topics: dict[str, dict[str, list]] = {}
    marks = [(m.start(), m.group(1)) for m in _TOPIC_RE.finditer(text)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[start:end]

        # Layout 2: one option set declared for the whole topic.
        shared = _SHARED_OPTS_RE.search(chunk)
        shared_options = _parse_options(shared.group(1), expect_correct=False)[0] if shared else None

        forms: dict[str, list] = {}
        fmarks = [(m.start(), m.group(1)) for m in _FORM_RE.finditer(chunk)]
        for j, (fstart, form) in enumerate(fmarks):
            fend = fmarks[j + 1][0] if j + 1 < len(fmarks) else len(chunk)
            body = chunk[fstart:fend]
            items = []

            for item_id, stem, opts in _ITEM_RE.findall(body):
                options, correct = _parse_options(opts)
                items.append({"id": item_id, "stem": " ".join(stem.split()),
                              "options": options, "correct": correct})

            if not items and shared_options:
                for item_id, stem, correct in _ITEM_SHARED_RE.findall(body):
                    stem = re.sub(r"\s*→.*$", "", " ".join(stem.split())).strip()
                    items.append({"id": item_id, "stem": stem,
                                  "options": shared_options, "correct": correct})

            if items:
                # A form that parsed some items but not all is worse than one that
                # parsed none -- it scores out of the wrong denominator. The answer
                # key line is the independent count to check against.
                key_line = re.search(rf"\*Answer key {form}:([^*]+)\*", body)
                if key_line:
                    expected = len([p for p in key_line.group(1).split(",") if p.strip()])
                    if expected != len(items):
                        raise ValueError(
                            f"{topic_id} form {form}: parsed {len(items)} items but the "
                            f"answer key lists {expected}")
                forms[form] = items
        if forms:
            topics[topic_id] = forms

    _banks, _banks_mtime = topics, mtime
    return topics


# ── serving ───────────────────────────────────────────────────────────────────

def has_bank(topic_id: str) -> bool:
    b = _load().get(topic_id)
    return bool(b and "A" in b and "B" in b)


def items_for_student(topic_id: str, form: str) -> list[dict] | None:
    """Items WITHOUT the answer key. The only shape that may cross the wire."""
    bank = _load().get(topic_id, {}).get(form.upper())
    if not bank:
        return None
    return [{"id": i["id"], "stem": i["stem"], "options": i["options"]} for i in bank]


def _key(topic_id: str, form: str) -> dict[str, str]:
    return {i["id"]: i["correct"] for i in _load().get(topic_id, {}).get(form.upper(), [])}


# ── grading ───────────────────────────────────────────────────────────────────

def grade_submission(topic_id: str, form: str, answers: dict[str, str],
                     reveal: bool = False) -> dict:
    """Score one submission server-side.

    `reveal` follows the feedback asymmetry in docs/revamp.md Part 8.5: the
    post-check returns the correct answer and per-item outcome; the pre-check
    returns the bare fact that it was recorded and nothing else. A pre-check that
    leaks its score lets a student infer the answers by resubmitting -- and
    contaminates the post-check, which is the measurement this all exists for.
    """
    key = _key(topic_id, form)
    if not key:
        raise ValueError(f"no item bank for {topic_id} form {form}")

    per_item, correct_n = [], 0
    for item_id, right in key.items():
        given = (answers.get(item_id) or "").strip().lower()[:1]
        is_right = given == right
        correct_n += is_right
        entry = {"id": item_id, "answered": given or None}
        if reveal:
            entry.update({"correct_option": right, "was_correct": is_right})
        per_item.append(entry)

    total = len(key)
    result = {
        "topic_id": topic_id,
        "form": form.upper(),
        "answered": sum(1 for e in per_item if e["answered"]),
        "total": total,
        "items": per_item,
    }
    if reveal:
        result["score"] = round(100.0 * correct_n / total, 1)
        result["correct"] = correct_n
    return result


def score_only(topic_id: str, form: str, answers: dict[str, str]) -> float:
    """Percentage correct, for the sink. Never returned to the student on a pre-check."""
    graded = grade_submission(topic_id, form, answers, reveal=True)
    return graded["score"]


# ── integrity ─────────────────────────────────────────────────────────────────

def already_submitted(events: list[dict], sid: str, topic_id: str, event_type: str) -> bool:
    """One submission per item set -- 'MC limit 1' (docs/revamp.md Part 11).

    Takes the event list rather than querying, so the caller controls the read and
    this stays testable without a live sink.
    """
    for row in events:
        if (row.get("participant_id") == sid
                and row.get("event_type") == event_type
                and row.get("topic_id") == topic_id):
            return True
    return False


def bank_report() -> dict:
    """Which topics have usable banks, are A/B the same length, and how many options.

    `n_options` is here because it is NOT constant across the bank: Gestalt items
    offer 5 (chance 20%), the rest offer 4 (chance 25%). Raw percentage scores are
    therefore not directly comparable across topics, and any cross-topic pooling of
    gain needs a chance correction. Surfacing it here so it cannot be forgotten.
    """
    out = {}
    for topic_id, forms in _load().items():
        a, b = forms.get("A", []), forms.get("B", [])
        n_opts = sorted({len(i["options"]) for i in a + b})
        out[topic_id] = {
            "A": len(a),
            "B": len(b),
            "balanced": len(a) == len(b) and len(a) > 0,
            "n_options": n_opts[0] if len(n_opts) == 1 else n_opts,
            "chance_pct": round(100 / n_opts[0], 1) if len(n_opts) == 1 else None,
        }
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(bank_report(), indent=2))
