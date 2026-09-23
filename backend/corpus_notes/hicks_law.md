# Hick's Law — COMP3423 reference notes (topic: hicks-law)

## What it is
**Hick's Law** (also called the Hick–Hyman Law, after William Hick, 1952, and Ray Hyman,
1953) describes **choice reaction time**: the time it takes a person to decide among several
equally likely alternatives grows with the **number of choices** on offer. Crucially the
growth is **logarithmic, not linear** — each extra alternative adds a little less
**decision time** than the one before it. Hick's Law is a decision (cognitive) law: it is
about the time to *choose*, before any movement to the chosen thing takes place.

## The formula
    RT = a + b × log₂(n + 1)

- **RT** — the choice reaction time (the decision time).
- **n** — the number of equally likely alternatives the person must choose among.
- **a** — the baseline intercept: the fixed part of the time that does **not** depend on the
  number of choices (sensing the display, initiating a response). With one option and no real
  choice, RT ≈ a.
- **b** — the slope: how much time each additional *bit* of choice costs, in this person and
  task.
- **log₂(n + 1)** — the amount of information (in **bits**) resolved by the decision. The
  "+ 1" accounts for the person also having to decide *whether* to respond at all, and keeps
  the term well-behaved. This is the information-theoretic reading of the law: reaction time
  is roughly proportional to the information transmitted by the choice.

## Diminishing returns
Because the cost term is `log₂(n + 1)` rather than `n`, the choices are **not** equally
expensive. The first alternatives added to a set cost the most; later ones cost progressively
less. Going from **1 to 2** options adds more decision time than going from **9 to 10**.
Equivalently, halving a menu from **16** items to **8** removes only about a *fifth* of the
decision-time component (log₂ 17 ≈ 4.09 bits versus log₂ 9 ≈ 3.17 bits), not half of it.

## When it applies (and when it does not)
Hick's Law assumes the alternatives are **equally probable** and that the person genuinely
evaluates the options as a set (a true choice reaction). It does **not** describe:
- **Highly practised / automatic** responses, where the mapping is over-learned;
- **Visual search or sorted lists** (e.g. an alphabetical or numeric list), where the user
  jumps toward a known region instead of considering every item — search time, not Hick-style
  choice, dominates.
When alternatives are *not* equally likely, the log-of-n term is replaced by the information
entropy of the distribution (the Hyman generalisation): more predictable choices are faster.

## Implications for UI and menu design
- **Fewer choices → faster decisions.** For frequent or time-critical actions, cut the number
  of alternatives the user must weigh. Safety-critical and emergency interfaces deliberately
  offer very few controls, because a delay in an emergency is exactly the cost being avoided.
- **Breadth vs depth is a real trade-off, not a free win.** Splitting one flat menu into
  nested submenus replaces a single decision with several. Their bit-costs *add up*, and can
  exceed the flat menu's. For example, a flat menu of **15** commands costs about log₂(16) =
  4.0 bits, whereas three groups of five costs about log₂(4) + log₂(6) ≈ 4.6 bits — Hick's Law
  alone predicts the *nested* version is slightly **slower** to decide through. (Categorisation
  can still help overall by turning a raw choice into a faster visual search, but that benefit
  comes from search behaviour, not from Hick's Law.)
- **Group, prioritise, and progressively disclose.** Highlight likely defaults (unequal
  probabilities speed the decision) and hide rarely used options until needed.

## Not to be confused with Fitts's Law
Hick's Law and **Fitts's Law** describe two *different* stages of one interaction and are
often needed together:
- **Hick's Law** predicts the time to **decide** which of several options to pick — the
  cognitive choice among alternatives.
- **Fitts's Law** predicts the time to physically **move** the pointer (or hand) to the target
  once chosen — the motor act of acquiring it, as a function of its distance and size.

So when a user glances at a toolbar, decides which of six icons they want, and then reaches for
it: Hick's Law governs the *deciding-among-the-six* part, and Fitts's Law governs the
*moving-to-the-chosen-one* part. They are complementary, not interchangeable.
