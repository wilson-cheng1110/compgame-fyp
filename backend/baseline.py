"""The one-off baseline pre-test: prior knowledge, measured once, before anything else.

docs/experiment-design.md §8. Five multiple-choice items spanning five of the thirteen
topics, sat once during onboarding and never again.

WHAT IT IS AND IS NOT. This is NOT the H1 instrument — that is the per-topic Form A /
Form B concept inventory in `checks.py`, which produces the normalized gain. This is a
single **prior-knowledge covariate**: a student who already knows some HCI going in is
different from one who does not, and without this there is no way to say so. It was
demoted from "the H1 measure" to "a covariate" on 2026-08-16, and demoted is not the
same as deleted.

WHY IT LIVES HERE AND NOT IN `checks.py`. The topic banks are per-topic and have an A/B
pair; this is one cross-topic set with no counterpart, and folding it into the bank
parser would mean bending `quiz-item-banks.md`'s structure around a single exception.

THE REASON IT IS SERVER-SIDE. The original lived in `app/signup/page.tsx` with the key
in the client — the file literally opened with `// Correct answers: [0, 1, 2, 1, 2]`.
These five items cover Fitts' Law, Miller's Law, Norman, Gestalt and Hick's Law: five
topics the same student is later measured on. A key in the bundle is not just a leaked
baseline, it is a leaked head-start on five of the thirteen units. Same rule as
`checks.py`: `items_for_student()` strips the answer, and only `grade()` — here, on the
server — ever sees it.

The student is never shown their score, for the same reason.
"""

# Item text preserved verbatim from the retired signup page (commit 2f3a17d) so the
# instrument is unchanged — a reworded item is a different item, and this one has
# already been administered to the Stage-1 focus group.
_ITEMS = [
    {
        "id": "B1",
        "topic": "fitts-law",
        "stem": "Fitts' Law predicts that pointing time...",
        "options": [
            "increases as targets get farther away or smaller",
            "depends mainly on screen resolution",
            "is constant regardless of target position",
            "decreases as the number of targets increases",
        ],
        "correct": 0,
    },
    {
        "id": "B2",
        "topic": "memory",
        "stem": "Miller's Law states that working memory holds approximately...",
        "options": [
            "3 items at a time",
            "7 ± 2 chunks",
            "15 items if chunked well",
            "unlimited items with practice",
        ],
        "correct": 1,
    },
    {
        "id": "B3",
        "topic": "norman",
        "stem": "In Norman's Action Cycle, the 'Gulf of Execution' means...",
        "options": [
            "the computer takes a long time to respond",
            "the user cannot tell whether their action worked",
            "the user cannot figure out how to do what they want",
            "the interface has too many steps",
        ],
        "correct": 2,
    },
    {
        "id": "B4",
        "topic": "gestalt",
        "stem": "The Gestalt principle of Proximity says objects are grouped because...",
        "options": [
            "they look similar to each other",
            "they are physically near each other",
            "they share the same colour",
            "the brain fills in gaps between them",
        ],
        "correct": 1,
    },
    {
        "id": "B5",
        "topic": "hicks-law",
        "stem": "According to Hick's Law, adding more choices to a menu...",
        "options": [
            "doubles decision time with each new item",
            "has no effect if items are clearly labelled",
            "increases decision time by a fixed logarithmic amount",
            "only matters for novice users",
        ],
        "correct": 2,
    },
]

EVENT_TYPE = "pre_test_complete"
N_OPTIONS = 4
CHANCE_PCT = round(100 / N_OPTIONS, 1)          # 25.0 — the floor any score sits above


def items_for_student() -> list[dict]:
    """Items WITHOUT the answer key. The only shape that may cross the wire."""
    return [{"id": i["id"], "stem": i["stem"], "options": i["options"]} for i in _ITEMS]


def grade(answers: dict) -> dict:
    """Score a submission server-side.

    `answers` maps item id -> selected option INDEX (as a string or int). An
    unanswered item is missing or -1, and is scored as wrong-but-recorded rather than
    dropped: skipping is itself information about prior knowledge, and silently
    excluding it would inflate the mean for exactly the students who knew least.
    """
    per_item, correct_n, answered_n = [], 0, 0
    for item in _ITEMS:
        raw = answers.get(item["id"])
        try:
            chosen = int(raw)
        except (TypeError, ValueError):
            chosen = -1
        if chosen < 0 or chosen >= len(item["options"]):
            chosen = -1
        else:
            answered_n += 1
        is_right = chosen == item["correct"]
        correct_n += is_right
        per_item.append({"id": item["id"], "topic": item["topic"], "answered": chosen})

    total = len(_ITEMS)
    return {
        "total": total,
        "answered": answered_n,
        "correct": correct_n,
        "score": round(100.0 * correct_n / total, 1),
        "chance_pct": CHANCE_PCT,
        "items": per_item,        # what they picked, never what was right
    }


def already_taken(events: list[dict], sid: str) -> bool:
    """One sitting, ever. Takes the event list so this stays testable without a sink."""
    return any(r.get("participant_id") == sid and r.get("event_type") == EVENT_TYPE
               for r in events)


def report() -> dict:
    """Shape check for the test suite and for a human sanity-read."""
    return {
        "n_items": len(_ITEMS),
        "topics": [i["topic"] for i in _ITEMS],
        "n_options": sorted({len(i["options"]) for i in _ITEMS}),
        "chance_pct": CHANCE_PCT,
    }


if __name__ == "__main__":
    import json
    print(json.dumps(report(), indent=2))
