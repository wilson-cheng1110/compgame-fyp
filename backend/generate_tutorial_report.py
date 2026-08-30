"""The teacher's tutorial brief. docs/revamp.md Part 12.

    python generate_tutorial_report.py --topic webers-law --section B
    python generate_tutorial_report.py --topic webers-law --section B --no-llm

Writes TWO files, always, into reports/<cohort>/<section>/:

    <topic>-<date>-teacher.md      carries SIDs. NEVER leaves this machine.
    <topic>-<date>-discussion.md   anonymised. Safe to project in the tutorial.

BOTH, EVERY TIME, and the anonymised one is not optional. The moment a report with
names gets screen-shared during a study that needed ethics approval, you have a
data-protection incident. Generating only the teacher version and "being careful"
is not a control; generating the safe one by default is.

TWO PASSES, AND THE SPLIT IS THE POINT.

  Pass 1 is CODE. Every count, percentage, delta and denominator. An LLM asked to
  count gets it wrong, and a teacher who catches one wrong number stops trusting
  the entire report -- including the parts that were right.

  Pass 2 is the LLM, and only for what it is actually good at: clustering free text
  into misconception themes, choosing representative quotes, proposing discussion
  points. It receives the Pass-1 numbers as FIXED CONTEXT and is told it may cite
  them but never recompute them.

With --no-llm (or with Ollama down) Pass 1 still produces a complete, useful,
entirely trustworthy report. That is the intended degradation: the numbers are the
part the teacher needs, and they never depend on a model being up.
"""

import argparse
import io
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone

import checks
import grade
import measures
import research_store
import schedule

HERE = os.path.dirname(os.path.abspath(__file__))
REPORTS = os.environ.get("REPORTS_DIR", os.path.join(HERE, "..", "reports"))
GRADES_DIR = os.environ.get("GRADES_DIR", os.path.join(HERE, "..", "reports", "grades"))

PRE_EVENT, POST_EVENT = "topic_pretest", "topic_posttest"
PROBE_PRE, PROBE_POST = "topic_probe", "topic_probe_post"


def _meta(row) -> dict:
    m = row.get("meta")
    if isinstance(m, str):
        try:
            return json.loads(m)
        except (json.JSONDecodeError, ValueError):
            return {}
    return m if isinstance(m, dict) else {}


# ── Pass 1: counting, in code ────────────────────────────────────────────────

def gather(topic: str, section: str) -> dict:
    """Every number in the report. No model involved, by design."""
    rows = [r for r in research_store.fetch_all() if r.get("topic_id") == topic]
    rows = [r for r in rows if _meta(r).get("section") == section] or rows

    roster = [sid for sid, sec in _roster().items() if sec == section]

    pre = {r["participant_id"]: r for r in rows if r["event_type"] == PRE_EVENT}
    post = {r["participant_id"]: r for r in rows if r["event_type"] == POST_EVENT}
    probes = [r for r in rows if r["event_type"] in (PROBE_PRE, PROBE_POST)]

    def mean_score(d):
        vals = [r["score"] for r in d.values() if r.get("score") is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    pre_pct, post_pct = mean_score(pre), mean_score(post)

    # Hake's normalized gain, on the students who sat BOTH. Computing it over
    # everyone would mix a pre-only student's missing post into the mean.
    both = set(pre) & set(post)
    gains = []
    for sid in both:
        a, b = pre[sid].get("score"), post[sid].get("score")
        if a is None or b is None or a >= 100:
            continue
        gains.append((b - a) / (100 - a))
    hake = round(sum(gains) / len(gains), 3) if gains else None

    bank = checks.bank_report().get(topic, {})

    # Per-item error rate on the post-check -- which specific item the class missed
    # is the most directly actionable number in the whole report.
    item_wrong = Counter()
    item_seen = Counter()
    for r in post.values():
        answers = _meta(r).get("answers") or {}
        try:
            graded = checks.grade_submission(topic, "B", answers, reveal=True)
        except ValueError:
            continue
        for it in graded["items"]:
            item_seen[it["id"]] += 1
            if not it.get("was_correct"):
                item_wrong[it["id"]] += 1

    # THE DENOMINATOR HAS TO BE HONEST OR THE REPORT IS WORTHLESS.
    # `roster` comes from enrolled_sids.txt. If it is stale, filtered to the wrong
    # section, or simply absent, len(roster) can be SMALLER than the number of
    # students who actually sat the topic -- which renders as "n = 20 of 2". A
    # teacher who reads one impossible number stops believing the rest of the file,
    # including the numbers that were right. So when the roster is not credible we
    # say so and drop the denominator rather than printing a ratio we don't have.
    roster_credible = len(roster) >= len(set(pre) | set(post))

    return {
        "topic": topic,
        "section": section,
        "roster_n": len(roster),
        "roster_credible": roster_credible,
        "started_n": len(set(pre) | set(post) | {p["participant_id"] for p in probes}),
        "pre_n": len(pre), "post_n": len(post), "both_n": len(both),
        "pre_pct": pre_pct, "post_pct": post_pct, "hake_g": hake,
        "chance_pct": bank.get("chance_pct"),
        "n_options": bank.get("n_options"),
        "item_error": {i: (item_wrong[i], item_seen[i]) for i in sorted(item_seen)},
        "not_completed": sorted(set(roster) - set(post)) if roster_credible else [],
        # DID THEY ACTUALLY DO IT.
        #
        # The report could say "pre 41% -> post 58%" without ever saying how many of
        # those students opened the activity, so a teacher had no way to read a flat
        # gain: is the game not teaching, or did half the class never launch it?
        # Those call for opposite tutorials. Derived server-side in measures.py from
        # event timestamps -- never from a flag the browser sent.
        "participation": [m for m in measures.per_topic() if m["topic_id"] == topic
                          and (not roster or m["participant_id"] in set(roster))],
        # Slow AND wrong. The most useful thing a tutorial can know and it is
        # invisible without timing: a student at chance in 2 seconds needs a word
        # about effort, one at chance in four minutes needs teaching. Same score.
        "effort": [e for e in measures.effort()
                   if e["topic_id"] == topic and e["phase"] == "post"
                   and (not roster or e["participant_id"] in set(roster))],
        "probes": probes,
        "grades": _load_grades(topic),
    }


def _roster() -> dict:
    try:
        import auth_store
        auth_store._refresh_enrolment()
        return dict(auth_store._enrolment)
    except Exception:
        return {}


def _load_grades(topic: str) -> dict:
    """event_id -> grade, from the most recent non-dry grade_batch run."""
    out = {}
    if not os.path.isdir(GRADES_DIR):
        return out
    for f in sorted(os.listdir(GRADES_DIR)):
        if not f.endswith(".json"):
            continue
        try:
            with open(os.path.join(GRADES_DIR, f), encoding="utf-8") as fh:
                blob = json.load(fh)
            if blob.get("dry_run"):
                continue
            for r in blob.get("results", []):
                if r.get("topic_id") == topic:
                    out[r["id"]] = r["grade"]
        except (json.JSONDecodeError, KeyError, OSError):
            continue
    return out


def short_answer_counts(data: dict) -> dict:
    levels = Counter()
    missed = Counter()
    hit = Counter()
    for p in data["probes"]:
        g = data["grades"].get(p["id"])
        if g is None:
            # A probe with no text was never sent to the grader at all -- calling it
            # "not yet graded" tells the teacher to re-run a batch that would skip
            # it forever. It is a non-response, which is a different fact.
            if not (_meta(p).get("answer") or "").strip():
                levels["no answer"] += 1
            else:
                levels["not yet graded"] += 1
            continue
        lvl = g.get("level")
        levels[lvl if lvl in grade.LEVELS else "ungradeable"] += 1
        for k in g.get("rubric_hit") or []:
            hit[k] += 1
    points = grade.rubric_for(data["topic"])["points"]
    graded_n = sum(levels[k] for k in grade.LEVELS)
    for k in points:
        missed[k] = graded_n - hit[k]
    return {"levels": levels, "hit": hit, "missed": missed, "graded_n": graded_n,
            "points": points}


# ── Pass 2: the model, on text only ──────────────────────────────────────────

_PASS2 = """You are helping a university tutor prepare a 50-minute tutorial. Below are
anonymous short answers from students who just finished an online module on {topic},
plus the counts that have ALREADY been computed.

DO NOT COMPUTE OR RESTATE ANY NUMBER THAT IS NOT IN THE FIXED FACTS BLOCK. You may cite
those numbers. If you want to say how many students did something and it is not listed,
say "several" or "a number of" instead. Inventing a count destroys the tutor's trust in
the whole report.

FIXED FACTS (already computed, treat as ground truth):
{facts}

STUDENT ANSWERS:
{answers}

Return ONLY this JSON:
{{"got": ["<what most students genuinely understood, each with a short verbatim quote>"],
  "broke": ["<a specific misconception, with a short verbatim quote showing it>"],
  "discussion": ["<a concrete thing to DO in the tutorial: a case to open with, a question to pose, a comparison to draw>"]}}

Two or three items per list. Be specific and usable -- "revise the concept" is useless;
"open with the $5-off-a-$20-shirt vs $5-off-a-$500-laptop case" is what a tutor wants.
Every quote must be VERBATIM from an answer above."""


def pass_two(data: dict, sa: dict) -> dict | None:
    answers = [p for p in data["probes"] if (_meta(p).get("answer") or "").strip()]
    if not answers:
        return None

    lines = []
    for i, p in enumerate(answers[:60], 1):          # bounded: this is one prompt
        g = data["grades"].get(p["id"], {})
        lvl = g.get("level")
        lines.append(f"{i}. [{lvl or 'ungraded'}] {_meta(p).get('answer','').strip()}")

    facts = (f"- {sa['graded_n']} answers graded: "
             f"full {sa['levels']['full']}, partial {sa['levels']['partial']}, "
             f"none {sa['levels']['none']}\n"
             f"- MC pre {data['pre_pct']}% -> post {data['post_pct']}% "
             f"(n={data['both_n']} sat both)\n")
    for k, n in sa["missed"].most_common():
        if n > 0:
            facts += f"- {n} of {sa['graded_n']} did NOT hit the rubric point '{k}'\n"

    prompt = _PASS2.format(topic=data["topic"], facts=facts, answers="\n".join(lines))

    try:
        from langchain_ollama import ChatOllama
        model = os.environ.get("OLLAMA_LLM", "gemma4:e4b")
        # Same cliff as the grader: a low num_predict on this model returns an
        # EMPTY string rather than a truncated one (see grade.py). This prompt is
        # far longer and the reply far larger, so the headroom is larger too.
        llm = ChatOllama(model=model, temperature=0.3, format="json",
                         num_predict=int(os.environ.get("REPORT_NUM_PREDICT", "3072")))
        raw = llm.invoke(prompt)
        text = getattr(raw, "content", raw)
        if not str(text).strip():
            return {"_error": "model returned an empty reply (see the num_predict note in grade.py)"}
        obj = json.loads(re.sub(r"^```(?:json)?|```$", "", str(text).strip(), flags=re.M))
        return {k: [str(x) for x in obj.get(k, [])][:4] for k in ("got", "broke", "discussion")}
    except Exception as e:
        return {"_error": f"{type(e).__name__}: {e}"}


def _check_status():
    """One line when the daily checks failed or stopped running. None when fine."""
    path = os.path.join(HERE, "..", "deploy", "last-check.txt")
    try:
        raw = io.open(path, encoding="utf-8").read().strip()
        age_h = (datetime.now(timezone.utc)
                 - datetime.fromtimestamp(os.path.getmtime(path), timezone.utc)
                 ).total_seconds() / 3600
    except OSError:
        return ("The daily data checks have never run, so nothing below is verified. "
                "See docs/measurement-plan.md.")
    if age_h > 48:
        return (f"The daily data checks last ran {age_h / 24:.0f} days ago -- something "
                f"has stopped. Treat the numbers below with care.")
    if raw.startswith("FAIL"):
        parts = raw.split(" ", 2)
        which = parts[2] if len(parts) > 2 else "unknown"
        return (f"The daily data checks FAILED ({which}). Run "
                f"`python backend/check_measurement_coverage.py` before trusting anything "
                f"below.")
    return None


# ── rendering ────────────────────────────────────────────────────────────────

def render(data: dict, sa: dict, llm: dict | None, identified: bool, stamp: str,
           blind: bool = True) -> str:
    """`blind` hides the EXPERIMENT from the lecturer's copies.

    Both the course lecturer and Wilson read these (confirmed 2026-08-30). A lecturer
    who learns that some students saw the game before the second check can, with the
    best intentions, teach to compensate -- and differential instruction by condition
    is a confound that lands on H1 and cannot be removed afterwards. They do not need
    the sequence to plan a tutorial; they need what was missed and who is struggling.

    So the two lecturer files say nothing about order or arms, and a third
    `-research` file carries everything.
    """
    t = data["topic"]
    lv = sa["levels"]
    who = (f"n = {data['post_n']} of {data['roster_n']}" if data["roster_credible"]
           else f"n = {data['post_n']} completed")
    head = (f"# {t} — tutorial brief\n\n"
            f"section {data['section']} · {who} "
            f"· generated {stamp}\n\n")

    if not identified:
        head += ("*Anonymised version — safe to project. Quotes are verbatim but "
                 "unattributed; no SIDs appear anywhere in this file.*\n\n")
    else:
        head += (f"*{'RESEARCH' if not blind else 'TEACHER'} VERSION — contains student SIDs"
                 f"{' AND the study conditions (FLIP/CONTROL, sequence)' if not blind else ''}. Do not screen-share, "
                 "email, or upload this file.*\n\n")

    # THE CHECKS REACH A HUMAN HERE, and that is the whole point of writing them to
    # a file. A scheduled task that fails into a log nobody opens is the same silent
    # failure it was built to catch; a brief is a document somebody reads before
    # every tutorial. No new alerting channel and nothing extra to remember.
    out = [head]
    warn = _check_status()
    if warn:
        out.append(f"> **{warn}**\n\n")
    # Roster mismatch, surfaced at the TOP not buried in Flags. The integration sweep
    # noted the whole participation section vanishes silently when the generator's
    # ENROLMENT_PATH differs from the deployed server's — the teacher just sees a
    # smaller report with no idea a chunk is missing. Say so where they will see it.
    if not data["roster_credible"]:
        out.append("> **This brief is running against a different class list than the "
                   "live server** (the participation section is omitted). If numbers look "
                   "thin, match `ENROLMENT_PATH` to the deployed server's roster.\n\n")
    out.append("## Where the class landed\n")
    if data["pre_pct"] is not None and data["post_pct"] is not None:
        line = f"MC pre {data['pre_pct']}% → post {data['post_pct']}%"
        if data["hake_g"] is not None:
            line += f"  ·  normalized gain ⟨g⟩ = {data['hake_g']} (n = {data['both_n']} sat both)"
        if data["chance_pct"]:
            line += f"  ·  chance = {data['chance_pct']}% ({data['n_options']} options)"
        out.append(line + "\n")
    else:
        out.append("_No MC bank for this topic yet — short answer only._\n")

    if sa["graded_n"] or lv.get("not yet graded"):
        out.append(f"\nShort answer: full {lv['full']} · partial {lv['partial']} · "
                   f"none {lv['none']} · ungradeable {lv['ungradeable']}"
                   + (f" · {lv['no answer']} left blank" if lv.get("no answer") else "")
                   + (f" · **{lv['not yet graded']} not yet graded** "
                      f"(run `grade_batch.py --topic {t}`)" if lv.get("not yet graded") else "")
                   + "\n")

    # -- participation, ahead of the item breakdown -------------------------
    part = data.get("participation") or []
    if part:
        no_act = [m for m in part if m["played_first_basis"] == "activity never recorded"]
        played = [m for m in part if m["played_first"] is not None]
        first = [m for m in played if m["played_first"]]
        escaped = [m for m in part if m["skipped_activity"]]
        out.append("\n## Did they actually do the activity\n")
        out.append(f"Of {len(part)} student(s) with any record on this topic, "
                   f"**{len(part) - len(no_act)} "
                   f"{'has' if len(part) - len(no_act) == 1 else 'have'} the activity "
                   f"recorded** and {len(no_act)} "
                   f"{'does' if len(no_act) == 1 else 'do'} not.\n")
        # ARM-REVEALING. Kept out of the lecturer's copies -- see render()'s docstring.
        if played and not blind:
            out.append(f"\nOf those that can be placed in sequence: {len(first)} played it "
                       f"BEFORE the second check, {len(played) - len(first)} after.\n")
        if escaped:
            out.append(f"\n{len(escaped)} pressed \"the activity didn't record\" and carried "
                       f"on. Worth a word - either the game broke for them, or they went "
                       f"round it.\n")
        if no_act and not played:
            out.append("\n**Read this before the gain above.** No activity is recorded for "
                       "anyone here, and that looks identical whether the class was idle or "
                       "the pipe was broken - it was broken for ten weeks in 2026. Run "
                       "`python check_measurement_coverage.py` before concluding anything "
                       "about the game.\n")

    # -- who to spend the hour on ------------------------------------------
    eff = data.get("effort") or []
    if eff:
        strug = [e for e in eff if e["verdict"] == "struggling"]
        rapid = [e for e in eff if e["verdict"] == "rapid guess"]
        untimed = [e for e in eff if e["verdict"] == "no timing"]
        out.append("\n## Who to spend the hour on\n")
        if strug:
            out.append(f"**{len(strug)} took their time and still got it wrong.** These are "
                       f"the ones worth calling on: they engaged and it did not land, which "
                       f"is a teaching problem and the most useful thing on this page.\n")
            if identified:
                out.append("\n" + ", ".join(
                    f"`{e['participant_id']}` ({e['correct']}/{e['total']}, "
                    f"{e['sec_per_item']}s per question)" for e in strug[:20]) + "\n")
        if rapid:
            out.append(f"\n{len(rapid)} answered fast enough that the answers are not really "
                       f"answers. That is an effort problem rather than a comprehension one, "
                       f"and the two need opposite responses.\n")
            if identified:
                out.append("\n" + ", ".join(f"`{e['participant_id']}`" for e in rapid[:20]) + "\n")
        if untimed and not (strug or rapid):
            out.append(f"\n{len(untimed)} submission(s) carry no timing, so effort cannot be "
                       f"judged here.\n")
        if not strug and not rapid and not untimed:
            out.append("Nobody stands out on time against accuracy.\n")

    if data["item_error"]:
        out.append("\n### Per-item, post-check\n")
        for item_id, (wrong, seen) in data["item_error"].items():
            if seen:
                bar = "█" * round(10 * wrong / seen)
                out.append(f"- `{item_id}` {wrong}/{seen} wrong  {bar}\n")

    if sa["missed"]:
        out.append("\n### Rubric points the class missed\n")
        for k, n in sa["missed"].most_common():
            if n > 0 and sa["graded_n"]:
                out.append(f"- **{k}** — missed by {n} of {sa['graded_n']} graded"
                           f" · _{sa['points'].get(k,'')[:110]}_\n")

    if llm and "_error" not in llm:
        for title, key in (("What they got", "got"), ("Where it broke", "broke"),
                           ("Suggested discussion points", "discussion")):
            if llm.get(key):
                out.append(f"\n## {title}\n")
                for i, item in enumerate(llm[key], 1):
                    out.append(f"{i}. {item}\n")
    else:
        why = (llm or {}).get("_error", "skipped (--no-llm)")
        out.append(f"\n## What they got / Where it broke / Discussion points\n"
                   f"_Pass 2 did not run: {why}._\n"
                   f"_Everything above is Pass 1 and is unaffected — it is computed in "
                   f"code and does not depend on a model._\n")

    out.append("\n## Flags\n")
    if not data["roster_credible"]:
        out.append(f"- **Class-list mismatch.** {data['roster_n']} student(s) on the "
                   f"section-{data['section']} list, but {data['post_n']} sat the "
                   f"post-check. The completion rate and the non-completion list are "
                   f"therefore NOT reported — a denominator that produces \"n = 20 of 2\" "
                   f"would discredit every other number here. Check `enrolled_sids.txt`.\n")
    n_missing = len(data["not_completed"])
    if n_missing:
        if identified:
            out.append(f"- {n_missing} did not complete: "
                       f"{', '.join(data['not_completed'])}\n")
        else:
            out.append(f"- {n_missing} did not complete _(SIDs in the teacher version)_\n")
    blur = sum(1 for p in data["probes"]
               if (_meta(p).get("telemetry") or {}).get("tab_blur_count", 0) > 3)
    if blur:
        out.append(f"- {blur} session(s) with high off-tab time. **Treat as an analysis "
                   f"covariate and a caveat, never as an accusation** (Part 11).\n")
    if not n_missing and not blur:
        out.append("- none\n")

    out.append(f"\n---\n*Numbers computed in code; prose clustered by "
               f"{os.environ.get('OLLAMA_LLM','gemma4:e4b') if llm and '_error' not in llm else 'no model'}. "
               f"Rubric: docs/grading-rubric.md.*\n")
    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", required=True)
    ap.add_argument("--section", required=True)
    ap.add_argument("--cohort", default=os.environ.get("COHORT", "COMP3423"))
    ap.add_argument("--no-llm", action="store_true")
    args = ap.parse_args()

    data = gather(args.topic, args.section)
    if data["started_n"] == 0:
        print(f"  no events for {args.topic} / section {args.section}.")
        return 1

    sa = short_answer_counts(data)
    llm = None if args.no_llm else pass_two(data, sa)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = os.path.join(REPORTS, args.cohort, f"section-{args.section}")
    os.makedirs(out_dir, exist_ok=True)

    written = []
    # THREE files, and the third is the point of the split. The two lecturer copies
    # are blind to the experiment; the research copy is not. Writing all three every
    # time is the same discipline as always writing the anonymised one -- a control
    # you have to remember is not a control.
    for identified, blind, suffix in ((True, True, "teacher"),
                                      (False, True, "discussion"),
                                      (True, False, "research")):
        path = os.path.join(out_dir, f"{args.topic}-{stamp}-{suffix}.md")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(render(data, sa, llm, identified, stamp, blind))
        written.append(path)

    # Cheap structural check that the anonymised file is actually anonymous. The
    # LLM writes quotes into it, and a student who types their own SID into a
    # short answer would otherwise carry it straight through to the projector.
    with open(written[1], encoding="utf-8") as fh:
        anon = fh.read()
    leaked = [sid for sid in _roster() if sid and sid in anon]
    if leaked:
        print(f"  WARNING: {len(leaked)} SID(s) appear in the DISCUSSION version "
              f"({', '.join(leaked[:3])}...). Do not project it until you have removed them.")

    for p in written:
        print(f"  -> {p}")
    if llm and "_error" in llm:
        print(f"  Pass 2 skipped: {llm['_error']}")
    print("  The teacher version carries SIDs. It must not leave this machine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
