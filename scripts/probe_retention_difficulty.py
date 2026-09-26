"""Model-as-student difficulty probe for the Form C retention item bank.

Item-QA before the one-shot end-of-study retention re-test -- NOT a validated
human-difficulty measure. It runs every item in docs/retention-item-banks.md
as a zero-shot multiple-choice prompt against a ladder of local Ollama models
(weak -> strong) and reports:
  - a per-model x per-topic accuracy matrix, overall accuracy, no-answer rate
  - TOO-EASY items: every model (including the weakest) answered correctly
    -> ceiling risk, candidate for hardening
  - SUSPECT items: the strongest model answered incorrectly -> possible
    ambiguity, weak distractors, or a mis-keyed answer, worth a human look

Read-only on docs/retention-item-banks.md (and everything else in the repo
except this script -- it never writes back to the bank or any other file).

Item loading reuses scripts/validate_retention_bank.parse_retention_bank for
the trusted, error-prone part (option parsing + which option is "correct",
via backend/checks._parse_options). That function's returned dict does not
carry the question stem (validate_retention_bank only needed structure, not
prompt text), so this script separately recovers stems using the SAME
compiled regexes validate_retention_bank already trusts (_FORM_C_RE /
_ITEM_C_RE / _ITEM_SHARED_C_RE, plus checks._TOPIC_RE) -- mirroring how
backend/checks.py's OWN Form A/B loader keeps "stem" on each item. No new
option/answer-key parsing logic is introduced here.

Usage: python scripts/probe_retention_difficulty.py
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_BACKEND = os.path.join(_ROOT, "backend")
sys.path.insert(0, _BACKEND)
sys.path.insert(0, _ROOT)

from scripts.validate_retention_bank import parse_retention_bank  # noqa: E402
import scripts.validate_retention_bank as _vrb  # noqa: E402 (compiled regexes + checks module)

RETENTION_PATH = os.path.join(_ROOT, "docs", "retention-item-banks.md")
OLLAMA_GENERATE = "http://localhost:11434/api/generate"
OLLAMA_TAGS = "http://localhost:11434/api/tags"

# Weak -> strong ladder, as specified.
MODELS = ["gemma2:2b", "gemma4:e2b", "gemma4:e4b", "qwen2.5:7b-instruct"]

# NOTE on num_predict -- deviation from the nominal num_predict:8 spec, documented here:
# gemma4:e2b/e4b are THINKING models (Ollama exposes a separate "thinking" trace on
# /api/chat). At low num_predict the model spends its whole token budget thinking and
# emits an EMPTY completion (done_reason "length") -- this reproduces the exact cliff
# already documented in this project's own CLAUDE.md for backend/grade.py's prompt
# (empty at 320/512/640/768, correct at 1024+). Measured live for THIS probe's much
# shorter MCQ prompt: gemma4:e2b was empty through num_predict=300 and only completed
# ("a", done_reason "stop") at num_predict=600. Using num_predict:8 as literally
# specified would score gemma4:e2b/e4b as ~100% no-answer -- not a real difficulty
# signal, just truncation -- and defeat the point of the probe. num_predict is raised
# to 1024 for every model (uniform, matches the project's own "1024+ is safe" finding);
# generation still stops as soon as the model emits its letter (measured: e2b ~2-3s/item,
# e4b well under 1s/item once past cold start), so this does not blow up runtime.
NUM_PREDICT = 1024
TEMPERATURE = 0
REQUEST_TIMEOUT_S = 120
MAX_RETRIES = 2


def _load_stems(text: str) -> dict:
    """{(topic_id, item_id): stem} -- see module docstring."""
    C = _vrb.C
    stems: dict = {}
    marks = [(m.start(), m.group(1)) for m in C._TOPIC_RE.finditer(text)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        chunk = text[start:end]
        fmatch = _vrb._FORM_C_RE.search(chunk)
        if not fmatch:
            continue
        body = chunk[fmatch.start():]

        found_direct = _vrb._ITEM_C_RE.findall(body)
        if found_direct:
            for item_id, stem, _opts in found_direct:
                stems[(topic_id, item_id)] = " ".join(stem.split())
        else:
            for item_id, stem, _correct in _vrb._ITEM_SHARED_C_RE.findall(body):
                stems[(topic_id, item_id)] = " ".join(stem.split())
    return stems


def load_items() -> list:
    if not os.path.exists(RETENTION_PATH):
        print(f"FAIL: {RETENTION_PATH} does not exist")
        sys.exit(1)
    with open(RETENTION_PATH, encoding="utf-8") as fh:
        text = fh.read()

    bank = parse_retention_bank(text)
    stems = _load_stems(text)

    items = []
    for topic_id in sorted(bank):
        entry = bank[topic_id]
        for it in entry["items"]:
            stem = stems.get((topic_id, it["id"]))
            items.append({
                "topic": topic_id,
                "id": it["id"],
                "stem": stem if stem is not None else "<stem not recovered by regex>",
                "options": it["options"],
                "correct": it["correct"],
            })
    return items


def build_prompt(item: dict) -> str:
    letters = [o["letter"] for o in item["options"]]
    if len(letters) > 1:
        letter_list = ", ".join(letters[:-1]) + f", or {letters[-1]}"
    else:
        letter_list = letters[0]
    lines = [
        "Answer the following multiple-choice question.",
        f"Reply with ONLY the single letter of the best answer ({letter_list}). "
        "Do not explain your reasoning. Do not write anything except that one letter.",
        "",
        f"Question: {item['stem']}",
        "",
    ]
    for opt in item["options"]:
        lines.append(f"{opt['letter']}) {opt['text']}")
    lines.append("")
    lines.append("Answer:")
    return "\n".join(lines)


_BARE_LETTER_RE = re.compile(r"^[\*\s\"'`(]*([a-eA-E])[\*\s\"'`\.\):]*$")
_ANSWER_IS_RE = re.compile(r"answer\s*(?:is|:)?\s*[\*\"'`\(]*([a-eA-E])\b", re.I)
_LETTER_PUNCT_RE = re.compile(r"\b([a-eA-E])\s*[\)\.:]")
_BARE_WORD_RE = re.compile(r"\b([a-eA-E])\b")


def extract_letter(reply: str, valid_letters: set):
    if not reply:
        return None
    text = reply.strip()
    valid = {l.lower() for l in valid_letters}

    m = _BARE_LETTER_RE.match(text)
    if m and m.group(1).lower() in valid:
        return m.group(1).lower()

    m = _ANSWER_IS_RE.search(text)
    if m and m.group(1).lower() in valid:
        return m.group(1).lower()

    for m in _LETTER_PUNCT_RE.finditer(text):
        if m.group(1).lower() in valid:
            return m.group(1).lower()

    m = _BARE_WORD_RE.search(text)
    if m and m.group(1).lower() in valid:
        return m.group(1).lower()

    return None


def discover_available_models() -> set:
    try:
        req = urllib.request.Request(OLLAMA_TAGS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
        return {m["name"] for m in tags.get("models", [])}
    except Exception as e:
        print(f"WARNING: could not reach Ollama /api/tags ({e}); will attempt every model blindly")
        return None


def call_ollama(model: str, prompt: str, num_predict: int = None, temperature: float = None) -> str:
    """num_predict/temperature default to this module's baseline constants; callers
    (e.g. scripts/probe_retention_difficulty_arms.py's HARNESS-ON arm, which needs a
    much larger budget for visible deliberation on top of gemma4's thinking tokens)
    can override per call without touching the baseline arm's behaviour."""
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": TEMPERATURE if temperature is None else temperature,
            "num_predict": NUM_PREDICT if num_predict is None else num_predict,
        },
    }).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_GENERATE, data=payload, headers={"Content-Type": "application/json"}
    )
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return body.get("response", "")
        except Exception as e:  # noqa: BLE001 -- best-effort probe, log and retry
            last_err = e
            if attempt < MAX_RETRIES:
                time.sleep(1.5)
    raise RuntimeError(f"{model} failed after {MAX_RETRIES + 1} attempts: {last_err}")


def main() -> int:
    items = load_items()
    n_topics = len({it["topic"] for it in items})
    print(f"Loaded {len(items)} items across {n_topics} topics from {RETENTION_PATH}")
    unresolved_stems = [f"{it['topic']}/{it['id']}" for it in items if "not recovered" in it["stem"]]
    if unresolved_stems:
        print(f"WARNING: could not recover stem text for: {unresolved_stems}")

    available = discover_available_models()
    models_to_run = []
    for m in MODELS:
        if available is not None and m not in available:
            print(f"SKIP {m}: not present in `ollama list` (localhost:11434)")
            continue
        models_to_run.append(m)
    if not models_to_run:
        print("FAIL: none of the requested models are available on the local Ollama instance")
        return 1
    print(f"Models running: {models_to_run}")
    print(f"(num_predict={NUM_PREDICT}, temperature={TEMPERATURE} -- see module docstring for why "
          f"num_predict was raised from the nominal 8)")

    # model -> topic -> [n_correct, n_total]
    per_topic = {m: {} for m in models_to_run}
    # model -> {"correct":.., "total":.., "no_answer":..}
    overall = {m: {"correct": 0, "total": 0, "no_answer": 0} for m in models_to_run}
    # (topic, id) -> {model: {"letter":.., "correct":bool}}
    per_item = {}

    total_calls = len(items) * len(models_to_run)
    call_i = 0
    t0 = time.time()
    errors = []

    for item in items:
        key = (item["topic"], item["id"])
        per_item[key] = {}
        prompt = build_prompt(item)
        valid_letters = {o["letter"].lower() for o in item["options"]}

        for model in models_to_run:
            call_i += 1
            try:
                reply = call_ollama(model, prompt)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{model} on {item['topic']}/{item['id']}: {e}")
                reply = ""

            letter = extract_letter(reply, valid_letters)
            is_correct = letter is not None and letter == item["correct"]

            overall[model]["total"] += 1
            per_topic[model].setdefault(item["topic"], [0, 0])
            per_topic[model][item["topic"]][1] += 1
            if letter is None:
                overall[model]["no_answer"] += 1
            if is_correct:
                overall[model]["correct"] += 1
                per_topic[model][item["topic"]][0] += 1

            per_item[key][model] = {"letter": letter, "correct": is_correct, "raw": reply.strip()[:60]}

            if call_i % 25 == 0 or call_i == total_calls:
                elapsed = time.time() - t0
                print(f"  progress: {call_i}/{total_calls} calls, {elapsed:.0f}s elapsed")

    elapsed = time.time() - t0
    print(f"\nDone: {total_calls} calls in {elapsed:.0f}s")
    if errors:
        print(f"\n{len(errors)} call(s) errored after retries (counted as no-answer/wrong):")
        for e in errors[:20]:
            print(f"  {e}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")

    # ---- Matrix: model x topic accuracy ----
    topics_sorted = sorted({it["topic"] for it in items})
    print("\n" + "=" * 100)
    print("ACCURACY MATRIX (correct/total per model x topic)")
    print("=" * 100)
    col_w = max(len(t) for t in topics_sorted) + 2
    header = "MODEL".ljust(22) + "".join(t.ljust(col_w) for t in topics_sorted)
    print(header)
    for model in models_to_run:
        row = model.ljust(22)
        for topic in topics_sorted:
            c, n = per_topic[model].get(topic, (0, 0))
            row += f"{c}/{n}".ljust(col_w)
        print(row)

    print("\n" + "=" * 100)
    print("OVERALL ACCURACY + NO-ANSWER RATE")
    print("=" * 100)
    for model in models_to_run:
        o = overall[model]
        acc = 100.0 * o["correct"] / o["total"] if o["total"] else 0.0
        na = 100.0 * o["no_answer"] / o["total"] if o["total"] else 0.0
        print(f"  {model.ljust(22)} accuracy={acc:5.1f}%  ({o['correct']}/{o['total']})   "
              f"no-answer={na:5.1f}%  ({o['no_answer']}/{o['total']})")

    # ---- TOO-EASY: every model that ran got it right ----
    too_easy = []
    for key, by_model in per_item.items():
        if all(by_model.get(m, {}).get("correct") for m in models_to_run):
            too_easy.append(key)
    too_easy.sort()

    print("\n" + "=" * 100)
    print(f"TOO-EASY ({len(too_easy)}/{len(items)}) -- every model incl. gemma2:2b got these right; "
          "ceiling-risk candidates for hardening")
    print("=" * 100)
    if len(models_to_run) < len(MODELS):
        print(f"  NOTE: only {models_to_run} ran, not the full ladder {MODELS} -- "
              "'every model' below means every model that actually ran.")
    for topic, item_id in too_easy:
        print(f"  {topic}/{item_id}")

    # ---- SUSPECT: strongest model that ran got it wrong ----
    strongest = models_to_run[-1]  # ladder order, last = strongest that ran
    items_by_key = {(it["topic"], it["id"]): it for it in items}
    suspect = []
    for key, by_model in per_item.items():
        res = by_model.get(strongest)
        if res is not None and not res["correct"]:
            suspect.append(key)
    suspect.sort()

    print("\n" + "=" * 100)
    print(f"SUSPECT ({len(suspect)}/{len(items)}) -- strongest model available ({strongest}) got these "
          "wrong; possible ambiguity, weak distractors, or a mis-keyed answer key -- worth a human look")
    print("=" * 100)
    for topic, item_id in suspect:
        it = items_by_key[(topic, item_id)]
        got = per_item[(topic, item_id)][strongest]
        print(f"\n  {topic}/{item_id}")
        print(f"    stem: {it['stem']}")
        for opt in it["options"]:
            mark = " <- correct" if opt["letter"] == it["correct"] else ""
            print(f"      {opt['letter']}) {opt['text']}{mark}")
        print(f"    {strongest} answered: {got['letter']!r} (raw: {got['raw']!r})")

    print("\n" + "=" * 100)
    print("Reminder: this is model-as-student item QA, NOT a validated human-difficulty measure.")
    print("=" * 100)

    return 0


if __name__ == "__main__":
    sys.exit(main())
