# Weber's Law — COMP3423 reference notes (topic: webers-law)

## What it is
**Weber's Law** (Ernst Heinrich Weber, ~1834; later formalised by Gustav Fechner) is a
foundational result in **psychophysics**, the study of how physical stimuli map to
perception. It concerns the **just noticeable difference (JND)** — the smallest change in a
stimulus that a person can *reliably* detect. Weber's finding is that the JND is **not a fixed
amount**; it is a roughly **constant fraction of the original stimulus intensity**. In short:
what the senses detect is the *ratio* of the change to the baseline, not the absolute size of
the change.

## The formula
    ΔI / I = k

- **ΔI** — the just noticeable difference: the smallest change in the stimulus that can just be
  detected.
- **I** — the original (baseline) intensity of the stimulus before the change.
- **k** — the **Weber fraction**: a constant that stays roughly the same for a given sensory
  dimension. Rearranged, the smallest detectable change scales with the baseline: `ΔI = k × I`.

Because the detectable change is a *percentage* of what is already there, the same absolute
change can be obvious against a small baseline and invisible against a large one. A **5-pixel**
growth is easy to see on a **20px** icon (a 25% change) but invisible on a **400px** banner
(about 1.25%). Likewise, adding 2 grams is obvious in a 10g letter but unnoticeable in a 5kg
bag — same 2g, very different ratio.

## The Weber fraction differs by sense and dimension
Each perceptual dimension has its own Weber fraction `k`. The teaching values used in the
COMPGame Weber's Law game are:
- **size** ≈ **10%** (a size change must exceed ~10% of the original to be reliably noticed),
- **brightness** ≈ **8%** (a brightness step below ~8% of the current level goes unnoticed),
- **count** ≈ **14%** (a change in the number of items in a group must be ~14% to register).
Classic textbook dimensions include **brightness**, loudness, and heaviness/weight; each has
its own characteristic fraction.

## Limits of the law
Weber's Law holds well across the **middle range** of intensities but **breaks down at the
extremes** — for very weak stimuli near the detection threshold and for very strong stimuli.
Fechner's Law (perceived magnitude grows with the *logarithm* of intensity) is the standard
extension built on top of Weber's ratio principle.

## Implications for UI and HCI design
The practical rule is: **a change is perceptible only when it clears the JND** — i.e. when it
is a large enough *fraction* of the current value. Designers must size changes relative to the
baseline, not by a fixed amount.
- **Brightness / state feedback.** A button that darkens by only **3%** on hover feels
  unresponsive, because 3% is below the ~8% brightness JND — the state change literally cannot
  be perceived. Hover, pressed and disabled states must differ by more than the JND.
- **Progress indicators.** A progress bar creeping from **95% to 96%** (a 1% change) is barely
  noticeable — the ratio is far below the JND. Meaningful visual jumps need a large enough
  relative step.
- **Size.** Icon or element size changes below ~10% of the original will not read as "bigger";
  emphasis by size has to clear the fraction.
- **Loudness / evenly-spaced controls.** For each step of a volume (or text-size) control to
  *feel* like an equal change, consecutive steps should increase by a roughly **constant
  percentage** of the current level, not by a fixed number of units — geometric spacing, not
  arithmetic.
- **Price / magnitude perception.** The same ratio principle explains why a **$5** discount
  feels significant on a **$20** item but negligible on a **$2000** item: perceived saving
  tracks the fraction of the original price, not the absolute amount.

## Note on the in-game measure
In the COMPGame Weber game, the *in-game assessment* is a **perceptual** spot-the-odd-one-out
task (detecting which element differs). That is a behavioural measure of perceptual
discrimination — separate from the conceptual knowledge of the `ΔI / I = k` relationship,
the JND, and the Weber fraction covered in these notes.
