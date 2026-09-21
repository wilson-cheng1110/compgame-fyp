"""Reflection-depth / help-seeking coding harness. docs/lit/paper-03-coding-scheme.md.

    python code_batch.py --dry-run                          # what's collectable, no sheet written
    python code_batch.py --sheet                             # blind double-coding sheet, all topics
    python code_batch.py --sheet --topic webers-law          # one topic
    python code_batch.py --kappa coder_a.csv coder_b.csv      # inter-rater reliability, both axes

WHY THIS IS A HUMAN-ONLY HARNESS, NOT ANOTHER `grade_batch.py`.

`grade_batch.py` grades a short answer against a rubric with an LLM, because the grader *is* the
model by design (blindness is the point, and the "rubric" is a correctness key). Reflection depth
and help-seeking style are a different kind of thing: they are the qualitative constructs Bisra et
al. (2018) / Chi et al. (1989) and Aleven et al. (2016) themselves developed as HUMAN-CODED
schemes, not machine-graded ones, and the pre-registration commits to inter-rater-checked human
coding before anything here reaches the paper. An LLM-assisted first pass is named in the scope
doc as a possible *later* addition, once the two-human kappa is itself established — it is NOT
built here. There is no model call anywhere in this file, on purpose.

TWO THINGS THIS MODULE IS BUILT AROUND (same two as grade.py, same reasons):

1. **Blindness is structural, not polite.** `grade.blind()` is reused as-is: it strips
   participant id and shuffles before either coder sees a row. A transcript carries no explicit
   pre/post or arm label the way a probe answer does, but the same discipline applies — a coding
   sheet that could be re-sorted back into collection order would leak session-to-session
   identity even with names removed.
2. **`none` is not a fourth level bolted on for convenience.** It is the same missing-datum
   convention as `grade.py`'s null/none split (docs/grading-rubric.md): a reflection that was
   skipped, or a transcript with nothing to code on an axis, is EXCLUDED from that axis's kappa
   and its analysis denominator, not silently folded into the lowest real category.

DESIGN DECISION the scope doc flagged as open (paper-03-coding-scheme.md (b), row "Collect"):
`reflection_complete` is deliberately NOT in the once-per-topic unique index, so a participant x
topic pair can have more than one reflection row (the debrief-screen replay flow can reopen it).
`collect()`'s unit of analysis is ONE per (participant_id, topic_id) pair — but unlike
`measures.py`'s "first, not last" rule (which exists to stop a LATER replay from silently
re-labelling which arm a student was in), here we want the reflection that actually has something
to code: pick the first `reflection_complete` if any exist for that pair, else fall back to the
first `reflection_skipped` (a real "left early" event, kept for the `none` floor and attrition
accounting, never for depth/help-seeking coding). Pass `dedupe=False` to get every recorded
reflection event instead, un-deduplicated, for a volume/attrition audit.
"""

import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

import grade
import research_store

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.environ.get("CODING_DIR", os.path.join(HERE, "..", "reports", "coding"))

# `reflection_skipped` carries no transcript (nothing was finished) but is still collected --
# it seeds the `none` floor on both axes and lets attrition be counted honestly, per
# paper-03-coding-scheme.md (c).
REFLECTION_EVENTS = ("reflection_complete", "reflection_skipped")

DEPTH_CODES = ("none", "shallow", "generative")
HELP_CODES = ("none", "instrumental", "executive")

# ── the codebook, as structured constants ──────────────────────────────────────
# The human-readable version with worked examples lives at
# docs/study-pack/10_reflection-coding-codebook.md, for the coders to read while they work.
# This copy is the same categories in a form the harness (and its tests) can check against --
# two copies of the SAME two axes, not two different rubrics. Neither invents a category the
# scope doc doesn't already name.

CODEBOOK = {
    "reflection_depth": {
        "axis": "A",
        "source": "Bisra, Liu, Nesbit, Salimi & Winne (2018), Educational Psychology Review 30(3); "
                  "Chi, Bassok, Lewis, Reimann & Glaser (1989), Cognitive Science 13(2)",
        "codes": {
            "none": {
                "definition": "No substantive reflection turn to code -- the transcript is empty "
                              "(reflection_skipped), or every non-direct turn is off-topic.",
                "example": "(reflection_skipped -- no transcript recorded)",
                "basis": "Bookkeeping category, not from the psych literature -- reuses the "
                        "null-as-missing-datum convention (docs/grading-rubric.md 'The none/null split').",
            },
            "shallow": {
                "definition": "A metacognitive self-report about the student's own state of "
                              "knowing/feeling, with no new content connection.",
                "example": "\"Oh okay, I get it now.\" / \"I'm still a bit confused about this part.\"",
                "basis": "Bisra et al. (2018): self-explanation prompts eliciting only a metacognitive "
                        "self-report produce a SMALLER effect than prompts eliciting content connections.",
            },
            "generative": {
                "definition": "The turn constructs a content connection: explains why a mechanism "
                              "works, relates it to a different example or a prior misconception, or "
                              "extends the tutor's explanation with a new inference, in the student's "
                              "own words.",
                "example": "\"So it's like Weber's law -- the phone buzzing is only distracting in a "
                          "quiet room because the CHANGE is big relative to the background.\"",
                "basis": "Chi et al. (1989): good learners produced far more self-generated "
                        "explanations of this kind (15.3 vs 2.8), and explanation QUALITY (not just "
                        "presence) predicted problem-solving success.",
            },
        },
    },
    "help_seeking_style": {
        "axis": "B",
        "source": "Aleven, Roll, McLaren & Koedinger (2016), IJAIED 26(1); the executive-pattern cost "
                  "is Baker, Corbett, Koedinger & Wagner (2004)",
        "codes": {
            "none": {
                "definition": "No help-seeking turn in this reflection -- the student never asked "
                              "for the answer or a hint.",
                "example": "(a reflection that stayed a back-and-forth explanation)",
                "basis": "Bookkeeping category, same rationale as Axis A's none.",
            },
            "instrumental": {
                "definition": "The request is aimed at learning -- asks for a hint, an analogy, or "
                              "\"why,\" in a way that reduces future dependence on the tutor.",
                "example": "\"Can you give me a hint, not the whole answer?\" / \"Is there an "
                          "everyday example of this?\"",
                "basis": "Aleven et al. (2016): the instrumental category, which associates with "
                        "achievement.",
            },
            "executive": {
                "definition": "The request is aimed at finishing the task -- a direct \"just tell "
                              "me the answer\" ask, with minimal engagement with the reasoning.",
                "example": "\"Just tell me the answer.\" (what a direct:true turn logs)",
                "basis": "Aleven et al. (2016)'s executive category, which does not associate with "
                        "-- and per Baker et al. (2004)'s hint-abuse finding can predict LOWER -- "
                        "learning.",
            },
        },
    },
}


# ── collect ───────────────────────────────────────────────────────────────────

def _meta(row: dict) -> dict:
    meta = row.get("meta")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (json.JSONDecodeError, ValueError):
            return {}
    return meta if isinstance(meta, dict) else {}


def _has_transcript(event_type: str, transcript) -> bool:
    if event_type != "reflection_complete" or not isinstance(transcript, list) or not transcript:
        return False
    return any(isinstance(t, dict) and t.get("role") == "human" for t in transcript)


def collect(topic: str | None = None, dedupe: bool = True) -> list[dict]:
    """Pull reflection units out of the sink, carrying no more than a coder needs.

    Same read path grade_batch.collect() uses (research_store.fetch_all(), filtered by
    event_type), because that is the house pattern for this exact problem (paper-03-coding-scheme.md
    (c): "the exact same access path grade_batch.collect() already uses for probe answers").
    """
    flat = []
    for row in research_store.fetch_all():
        et = row.get("event_type")
        if et not in REFLECTION_EVENTS:
            continue
        if topic and row.get("topic_id") != topic:
            continue
        meta = _meta(row)
        transcript = meta.get("transcript") if et == "reflection_complete" else None
        flat.append({
            "id": row["id"],
            "participant_id": row.get("participant_id"),
            "topic_id": row.get("topic_id"),
            "event_type": et,
            "turns": meta.get("turns"),
            "counted_turns": meta.get("countedTurns"),
            "insight": meta.get("insight"),
            "end_reason": meta.get("endReason"),
            "direct_answers": meta.get("directAnswers"),
            "transcript": transcript,
            "turn_quality": meta.get("turnQuality") if et == "reflection_complete" else None,
            "has_transcript": _has_transcript(et, transcript),
        })

    if not dedupe:
        return flat

    groups: dict[tuple, list[dict]] = {}
    for u in flat:
        groups.setdefault((u["participant_id"], u["topic_id"]), []).append(u)

    chosen = []
    for units in groups.values():
        completes = [u for u in units if u["event_type"] == "reflection_complete"]
        chosen.append(completes[0] if completes else units[0])
    return chosen


# ── rendering, for the coder to actually read ──────────────────────────────────

def render_transcript(transcript: list[dict] | None) -> str:
    """One cell of coder-readable text. Marks direct turns -- Axis B needs to know which
    ones are the "just tell me" exchanges, per the codebook's pre-filter note, even though
    the code itself still requires reading the surrounding turns."""
    if not transcript:
        return ""
    lines = []
    for t in transcript:
        if not isinstance(t, dict):
            continue
        role = "TUTOR" if t.get("role") == "assistant" else "STUDENT"
        tag = " [DIRECT ASK]" if t.get("direct") else ""
        content = (t.get("content") or "").strip()
        lines.append(f"[{role}{tag}] {content}")
    return "\n".join(lines)


# ── the blind double-coding sheet ───────────────────────────────────────────────
# Mirrors grade_batch._sample(): a blank sheet, no machine code pre-filled, because an
# anchored coder measures compliance, not agreement -- doubly true here, where there IS no
# machine code to anchor on in the first place.

SHEET_HEADER = ["tag", "topic_id", "direct_answers_hint", "transcript",
               "reflection_depth(none/shallow/generative)",
               "help_seeking_style(none/instrumental/executive)", "notes"]


def write_double_coding_sheet(records: list[dict], seed: str = "compgame",
                              limit: int | None = None, out: str | None = None) -> str:
    """records must already be filtered to has_transcript==True -- coding a blank transcript
    wastes a human coder's time on a decision that isn't one (paper-03-coding-scheme.md (a)'s
    `none` bookkeeping category exists so those don't need a human at all).

    Reuses grade.blind() UNCHANGED (paper-03-coding-scheme.md (b): "Same two functions, reused
    as-is"). blind() only carries tag/topic_id/answer across the strip -- the rendered
    transcript rides in the `answer` field it already knows how to shuffle and re-join. The
    `direct_answers_hint` column is pulled back out of blind()'s own mapping afterwards: it is
    a behavioural count, not an identity or a pre/post label, so reading it off the (otherwise
    still-blind) mapping does not reintroduce anything blind() was built to strip.
    """
    prepped = [{**r, "answer": render_transcript(r["transcript"])} for r in records]
    blinded, mapping = grade.blind(prepped, seed=seed)
    if limit is not None:
        blinded = blinded[:limit]

    name = out or os.path.join(OUT_DIR, f"reflection-coding-sheet-{len(blinded)}.csv")
    os.makedirs(os.path.dirname(os.path.abspath(name)), exist_ok=True)
    with open(name, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(SHEET_HEADER)
        for b in blinded:
            rec = mapping[b["tag"]]
            w.writerow([b["tag"], b["topic_id"], rec.get("direct_answers"), b["answer"], "", "", ""])
    return name


# ── ingest + kappa ──────────────────────────────────────────────────────────────

def read_coded_sheet(path: str) -> dict:
    """tag -> {"reflection_depth": str|None, "help_seeking_style": str|None}.

    Column lookup is prefix-based (like grade_batch._kappa's `your_grade` lookup) so a coder
    who leaves the parenthesised hint in the header, or Excel round-trips the file, still parses.
    """
    out = {}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            tag = row.get("tag")
            if not tag:
                continue
            depth_col = next((k for k in row if k and k.startswith("reflection_depth")), None)
            help_col = next((k for k in row if k and k.startswith("help_seeking_style")), None)
            depth = (row.get(depth_col) or "").strip().lower() if depth_col else ""
            help_ = (row.get(help_col) or "").strip().lower() if help_col else ""
            out[tag] = {
                "reflection_depth": depth or None,
                "help_seeking_style": help_ or None,
            }
    return out


AXES = (
    ("reflection_depth", "Axis A -- reflection depth (Bisra et al. 2018 / Chi et al. 1989)", DEPTH_CODES),
    ("help_seeking_style", "Axis B -- help-seeking style (Aleven et al. 2016)", HELP_CODES),
)


def kappa_report(coder_a_csv: str, coder_b_csv: str) -> dict:
    """Pure: reads two completed sheets, matches by tag, and calls grade.cohen_kappa() per axis
    -- reused, not reimplemented, exactly as paper-03-coding-scheme.md (b) specifies. Kept
    separate from any printing/exit-code logic (below in _kappa_cli) so it is unit-testable the
    same way grade.py's pure functions are, without needing to capture stdout.
    """
    a = read_coded_sheet(coder_a_csv)
    b = read_coded_sheet(coder_b_csv)
    common = sorted(set(a) & set(b))

    axes = {}
    for col, label, valid in AXES:
        pairs = [(a[t][col], b[t][col]) for t in common
                if a[t][col] is not None and b[t][col] is not None]
        x = [p[0] for p in pairs]
        y = [p[1] for p in pairs]
        res = grade.cohen_kappa(x, y) if pairs else {"kappa": None, "n": 0, "agreement": None,
                                                       "note": "no rows coded on this axis by both coders"}
        unknown = sorted({v for v in set(x) | set(y) if v not in valid})
        axes[col] = {
            **res,
            "label": label,
            "valid_codes": valid,
            "unknown_codes": unknown,
            "distribution_a": dict(Counter(x)),
            "distribution_b": dict(Counter(y)),
            "usable_ge_0_6": (res["kappa"] is not None and res["kappa"] >= 0.6),
        }

    return {"n_common_tags": len(common), "n_a": len(a), "n_b": len(b), "axes": axes}


def _kappa_cli(coder_a_csv: str, coder_b_csv: str) -> int:
    def _resolve(p):
        return p if os.path.exists(p) else os.path.join(OUT_DIR, p)

    a_path, b_path = _resolve(coder_a_csv), _resolve(coder_b_csv)
    for p, name in ((a_path, coder_a_csv), (b_path, coder_b_csv)):
        if not os.path.exists(p):
            print(f"  no such file: {name}")
            return 1

    report = kappa_report(a_path, b_path)
    if report["n_common_tags"] == 0:
        print(f"  {report['n_a']} rows from coder A, {report['n_b']} from coder B, "
              f"but no tag appears in both. Did both coders code copies of the SAME sheet?")
        return 1

    print(f"\n  {report['n_common_tags']} rows coded by both "
          f"({report['n_a']} in A, {report['n_b']} in B)")
    for col, label, _ in AXES:
        r = report["axes"][col]
        print(f"\n  {label}")
        print(f"  n = {r['n']} coded by both on this axis")
        print(f"  raw agreement = {r['agreement']}")
        print(f"  kappa         = {r['kappa']}   {r.get('verdict', r.get('note', ''))}")
        print(f"  coder A distribution: {r['distribution_a']}")
        print(f"  coder B distribution: {r['distribution_b']}")
        if r["unknown_codes"]:
            print(f"  WARNING: code(s) not in the codebook: {r['unknown_codes']}")
        if r["kappa"] is not None and r["kappa"] < 0.6:
            print("  Below 0.6. Report this axis as descriptive colour only, or refine the "
                  "codebook and re-code -- same threshold docs/grading-rubric.md uses.")
    return 0


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--topic")
    ap.add_argument("--seed", default="compgame")
    ap.add_argument("--dedupe", dest="dedupe", action="store_true", default=True,
                    help="one unit per (participant, topic) -- the default")
    ap.add_argument("--no-dedupe", dest="dedupe", action="store_false",
                    help="every recorded reflection event, for a volume/attrition audit")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sheet", action="store_true", help="emit the blind double-coding sheet")
    ap.add_argument("--limit", type=int, metavar="N",
                    help="cap the sheet at N codable units (default: all of them)")
    ap.add_argument("--kappa", nargs=2, metavar=("CODER_A_CSV", "CODER_B_CSV"))
    ap.add_argument("--out")
    ap.add_argument("--print-codebook", action="store_true")
    args = ap.parse_args()

    if args.print_codebook:
        print(json.dumps(CODEBOOK, indent=2, ensure_ascii=False))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)

    if args.kappa:
        return _kappa_cli(*args.kappa)

    records = collect(args.topic, dedupe=args.dedupe)
    if not records:
        print(f"  no reflection events in the sink"
              f"{' for ' + args.topic if args.topic else ''}.")
        print(f"  looked for event_type in {REFLECTION_EVENTS}.")
        return 0

    codable = [r for r in records if r["has_transcript"]]
    none_floor = [r for r in records if not r["has_transcript"]]
    by_topic: dict = {}
    for r in records:
        t = by_topic.setdefault(r["topic_id"], {"codable": 0, "none_floor": 0})
        t["codable" if r["has_transcript"] else "none_floor"] += 1

    mode_desc = "deduped, one per participant x topic" if args.dedupe else "every recorded event"
    print(f"\n  {len(records)} reflection unit(s) ({mode_desc})")
    for topic, t in sorted(by_topic.items()):
        print(f"  {topic:<20} codable {t['codable']:>3} · none-floor (no transcript) {t['none_floor']:>3}")
    print(f"\n  {len(codable)} codable, {len(none_floor)} auto-`none` "
          f"(skipped / empty transcript -- not sent to a human coder)")

    if args.dry_run:
        return 0

    if args.sheet:
        if not codable:
            print("  nothing codable -- no sheet to write.")
            return 0
        path = write_double_coding_sheet(codable, seed=args.seed, limit=args.limit, out=args.out)
        n = args.limit if args.limit else len(codable)
        print(f"\n  -> {path}")
        print(f"  Give TWO independent coders each their own copy of this file. Codebook: "
              f"docs/study-pack/10_reflection-coding-codebook.md")
        print("  Code independently -- do not compare rows until both sheets are back.")
        print(f"  Then: python code_batch.py --kappa coder_a.csv coder_b.csv")
        return 0

    print("\n  Nothing written. Pass --sheet to emit the blind double-coding sheet, or "
          "--kappa CODER_A.csv CODER_B.csv once both are coded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
