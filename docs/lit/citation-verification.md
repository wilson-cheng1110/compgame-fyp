# Citation verification — web-resolved, not DOI-trusted

Every citation in `docs/lit/0X-*.md` web-checked 2026-09-19: the DOI/arXiv ID was **resolved** (not
trusted for merely existing) against doi.org / CrossRef / OpenAlex / Semantic Scholar / arXiv /
OpenLibrary, and existence/venue/year confirmed. Five parallel verifier agents, one per file-pair.

## Bottom line

**0 fabricated papers · 0 dead or mismatched DOIs/arXiv-IDs · 111 CONFIRMED · 12 DETAIL-WRONG · 0 NOT-FOUND.**

Every citation resolves to a real paper. The 12 flags are bibliographic-detail slips (wrong author
order/attribution, year, volume, or pages) on an otherwise-correct identifier — **not** fake sources.
All **load-bearing recent results CONFIRMED**: DeCaro 2026, Saba/Kapur/Roll 2025, van Alten 2019 (01);
the preregistered reflection-null (03 — real, but it's **2025** not 2024, see below); PNAS 2025
guardrail-harm + LearnLM (07); all sub-5B/quantization arXiv preprints (08); the ICBL 2025 Fitts
chapter (09 — real, authorship fix below).

*Method note: the 05–06 agent exhausted the shared WebSearch quota mid-run and fell back to direct
DOI/arXiv/OpenLibrary API resolution — which is stronger evidence of identifier validity than search
snippets, not weaker.*

## Per-file tally

| File | Confirmed | Detail-wrong | DOI-bad | Not-found |
|---|---|---|---|---|
| 01 flip-effectiveness | 15 | 0 | 0 | 0 |
| 02 motivation-experience | 10 | 3 | 0 | 0 |
| 03 reflection-help-seeking | 13 | 2 | 0 | 0 |
| 04 test-taking-behaviour | 15 | 1 | 0 | 0 |
| 05 cross-population-transfer | 11 | 1 | 0 | 0 |
| 06 classroom-rct-methods | 12 | 0 | 0 | 0 |
| 07 ai-tutor-design | 14 | 1 | 0 | 0 |
| 08 small-local-model | 12 | 1 | 0 | 0 |
| 09 game-psychophysics | 11 | 3 | 0 | 0 |

*(van Alten 2019 appears in 01, 02 and 05 — counted per file. Rough totals; exact per-file counts as reported by each verifier.)*

## Corrections to apply at source (the 12)

| File | Cited as | Fix | Also appears in |
|---|---|---|---|
| 02 | Garrison, Anderson & Archer **2000** | year is **1999** (DOI 10.1016/S1096-7516(00)00016-6 correct) | — |
| 02 | Strelan, Osborn & Palmer 2020, pp. **378–399** | pages are **295–314** | ledger 02 (no pages — ok) |
| 02 | de Leng & Pawelka 2020, **43(3), 1–8** | **43(2), 216–222** | ledger 02 (no pages — ok) |
| 03 | Guo, **X.**, et al. 2022 | sole author **Lin Guo** ("Guo, L.") | — |
| 03 | reflection-null RCT, **2024 / L@S '24** | **2025 / L@S '25**; authors **Zengilowski, Schuetze, Siedahmed, Yan, Heffernan** | **README, ledger, pre-reg/README stub 03, .claude_resume, board (row 03)** |
| 04 | "rapid guessing distort…" 2022 (**no author**) | authors **Rios, Deng & Ihlenfeldt** (Educational Assessment 27(4)) | — |
| 05 | **Sweller**, Ayres, Kalyuga & Chandler 2003 | author order is **Kalyuga, Ayres, Chandler & Sweller** (Kalyuga first) | ledger 05 (cites "Sweller 2003") |
| 07 | Graesser, **Wiemer-Hastings, Kreuz** et al. 2004 (DOI 10.3758/BF03195563) | that DOI is **Graesser, Lu, Jackson, Mitchell, Ventura, Olney & Louwerse**, *"AutoTutor: A tutor with dialogue in natural language,"* Behavior Research Methods 36(2), 180–192 | — |
| 08 | **Subramanian, Elango, Gungor** 2025 (arXiv:2501.05465) | true first author **Akanksha Gupta** (cited names are trailing co-authors) | ledger 08 |
| 09 | **Macrine** & Lazonder 2023 | first author is **Muilwijk** (Sifra E. Muilwijk & Ard W. Lazonder); DOI correct | **ledger 09** |
| 09 | Kougioumtzis 2026, vol. **14** | volume is **11** | — |
| 09 | Ma, Cheung, Li, Prayadsab & Mungwattana (Eds.) 2025 (ICBL Fitts chapter) | those are the **book's editors**; real chapter authors **Chen Li, Jeff K. T. Tang, Ye Jia, Yufei Lu, Peter H. F. Ng, Laura Zhou, Jing Liu, Qing Li** | dossier 09 footnote (already flagged) |

**Load-bearing (change how something reads, not just a reference detail):** the **03 reflection-null
year (2024→2025)** — it's the flagship contradiction and the wrong year sits in five files; and the
**09 ICBL chapter / Macrine→Muilwijk** authorship — 09's near-scoop. Everything else is a clean
detail slip contained to its dossier.

*Fixes propagated to derived/visible files (README, ledger, pre-reg, board, resume) are applied
directly; per-dossier detail slips are recorded here as the authoritative overlay — apply into each
dossier body before those references enter a real paper.*
