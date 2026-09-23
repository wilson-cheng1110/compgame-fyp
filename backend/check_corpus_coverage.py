"""Does the RAG corpus actually cover the 13 COMPGame topics?

Requirement updates happen: lecture decks get revised, topics get added, and the
committed vector store silently falls behind. A stale corpus does not fail loudly
-- retrieval just returns nothing on-topic while SOCRATIC_SYSTEM_PROMPT still tells
the model it is grounded. This makes that detectable in one command.

Reads chroma.sqlite3 DIRECTLY -- no Ollama, no embeddings, no server. A check that
needs the stack running is a check nobody runs.

    python check_corpus_coverage.py          # report
    python check_corpus_coverage.py --quiet   # CI: exit 1 if any topic is uncovered

Word-BOUNDARY matching, deliberately: a plain substring search for "Hick" matches
the photo credit "Anthony Schick" 10 times and reports Hick's Law as well covered.
It is not. That false positive is why this file exists.
"""

import os
import re
import sqlite3
import sys

DB = os.path.join(os.path.dirname(__file__), "hci_chroma_db_local", "chroma.sqlite3")

# Per topic: the terms that should appear if the lecture material is in the corpus.
# Include BOTH the textbook name COMPGame uses and the lecturer's own wording --
# the 2023 decks teach Gestalt as "pattern recognition" and Weber's Law as "just
# noticeable difference", and a query for the textbook name alone retrieves nothing.
TOPIC_TERMS = {
    "norman":            ["Norman", "action cycle", "gulf of execution", "gulf of evaluation", "seven stages"],
    "memory":            ["Miller", "magic number", "7 ?± ?2", "chunk", "short-term memory", "working memory"],
    "problem-solving":   ["means-end", "problem space", "ill-defined problem", "problem solving", "forward reasoning"],
    "stroop":            ["Stroop", "stimulus-response compatibility", "consistency", "automatic"],
    "hicks-law":         ["Hick", "choice reaction time", "number of choices", "decision time"],
    "fitts-law":         ["Fitts", "index of difficulty", "speed vs accuracy"],
    "visual-perception": ["visual acuity", "colour", "color", "depth", "optic flow", "perception"],
    "webers-law":        ["Weber", "just noticeable difference", "JND", "brightness"],
    "gestalt":           ["Gestalt", "pattern recognition", "proximity", "similarity", "surroundedness"],
    "mental-model":      ["mental model", "affordance", "conceptual model"],
    "language":          ["ambiguity", "semantics", "pragmatics", "syntax", "speech act"],
    "ergonomics":        ["ergonomic", "anthropometry", "posture", "input device", "haptic"],
    "experiment-design": ["independent variable", "dependent variable", "confound", "within-subject", "hypothesis"],
}


def load_documents(db_path):
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT string_value FROM embedding_metadata "
            "WHERE key='chroma:document' AND string_value IS NOT NULL"
        ).fetchall()
    finally:
        conn.close()
    return [r[0] for r in rows]


def summary(db_path=None) -> dict:
    """Per-topic corpus coverage as ONE importable dict — the same per-term word-boundary
    matching ``main()`` prints, factored out so the CLI and the /researcher health endpoint
    read a single source of truth (mirrors how ``grade_batch.run()`` was exposed for its CLI).

    AGGREGATE-ONLY: chunk counts and per-topic hit counts over the lecture corpus — there is
    no participant data in the vector store, so nothing here can carry a SID. A missing store
    is reported (`db_exists=False`), not raised, so the endpoint degrades to "uncovered" rather
    than erroring."""
    path = db_path or DB
    if not os.path.exists(path):
        return {"db_exists": False, "chunks": 0, "topics": [],
                "uncovered": list(TOPIC_TERMS), "ok": False}

    docs = load_documents(path)
    topics, uncovered = [], []
    for topic, terms in TOPIC_TERMS.items():
        per_term = {}
        for term in terms:
            pat = re.compile(rf"\b{term}\b" if " " not in term and "?" not in term
                             else term, re.IGNORECASE)
            per_term[term] = sum(1 for d in docs if pat.search(d))

        total = sum(per_term.values())
        hits = {t: n for t, n in per_term.items() if n}
        if not hits:
            uncovered.append(topic)
        status = "uncovered" if not hits else ("thin" if total < 5 else "ok")
        topics.append({
            "topic": topic, "total_hits": total, "status": status,
            # Top few matched terms with their counts (the CLI shows the same four).
            "hits": dict(sorted(hits.items(), key=lambda kv: -kv[1])[:4]),
        })

    return {"db_exists": True, "chunks": len(docs), "topics": topics,
            "uncovered": uncovered, "ok": not uncovered}


def main():
    quiet = "--quiet" in sys.argv
    s = summary()
    if not s["db_exists"]:
        print(f"FAIL  no vector store at {DB}")
        return 2

    print(f"corpus: {s['chunks']} chunks  ({DB})\n")

    for row in s["topics"]:
        hits = row["hits"]
        mark = {"uncovered": "UNCOVERED", "thin": "thin ", "ok": "ok   "}[row["status"]]
        if not quiet or not hits:
            shown = ", ".join(f"{t}={n}" for t, n in hits.items())
            print(f"  {mark}  {row['topic']:<18} {row['total_hits']:>4} hit(s)   "
                  f"{shown or '-- nothing matched --'}")

    print()
    if s["uncovered"]:
        print(f"FAIL  {len(s['uncovered'])} topic(s) with ZERO corpus coverage: "
              f"{', '.join(s['uncovered'])}")
        print("      Add the current lecture decks to backend/ and run: python rebuild_db.py")
        return 1
    print("PASS  every topic has at least one grounded chunk.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
