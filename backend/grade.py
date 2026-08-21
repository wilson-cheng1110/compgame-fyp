"""Short-answer grading: rubric parsing, blinding, the LLM call, and /api/grade.

docs/revamp.md Part 8.2-8.3, rubric in docs/grading-rubric.md.

DELIBERATELY NOT AN EXTENSION OF /api/socratic. Opposite requirements: the tutor
is multi-turn, temperature 0.4, and must NOT give the answer away; the grader is
single-shot, temperature 0, and its whole job is to judge. Sharing a chain would
mean one prompt serving both, badly. `/api/socratic`'s envelope is load-bearing
(the truncated-JSON leak fixed in 5fd319e) -- nothing here touches it.

TWO THINGS THIS MODULE IS BUILT AROUND:

1. **Blindness is structural, not polite.** `blind()` strips the pre/post label and
   the participant id and shuffles, and `build_prompt()` physically cannot see
   them because they are gone from the record before it is called. A grader that
   knows it is reading a post-test grades more generously, which manufactures the
   pre-post gain the study exists to detect (Part 8.2).

2. **`None` is not `"none"`.** `None` means "not enough signal to grade" -- a
   missing datum, excluded from the denominator. `"none"` means a real attempt
   that missed -- a data point about the teaching. Collapsing them inflates the
   apparent failure rate of the material with what is really non-response.

langchain is imported LAZILY inside the call. Everything above it -- parsing,
blinding, shuffling, the kappa -- is pure and unit-tested without Ollama running,
which is the only reason this can be tested at all on a box without the RAG stack.
"""

import hashlib
import json
import os
import re

LEVELS = ("full", "partial", "none")

RUBRIC_PATH = os.environ.get(
    "GRADING_RUBRIC_PATH",
    os.path.join(os.path.dirname(__file__), "..", "docs", "grading-rubric.md"),
)

# Grading is offline and batched; the endpoint exists so the batch (and an
# occasional spot check) can reach the model, NOT so students can. It fails
# CLOSED when unset, the same posture as the research export.
GRADE_TOKEN = os.environ.get("GRADE_TOKEN", "")

_rubric: dict | None = None
_rubric_mtime: float | None = None

_TOPIC_RE = re.compile(r"^##\s+.*?\(`([a-z-]+)`\)\s*$", re.M)
_PROBE_RE = re.compile(r"^\*\*Probe\.\*\*\s*\*(.+?)\*\s*$", re.M | re.S)
_POINT_RE = re.compile(r"^-\s+`([a-z-]+)`\s+—\s+(.+?)(?=\n-\s+`|\n\n|\Z)", re.M | re.S)


def _load_rubric() -> dict:
    """{topic_id: {"probe": str, "points": {key: description}}}."""
    global _rubric, _rubric_mtime
    mtime = os.path.getmtime(RUBRIC_PATH)
    if _rubric is not None and mtime == _rubric_mtime:
        return _rubric

    with open(RUBRIC_PATH, encoding="utf-8") as fh:
        text = fh.read()

    # Only the per-topic half of the file; the prose above it documents the levels
    # for humans and would otherwise parse as a topic.
    split = text.find("# Per-topic rubric points")
    body = text[split:] if split != -1 else text

    topics: dict[str, dict] = {}
    marks = [(m.start(), m.group(1)) for m in _TOPIC_RE.finditer(body)]
    for i, (start, topic_id) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(body)
        chunk = body[start:end]
        probe = _PROBE_RE.search(chunk)
        points = {k: " ".join(v.split()) for k, v in _POINT_RE.findall(chunk)}
        topics[topic_id] = {
            "probe": " ".join(probe.group(1).split()) if probe else None,
            "points": points,
        }

    _rubric, _rubric_mtime = topics, mtime
    return topics


def rubric_for(topic_id: str) -> dict:
    """Never raises. A topic with no section is graded on the generic levels alone,
    which is the expected state while the banks are still rolling (Part 8.4)."""
    return _load_rubric().get(topic_id, {"probe": None, "points": {}})


def probe_for(topic_id: str) -> str | None:
    return rubric_for(topic_id)["probe"]


# ── the null filter ───────────────────────────────────────────────────────────
# Decided in code, before any LLM call. Two reasons: it is the majority of the
# `null` cases and they are free to detect, and a deterministic rule is auditable
# in a way "the model said so" is not.

_NO_ATTEMPT = re.compile(
    r"^(idk|dk|dunno|no idea|i\s*don'?t\s*know|not\s*sure|n/?a|none|nil|nothing|"
    r"pass|skip|\?+|-+|\.+)$", re.I)


def is_gradeable(answer: str, probe: str | None = None) -> tuple[bool, str | None]:
    """-> (gradeable, reason_if_not). `reason` is stored so non-response is
    reportable as its own category rather than vanishing into a null."""
    text = (answer or "").strip()
    if not text:
        return False, "blank"
    if _NO_ATTEMPT.match(text):
        return False, "no_attempt"

    words = re.findall(r"[\w']+", text)
    if len(words) < 4:
        return False, "too_short"

    if probe:
        # A paste of the question back at us. Note this is a COPY test, not a
        # "restates the question in their own words" test -- that is a real
        # attempt that missed, and the rubric grades it `none`, not null.
        a = {w.lower() for w in words}
        p = {w.lower() for w in re.findall(r"[\w']+", probe)}
        if p and len(a & p) / len(a) > 0.8:
            return False, "copied_prompt"

    return True, None


# ── prompt ────────────────────────────────────────────────────────────────────

_SYSTEM = """You grade a single short answer from a first-year HCI student against a rubric.

Rules, in order of importance:
1. Grade ONLY what is written. Give no credit for what the student probably meant.
2. IGNORE spelling, grammar, register and length. Three sloppy correct words beat a
   fluent paragraph that says nothing. Graders drift the other way; do not.
3. Everyday wording earns FULL credit. Do not require the textbook term. These
   students have had one lecture.
4. Quote your evidence VERBATIM from the answer. Never paraphrase it.
5. If there is not enough there to judge, return null. Do not guess.

Levels:
  "full"    - states the mechanism AND applies it correctly
  "partial" - right territory, one load-bearing piece missing or wrong
  "none"    - a real attempt that misses: confidently wrong, or restates the question
  null      - not enough signal to grade at all

Reply with ONLY this JSON object and nothing else:
{"level": "full"|"partial"|"none"|null, "evidence": "<verbatim span from the answer>", "rubric_hit": ["<key>", ...]}"""


def build_prompt(topic_id: str, answer: str, probe: str | None = None) -> str:
    """The complete grader prompt.

    Carries the question, the rubric points, and the answer. Carries NO participant
    id, NO pre/post label, NO score, and NO other answer by the same student --
    there is no parameter here through which any of them could arrive.
    """
    r = rubric_for(topic_id)
    probe = probe or r["probe"] or "(probe not recorded)"

    if r["points"]:
        keys = "\n".join(f"  {k}: {d}" for k, d in r["points"].items())
        rubric_block = (f"Rubric points for this question. Return the keys the answer "
                        f"actually hits, in rubric_hit:\n{keys}")
    else:
        rubric_block = ("No per-point rubric exists for this question yet. Grade on the "
                        "levels alone and return an empty rubric_hit.")

    return (f"{_SYSTEM}\n\n"
            f"QUESTION THE STUDENT WAS ASKED:\n{probe}\n\n"
            f"{rubric_block}\n\n"
            f"STUDENT ANSWER:\n{answer.strip()}\n\n"
            f"JSON:")


# ── parsing ───────────────────────────────────────────────────────────────────

def parse_grade(raw: str, answer: str = "") -> dict:
    """Tolerant parse of the model's envelope.

    Same defensive posture as `_parse_socratic`: small models fence their JSON,
    prepend prose, and truncate. A parse failure must degrade to `null` (missing
    datum), never to a level -- an unparseable reply is not evidence about the
    student.

    Also checks the quote is REAL. A grade whose evidence does not appear in the
    answer is the model reasoning about a student it invented, and that is the
    failure mode you would otherwise only find by reading 300 rows by hand.
    """
    out = {"level": None, "evidence": "", "rubric_hit": [],
           "evidence_verbatim": None, "parse_ok": False}

    text = (raw or "").strip()
    if not text:
        return out

    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.M).strip()

    obj = None
    try:
        obj = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        m = re.search(r"\{.*\}", text, re.S)          # embedded in prose
        if m:
            try:
                obj = json.loads(m.group(0))
            except (json.JSONDecodeError, ValueError):
                obj = None
        if obj is None:                                # truncated mid-object
            lvl = re.search(r'"level"\s*:\s*(?:"(full|partial|none)"|null)', text, re.I)
            ev = re.search(r'"evidence"\s*:\s*"([^"]*)', text)
            hits = re.findall(r'"([a-z-]+)"', text.split('"rubric_hit"')[-1]) \
                if '"rubric_hit"' in text else []
            if lvl:
                obj = {"level": lvl.group(1).lower() if lvl.group(1) else None,
                       "evidence": ev.group(1) if ev else "",
                       "rubric_hit": hits}

    if not isinstance(obj, dict):
        return out

    level = obj.get("level")
    if isinstance(level, str):
        level = level.strip().lower()
        level = level if level in LEVELS else None
    else:
        level = None

    evidence = obj.get("evidence")
    evidence = evidence.strip() if isinstance(evidence, str) else ""

    hits = obj.get("rubric_hit")
    hits = [str(h) for h in hits if isinstance(h, (str, int))] if isinstance(hits, list) else []

    verbatim = None
    if evidence and answer:
        norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()
        verbatim = norm(evidence) in norm(answer)

    return {"level": level, "evidence": evidence, "rubric_hit": hits,
            "evidence_verbatim": verbatim, "parse_ok": True}


# ── blinding ──────────────────────────────────────────────────────────────────

_STRIP = {"participant_id", "sid", "pseudonym", "form", "phase", "event_type",
          "score", "arm", "played_understanding_first", "server_ts", "client_ts",
          "section", "meta"}


def blind(records: list[dict], seed: str = "compgame") -> tuple[list[dict], dict]:
    """-> (prompts_safe_to_grade, mapping back).

    Removes every field that could tell the grader whether this is a pre-test or a
    post-test, or whose answer it is, then SHUFFLES -- because grading in
    collection order leaks the pre/post split even with the labels gone: pre-tests
    arrive first, so position alone would rebuild the label.

    The shuffle is SEEDED and derived from the record ids, never from the clock, so
    a re-run of the batch produces the identical order. An unreproducible grading
    order is not auditable, and "we shuffled" is not a claim a reviewer can check.
    """
    blinded, mapping = [], {}
    for rec in records:
        tag = hashlib.sha256(f"{seed}:{rec['id']}".encode()).hexdigest()[:16]
        blinded.append({"tag": tag,
                        "topic_id": rec.get("topic_id"),
                        "answer": rec.get("answer", "")})
        mapping[tag] = rec

    blinded.sort(key=lambda b: b["tag"])   # deterministic given the seed
    return blinded, mapping


def unblind(results: list[dict], mapping: dict) -> list[dict]:
    """Re-join after grading. Unknown tags are dropped loudly rather than silently."""
    out = []
    for r in results:
        rec = mapping.get(r.get("tag"))
        if rec is None:
            raise KeyError(f"graded a tag that was never issued: {r.get('tag')!r}")
        out.append({**rec, "grade": {k: v for k, v in r.items() if k != "tag"}})
    return out


# ── reliability ───────────────────────────────────────────────────────────────

def cohen_kappa(a: list, b: list) -> dict:
    """Cohen's kappa between two coders. `None` is a category, not a skip --
    disagreeing about whether something is gradeable at all is real disagreement.

    Below kappa ~0.6 the LLM grade is descriptive colour only (docs/grading-rubric.md).
    """
    if len(a) != len(b):
        raise ValueError(f"unequal lengths: {len(a)} vs {len(b)}")
    n = len(a)
    if n == 0:
        return {"kappa": None, "n": 0, "agreement": None, "note": "no pairs"}

    cats = sorted({str(x) for x in a} | {str(x) for x in b})
    a_s, b_s = [str(x) for x in a], [str(x) for x in b]

    observed = sum(1 for x, y in zip(a_s, b_s) if x == y) / n
    expected = sum((a_s.count(c) / n) * (b_s.count(c) / n) for c in cats)

    if expected >= 1.0:                     # both coders used one category only
        return {"kappa": None, "n": n, "agreement": round(observed, 3),
                "note": "kappa undefined: no variance in at least one coder"}

    k = (observed - expected) / (1 - expected)
    return {"kappa": round(k, 3), "n": n, "agreement": round(observed, 3),
            "categories": cats,
            "verdict": ("usable" if k >= 0.6 else "descriptive only (kappa < 0.6)")}


# ── the model call ────────────────────────────────────────────────────────────

_llm = None


def _get_llm():
    """Lazy so this module imports on a box with no langchain, which is what makes
    the pure logic above testable."""
    global _llm
    if _llm is None:
        from langchain_ollama import ChatOllama
        model = os.environ.get("OLLAMA_LLM", "gemma4:e4b")
        # temperature=0 so a re-run reproduces the grade (an unreproducible grade is
        # not auditable), format=json so the envelope is parseable.
        #
        # num_predict=1536 IS NOT ARBITRARY AND MUST NOT BE LOWERED. Measured on
        # gemma4:e4b against this exact prompt, 2026-08-21:
        #
        #     320 / 512 / 640 / 768  ->  '' (EMPTY STRING)
        #     1024 / 2048 / 4096     ->  correct 117-char JSON
        #
        # The reply itself is ~35 tokens, so the model is spending several hundred
        # tokens before it emits any content, and a cap below that returns nothing at
        # all rather than something truncated. An empty reply parses to level=None,
        # which is INDISTINGUISHABLE from "the student wrote too little to grade" --
        # so a too-low cap silently converts every answer into a missing datum and
        # the batch reports 0 graded while looking like it ran fine. That is exactly
        # what it did on the first run here.
        _llm = ChatOllama(model=model, temperature=0, format="json",
                          num_predict=int(os.environ.get("GRADE_NUM_PREDICT", "1536")))
    return _llm


def grade_answer(topic_id: str, answer: str, probe: str | None = None) -> dict:
    """Grade one answer. Blocking -- callers on the event loop must use ops.run_gated."""
    probe = probe or probe_for(topic_id)

    ok, reason = is_gradeable(answer, probe)
    if not ok:
        return {"level": None, "evidence": "", "rubric_hit": [],
                "ungradeable_reason": reason, "parse_ok": True, "llm": False}

    raw = _get_llm().invoke(build_prompt(topic_id, answer, probe))
    content = getattr(raw, "content", raw)
    result = parse_grade(content if isinstance(content, str) else str(content), answer)
    result["ungradeable_reason"] = None if result["level"] else "model_returned_null"
    result["llm"] = True
    return result


# ── router ────────────────────────────────────────────────────────────────────

def build_router():
    """Built in a function so importing this module never requires fastapi."""
    from fastapi import APIRouter, Header, Response
    from pydantic import BaseModel

    import ops

    router = APIRouter(prefix="/api/grade", tags=["grading"])

    class GradeRequest(BaseModel):
        topic_id: str
        answer: str
        probe: str | None = None

    @router.get("/rubric")
    async def rubric(response: Response, x_grade_token: str = Header(default="")):
        if not GRADE_TOKEN or x_grade_token != GRADE_TOKEN:
            response.status_code = 503 if not GRADE_TOKEN else 403
            return {"error": "grading_disabled" if not GRADE_TOKEN else "bad_token"}
        return {"topics": _load_rubric()}

    @router.post("")
    async def grade(body: GradeRequest, response: Response,
                    x_grade_token: str = Header(default="")):
        # Fails CLOSED. Unset token = endpoint off, same posture as the export.
        # Students must never reach this: it would hand them the rubric's judgement
        # of their answer live, which is exactly the feedback Part 8.5 withholds on
        # the pre-check.
        if not GRADE_TOKEN:
            response.status_code = 503
            return {"error": "grading_disabled",
                    "message": "GRADE_TOKEN is not set. Grading is offline by design."}
        if x_grade_token != GRADE_TOKEN:
            response.status_code = 403
            return {"error": "bad_token"}

        try:
            return await ops.run_gated(grade_answer, body.topic_id, body.answer, body.probe)
        except Exception as e:
            response.status_code = 502
            return {"error": "grader_unavailable", "detail": type(e).__name__}

    return router


if __name__ == "__main__":
    print(json.dumps(_load_rubric(), indent=2, ensure_ascii=False))
