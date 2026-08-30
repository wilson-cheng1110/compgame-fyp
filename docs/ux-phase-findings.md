# Phase sweep -- every game, walked as deep as clicking goes

`node frontend/ux-phases.mjs`. ux-audit.mjs measures one screen per route;
this walks in and fingerprints each one it reaches.

**207 screens measured** across 26 games
(the audit's whole-product number was 34, of which 26 were games).

## Consistency, now measured across screens rather than landing pages

| measure | distinct |
|---|---|
| primary-action styling | **25** |
| ground | **14** |

## H1 Visibility of status, inside the games

Screens showing any "N of M": **152 of 207**.

Games with more than one screen and NO progress indicator on any of them:
**7** -- hicks-law-assessment, memory-understanding, webers-law-understanding, mental-model-understanding, problem-solving-understanding, visual-perception-understanding, experiment-design-understanding

## Games a generic driver cannot advance

**3** -- these need a bespoke driver for P5, and that list is the finding:
fitts-law-understanding, gestalt-understanding, gestalt-assessment

## Per game

| game | screens reached | with progress |
|---|---|---|
| `fitts-law-understanding` | 1 | 0 |
| `fitts-law-assessment` | 12 | 9 |
| `gestalt-understanding` | 1 | 0 |
| `gestalt-assessment` | 1 | 0 |
| `hicks-law-understanding` | 9 | 8 |
| `hicks-law-assessment` | 2 | 0 |
| `memory-understanding` | 2 | 0 |
| `memory-assessment` | 2 | 1 |
| `stroop-understanding` | 3 | 2 |
| `stroop-assessment` | 14 | 13 |
| `webers-law-understanding` | 2 | 0 |
| `webers-law-assessment` | 11 | 10 |
| `norman-understanding` | 14 | 13 |
| `norman-assessment` | 12 | 11 |
| `mental-model-understanding` | 2 | 0 |
| `mental-model-assessment` | 13 | 10 |
| `problem-solving-understanding` | 14 | 0 |
| `problem-solving-assessment` | 14 | 13 |
| `visual-perception-understanding` | 4 | 0 |
| `visual-perception-assessment` | 14 | 13 |
| `language-understanding` | 11 | 8 |
| `language-assessment` | 14 | 13 |
| `ergonomics-understanding` | 3 | 2 |
| `ergonomics-assessment` | 14 | 13 |
| `experiment-design-understanding` | 4 | 0 |
| `experiment-design-assessment` | 14 | 13 |

## Controls with no accessible name

**2** screen(s): hicks-law-assessment, memory-understanding
