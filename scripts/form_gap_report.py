"""Form C desk-review packet: where Forms A/B turned out non-equivalent, and what Form C asks there.

Why: the 2026-10-08 interim found CONTROL (nothing between pre and post) rising +5.9 pp per item,
with the same item pairs rising in both arms (r = 0.74) -- some Form B items are simply easier than
their Form A partners, which ceiling'd the post-check. Form C item N targets the same concept as
A/B item N, so the slots where A->B jumped are where Form C most needs a human difficulty read.

    python scripts/form_gap_report.py <researcher-export.json> [--out docs/retention-review-packet.md]

Input is the PSEUDONYMISED researcher export (/api/researcher/export). Output is aggregate only:
per topic x item slot correct-rates. It asserts that no participant id from the export appears in
the packet. Reads backend/checks.py (A/B key) and docs/retention-item-banks.md (Form C); writes
nothing else. "Hardened" = the stem differs from the pre-hardening bank (commit 1614c72).
"""
import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, HERE)
import checks as C  # noqa: E402
import validate_retention_bank as V  # noqa: E402

PRE_HARDENING = "1614c72"
GAP_FLAG = 0.15


def form_c_stems(text: str) -> dict:
    """{topic: {slot: stem}} from a Form C bank text, using the validator's own regexes."""
    out = {}
    marks = [(m.start(), m.group(1)) for m in C._TOPIC_RE.finditer(text)]
    for i, (start, topic) in enumerate(marks):
        chunk = text[start:marks[i + 1][0] if i + 1 < len(marks) else len(text)]
        f = V._FORM_C_RE.search(chunk)
        if not f:
            continue
        body = chunk[f.start():]
        found = {int(i_[1:]): s.strip() for i_, s, _ in V._ITEM_C_RE.findall(body)}
        if not found:
            found = {int(i_[1:]): s.strip() for i_, s, _ in V._ITEM_SHARED_C_RE.findall(body)}
        out[topic] = found
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("export")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs", "retention-review-packet.md"))
    a = ap.parse_args()

    rows = json.load(open(a.export, encoding="utf-8"))
    pids = {r["participant_id"] for r in rows}
    # (topic, slot, arm, side) -> [n_correct, n]
    tally = defaultdict(lambda: [0, 0])
    for r in rows:
        if r["event_type"] not in ("topic_pretest", "topic_posttest"):
            continue
        m = json.loads(r["meta"] or "{}")
        key = C._key(r["topic_id"], m.get("form") or "")
        if not key or m.get("arm") not in ("FLIP", "CONTROL"):
            continue
        side = "pre" if r["event_type"] == "topic_pretest" else "post"
        ans = m.get("answers") or {}
        for item, right in key.items():
            t = tally[(r["topic_id"], int(item[1:]), m["arm"], side)]
            t[0] += (ans.get(item) or "").strip().lower()[:1] == right
            t[1] += 1

    def rate(topic, slot, arm, side):
        c, n = tally.get((topic, slot, arm, side), (0, 0))
        return (c / n, n) if n else (None, 0)

    bank = C._load()
    now = form_c_stems(open(os.path.join(ROOT, "docs", "retention-item-banks.md"), encoding="utf-8").read())
    old_text = subprocess.run(["git", "show", f"{PRE_HARDENING}:docs/retention-item-banks.md"],
                              cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout
    old = form_c_stems(old_text)

    topics = [t for t in bank if t in now]
    flagged, sections = [], []
    for t in topics:
        lines = [f"## {t}", ""]
        for slot in sorted(now[t]):
            a_items = {int(i["id"][1:]): i["stem"] for i in bank[t].get("A", [])}
            b_items = {int(i["id"][1:]): i["stem"] for i in bank[t].get("B", [])}
            pa, na = rate(t, slot, "CONTROL", "pre")
            pb, nb = rate(t, slot, "CONTROL", "post")
            gap = (pb - pa) if (pa is not None and pb is not None) else None
            hard = old.get(t, {}).get(slot) not in (None, now[t][slot])
            flag = gap is not None and abs(gap) >= GAP_FLAG
            if flag or hard:
                flagged.append((t, slot, gap, hard))
            tag = " ".join(x for x in ("**⚠ A/B gap**" if flag else "", "**hardened**" if hard else "") if x)
            g = f"{gap:+.0%}" if gap is not None else "n/a"
            lines += [f"### Slot {slot}  {tag}".rstrip(),
                      f"- CONTROL correct: A {pa:.0%} (n={na}) → B {pb:.0%} (n={nb}), gap **{g}**"
                      if pa is not None and pb is not None else "- CONTROL correct: no data (no bank or unreleased)",
                      f"- **A{slot}:** {a_items.get(slot, '—')}",
                      f"- **B{slot}:** {b_items.get(slot, '—')}",
                      f"- **C{slot}:** {now[t][slot]}", ""]
        sections.append("\n".join(lines))

    head = [
        "# Form C desk-review packet",
        "",
        "*Generated by `scripts/form_gap_report.py` from the pseudonymised researcher export — aggregate "
        "correct-rates only. Regenerate, don't hand-edit.*",
        "",
        "**How to use.** Form C item N tests the same concept as A/B item N. Where CONTROL's correct "
        "rate jumped from A to B with nothing taught in between (⚠, |gap| ≥ 15 pp), the B item is "
        "probably easier than its A partner — check that C is not built the same easy way. Items "
        "marked **hardened** were rewritten 2026-09-26 for difficulty and still need a content read. "
        "For each flagged slot: is C answerable without the concept? Is the key unambiguous? Is it "
        "harder than B?",
        "",
        f"**Flagged slots: {len(flagged)}** (gap ≥ {GAP_FLAG:.0%} or hardened)",
        "",
        "| Topic | Slot | CONTROL A→B gap | Hardened |",
        "|---|---|---|---|",
    ] + [f"| {t} | {s} | {('%+.0f%%' % (g * 100)) if g is not None else 'n/a'} | {'yes' if h else ''} |"
         for t, s, g, h in flagged] + [""]
    text = "\n".join(head) + "\n" + "\n".join(sections)
    leaked = [p for p in pids if p and p in text]
    assert not leaked, f"participant id in packet: {leaked[:3]}"
    open(a.out, "w", encoding="utf-8").write(text)
    print(f"wrote {a.out}: {len(topics)} topics, {len(flagged)} flagged slots, "
          f"{sum(1 for *_, h in flagged if h)} hardened; 0 participant ids in output")
    return 0


if __name__ == "__main__":
    sys.exit(main())
