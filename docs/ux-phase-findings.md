# Phase sweep -- every game, walked as deep as clicking goes

`node frontend/ux-phases.mjs`. ux-audit.mjs measures one screen per route;
this walks in and fingerprints each one it reaches.

**209 screens measured** across 26 games
(the audit's whole-product number was 34, of which 26 were games).

## Consistency, now measured across screens rather than landing pages

| measure | distinct |
|---|---|
| primary-action styling | **23** |
| ground | **14** |

Of 209 screens, **29** are led by the one shared `.pixel-btn`.
The rest are led by a game object -- a tile, an option row, an answer card --
which is content, not chrome. Broken down:

| screens | games | primary-action fingerprint |
|---|---|---|
| 55 | stroop-assessment, norman-understanding, norman-assessment +8 | `rgb(255, 255, 255) | rgb(0, 0, 0) | 0px | Pixelify Sans | 16px | flat` |
| 27 | norman-understanding, norman-assessment, mental-model-assessment +5 | `rgb(220, 252, 231) | rgb(22, 101, 52) | 0px | Pixelify Sans | 16px | flat` |
| 26 | fitts-law-assessment, gestalt-understanding, hicks-law-understanding +21 | `rgb(0, 102, 102) | rgb(255, 255, 255) | 0px | Press Start 2P | 16px | shadow` |
| 20 | stroop-assessment, norman-understanding, norman-assessment +5 | `rgb(254, 226, 226) | rgb(153, 27, 27) | 0px | Pixelify Sans | 16px | flat` |
| 15 | hicks-law-understanding, webers-law-assessment, visual-perception-understanding +1 | `rgba(0, 0, 0, 0) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | flat` |
| 12 | problem-solving-understanding | `rgb(0, 102, 102) | rgb(255, 255, 255) | 0px | Pixelify Sans | 16px | shadow` |
| 11 | fitts-law-assessment, hicks-law-assessment, memory-assessment | `rgb(0, 0, 0) | rgb(255, 255, 255) | 9999px | Inter | 16px | shadow` |
| 10 | stroop-assessment | `rgb(239, 68, 68) | rgb(0, 0, 0) | 0px | Pixelify Sans | 12px | shadow` |
| 8 | gestalt-assessment, webers-law-assessment, norman-assessment +5 | `rgb(242, 244, 245) | rgb(0, 0, 0) | 8px | Inter | 15px | flat` |
| 4 | language-understanding | `rgb(219, 234, 254) | rgb(0, 0, 0) | 0px | Pixelify Sans | 16px | flat` |
| 3 | hicks-law-understanding | `rgb(255, 255, 255) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | flat` |
| 3 | ergonomics-understanding, experiment-design-understanding | `rgb(0, 102, 102) | rgb(255, 255, 255) | 0px | Press Start 2P | 10px | shadow` |
| 2 | fitts-law-assessment | `rgb(253, 82, 82) | rgb(0, 0, 0) | 9999px | ui-sans-serif | 18px | shadow` |
| 2 | hicks-law-understanding | `rgb(254, 242, 242) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | flat` |
| 2 | webers-law-understanding, mental-model-understanding | `rgb(0, 153, 219) | rgb(255, 255, 255) | 0px | Press Start 2P | 10px | shadow` |
| 2 | experiment-design-understanding | `rgb(255, 255, 255) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | shadow` |
| 1 | fitts-law-understanding | `rgb(9, 56, 71) | rgb(255, 255, 255) | 0px | Inter | 30px | flat` |
| 1 | hicks-law-understanding | `rgb(240, 253, 244) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | flat` |
| 1 | hicks-law-assessment | `rgb(69, 123, 157) | rgb(0, 0, 0) | 0px | ui-sans-serif | 18px | shadow` |
| 1 | stroop-understanding | `rgb(34, 197, 94) | rgb(255, 255, 255) | 0px | Press Start 2P | 16px | shadow` |
| 1 | stroop-understanding | `rgb(74, 222, 128) | rgb(255, 255, 255) | 0px | Press Start 2P | 16px | shadow` |
| 1 | mental-model-assessment | `rgb(0, 102, 102) | rgb(0, 0, 0) | 0px | Pixelify Sans | 16px | flat` |
| 1 | problem-solving-understanding | `rgb(255, 255, 255) | rgb(0, 0, 0) | 0px | Pixelify Sans | 16px | shadow` |

## H1 Visibility of status, inside the games

Screens showing any "N of M": **184 of 209**.

Games with more than one screen and NO progress indicator on any of them:
**0** -- none

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
| `hicks-law-assessment` | 4 | 4 |
| `memory-understanding` | 2 | 2 |
| `memory-assessment` | 2 | 1 |
| `stroop-understanding` | 3 | 2 |
| `stroop-assessment` | 14 | 13 |
| `webers-law-understanding` | 2 | 2 |
| `webers-law-assessment` | 11 | 10 |
| `norman-understanding` | 14 | 13 |
| `norman-assessment` | 12 | 11 |
| `mental-model-understanding` | 2 | 2 |
| `mental-model-assessment` | 13 | 10 |
| `problem-solving-understanding` | 14 | 14 |
| `problem-solving-assessment` | 14 | 13 |
| `visual-perception-understanding` | 4 | 4 |
| `visual-perception-assessment` | 14 | 13 |
| `language-understanding` | 11 | 8 |
| `language-assessment` | 14 | 13 |
| `ergonomics-understanding` | 3 | 2 |
| `ergonomics-assessment` | 14 | 13 |
| `experiment-design-understanding` | 4 | 4 |
| `experiment-design-assessment` | 14 | 13 |

## Controls with no accessible name

**0** screen(s): none
