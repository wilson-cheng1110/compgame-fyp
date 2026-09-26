"""3-arm extension of scripts/probe_retention_difficulty.py (the OFF/baseline
model-as-student difficulty probe). Adds:

  HARNESS-ON -- same items/models/temperature 0, but the prompt forces
    deliberation before committing: restate what the item tests, evaluate
    each option and why it's right/wrong, check for a "trap" option, THEN
    answer, ending every reply with "ANSWER: <letter>".

  RAG -- before answering, retrieves the top chunks for the item's stem from
    the local HCI lecture vector store (backend/hci_chroma_db_local) using
    the SAME hybrid BM25 + vector ensemble backend/rag_api.py's
    build_retriever() constructs (nomic-embed-text embeddings), injects the
    retrieved text as context, then asks for a single letter (same
    instruction as OFF, isolating retrieval's effect from deliberation's).
    Context is capped to the top 6 chunks by retrieval rank so the injected
    context plus prompt fits the 4096-token context window these Ollama
    models are configured with (measured via `ollama ps`).

This is aggregate item-QA that may fold into the paper -- no participant data
anywhere in this file or its output, ever. Read-only on
docs/retention-item-banks.md and on backend/hci_chroma_db_local (only ever
queried, never written to). Local Ollama + local Chroma only; never touches
the deployed study box; nothing here is committed.

Reuses scripts/probe_retention_difficulty.py (imported as `base`) for item
loading, model discovery, the OFF prompt/extractor, and the Ollama HTTP call
-- no re-parsing of the item bank and no duplicated option/answer-key logic.

Usage: python scripts/probe_retention_difficulty_arms.py [--limit N]
  --limit N   only use the first N items (smoke-test / calibration; the
              real run omits this and covers all ~80 items).
"""
import os
import re
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
_BACKEND = os.path.join(_ROOT, "backend")
sys.path.insert(0, _BACKEND)
sys.path.insert(0, _ROOT)

import scripts.probe_retention_difficulty as base  # noqa: E402
import check_corpus_coverage as coverage  # noqa: E402 (backend/, read-only DB read)

RAG_DB_DIR = os.path.join(_BACKEND, "hci_chroma_db_local")
RAG_CONTEXT_K = 6
NUM_PREDICT_HARNESS = 1536  # matches backend/grade.py's own pinned "safe past the cliff" value
NUM_PREDICT_RAG = base.NUM_PREDICT  # 1024, same as OFF -- only the prompt changes, not the budget

ARMS = ["OFF", "HARNESS", "RAG"]


# ---------------------------------------------------------------------------
# HARNESS-ON prompt + answer extraction
# ---------------------------------------------------------------------------

def _letter_list(item):
    letters = [o["letter"] for o in item["options"]]
    if len(letters) > 1:
        return ", ".join(letters[:-1]) + f", or {letters[-1]}"
    return letters[0]


def build_prompt_harness(item):
    lines = [
        "You are answering a multiple-choice question. Work through it carefully before answering.",
        "Steps: (1) Restate in one sentence what this question is testing. "
        "(2) Evaluate EACH option in turn and say briefly why it is right or wrong. "
        "(3) Check whether there is a tempting but wrong \"trap\" option and name it if so. "
        "(4) Only then give your final answer.",
        f"End your reply with a final line of exactly the form: ANSWER: <letter>  "
        f"(one of {_letter_list(item)}).",
        "",
        f"Question: {item['stem']}",
        "",
    ]
    for opt in item["options"]:
        lines.append(f"{opt['letter']}) {opt['text']}")
    lines.append("")
    lines.append("Work through the steps, then finish with the ANSWER: line.")
    return "\n".join(lines)


_ANSWER_LINE_RE = re.compile(r"ANSWER\s*:\s*\**\(?\s*([a-eA-E])\b", re.I)


def extract_harness_answer(reply, valid_letters):
    if not reply:
        return None
    valid = {l.lower() for l in valid_letters}
    matches = _ANSWER_LINE_RE.findall(reply)
    for letter in reversed(matches):  # last ANSWER: line wins, in case of a repeated frame
        if letter.lower() in valid:
            return letter.lower()
    return base.extract_letter(reply, valid_letters)  # fallback if the model skipped the frame


# ---------------------------------------------------------------------------
# RAG retrieval + prompt
# ---------------------------------------------------------------------------

def get_rag_retriever():
    from langchain_community.retrievers import BM25Retriever
    from langchain_community.vectorstores import Chroma
    from langchain_classic.retrievers import EnsembleRetriever
    from langchain_core.documents import Document
    from langchain_ollama import OllamaEmbeddings

    if not os.path.exists(RAG_DB_DIR):
        raise RuntimeError(f"no vector store at {RAG_DB_DIR}")
    vectorstore = Chroma(persist_directory=RAG_DB_DIR,
                          embedding_function=OllamaEmbeddings(model="nomic-embed-text"))
    vector_retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 12})
    collection = vectorstore._collection.get(include=["documents", "metadatas"])
    bm25_docs = [Document(page_content=t, metadata=m)
                 for t, m in zip(collection["documents"], collection["metadatas"])]
    if not bm25_docs:
        raise RuntimeError(f"vector store at {RAG_DB_DIR} has zero chunks")
    bm25_retriever = BM25Retriever.from_documents(bm25_docs)
    bm25_retriever.k = 12
    return EnsembleRetriever(retrievers=[bm25_retriever, vector_retriever], weights=[0.5, 0.5])


def build_prompt_rag(item, context):
    lines = [
        "Use the following lecture context if it helps. If the context does not cover this, "
        "answer from your own knowledge instead.",
        "",
        "Context:",
        context.strip() if context and context.strip() else "(no relevant context retrieved)",
        "",
        "Answer the following multiple-choice question.",
        f"Reply with ONLY the single letter of the best answer ({_letter_list(item)}). "
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


# ---------------------------------------------------------------------------
# Generic arm runner
# ---------------------------------------------------------------------------

def run_arm(arm_name, items, models_to_run, prompt_fn, extract_fn, num_predict, contexts=None):
    per_topic = {m: {} for m in models_to_run}
    overall = {m: {"correct": 0, "total": 0, "no_answer": 0} for m in models_to_run}
    per_item = {}
    total_calls = len(items) * len(models_to_run)
    call_i = 0
    t0 = time.time()
    errors = []

    # Prompts + valid letters are model-independent, so compute them once per item.
    prepared = []
    for item in items:
        key = (item["topic"], item["id"])
        per_item[key] = {}
        prompt = prompt_fn(item, contexts.get(key, "")) if contexts is not None else prompt_fn(item)
        valid_letters = {o["letter"].lower() for o in item["options"]}
        prepared.append((key, item, prompt, valid_letters))

    # MODEL-OUTER LOOP: each model loads into Ollama ONCE and stays resident for its
    # whole pass, instead of Ollama reloading weights on every model switch per item
    # (the interleaved order thrashed at ~1 reload/call and never finished in practice).
    for model in models_to_run:
        for key, item, prompt, valid_letters in prepared:
            call_i += 1
            try:
                reply = base.call_ollama(model, prompt, num_predict=num_predict)
            except Exception as e:  # noqa: BLE001
                errors.append(f"[{arm_name}] {model} on {item['topic']}/{item['id']}: {e}")
                reply = ""

            letter = extract_fn(reply, valid_letters)
            is_correct = letter is not None and letter == item["correct"]

            overall[model]["total"] += 1
            per_topic[model].setdefault(item["topic"], [0, 0])
            per_topic[model][item["topic"]][1] += 1
            if letter is None:
                overall[model]["no_answer"] += 1
            if is_correct:
                overall[model]["correct"] += 1
                per_topic[model][item["topic"]][0] += 1

            per_item[key][model] = {"letter": letter, "correct": is_correct, "raw": reply.strip()[:80]}

            if call_i % 25 == 0 or call_i == total_calls:
                print(f"  [{arm_name}] progress: {call_i}/{total_calls} calls "
                      f"({time.time() - t0:.0f}s elapsed)")

    if errors:
        print(f"  [{arm_name}] {len(errors)} call(s) errored after retries (counted as no-answer):")
        for e in errors[:15]:
            print(f"    {e}")
        if len(errors) > 15:
            print(f"    ... and {len(errors) - 15} more")

    return {"per_topic": per_topic, "overall": overall, "per_item": per_item, "errors": errors}


def acc_pct(arm_result, model):
    o = arm_result["overall"][model]
    return 100.0 * o["correct"] / o["total"] if o["total"] else 0.0


def topic_acc_pct(arm_result, model, topic):
    c, n = arm_result["per_topic"][model].get(topic, (0, 0))
    return (100.0 * c / n if n else None), c, n


def main() -> int:
    limit = None
    if "--limit" in sys.argv:
        i = sys.argv.index("--limit")
        limit = int(sys.argv[i + 1])

    items = base.load_items()
    if limit:
        items = items[:limit]
        print(f"SMOKE TEST: limited to first {limit} items")
    topics_sorted = sorted({it["topic"] for it in items})
    print(f"Loaded {len(items)} items across {len(topics_sorted)} topics")

    available = base.discover_available_models()
    models_to_run = [m for m in base.MODELS if available is None or m in available]
    for m in base.MODELS:
        if m not in models_to_run:
            print(f"SKIP {m}: not present in `ollama list` (localhost:11434)")
    if not models_to_run:
        print("FAIL: no requested models available")
        return 1
    print(f"Models running: {models_to_run}")
    strongest = models_to_run[-1]

    # ---- Build RAG retriever + retrieve context per item up front ----
    print("\nBuilding RAG retriever (BM25 + vector ensemble over hci_chroma_db_local)...")
    retriever = None
    try:
        retriever = get_rag_retriever()
        print("  retriever OK")
    except Exception as e:  # noqa: BLE001
        print(f"  RAG retriever build FAILED -- RAG arm will be SKIPPED. Reason: {e}")

    rag_contexts = {}
    if retriever is not None:
        print("Retrieving context per item...")
        retrieval_errors = 0
        for i, item in enumerate(items):
            key = (item["topic"], item["id"])
            try:
                docs = retriever.invoke(item["stem"])
                rag_contexts[key] = "\n\n".join(d.page_content for d in docs[:RAG_CONTEXT_K])
            except Exception as e:  # noqa: BLE001
                retrieval_errors += 1
                rag_contexts[key] = ""
                if retrieval_errors <= 5:
                    print(f"  retrieval failed for {key}: {e}")
            if (i + 1) % 20 == 0 or (i + 1) == len(items):
                print(f"  retrieval progress: {i + 1}/{len(items)}")
        if retrieval_errors:
            print(f"  {retrieval_errors} item(s) had retrieval errors -- empty context used, "
                  "counted as-is (not skipped)")

    # ---- Run the three arms ----
    print("\n" + "#" * 100)
    print("ARM: OFF (baseline -- zero-shot, no deliberation, no retrieval)")
    print("#" * 100)
    off = run_arm("OFF", items, models_to_run, base.build_prompt, base.extract_letter, base.NUM_PREDICT)

    print("\n" + "#" * 100)
    print("ARM: HARNESS-ON (forced deliberation, ANSWER: <letter>)")
    print("#" * 100)
    harness = run_arm("HARNESS", items, models_to_run, build_prompt_harness, extract_harness_answer,
                       NUM_PREDICT_HARNESS)

    rag = None
    if retriever is not None:
        print("\n" + "#" * 100)
        print("ARM: RAG (retrieved lecture context injected, single-letter answer)")
        print("#" * 100)
        rag = run_arm("RAG", items, models_to_run, build_prompt_rag, base.extract_letter,
                       NUM_PREDICT_RAG, contexts=rag_contexts)
    else:
        print("\nARM: RAG -- SKIPPED (no retriever)")

    # =========================================================================
    # REPORTING
    # =========================================================================
    print("\n" + "=" * 100)
    print("3-ARM OVERALL ACCURACY (and delta vs OFF)")
    print("=" * 100)
    header = f"{'MODEL':<22}{'OFF%':>8}{'HARNESS%':>10}{'dH':>8}"
    if rag:
        header += f"{'RAG%':>8}{'dR':>8}"
    print(header)
    for model in models_to_run:
        off_a = acc_pct(off, model)
        har_a = acc_pct(harness, model)
        row = f"{model:<22}{off_a:>7.1f}%{har_a:>9.1f}%{har_a - off_a:>+7.1f}%"
        if rag:
            rag_a = acc_pct(rag, model)
            row += f"{rag_a:>7.1f}%{rag_a - off_a:>+7.1f}%"
        print(row)

    print("\nNo-answer rate per arm:")
    for model in models_to_run:
        line = (f"  {model:<22} OFF={100.0*off['overall'][model]['no_answer']/off['overall'][model]['total']:5.1f}%"
                f"  HARNESS={100.0*harness['overall'][model]['no_answer']/harness['overall'][model]['total']:5.1f}%")
        if rag:
            line += f"  RAG={100.0*rag['overall'][model]['no_answer']/rag['overall'][model]['total']:5.1f}%"
        print(line)

    # ---- Per-topic deltas, per model ----
    print("\n" + "=" * 100)
    print("PER-TOPIC ACCURACY + DELTAS, PER MODEL")
    print("=" * 100)
    for model in models_to_run:
        print(f"\n-- {model} --")
        col = f"{'topic':<20}{'OFF%':>8}{'HARNESS%':>10}{'dH':>8}"
        if rag:
            col += f"{'RAG%':>8}{'dR':>8}"
        print(col)
        for topic in topics_sorted:
            off_pct, _, n = topic_acc_pct(off, model, topic)
            har_pct, _, _ = topic_acc_pct(harness, model, topic)
            row = f"{topic:<20}{off_pct:>7.1f}%{har_pct:>9.1f}%{har_pct - off_pct:>+7.1f}%"
            if rag:
                rag_pct, _, _ = topic_acc_pct(rag, model, topic)
                row += f"{rag_pct:>7.1f}%{rag_pct - off_pct:>+7.1f}%"
            print(row)

    # =========================================================================
    # CONCENTRATION ANALYSIS: does lift land on hard items or easy items?
    # =========================================================================
    print("\n" + "=" * 100)
    print("LIFT CONCENTRATION -- hard items (few/no OFF models correct) vs easy items (most/all correct)")
    print("=" * 100)
    n_models = len(models_to_run)
    keys = list(off["per_item"].keys())

    def off_correct_count(key):
        return sum(1 for m in models_to_run if off["per_item"][key][m]["correct"])

    buckets = {"hard (0-1 OFF models correct)": [], "medium": [], "easy (all OFF models correct)": []}
    for key in keys:
        c = off_correct_count(key)
        if c <= 1:
            buckets["hard (0-1 OFF models correct)"].append(key)
        elif c == n_models:
            buckets["easy (all OFF models correct)"].append(key)
        else:
            buckets["medium"].append(key)
    for label, ks in buckets.items():
        print(f"  {label}: {len(ks)} items")

    def mean_lift(arm_result, bucket_keys):
        if not bucket_keys:
            return None
        deltas = []
        for key in bucket_keys:
            for m in models_to_run:
                off_c = 1 if off["per_item"][key][m]["correct"] else 0
                arm_c = 1 if arm_result["per_item"][key][m]["correct"] else 0
                deltas.append(arm_c - off_c)
        return 100.0 * sum(deltas) / len(deltas)

    print(f"\n{'bucket':<32}{'mean HARNESS lift':>20}" + (f"{'mean RAG lift':>16}" if rag else ""))
    for label, ks in buckets.items():
        hl = mean_lift(harness, ks)
        line = f"{label:<32}{('%+.1f pp' % hl) if hl is not None else 'n/a':>20}"
        if rag:
            rl = mean_lift(rag, ks)
            line += f"{('%+.1f pp' % rl) if rl is not None else 'n/a':>16}"
        print(line)
    print("(pp = percentage points of correctness across all model x item pairs in that bucket;"
          " positive = arm outperforms OFF on that bucket)")

    # =========================================================================
    # RAG lift vs per-topic corpus coverage
    # =========================================================================
    if rag:
        print("\n" + "=" * 100)
        print("RAG LIFT vs PER-TOPIC CORPUS COVERAGE (backend/check_corpus_coverage.py)")
        print("=" * 100)
        cov = coverage.summary()
        cov_by_topic = {row["topic"]: row for row in cov.get("topics", [])}
        print(f"corpus: {cov.get('chunks', '?')} chunks, db_exists={cov.get('db_exists')}\n")
        print(f"{'topic':<20}{'coverage':<12}{'hits':>6}   mean RAG lift (all models, pp)")
        by_status = {}
        for topic in topics_sorted:
            row = cov_by_topic.get(topic, {"status": "unknown", "total_hits": "?"})
            deltas = []
            for m in models_to_run:
                off_pct, _, _ = topic_acc_pct(off, m, topic)
                rag_pct, _, _ = topic_acc_pct(rag, m, topic)
                deltas.append(rag_pct - off_pct)
            lift = sum(deltas) / len(deltas)
            print(f"{topic:<20}{row['status']:<12}{str(row['total_hits']):>6}   {lift:+.1f}")
            by_status.setdefault(row["status"], []).append(lift)
        print()
        for status, lifts in by_status.items():
            print(f"  mean RAG lift where corpus status == {status:<10}: "
                  f"{sum(lifts)/len(lifts):+.1f} pp  (n={len(lifts)} topics)")

    # =========================================================================
    # SUSPECT (strongest model wrong under OFF) -- still worth carrying over
    # =========================================================================
    items_by_key = {(it["topic"], it["id"]): it for it in items}
    print("\n" + "=" * 100)
    print(f"Reference: OFF-arm SUSPECT items (strongest model {strongest} wrong under OFF) and "
          f"whether HARNESS/RAG recovered them")
    print("=" * 100)
    for key in sorted(keys):
        off_res = off["per_item"][key][strongest]
        if off_res["correct"]:
            continue
        it = items_by_key[key]
        har_res = harness["per_item"][key][strongest]
        line = f"  {key[0]}/{key[1]}  OFF={off_res['letter']!r}(wrong)  HARNESS={har_res['letter']!r}" \
               f"({'FIXED' if har_res['correct'] else 'still wrong'})"
        if rag:
            rag_res = rag["per_item"][key][strongest]
            line += f"  RAG={rag_res['letter']!r}({'FIXED' if rag_res['correct'] else 'still wrong'})"
        print(line)

    print("\n" + "=" * 100)
    print("Reminder: this is model-as-student item QA, NOT a validated human-difficulty measure.")
    print("=" * 100)
    return 0


if __name__ == "__main__":
    sys.exit(main())
