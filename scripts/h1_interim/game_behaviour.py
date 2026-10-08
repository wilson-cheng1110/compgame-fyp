"""Game vs no-game behaviour (paper 09, board card #09). EXPLORATORY.

Same per-session reading as measures.game_behavior_summary (games: one visit; checks: one whole
submission, longest item time + summed movement; sessions < 3 s dropped). Tests:
  (a) Understanding game played BEFORE the post-check (FLIP) vs AFTER it (CONTROL):
      log minutes, pointer px/s, direction changes/min, idle share ~ flip + topic + (1|student)
  (b) within student: game sessions vs check sessions on the same measures.

    python game_behaviour.py <researcher-export.json>
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json, math, warnings
import pandas as pd
import statsmodels.formula.api as smf
warnings.filterwarnings("ignore")

rows = json.load(open(EXPORT, encoding="utf-8"))
arm = {(r["participant_id"], r["topic_id"]): json.loads(r["meta"] or "{}").get("arm")
       for r in rows if r["event_type"] == "topic_pretest"}
KIND = {"understanding_complete": "understanding", "assessment_complete": "assessment",
        "topic_pretest": "check", "topic_posttest": "check"}
recs = []
for r in rows:
    if r["event_type"] not in KIND:
        continue
    tel = json.loads(r["meta"] or "{}").get("telemetry")
    if not isinstance(tel, dict):
        continue
    parts = [tel] if KIND[r["event_type"]] != "check" else [t for t in tel.values() if isinstance(t, dict)]
    if not parts:
        continue
    n = lambda v: v if isinstance(v, (int, float)) and not isinstance(v, bool) else 0  # noqa: E731
    total = max(n(t.get("total_time_ms")) for t in parts)
    if total < 3000:
        continue
    recs.append(dict(pid=r["participant_id"], topic=r["topic_id"], kind=KIND[r["event_type"]],
                     flip=int(arm.get((r["participant_id"], r["topic_id"])) == "FLIP"),
                     has_arm=arm.get((r["participant_id"], r["topic_id"])) in ("FLIP", "CONTROL"),
                     log_min=math.log(total / 60000),
                     px_s=sum(n(t.get("path_length_px")) for t in parts) / (total / 1000),
                     dir_min=sum(n(t.get("direction_changes")) for t in parts) / (total / 60000),
                     idle=min(1.0, max(n(t.get("max_idle_ms")) for t in parts) / total)))
d = pd.DataFrame(recs)
print("sessions by kind:", d.groupby("kind").size().to_dict())

def fit(formula, df, term):
    f = smf.mixedlm(formula, df, groups=df["pid"]).fit()
    ci = f.conf_int().loc[term]
    return f"{f.params[term]:+.3f} [{ci[0]:+.3f}, {ci[1]:+.3f}] p={f.pvalues[term]:.3f} (n={len(df)}, students {df.pid.nunique()})"

u = d[(d.kind == "understanding") & d.has_arm]
print("\n(a) Understanding game, FLIP (before post-check) vs CONTROL (after), + topic + (1|student):")
for y, lab in (("log_min", "log minutes"), ("px_s", "pointer px/s"), ("dir_min", "direction changes/min"),
               ("idle", "longest idle share")):
    print(f"    {lab:24} flip effect {fit(f'{y} ~ flip + C(topic)', u, 'flip')}")

print("\n(b) within student: game session vs MC check session (+ topic + (1|student)):")
gc = d[d.kind.isin(["understanding", "check"])].assign(game=lambda x: (x.kind == "understanding").astype(int))
for y, lab in (("px_s", "pointer px/s"), ("dir_min", "direction changes/min"), ("idle", "longest idle share")):
    print(f"    {lab:24} game - check {fit(f'{y} ~ game + C(topic)', gc, 'game')}")
