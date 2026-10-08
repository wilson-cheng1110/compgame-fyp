import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python %s <researcher-export.json>" % sys.argv[0])
import json, sys
from datetime import datetime, timedelta, timezone
import pandas as pd, statsmodels.formula.api as smf
cfg = json.load(open(os.path.join(ROOT, "backend", "topic_schedule.json"), encoding="utf-8"))
tz = timezone(timedelta(hours=8)); ses = {t["id"]: str(t["session"]) for t in cfg["topics"]}
rows = json.load(open(EXPORT, encoding="utf-8"))
pre, post = {}, {}
for r in rows:
    k = (r["participant_id"], r["topic_id"])
    if r["event_type"] == "topic_pretest": pre[k] = r
    elif r["event_type"] == "topic_posttest": post[k] = r
out = []
for k, r in pre.items():
    m = json.loads(r["meta"] or "{}"); sec = m.get("section"); s = ses.get(k[1])
    d = cfg["sessions"].get(s, {}).get(sec) if s else None
    if not d or k not in post: continue
    lec = datetime.fromisoformat(d).replace(hour=cfg["session_hour"], tzinfo=tz)
    h = (datetime.fromisoformat(r["server_ts"]) - lec).total_seconds() / 3600
    when = "on time (>48h before)" if h < -48 else ("late, still before lecture" if h < 0 else "AFTER the lecture")
    out.append(dict(pid=k[0], topic=k[1], arm=m.get("arm"), when=when, pre=r["score"], post=post[k]["score"],
                    flip=int(m.get("arm") == "FLIP")))
d = pd.DataFrame(out)
print(d.when.value_counts(normalize=True).round(3).to_dict(), "n", len(d))
print(d.groupby("when").agg(pre=("pre", "mean"), post=("post", "mean"), n=("pre", "size")).round(1))
print("share AFTER lecture by arm:", d.assign(a=d.when.eq("AFTER the lecture")).groupby("arm").a.mean().round(3).to_dict())
for w, x in d.groupby("when"):
    if x.pid.nunique() < 30: continue
    mm = smf.mixedlm("post ~ flip + pre + C(topic)", x, groups=x["pid"]).fit()
    print(f"  {w:28} FLIP effect {mm.params['flip']:+.2f} [{mm.conf_int().loc['flip',0]:+.2f}, {mm.conf_int().loc['flip',1]:+.2f}] p={mm.pvalues['flip']:.3f}")
