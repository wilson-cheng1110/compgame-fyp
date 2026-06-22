# Analysis scaffold — COMPGame Stage-1

`analyze.py` turns the exported Forms response CSVs into the paper's numbers: Hake ⟨g⟩,
subscale means, Cronbach's α, item analysis. Scoring config lives in `item-bank.json`.

## Setup

```bash
pip install -r requirements.txt          # pandas, numpy, scipy
```

## Get the data in

1. In each Google Form: **Responses → Link to Sheets**, then **File → Download → CSV** (or export
   the linked Sheet). For paper administration, type responses into a CSV with the same column
   headers the forms use.
2. Put the CSVs in `responses/` and name them to match the `CONFIG` block at the top of
   `analyze.py` (edit the filenames there if yours differ):

   | role | default filename |
   |------|------------------|
   | consent + demographics | `consent_demographics.csv` |
   | Weber pre / post | `weber_pre.csv` / `weber_post.csv` |
   | Problem Solving pre / post | `problem_solving_pre.csv` / `problem_solving_post.csv` |
   | Gestalt pre / post | `gestalt_pre.csv` / `gestalt_post.csv` |
   | Miller pre / post | `miller_pre.csv` / `miller_post.csv` |
   | post battery (IMI+CoI+ARCS) | `post_battery.csv` |
   | reflection + Paas | `reflection.csv` |

   Used the **combined** pre/post forms instead of 8 per-topic ones? Set `concept_combined` in
   CONFIG to your two filenames; the script splits them by the `Topic — A1.` column prefix.

## Run

```bash
python analyze.py                 # reads ./responses, writes ./out
python analyze.py --responses /path/to/csvs --out /path/to/out
```

Outputs (printed + saved to `out/`):
- `report.txt` — the full formatted report.
- `scored_wide.csv` — one row per participant: every item 0/1, topic pre/post %, ⟨g⟩, subscale
  means, Paas load. This is the dataset to drop into SPSS/JASP/R if you want more tests.
- `item_analysis.csv` — per-item difficulty P and corrected item-total r_pb with flags.

## What it computes

- **H1** per-topic + overall **pre/post %**, **Hake ⟨g⟩** with bootstrap 95% CI, paired
  **Wilcoxon** + **Cohen's dz**, gain class (low/med/high). Ceiling cells (pre = 100%) are dropped
  from ⟨g⟩ and counted. **Item analysis** (P, r_pb, flags `too-hard`/`ceiling`/`weak-D`) — this is
  the Stage-1 validation deliverable.
- **H2** IMI subscale means + α (auto reverse-scores **M9, M11**).
- **H3** CoI Teaching/Social Presence means + α — labelled *non-validated, exploratory*.
- **H4** ARCS-Satisfaction + global means + α — descriptive, null-expected.
- Paas load per topic; reflection self-perceived-learning mean.

## Trust / caveats

- **Matching is normalization-tolerant** — curly quotes, en/em dashes, `±`→`+/-`, `→`→`->`,
  whitespace and case are canonicalized on both sides, so the ASCII keys in `item-bank.json` match
  the unicode the forms emit. Verified on synthetic data (unicode cells score correctly).
- **Missing files/columns score NaN and emit a `[warn]` to stderr** — they never silently zero a
  score. If you see warnings, a filename or header didn't match; fix and re-run.
- **`item-bank.json` is the scoring source of truth.** If you edit the form wording, update the
  matching correct-answer text there too, or scoring drifts.
- **Design honesty carries through:** ⟨g⟩ is a one-group **feasibility signal**, not a
  confirmatory H1 test (see `../06_scoring-codebook-analysis.md` §A). With focus-group N, read the
  effect size + CI, not the p-value.
- **α and tests need variance and a few participants** — with N ≈ 3 or identical answers, α and
  some tests return `n/a`; that's correct, not a bug. They populate as real data comes in.
- **Open reflection text** is for manual thematic coding (`../06` §E) — not scored here.
