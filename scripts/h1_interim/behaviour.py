"""Does on-site behaviour reflect learning? Decisiveness on the pre/post checks. EXPLORATORY.

Not "click faster after the Fitts game": knowing Fitts' law does not change motor speed, and the
telemetry stores no target geometry, so clicks cannot be fitted to Fitts' law. What each check
item DOES record (TELEMETRY_ENABLED, from 2026-09-10): hover dwell per option, selection changes,
cursor direction changes, total time. Hesitation should fall as knowledge rises.

  (a) does post-check hesitation fall more in FLIP than CONTROL (pre-check hesitation covariate)?
  (b) validity: does hesitation on an item predict getting it wrong?
  (c) does the share of hover time on the CORRECT option rise from pre to post, by arm?

    python behaviour.py <researcher-export.json>
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json, math, warnings
import numpy as np, pandas as pd
import statsmodels.formula.api as smf
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.join(ROOT, "backend"))
import checks

rows = json.load(open(EXPORT, encoding="utf-8"))
arm = {}
for r in rows:
    if r["event_type"] == "topic_pretest":
        arm[(r["participant_id"], r["topic_id"])] = json.loads(r["meta"] or "{}").get("arm")

items = []
for r in rows:
    if r["event_type"] not in ("topic_pretest", "topic_posttest"):
        continue
    m = json.loads(r["meta"] or "{}"); tel = m.get("telemetry") or {}
    k = (r["participant_id"], r["topic_id"]); a = arm.get(k)
    key = checks._key(r["topic_id"], m.get("form") or "")
    if a not in ("FLIP", "CONTROL") or not key or not tel:
        continue
    ans = m.get("answers") or {}
    for item, right in key.items():
        t = tel.get(item)
        if not isinstance(t, dict) or not t.get("total_time_ms"):
            continue
        dwell = t.get("hover_dwell_ms") or {}
        tot = sum(v for v in dwell.values() if isinstance(v, (int, float)))
        items.append(dict(
            pid=k[0], topic=k[1], side="pre" if r["event_type"] == "topic_pretest" else "post",
            flip=int(a == "FLIP"), correct=int((ans.get(item) or "").strip().lower()[:1] == right),
            mouse=t.get("input_modality") == "mouse",
            hovered=sum(1 for v in dwell.values() if isinstance(v, (int, float)) and v > 300),
            sel=t.get("selection_changes") or 0, dirc=t.get("direction_changes") or 0,
            logt=math.log(max(t["total_time_ms"], 1) / 1000),
            dwell_correct=(dwell.get(right, 0) / tot) if tot else None))
d = pd.DataFrame(items)
print(f"item responses with telemetry: {len(d)} ({d.pid.nunique()} students); mouse {d.mouse.mean():.0%}")

# Hesitation index: z-scored mean of options-hovered, selection changes, direction changes, log time.
mo = d[d.mouse].copy()
for c in ("hovered", "sel", "dirc", "logt"):
    mo[c + "_z"] = (mo[c] - mo[c].mean()) / mo[c].std()
# Validity (b) on the 2026-10-08 export showed time and direction changes go WITH being right
# (effort, not doubt) while selection changes and options-hovered go with being wrong -- so the
# index is built from the two components that actually track doubt.
mo["hes_all4"] = mo[["hovered_z", "sel_z", "dirc_z", "logt_z"]].mean(axis=1)
mo["hes"] = mo[["hovered_z", "sel_z"]].mean(axis=1)

def fit(formula, df, term):
    f = smf.mixedlm(formula, df, groups=df["pid"]).fit()
    ci = f.conf_int().loc[term]
    return f"{f.params[term]:+.3f} [{ci[0]:+.3f}, {ci[1]:+.3f}] p={f.pvalues[term]:.3f} (n={len(df)})"

# (b) validity first: if hesitation does not track being wrong, (a) and (c) mean little.
post = mo[mo.side == "post"]
print("\n(b) VALIDITY — post-check item correct ~ hesitation + topic + (1|student):")
print("    hesitation, all 4 parts  ", fit("correct ~ hes_all4 + C(topic)", post, "hes_all4"))
print("    hesitation (hovered+sel) ", fit("correct ~ hes + C(topic)", post, "hes"))
for c in ("hovered_z", "sel_z", "dirc_z", "logt_z"):
    print(f"    {c[:-2]:24}", fit(f"correct ~ {c} + C(topic)", post, c))

# (a) post hesitation by arm, controlling pre hesitation (per student x topic means)
st = mo.groupby(["pid", "topic", "side", "flip"]).hes.mean().unstack("side").dropna().reset_index()
print("\n(a) post-check hesitation ~ flip + pre-check hesitation + topic + (1|student):")
print("    flip effect (negative = FLIP more decisive)", fit("post ~ flip + pre + C(topic)", st, "flip"))
print(f"    pre -> post hesitation: FLIP {st[st.flip==1].pre.mean():+.2f} -> {st[st.flip==1].post.mean():+.2f}, "
      f"CONTROL {st[st.flip==0].pre.mean():+.2f} -> {st[st.flip==0].post.mean():+.2f}")

# (c) share of hover time on the correct option
dc = mo.dropna(subset=["dwell_correct"])
sc = dc.groupby(["pid", "topic", "side", "flip"]).dwell_correct.mean().unstack("side").dropna().reset_index()
print("\n(c) share of hover dwell on the CORRECT option (chance ~0.25):")
print(f"    pre -> post: FLIP {sc[sc.flip==1].pre.mean():.2f} -> {sc[sc.flip==1].post.mean():.2f}, "
      f"CONTROL {sc[sc.flip==0].pre.mean():.2f} -> {sc[sc.flip==0].post.mean():.2f}")
print("    flip effect on post share (pre share covariate)", fit("post ~ flip + pre + C(topic)", sc, "flip"))
