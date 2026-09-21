import os, sys, json, csv, tempfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BE)

# Point research_store at a throwaway db BEFORE importing it -- DB_PATH is read at import
# time (same pattern test_research_api.py uses).
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tmp_code_batch")
os.makedirs(d, exist_ok=True)
db_path = os.path.join(d, "r.db")
if os.path.exists(db_path):
    os.remove(db_path)
os.environ["RESEARCH_DB_PATH"] = db_path

import research_store
import code_batch as CB
import grade as G

research_store.init_db()

ok = fail = 0
def check(label, cond, extra=""):
    global ok, fail
    if cond: ok += 1; print(f"  PASS  {label}")
    else:    fail += 1; print(f"  FAIL  {label}  {extra}")


def turn(role, content, direct=False, ts="2026-09-01T09:00:00.000Z"):
    t = {"role": role, "content": content, "ts": ts}
    if direct:
        t["direct"] = True
    return t


# ── synthetic transcripts ──────────────────────────────────────────────────────

P1, P2, P3, P4 = "24111111A", "24222222B", "24333333C", "24444444D"

# P1 / webers-law: a rich, generative reflection with genuine insight.
p1_transcript = [
    turn("assistant", "Why does adding 1kg feel obvious at 2kg but not at 50kg?"),
    turn("human", "Because it's a ratio thing -- like the phone buzzing example, the CHANGE "
                  "has to be big relative to what's already there, not a fixed amount."),
]
research_store.record_event({
    "participant_id": P1, "event_type": "reflection_complete", "topic_id": "webers-law",
    "meta": {"turns": 1, "countedTurns": 1, "insight": True, "endReason": "insight",
             "directAnswers": 0, "transcript": p1_transcript,
             "turnQuality": [{"counts": True, "understood": True}]},
})

# P2 / webers-law: shallow metacognitive turn, PLUS one direct "just tell me" (executive proxy).
p2_transcript = [
    turn("assistant", "Why does adding 1kg feel obvious at 2kg but not at 50kg?"),
    turn("human", "Oh okay, I get it now I think."),
    turn("human", "Just tell me the answer, I am stuck.", direct=True),
    turn("assistant", "Straight answer: it's about the ratio, not the absolute amount.", direct=True),
]
research_store.record_event({
    "participant_id": P2, "event_type": "reflection_complete", "topic_id": "webers-law",
    "meta": {"turns": 2, "countedTurns": 1, "insight": False, "endReason": "floor",
             "directAnswers": 1, "transcript": p2_transcript,
             "turnQuality": [{"counts": True, "understood": False}]},
})

# P3 / webers-law: left early. No transcript at all.
research_store.record_event({
    "participant_id": P3, "event_type": "reflection_skipped", "topic_id": "webers-law",
    "meta": {"turns": 0, "directAnswers": 0},
})

# P4 / gestalt: TWO reflection_complete events (the debrief-screen replay flow). The FIRST one
# carries a distinctive marker so the dedupe test can tell which one collect() picked.
p4_first = [
    turn("assistant", "What made the grouped icons easier to scan?"),
    turn("human", "FIRST-RUN-MARKER: proximity grouped them so I read the set as one thing."),
]
p4_second = [
    turn("assistant", "What made the grouped icons easier to scan?"),
    turn("human", "SECOND-RUN-MARKER: closeness made them feel like one group."),
]
research_store.record_event({
    "participant_id": P4, "event_type": "reflection_complete", "topic_id": "gestalt",
    "meta": {"turns": 1, "countedTurns": 1, "insight": True, "endReason": "insight",
             "directAnswers": 0, "transcript": p4_first, "turnQuality": []},
})
research_store.record_event({
    "participant_id": P4, "event_type": "reflection_complete", "topic_id": "gestalt",
    "meta": {"turns": 1, "countedTurns": 1, "insight": True, "endReason": "insight",
             "directAnswers": 0, "transcript": p4_second, "turnQuality": []},
})


print("\n-- collect(): reads the sink the same way grade_batch.collect() does --")
all_rows = research_store.fetch_all()
check("5 rows landed in the sink", len(all_rows) == 5, len(all_rows))

records = CB.collect()
check("deduped: one unit per (participant, topic) -- 4 pairs, not 5 rows",
      len(records) == 4, len(records))

by_pid = {r["participant_id"]: r for r in records}
check("P1 is codable (has a real transcript)", by_pid[P1]["has_transcript"] is True)
check("P2 is codable too", by_pid[P2]["has_transcript"] is True)
check("P3 (skipped) is NOT codable -- no transcript", by_pid[P3]["has_transcript"] is False)
check("P3's event_type recorded as reflection_skipped", by_pid[P3]["event_type"] == "reflection_skipped")

print("\n-- dedupe picks the FIRST reflection_complete, not the last (replay flow) --")
check("P4's chosen transcript is the FIRST run",
      "FIRST-RUN-MARKER" in json.dumps(by_pid[P4]["transcript"]), by_pid[P4]["transcript"])
check("...and NOT the second run",
      "SECOND-RUN-MARKER" not in json.dumps(by_pid[P4]["transcript"]))

print("\n-- --no-dedupe surfaces every recorded event --")
undeduped = CB.collect(dedupe=False)
check("5 raw rows, un-deduplicated", len(undeduped) == 5, len(undeduped))
p4_raw = [r for r in undeduped if r["participant_id"] == P4]
check("both of P4's replay events are present", len(p4_raw) == 2, len(p4_raw))

print("\n-- topic filter --")
webers_only = CB.collect(topic="webers-law")
check("topic filter narrows to the 3 webers-law pairs", len(webers_only) == 3,
      [r["participant_id"] for r in webers_only])

print("\n-- render_transcript() marks direct turns for the coder --")
rendered = CB.render_transcript(by_pid[P2]["transcript"])
check("student turns are labelled", "[STUDENT]" in rendered, rendered)
check("tutor turns are labelled", "[TUTOR]" in rendered, rendered)
check("the direct ask is flagged", "[STUDENT [DIRECT ASK]]" in rendered, rendered)
check("empty/None transcript renders to empty string", CB.render_transcript(None) == "")

print("\n-- the double-coding sheet is blind by construction --")
codable = [r for r in records if r["has_transcript"]]
check("3 codable units (P1, P2, P4)", len(codable) == 3, [r["participant_id"] for r in codable])

sheet_path = os.path.join(d, "sheet.csv")
out_path = CB.write_double_coding_sheet(codable, seed="paper03", out=sheet_path)
check("sheet written to the requested path", out_path == sheet_path)

with open(sheet_path, encoding="utf-8") as fh:
    raw_text = fh.read()

for leak in (P1, P2, P3, P4, "insight", "endReason", "countedTurns", "24111111", "24222222", "24444444"):
    # SIDs, and the session-internal bookkeeping fields (insight/endReason/countedTurns), must
    # never appear -- the sheet carries only tag/topic_id/direct_answers_hint/transcript/notes.
    check(f"NO SID/label leak: {leak!r} absent from the emitted sheet", leak not in raw_text)

with open(sheet_path, encoding="utf-8", newline="") as fh:
    rows = list(csv.DictReader(fh))
check("one row per codable unit", len(rows) == 3, len(rows))
check("header matches the documented sheet shape", list(rows[0].keys()) == CB.SHEET_HEADER, list(rows[0].keys()))
check("no machine code pre-filled (blank reflection_depth)",
      all(r["reflection_depth(none/shallow/generative)"] == "" for r in rows))
check("no machine code pre-filled (blank help_seeking_style)",
      all(r["help_seeking_style(none/instrumental/executive)"] == "" for r in rows))
check("transcript text made it into the sheet",
      any("ratio thing" in r["transcript"] for r in rows))
check("direct_answers_hint rides along as a pre-filter, not a code",
      any(r["direct_answers_hint"] == "1" for r in rows))

print("\n-- reused grade.blind()/unblind(), not reimplemented --")
prepped = [{**r, "answer": CB.render_transcript(r["transcript"])} for r in codable]
blinded, mapping = G.blind(prepped, seed="paper03")
check("code_batch's sheet used the SAME tags grade.blind() would produce",
      {b["tag"] for b in blinded} == {r["tag"] for r in rows})
collection_order = [r["participant_id"] for r in codable]
sheet_order = [mapping[r["tag"]]["participant_id"] for r in rows]
check("sheet order is NOT collection order (blind() shuffles by tag, not by arrival)",
      sheet_order != collection_order, (sheet_order, collection_order))

print("\n-- ingest + Cohen's kappa, reusing grade.cohen_kappa() --")
# A small HAND-COMPUTABLE example. Reuse the sheet's own tags so read_coded_sheet()'s
# tag-matching is exercised for real, not against invented ids.
tags = [r["tag"] for r in rows]
# Only 3 codable rows exist above; pad the disagreement example out to 5 by hand-picking
# values (the numbers below are chosen to hand-verify, not derived from the fixture data).
a_codes = ["generative", "generative", "shallow", "none", "shallow"]
b_codes = ["generative", "shallow", "shallow", "none", "shallow"]
five_tags = (tags + ["synthtag1", "synthtag2"])[:5]

def write_axis_csv(path, tag_list, depth_list):
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(CB.SHEET_HEADER)
        for t, dep in zip(tag_list, depth_list):
            w.writerow([t, "webers-law", "", "", dep, "none", ""])

coder_a_path = os.path.join(d, "coder_a.csv")
coder_b_path = os.path.join(d, "coder_b.csv")
write_axis_csv(coder_a_path, five_tags, a_codes)
write_axis_csv(coder_b_path, five_tags, b_codes)

parsed_a = CB.read_coded_sheet(coder_a_path)
check("read_coded_sheet parses every row", len(parsed_a) == 5, parsed_a)
check("axis columns come back lower-cased and matched by tag",
      parsed_a[five_tags[0]]["reflection_depth"] == "generative", parsed_a[five_tags[0]])
check("the untouched axis (help_seeking_style) is read too",
      parsed_a[five_tags[0]]["help_seeking_style"] == "none")

report = CB.kappa_report(coder_a_path, coder_b_path)
check("5 tags common to both coders", report["n_common_tags"] == 5, report["n_common_tags"])

# Hand computation for reflection_depth:
#   observed agreement = 4/5 = 0.8 (rows 0,2,3,4 agree; row 1 disagrees)
#   categories: generative(A:2,B:1) shallow(A:2,B:3) none(A:1,B:1), each /5
#   expected   = (2/5*1/5) + (2/5*3/5) + (1/5*1/5) = 0.08 + 0.24 + 0.04 = 0.36
#   kappa      = (0.8 - 0.36) / (1 - 0.36) = 0.44 / 0.64 = 0.6875
hand_kappa = round((0.8 - 0.36) / (1 - 0.36), 3)
oracle = G.cohen_kappa(a_codes, b_codes)
depth = report["axes"]["reflection_depth"]
check("hand-computed kappa matches the harness's own number",
      depth["kappa"] == hand_kappa, (depth["kappa"], hand_kappa))
check("...and matches calling grade.cohen_kappa() directly (no reimplementation)",
      depth["kappa"] == oracle["kappa"], (depth["kappa"], oracle["kappa"]))
check("raw agreement is 0.8", depth["agreement"] == 0.8, depth["agreement"])
check("kappa 0.6875 rounds to >= 0.6 -- usable", depth["usable_ge_0_6"] is True, depth)
check("per-code distribution for coder A", depth["distribution_a"] == {"generative": 2, "shallow": 2, "none": 1},
      depth["distribution_a"])
check("per-code distribution for coder B", depth["distribution_b"] == {"generative": 1, "shallow": 3, "none": 1},
      depth["distribution_b"])

help_axis = report["axes"]["help_seeking_style"]
check("perfect agreement on the untouched axis -> kappa None (no variance) or 1.0",
      help_axis["kappa"] in (1.0, None), help_axis)

print("\n-- kappa below 0.6 is flagged, same threshold as docs/grading-rubric.md --")
low_a = os.path.join(d, "low_a.csv")
low_b = os.path.join(d, "low_b.csv")
write_axis_csv(low_a, five_tags, ["generative", "shallow", "none", "generative", "shallow"])
write_axis_csv(low_b, five_tags, ["none", "generative", "shallow", "shallow", "generative"])
low_report = CB.kappa_report(low_a, low_b)
low_depth = low_report["axes"]["reflection_depth"]
check("a chance-level disagreement pattern drops below 0.6",
      low_depth["kappa"] is not None and low_depth["kappa"] < 0.6, low_depth)
check("...and is marked not usable", low_depth["usable_ge_0_6"] is False, low_depth)

print("\n-- an unknown/typo'd code is surfaced, not silently accepted --")
typo_path = os.path.join(d, "typo.csv")
write_axis_csv(typo_path, five_tags, ["generative", "shallow", "generatve", "none", "shallow"])
typo_report = CB.kappa_report(typo_path, coder_b_path)
check("the typo'd code is flagged as unknown",
      "generatve" in typo_report["axes"]["reflection_depth"]["unknown_codes"],
      typo_report["axes"]["reflection_depth"]["unknown_codes"])

print("\n-- no overlap between two sheets is reported, not a crash --")
disjoint_path = os.path.join(d, "disjoint.csv")
write_axis_csv(disjoint_path, ["nope-a", "nope-b"], ["generative", "shallow"])
disjoint = CB.kappa_report(coder_a_path, disjoint_path)
check("zero common tags is reported as zero, not an exception", disjoint["n_common_tags"] == 0)

print("\n-- CLI-level --kappa exits non-zero only on a genuinely unusable input --")
missing_rc = CB._kappa_cli("does-not-exist.csv", coder_b_path)
check("missing file -> exit 1", missing_rc == 1)
disjoint_rc = CB._kappa_cli(disjoint_path, coder_a_path)
check("zero overlap -> exit 1", disjoint_rc == 1)
ok_rc = CB._kappa_cli(coder_a_path, coder_b_path)
check("a real, if imperfect, kappa -> exit 0 (a low kappa is reported honestly, not a failure)",
      ok_rc == 0)

print("\n-- the codebook is grounded in exactly the two axes the scope doc names --")
check("codebook has exactly the two axes", set(CB.CODEBOOK) == {"reflection_depth", "help_seeking_style"})
check("depth codes match DEPTH_CODES", set(CB.CODEBOOK["reflection_depth"]["codes"]) == set(CB.DEPTH_CODES))
check("help codes match HELP_CODES", set(CB.CODEBOOK["help_seeking_style"]["codes"]) == set(CB.HELP_CODES))
check("depth cites Bisra and Chi", "Bisra" in CB.CODEBOOK["reflection_depth"]["source"]
      and "Chi" in CB.CODEBOOK["reflection_depth"]["source"])
check("help-seeking cites Aleven", "Aleven" in CB.CODEBOOK["help_seeking_style"]["source"])

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
