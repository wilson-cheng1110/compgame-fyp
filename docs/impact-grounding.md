# Impact grounding — venue metrics & competitive citations

The board's per-paper **Impact** rating is grounded in the figures below (gathered 2026-09-19).
**Honesty caveat:** in this session Clarivate JCR, Scimago, CORE and DBLP were all blocked
(403/CAPTCHA/rate-limit), so these come from public aggregators (scijournal.org, Wikipedia),
the **OpenAlex** API, Google Scholar Metrics, and colm.cc. Journal IFs from the aggregator looked
inflated for some titles (it showed C&E 17.7 and BJET 16.5), so the board uses **conservative,
widely-cited values** (≈) rather than the aggregator's highest number. Where an IF was unreachable,
an OpenAlex "2-yr mean citedness" proxy is noted instead. Treat all as **approximate**, verify
against JCR before quoting a precise number.

## Venues

| # | Venue | Metric | Board tier | Source |
|---|---|---|---|---|
| 01 | Computers & Education | IF ≈12.9 (2024); aggregator showed 17.7 | top | scijournal.org |
| 02 | Contemporary Educational Psychology | IF ≈4.3–5.0 | strong | scijournal.org |
| 03 | Metacognition and Learning | IF ≈4.5–5.6 | strong (specialised) | scijournal.org |
| 04 | Journal of Learning Analytics | no JCR IF; OpenAlex h-index 56, citedness ≈7 | niche (open-access) | OpenAlex |
| 05 | British Journal of Educational Technology | IF ≈6.7 (2023, Wikipedia); aggregator higher | strong→top | Wikipedia / scijournal.org |
| 06 | ACM Learning @ Scale | no IF; selective conference; CORE/acceptance not obtainable | niche (selective conf) | Google Scholar Metrics |
| 07 | IJAIED (journal) / AIED (conf) | no live JCR; OpenAlex h-index 88, citedness ≈14 | mid (specialist) | OpenAlex |
| 08 | COLM / EMNLP | COLM new (2024, sold out by 3rd ed.); EMNLP h5-index ≈218 | emerging / top NLP | colm.cc / GScholar Metrics |
| 09 | Cognitive Science / npj Science of Learning | Cog Sci IF ≈2.5; npj h-index 53, citedness ≈7.5 | strong (reputation) / mid | scijournal.org / OpenAlex |

## Competitive citations (how established each area is)

| Paper | ~citations | Signal | Source |
|---|---|---|---|
| Sinha & Kapur 2021 (RER) | ~201 | productive-failure synthesis is established | OpenAlex |
| DeCaro et al. 2026 (BJEP) | ~3 | the near-twin is **very fresh**, not yet influential | OpenAlex (lists year 2025) |
| van Alten et al. 2019 (Educ. Research Review) | ~554 | flip field is **mature & crowded** | OpenAlex |
| Chen et al. 2018 (Medical Education) | ~363 | the sole PG comparison is well-cited but underpowered | OpenAlex |
| Williams et al. 2015 (L@S) | not reliably counted (OpenAlex indexes only the arXiv preprint) | — | OpenAlex |
| Kestin et al. 2025 (Sci. Reports) | ~140 in ~1 yr | AI-tutor area **exploding** | OpenAlex |
| "GenAI without guardrails harms learning" 2025 (PNAS) | ~190 in ~1 yr | AI-tutor area **exploding** | OpenAlex |

## Field crowdedness

- **Flipped / experience-first learning:** mature and crowded — two big meta-analyses alone
  (van Alten ~554, Chen ~363 cites) synthesise 114 and 46 primary studies; a new RCT enters a
  well-populated, multi-meta-analysis field. → caps novelty for 01, 05.
- **LLM / AI tutors in education:** young but exploding — COLM only began 2024 (already selling out);
  the two flagship 2025 papers hit 140–190 cites within a year. Few RCTs yet, multiplying fast.
  → high ceiling + high variance for 07, and a timely differentiated audience for 08.

## Submission deadlines (grounded 2026-09-19)

- **Journals — ROLLING, no fixed deadline** (standard journal model, continuous submission): 01 Computers & Education, 02 Contemporary Educational Psychology, 03 Metacognition and Learning, 04 Journal of Learning Analytics, 05 British Journal of Educational Technology, 07 IJAIED, 09 Cognitive Science & npj Science of Learning.
- **06 ACM Learning @ Scale (conference):** annual CFP; 2026 cycle passed; 2027 **not confirmed** — official CFP (learningatscale.acm.org) was WAF-blocked (403) this session, so NOT verified. Check by hand.
- **07 AIED (conference):** annual CFP; date **not confirmed** (iaied.org is JS-only, unreachable to fetch). The IJAIED journal fallback is rolling, so this paper is not deadline-blocked.
- **08 COLM:** 2026 closed — abstract **Mar 26 2026** / full paper **Mar 31 2026** (conf Oct 6–9 2026); COLM 2027 TBA. Source: colm.cc/Conferences/2026/CallForPapers. **EMNLP:** via ACL Rolling Review — EMNLP 2026 commitment closed May 25 2026; next general ARR monthly cycle **Oct 12 2026** (not confirmed tied to a specific 2027 venue). Sources: 2026.emnlp.org, aclrollingreview.org/dates.

**Honesty:** L@S and AIED official CFP pages were unreachable this session (ACM WAF / JS-only site), so those two are marked "not confirmed" on the board, not guessed. Takeaway: **7 of 9 target rolling journals** (submittable anytime); only 06 and 08 are conference-cycle-gated, and both 2026 cycles have passed.
