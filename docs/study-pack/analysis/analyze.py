#!/usr/bin/env python3
"""
COMPGame Stage-1 analysis scaffold.

Reads the Google-Forms (or paper-entered) response CSVs, scores everything against
item-bank.json, and prints + saves the numbers the paper needs:

  H1  per-topic & overall pre/post %, Hake normalized gain <g> (+ bootstrap 95% CI),
      paired Wilcoxon + Cohen's dz, gain class (low/med/high), and item analysis
      (difficulty P, corrected item-total discrimination r_pb, with flags).
  H2  IMI subscale means (reverse-scoring M9, M11) + Cronbach's alpha.
  H3  CoI Teaching/Social Presence means + alpha   (non-validated adaptation - exploratory).
  H4  ARCS-Satisfaction + global means + alpha      (descriptive, null-expected).
  --  Paas cognitive load per topic; reflection self-perceived-learning mean.

One-group pretest-posttest design (no control). <g> is a FEASIBILITY signal, not a
confirmatory test of H1-H4 - see ../06_scoring-codebook-analysis.md A.

Usage:
    python analyze.py                # uses ./responses/ and the CONFIG below
    python analyze.py --responses DIR --out DIR

Deps: pandas, numpy, scipy   (pip install -r requirements.txt)
"""

import argparse
import json
import math
import os
import re
import sys
import unicodedata

import numpy as np
import pandas as pd
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- CONFIG: map each form's exported CSV to its role. Edit filenames to match your exports. ----
# Concept keys are ("topic", "A"|"B"). Leave a file out (or point to a missing path) to skip it.
CONFIG = {
    "demographics": "consent_demographics.csv",
    "battery": "post_battery.csv",
    "reflection": "reflection.csv",
    "concept": {
        ("weber", "A"): "weber_pre.csv",
        ("weber", "B"): "weber_post.csv",
        ("ps", "A"): "problem_solving_pre.csv",
        ("ps", "B"): "problem_solving_post.csv",
        ("gestalt", "A"): "gestalt_pre.csv",
        ("gestalt", "B"): "gestalt_post.csv",
        ("miller", "A"): "miller_pre.csv",
        ("miller", "B"): "miller_post.csv",
    },
    # If you used the COMBINED pre/post forms (SEPARATE_TOPIC_FORMS=false), instead set:
    #   "concept_combined": {"A": "concept_pretest.csv", "B": "concept_posttest.csv"}
    # and the script will split by the "Topic - A1." column prefix.
    "concept_combined": {},
}

WARNINGS = []
def warn(msg):
    WARNINGS.append(msg)
    print("  [warn] " + msg, file=sys.stderr)

# ---------- normalization (bridges ASCII keys <-> unicode form text) ----------

_REPL = [("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'),
         ("—", "-"), ("–", "-"), ("−", "-"),
         ("±", "+/-"), ("→", "->"), ("⇒", "->")]

def norm(s):
    if s is None:
        return ""
    if isinstance(s, float) and math.isnan(s):
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    for a, b in _REPL:
        s = s.replace(a, b)
    return " ".join(s.lower().split())

# ---------- io ----------

def read_csv(path):
    return pd.read_csv(path, encoding="utf-8-sig", dtype=str)

def pid_column(df):
    for c in df.columns:
        if "participant code" in norm(c):
            return c
    return None

def keyed(df):
    """Index a response frame by normalized participant code; drop blanks."""
    pc = pid_column(df)
    if pc is None:
        warn("no 'Participant code' column found - skipping a file")
        return None
    out = df.copy()
    out["_pid"] = out[pc].map(lambda v: norm(v).upper())
    out = out[out["_pid"] != ""]
    out = out.drop_duplicates("_pid", keep="last").set_index("_pid")
    return out

# ---------- column finders ----------

def find_concept_col(df, code, topic_name=None):
    cands = [c for c in df.columns if re.search(r"(?<![A-Za-z0-9])" + re.escape(code) + r"\.", c)]
    if topic_name and len(cands) > 1:
        tn = norm(topic_name)
        narrowed = [c for c in cands if tn in norm(c)]
        if narrowed:
            cands = narrowed
    return cands[0] if cands else None

def find_grid_col(df, code):
    for c in df.columns:
        if re.search(r"\[\s*" + re.escape(code) + r"\.", c):
            return c
    # fallback: a plain "CODE." somewhere (in case the grid wasn't used)
    for c in df.columns:
        if re.search(r"(?<![A-Za-z0-9])" + re.escape(code) + r"\.", c):
            return c
    return None

def parse_likert(v):
    m = re.match(r"\s*(\d+)", "" if v is None else str(v))
    return float(m.group(1)) if m else np.nan

# ---------- scoring ----------

def score_concept(bank, responses_dir):
    """Return a frame indexed by pid with weber_A1.. (0/1) and {topic}_pre_pct/_post_pct."""
    pieces = []
    combined = CONFIG.get("concept_combined") or {}

    def score_one(df, topic, form, topic_name):
        keys = bank["concept"][topic][form]
        cols = {}
        missing = []
        for code, correct in keys.items():
            col = find_concept_col(df, code, topic_name if combined else None)
            if col is None:
                missing.append(code)
                cols[f"{topic}_{code}"] = pd.Series(np.nan, index=df.index)
                continue
            cells = df[col]
            cols[f"{topic}_{code}"] = cells.map(
                lambda v, k=correct: np.nan if norm(v) == "" else float(norm(v) == norm(k)))
        if missing:
            warn(f"{topic} Form {form}: items not found in CSV -> {missing} (scored NaN)")
        frame = pd.DataFrame(cols)
        pct_col = f"{topic}_{'pre' if form == 'A' else 'post'}_pct"
        frame[pct_col] = frame[[f"{topic}_{c}" for c in keys]].mean(axis=1) * 100.0
        return frame

    for (topic, form), fname in CONFIG["concept"].items():
        path = os.path.join(responses_dir, fname)
        if not os.path.exists(path):
            warn(f"concept file missing: {fname} ({topic} Form {form}) - skipped")
            continue
        df = keyed(read_csv(path))
        if df is not None:
            pieces.append(score_one(df, topic, form, bank["concept"][topic]["name"]))

    for form, fname in combined.items():
        path = os.path.join(responses_dir, fname)
        if not os.path.exists(path):
            warn(f"combined concept file missing: {fname} - skipped")
            continue
        df = keyed(read_csv(path))
        if df is None:
            continue
        for topic in bank["topic_order"]:
            pieces.append(score_one(df, topic, form, bank["concept"][topic]["name"]))

    if not pieces:
        return pd.DataFrame()
    out = pd.concat(pieces, axis=1)
    out = out.loc[:, ~out.columns.duplicated()]
    return out

def score_questionnaire(bank, responses_dir):
    """IMI/CoI/ARCS/reflection subscale means + the raw item frame (for alpha)."""
    subs = bank["questionnaire"]["subscales"]
    rev = set(bank["questionnaire"]["reverse_items"])
    hi = bank["questionnaire"]["likert_max"]
    lo = bank["questionnaire"]["likert_min"]

    item_vals = {}
    for role in ("battery", "reflection"):
        fname = CONFIG.get(role)
        path = os.path.join(responses_dir, fname) if fname else None
        if not path or not os.path.exists(path):
            warn(f"{role} file missing ({fname}) - its items scored NaN")
            continue
        df = keyed(read_csv(path))
        if df is None:
            continue
        codes = sorted({c for items in subs.values() for c in items})
        for code in codes:
            col = find_grid_col(df, code)
            if col is None:
                continue
            raw = df[col].map(parse_likert)
            if code in rev:
                raw = (hi + lo) - raw
            item_vals.setdefault(code, raw)

    items = pd.DataFrame(item_vals)
    means = {}
    for name, codes in subs.items():
        present = [c for c in codes if c in items.columns]
        if not present:
            continue
        means[name] = items[present].mean(axis=1)
    return pd.DataFrame(means), items

def score_paas(bank, responses_dir):
    fname = CONFIG.get("reflection")
    path = os.path.join(responses_dir, fname) if fname else None
    if not path or not os.path.exists(path):
        return pd.DataFrame()
    df = keyed(read_csv(path))
    if df is None:
        return pd.DataFrame()
    out = {}
    for topic in bank["paas"]["topics"]:
        tn = norm(bank["concept"][topic]["name"])
        col = next((c for c in df.columns if "effort" in norm(c) and tn in norm(c)), None)
        if col is None:
            warn(f"Paas load column for {topic} not found")
            continue
        out[f"load_{topic}"] = df[col].map(parse_likert)
    return pd.DataFrame(out)

# ---------- stats ----------

def cronbach_alpha(item_df):
    df = item_df.dropna()
    k = df.shape[1]
    if k < 2 or df.shape[0] < 2:
        return np.nan
    item_var = df.var(axis=0, ddof=1).sum()
    total_var = df.sum(axis=1).var(ddof=1)
    if total_var == 0:
        return np.nan
    return (k / (k - 1.0)) * (1.0 - item_var / total_var)

def boot_ci(vals, nboot=5000, seed=0):
    v = np.asarray([x for x in vals if x is not None and not (isinstance(x, float) and math.isnan(x))], float)
    if v.size < 2:
        return (np.nan, np.nan)
    rng = np.random.default_rng(seed)
    means = rng.choice(v, size=(nboot, v.size), replace=True).mean(axis=1)
    return (float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5)))

def hake_g(pre, post):
    if any(x is None or math.isnan(x) for x in (pre, post)):
        return np.nan
    if pre >= 100.0:
        return np.nan  # ceiling: undefined
    return (post - pre) / (100.0 - pre)

def gain_class(g):
    if g is None or math.isnan(g):
        return "n/a"
    return "high" if g > 0.7 else ("medium" if g >= 0.3 else "low")

def paired_block(pre, post):
    d = pd.DataFrame({"pre": pre, "post": post}).dropna()
    n = len(d)
    res = {"n": n, "pre_mean": np.nan, "post_mean": np.nan, "W": np.nan, "p": np.nan, "dz": np.nan}
    if n == 0:
        return res
    res["pre_mean"] = d["pre"].mean()
    res["post_mean"] = d["post"].mean()
    diff = d["post"] - d["pre"]
    sd = diff.std(ddof=1)
    res["dz"] = diff.mean() / sd if (n > 1 and sd and not math.isnan(sd)) else np.nan
    if n >= 1 and (diff != 0).any():
        try:
            w = stats.wilcoxon(d["post"], d["pre"])
            res["W"], res["p"] = float(w.statistic), float(w.pvalue)
        except ValueError:
            pass
    return res

# ---------- report ----------

def f(x, nd=2):
    return "  n/a" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{nd}f}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--responses", default=os.path.join(HERE, "responses"))
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--bank", default=os.path.join(HERE, "item-bank.json"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    with open(args.bank, encoding="utf-8") as fh:
        bank = json.load(fh)

    print(f"Reading responses from: {args.responses}")
    concept = score_concept(bank, args.responses)
    quest, items = score_questionnaire(bank, args.responses)
    paas = score_paas(bank, args.responses)

    frames = [x for x in (concept, quest, paas) if not x.empty]
    if not frames:
        print("\nNo scorable data found. Put the exported CSVs in the responses/ folder "
              "(see README), then re-run.")
        return
    scored = pd.concat(frames, axis=1)
    n = scored.shape[0]
    lines = []
    def out(s=""):
        print(s); lines.append(s)

    out("=" * 72)
    out(f"COMPGame Stage-1 analysis   |   N = {n} participants")
    out("One-group pretest-posttest. <g> = feasibility signal, not confirmatory.")
    out("=" * 72)

    # ---- H1 ----
    out("\n## H1  Learning performance (concept inventory, Hake <g>)\n")
    out(f"{'topic':<14}{'n':>4}{'pre%':>8}{'post%':>8}{'<g>':>7}{'class':>8}{'dz':>7}{'p(Wil)':>9}  g 95% CI")
    topic_g_overall = {}
    for t in bank["topic_order"]:
        pre_c, post_c = f"{t}_pre_pct", f"{t}_post_pct"
        if pre_c not in scored or post_c not in scored:
            out(f"{t:<14}  (no data)")
            continue
        pb = paired_block(scored[pre_c], scored[post_c])
        gs = [hake_g(a, b) for a, b in zip(scored[pre_c], scored[post_c])]
        gmean = np.nanmean(gs) if np.any(~np.isnan(gs)) else np.nan
        ci = boot_ci(gs)
        topic_g_overall[t] = gmean
        out(f"{t:<14}{pb['n']:>4}{f(pb['pre_mean'],1):>8}{f(pb['post_mean'],1):>8}"
            f"{f(gmean):>7}{gain_class(gmean):>8}{f(pb['dz']):>7}{f(pb['p'],3):>9}"
            f"  [{f(ci[0])}, {f(ci[1])}]")
    # overall pooled
    pre_cols = [f"{t}_pre_pct" for t in bank["topic_order"] if f"{t}_pre_pct" in scored]
    post_cols = [f"{t}_post_pct" for t in bank["topic_order"] if f"{t}_post_pct" in scored]
    if pre_cols and post_cols:
        scored["overall_pre_pct"] = scored[pre_cols].mean(axis=1)
        scored["overall_post_pct"] = scored[post_cols].mean(axis=1)
        pb = paired_block(scored["overall_pre_pct"], scored["overall_post_pct"])
        gs = [hake_g(a, b) for a, b in zip(scored["overall_pre_pct"], scored["overall_post_pct"])]
        gmean = np.nanmean(gs) if np.any(~np.isnan(gs)) else np.nan
        ci = boot_ci(gs)
        out("-" * 72)
        out(f"{'OVERALL':<14}{pb['n']:>4}{f(pb['pre_mean'],1):>8}{f(pb['post_mean'],1):>8}"
            f"{f(gmean):>7}{gain_class(gmean):>8}{f(pb['dz']):>7}{f(pb['p'],3):>9}"
            f"  [{f(ci[0])}, {f(ci[1])}]")
    out("\n  Note: dz = paired Cohen's d; p = Wilcoxon signed-rank. At focus-group N, lead with")
    out("  effect size + CI, not p. Items at ceiling (pre=100%) are excluded from <g>.")

    # ---- item analysis (H1 validation - the Stage-1 job) ----
    out("\n## H1  Item analysis  (P = difficulty/prop-correct, r_pb = corrected item-total)\n")
    out(f"{'item':<12}{'P':>7}{'r_pb':>8}   flags")
    rows = []
    for t in bank["topic_order"]:
        for form in ("A", "B"):
            codes = list(bank["concept"][t][form].keys())
            cols = [f"{t}_{c}" for c in codes if f"{t}_{c}" in scored]
            if not cols:
                continue
            block = scored[cols]
            total = block.sum(axis=1)
            for c in cols:
                P = block[c].mean()
                rest = total - block[c]
                rpb = np.nan
                if (block[c].notna().sum() > 2
                        and block[c].std(ddof=1) > 0 and rest.std(ddof=1) > 0):
                    rpb = block[c].corr(rest)
                flags = []
                if not math.isnan(P) and P < 0.20: flags.append("too-hard")
                if not math.isnan(P) and P > 0.95: flags.append("ceiling")
                if not math.isnan(rpb) and rpb < 0.20: flags.append("weak-D")
                out(f"{c:<12}{f(P):>7}{f(rpb):>8}   {','.join(flags)}")
                rows.append({"item": c, "P": P, "r_pb": rpb, "flags": ";".join(flags)})
    if rows:
        pd.DataFrame(rows).to_csv(os.path.join(args.out, "item_analysis.csv"), index=False)

    # ---- H2/H3/H4 + reflection ----
    def scale_block(title, names, note=""):
        out(f"\n## {title}{(' - ' + note) if note else ''}\n")
        out(f"{'subscale':<16}{'n':>4}{'mean':>7}{'sd':>7}{'alpha':>8}")
        for nm in names:
            if nm not in quest:
                continue
            s = quest[nm].dropna()
            codes = bank["questionnaire"]["subscales"][nm]
            present = [c for c in codes if c in items.columns]
            a = cronbach_alpha(items[present]) if len(present) >= 2 else np.nan
            out(f"{nm:<16}{len(s):>4}{f(s.mean()):>7}{f(s.std(ddof=1)):>7}{f(a):>8}")

    scale_block("H2  Motivation (IMI, 1-5)", ["imi_ie", "imi_pc", "imi_ei", "imi_vu", "imi_total"])
    scale_block("H3  Interaction (CoI, 1-5)", ["coi_tp", "coi_sp"],
                note="non-validated adaptation; exploratory")
    scale_block("H4  Satisfaction (ARCS, 1-5)", ["arcs_s", "arcs_global"],
                note="descriptive, null-expected")
    scale_block("Reflection  self-perceived learning (1-5)", ["reflection_rl"])

    # ---- Paas ----
    if not paas.empty:
        out("\n## Cognitive load (Paas, 1-9, per topic)\n")
        out(f"{'topic':<14}{'n':>4}{'mean':>7}{'sd':>7}")
        for t in bank["paas"]["topics"]:
            col = f"load_{t}"
            if col in scored:
                s = scored[col].dropna()
                out(f"{t:<14}{len(s):>4}{f(s.mean()):>7}{f(s.std(ddof=1)):>7}")

    # ---- save + warnings ----
    scored.to_csv(os.path.join(args.out, "scored_wide.csv"))
    out("\n" + "=" * 72)
    if WARNINGS:
        out(f"{len(WARNINGS)} warning(s) - review stderr above (missing files/columns score NaN).")
    out(f"Saved: {os.path.join(args.out, 'scored_wide.csv')}")
    out(f"       {os.path.join(args.out, 'item_analysis.csv')}")
    out(f"       {os.path.join(args.out, 'report.txt')}")
    with open(os.path.join(args.out, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

if __name__ == "__main__":
    main()
