"""Grade every short answer offline, blind, reproducibly. docs/revamp.md Part 8.2.

    python grade_batch.py --dry-run                  # what would be graded, no LLM
    python grade_batch.py --topic webers-law         # grade one topic
    python grade_batch.py --resume                   # skip anything already graded
    python grade_batch.py --sample-for-human 60      # blank sheet for hand-coding
    python grade_batch.py --kappa human.csv          # reliability against those hands

WHY OFFLINE. Two independent reasons, either sufficient:

* **Blindness.** Grading live means grading a post-test while knowing it is one.
  The grader inflates, and the pre-post gain becomes an artefact of the grader
  rather than a finding about the teaching (Part 8.2).
* **Load.** It removes ~4 LLM calls per student per topic from the live path. Part
  16's arithmetic is the difference between the GPU coping at 300 students and not.

Nobody is waiting on this. It can run at 3am, take an hour, and be re-run when the
rubric changes -- and a re-run reproduces the previous grades exactly, because the
order is seeded and the temperature is 0.
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

import grade
import research_store

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.environ.get("GRADES_DIR", os.path.join(HERE, "..", "reports", "grades"))

# Event types that carry a free-text concept answer. `reflection` is deliberately
# NOT here: a reflection is about how the student felt, and running it through a
# correctness rubric would produce a grade that means nothing.
SHORT_ANSWER_EVENTS = ("topic_probe", "topic_probe_post")

# Where the text sits inside the event's free-form meta column.
ANSWER_KEYS = ("answer", "response", "text", "short_answer")


def _extract(row: dict) -> str | None:
    meta = row.get("meta")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (json.JSONDecodeError, ValueError):
            return None
    if not isinstance(meta, dict):
        return None
    for k in ANSWER_KEYS:
        v = meta.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return None


def collect(topic: str | None = None) -> list[dict]:
    """Pull gradeable short answers out of the sink, carrying the labels along.

    The labels ride here and are stripped by `grade.blind()` one step later -- they
    are needed to re-join afterwards, and they must not be in scope when the prompt
    is built. Keeping the strip in one place beats trusting every call site.
    """
    out = []
    for row in research_store.fetch_all():
        if row.get("event_type") not in SHORT_ANSWER_EVENTS:
            continue
        if topic and row.get("topic_id") != topic:
            continue
        answer = _extract(row)
        if answer is None:
            continue
        meta = row.get("meta")
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, ValueError):
                meta = {}
        out.append({
            "id": row["id"],
            "participant_id": row.get("participant_id"),
            "topic_id": row.get("topic_id"),
            "event_type": row.get("event_type"),
            "phase": (meta or {}).get("form") or (meta or {}).get("phase"),
            "arm": (meta or {}).get("arm"),
            "answer": answer,
        })
    return out


def already_graded() -> set:
    """Event ids graded by any previous run, for --resume."""
    done = set()
    if not os.path.isdir(OUT_DIR):
        return done
    for f in os.listdir(OUT_DIR):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(OUT_DIR, f), encoding="utf-8") as fh:
                for r in json.load(fh).get("results", []):
                    done.add(r["id"])
        except (json.JSONDecodeError, KeyError, OSError):
            continue
    return done


def run_batch(records: list[dict], seed: str, dry: bool) -> list[dict]:
    blinded, mapping = grade.blind(records, seed=seed)
    print(f"  {len(blinded)} answers, shuffled under seed {seed!r}")

    results = []
    for i, b in enumerate(blinded, 1):
        if dry:
            ok, reason = grade.is_gradeable(b["answer"], grade.probe_for(b["topic_id"]))
            g = {"level": None, "evidence": "", "rubric_hit": [],
                 "ungradeable_reason": reason, "llm": False, "dry_run": True,
                 "would_call_llm": ok}
        else:
            try:
                g = grade.grade_answer(b["topic_id"], b["answer"])
            except Exception as e:                      # one bad answer must not kill the run
                g = {"level": None, "evidence": "", "rubric_hit": [],
                     "ungradeable_reason": f"error:{type(e).__name__}", "llm": True}
        results.append({"tag": b["tag"], **g})
        if i % 25 == 0 or i == len(blinded):
            print(f"  {i}/{len(blinded)}")

    return grade.unblind(results, mapping)


def summarise(joined: list[dict]) -> dict:
    """Counts by level, per topic. Code counts; the LLM never does (Part 12: a
    teacher who catches one wrong number stops trusting the whole report).

    A dry run is counted SEPARATELY and never folded into `ungradeable`. In a dry
    run nothing was graded, so every level is null -- reporting that as "N
    ungradeable" would say the students wrote nothing gradeable when the truth is
    that no grader ran. That is the exact shape of number that quietly becomes a
    finding, so the two are kept apart.
    """
    by_topic: dict = {}
    for r in joined:
        t = by_topic.setdefault(r["topic_id"], {"full": 0, "partial": 0, "none": 0,
                                                "ungradeable": 0, "n": 0,
                                                "unverbatim_evidence": 0,
                                                "dry_run": False,
                                                "would_grade": 0, "null_prefilter": 0})
        g = r["grade"]
        t["n"] += 1
        if g.get("dry_run"):
            t["dry_run"] = True
            if g.get("would_call_llm"):
                t["would_grade"] += 1
            else:
                t["null_prefilter"] += 1
            continue
        lvl = g.get("level")
        t[lvl if lvl in grade.LEVELS else "ungradeable"] += 1
        if g.get("evidence_verbatim") is False:
            t["unverbatim_evidence"] += 1

    for t in by_topic.values():
        if t["dry_run"]:
            t["graded_n"] = 0
            t["full_pct"] = None
            continue
        # The denominator EXCLUDES ungradeable. A null is a missing datum, not a
        # failure -- putting it in the denominator reports non-response as if it
        # were students getting the material wrong.
        graded = t["n"] - t["ungradeable"]
        t["graded_n"] = graded
        t["full_pct"] = round(100 * t["full"] / graded, 1) if graded else None
    return by_topic


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic")
    ap.add_argument("--seed", default="compgame")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--sample-for-human", type=int, metavar="N")
    ap.add_argument("--kappa", metavar="HUMAN_CSV")
    ap.add_argument("--out")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    if args.kappa:
        return _kappa(args.kappa)

    records = collect(args.topic)
    if not records:
        print(f"  no short answers in the sink"
              f"{' for ' + args.topic if args.topic else ''}.")
        print(f"  looked for event_type in {SHORT_ANSWER_EVENTS} with a text field "
              f"in meta{ANSWER_KEYS}.")
        return 0

    if args.sample_for_human:
        return _sample(records, args.sample_for_human, args.seed, args.out)

    if args.resume:
        done = already_graded()
        before = len(records)
        records = [r for r in records if r["id"] not in done]
        print(f"  --resume: {before - len(records)} already graded, {len(records)} to go")
        if not records:
            return 0

    joined = run_batch(records, args.seed, args.dry_run)
    by_topic = summarise(joined)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = args.out or os.path.join(
        OUT_DIR, f"{args.topic or 'all'}-{stamp}{'-dryrun' if args.dry_run else ''}.json")
    with open(name, "w", encoding="utf-8") as fh:
        json.dump({"generated": stamp, "seed": args.seed, "dry_run": args.dry_run,
                   "model": os.environ.get("OLLAMA_LLM", "gemma4:e4b"),
                   "rubric_path": os.path.abspath(grade.RUBRIC_PATH),
                   "summary": by_topic, "results": joined},
                  fh, indent=2, ensure_ascii=False)

    print()
    for topic, t in by_topic.items():
        if t["dry_run"]:
            print(f"  {topic:<18} DRY RUN — nothing graded. {t['would_grade']} of {t['n']} "
                  f"would go to the model; {t['null_prefilter']} are null before it "
                  f"(blank / no attempt / too short).")
            continue
        print(f"  {topic:<18} full {t['full']:>3} · partial {t['partial']:>3} · "
              f"none {t['none']:>3} · ungradeable {t['ungradeable']:>3}   "
              f"(full {t['full_pct']}% of {t['graded_n']} graded)")
        if t["unverbatim_evidence"]:
            print(f"  {'':<18} WARNING: {t['unverbatim_evidence']} grades quote text that is "
                  f"NOT in the answer — the model is inventing evidence. Inspect before using.")
    print(f"\n  -> {name}")
    if not args.dry_run:
        print("  Reminder: hand-code ~60 of these and run --kappa before any of it "
              "reaches the paper (docs/grading-rubric.md).")
    return 0


def _sample(records, n, seed, out) -> int:
    """Blank coding sheet for the human coder. Deliberately carries no machine grade:
    seeing it first is the definition of an anchored second coder, and the kappa
    would be measuring compliance rather than agreement."""
    blinded, mapping = grade.blind(records, seed=seed)
    take = blinded[:n]
    name = out or os.path.join(OUT_DIR, f"human-coding-sheet-{len(take)}.csv")
    with open(name, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["tag", "topic_id", "answer", "your_grade(full/partial/none/null)", "notes"])
        for b in take:
            w.writerow([b["tag"], b["topic_id"], b["answer"], "", ""])
    print(f"  {len(take)} answers -> {name}")
    print("  Code the 4th column by hand. No machine grades are in this file on "
          "purpose — an anchored coder measures compliance, not agreement.")
    print(f"  Then: python grade_batch.py --kappa {os.path.basename(name)}")
    return 0


def _kappa(human_csv: str) -> int:
    path = human_csv if os.path.exists(human_csv) else os.path.join(OUT_DIR, human_csv)
    if not os.path.exists(path):
        print(f"  no such file: {human_csv}")
        return 1

    human = {}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            col = next((k for k in row if k.startswith("your_grade")), None)
            v = (row.get(col) or "").strip().lower()
            if v:
                human[row["tag"]] = None if v in ("null", "none_datum", "") else v

    machine = {}
    for f in sorted(os.listdir(OUT_DIR)):
        if f.endswith(".json"):
            try:
                with open(os.path.join(OUT_DIR, f), encoding="utf-8") as fh:
                    blob = json.load(fh)
                if blob.get("dry_run"):
                    continue
                for r in blob.get("results", []):
                    tag = r["grade"].get("tag") or r.get("tag")
                    key = tag or r["id"]
                    machine[str(key)] = r["grade"].get("level")
            except (json.JSONDecodeError, KeyError, OSError):
                continue

    # Machine results are keyed by event id after unblinding; the sheet is keyed by
    # tag. Re-derive the tag so the two line up without storing it twice.
    import hashlib
    remap = {}
    for f in sorted(os.listdir(OUT_DIR)):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(OUT_DIR, f), encoding="utf-8") as fh:
                blob = json.load(fh)
            if blob.get("dry_run"):
                continue
            seed = blob.get("seed", "compgame")
            for r in blob.get("results", []):
                tag = hashlib.sha256(f"{seed}:{r['id']}".encode()).hexdigest()[:16]
                remap[tag] = r["grade"].get("level")
        except (json.JSONDecodeError, KeyError, OSError):
            continue

    pairs = [(h, remap[t]) for t, h in human.items() if t in remap]
    if not pairs:
        print(f"  {len(human)} hand-coded rows, but none matched a machine grade.")
        print("  Grade the batch first (without --dry-run), then re-run --kappa.")
        return 1

    h, m = [p[0] for p in pairs], [p[1] for p in pairs]
    res = grade.cohen_kappa(h, m)
    print(f"\n  Cohen's kappa (human vs {os.environ.get('OLLAMA_LLM', 'gemma4:e4b')})")
    print(f"  n = {res['n']} of {len(human)} hand-coded")
    print(f"  raw agreement = {res['agreement']}")
    print(f"  kappa         = {res['kappa']}   {res.get('verdict', res.get('note', ''))}")
    if res["kappa"] is not None and res["kappa"] < 0.6:
        print("\n  Below 0.6. Report the short-answer grades as descriptive colour only,")
        print("  or improve the rubric and re-grade. Do not quietly use them as a measure.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
