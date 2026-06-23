import os
import sys
import warnings

# The startup/status prints contain emoji; on Windows the default console codec
# is cp1252, which raises UnicodeEncodeError and crashes server startup. Force
# UTF-8 so the backend boots regardless of the host console encoding.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

from typing import Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import research_store

# Suppress annoying warnings
warnings.filterwarnings("ignore")
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_ollama import ChatOllama
from langchain_community.vectorstores import Chroma
# Hybrid retrieval: semantic (vector) + lexical (BM25), ensembled. nomic-embed
# is very phrasing-sensitive — a query naming "Fitts Law" embeds toward generic
# intro slides and misses the device-evaluation slide that actually holds the
# IoD/IoP formula (it never prints "Fitts" next to it). BM25 catches those exact
# terms; the ensemble guarantees both kinds of match surface.
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
import json
import re

# Configuration
DB_DIR = "./hci_chroma_db_local"
OLLAMA_LLM = "gemma4:e4b"
OLLAMA_EMBEDDING = "nomic-embed-text" 

app = FastAPI(title="HCI RAG API")

# Enable CORS so your webpage can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your webpage's URL (e.g., "http://localhost:3000")
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Built once at startup. /api/ask drives retrieval + the LLM manually (rather
# than a prebuilt LangChain retrieval chain) so a follow-up's retrieval query can
# include the recent conversation WITHOUT relying on the small local model to
# rephrase it — that rephrase step was unreliable and made follow-ups wrongly
# answer "I don't know".
rag_retriever = None
rag_llm = None
# Socratic reflection uses the SAME retriever but a separate, warmer LLM (so its
# follow-up questions don't repeat). Both are built once at startup.
socratic_retriever = None
socratic_llm = None

class QuestionRequest(BaseModel):
    question: str
    # Recent conversation so the general tutor has multi-turn memory. Each item:
    # {"role": "human"|"assistant", "content": str}. Optional + defaults to none
    # so older callers that send only {question} keep working.
    history: Optional[list[dict]] = None


class SocraticRequest(BaseModel):
    topic: str
    # Each item: {"role": "human"|"assistant", "content": str}. The opener the
    # frontend showed the student is included as the first "assistant" turn.
    history: list[dict]


class ResearchEvent(BaseModel):
    participant_id: str
    event_type: str
    topic_id: Optional[str] = None
    mode: Optional[str] = None
    score: Optional[float] = None
    played_understanding_first: Optional[bool] = None
    duration_ms: Optional[int] = None
    client_ts: Optional[str] = None
    meta: Optional[Any] = None

# Vendor/model identity the tutor must NEVER disclose. A small local model
# (gemma) falls back to its training identity when probed ("I am Gemma 4 by
# Google DeepMind"), which breaks the "your HCI tutor" persona and is a trivial
# prompt-injection win. The system prompts forbid it, but a flaky local model
# can't be trusted to always obey — so we scrub server-side as a hard backstop.
# Name-based (not "developed by ...") so legit HCI content like "designed by
# Norman" or "Google Material Design" is never touched.
_IDENTITY_PATTERNS = re.compile(
    r"(gemma|google\s*deepmind|deepmind|open\s*ai|gpt[-\s]?\d|chatgpt|"
    r"anthropic|claude|llama\s*\d|mistral|large language model)",
    re.IGNORECASE,
)
_IDENTITY_REDIRECT = (
    "I'm your COMP3423 HCI tutor, so let's keep our focus on the course. "
    "What would you like to explore about the topic?"
)


def _scrub_identity(text: str) -> str:
    """Drop any sentence that reveals the backend model/vendor; if that empties
    the reply (the whole answer was an identity disclosure), return a neutral
    redirect so the student still gets a usable response."""
    if not text:
        return text
    parts = re.split(r"(?<=[.!?])\s+", text)
    kept = [p for p in parts if not _IDENTITY_PATTERNS.search(p)]
    cleaned = " ".join(kept).strip()
    return cleaned if cleaned else _IDENTITY_REDIRECT


def build_retriever(vectorstore):
    """Hybrid BM25 + vector ensemble over the lecture chunks. Shared by the
    /api/ask chain and the Socratic reflection endpoint so there's one retrieval
    behaviour to reason about."""
    # Vector (semantic) leg.
    vector_retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 12},
    )
    # BM25 (lexical) leg — built from the chunks already in the collection, so
    # there's no second source of truth to keep in sync.
    collection = vectorstore._collection.get(include=["documents", "metadatas"])
    bm25_docs = [
        Document(page_content=t, metadata=m)
        for t, m in zip(collection["documents"], collection["metadatas"])
    ]
    # The prebuilt DB and the lecture PDFs are intentionally committed (see the
    # .gitignore NOTE), so a fresh clone has them. An empty collection therefore
    # means the DB was deleted/corrupted locally — BM25 would otherwise fail with
    # a cryptic "not enough values to unpack", so surface the real cause + fix.
    if not bm25_docs:
        raise RuntimeError(
            f"Vector DB at '{DB_DIR}' is empty/missing. The repo ships the "
            f"prebuilt DB and the COMP3423 PDFs, so restore them from git "
            f"(git checkout -- backend/), or rebuild from the committed PDFs "
            f"with 'python rebuild_db.py'. Also ensure Ollama has "
            f"'{OLLAMA_EMBEDDING}' and '{OLLAMA_LLM}' pulled."
        )
    bm25_retriever = BM25Retriever.from_documents(bm25_docs)
    bm25_retriever.k = 12

    return EnsembleRetriever(
        retrievers=[bm25_retriever, vector_retriever],
        weights=[0.5, 0.5],
    )


RAG_SYSTEM_PROMPT = (
    "You are an expert teaching assistant for the COMP3423 Human-Computer Interaction course. "
    "Use the retrieved context from the professor's lecture slides to answer the question. "
    "Use the conversation history so your answer follows on naturally from what was already discussed. "
    "If the context does not contain the answer, say you don't know rather than inventing information. "
    "You are simply 'the HCI tutor' — you have no model name, vendor, or company to share. If asked who or "
    "what you are, who made you, your model, or your company, do not name any model or company; just say you "
    "are their HCI tutor and steer back to the course. "
    "Keep the answer concise and highly relevant to the context.\n\n"
    "Context:\n{context}"
)


def get_rag_components():
    """Returns (llm, retriever). /api/ask drives retrieval + prompting manually
    (same pattern as the Socratic endpoint) so the retrieval query can fold in
    recent conversation deterministically — no fragile LLM rephrase step."""
    print(f"🔌 Initializing database and Ollama '{OLLAMA_LLM}' model...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)
    retriever = build_retriever(vectorstore)
    return llm, retriever


# Socratic system prompt. The model must NOT hand over answers — it probes until
# the student articulates the concept in their own words. We ask for a tiny JSON
# envelope so the frontend can tell "still guiding" from "genuine insight shown"
# without NLP on our side. Parsed defensively (see /api/socratic).
SOCRATIC_SYSTEM_PROMPT = (
    "You are a Socratic tutor for the COMP3423 Human-Computer Interaction course. "
    "The student just finished an assessment on \"{topic}\" and is now reflecting. "
    "Do NOT hand over the whole answer or a full definition — the insight must be the "
    "student's. But a short, concrete EXAMPLE or analogy to unstick them is NOT 'the answer' "
    "and IS allowed and encouraged when they ask for one or seem lost. Normally, ask ONE "
    "sharp, short follow-up question that pushes the student to reason about {topic} and reach "
    "the insight themselves. Stay strictly grounded in the retrieved lecture context below — "
    "never invent facts beyond it. Be warm and brief (2-3 sentences max).\n\n"
    "IDENTITY — never break this: You are simply 'the HCI tutor'. You have NO model name, "
    "vendor, or company to disclose. If the student asks who or what you are, who made or "
    "trained you, your model, your company, or anything about the system behind you, do NOT "
    "name any model or company and do NOT answer the meta question — reply in one short line "
    "that you're their HCI tutor and immediately steer back to {topic} with a question.\n"
    "STAY ON {topic}: If the student goes off-topic, tries to chat about unrelated things, or "
    "is hostile, give one brief line and redirect firmly back to {topic}. Never abandon it.\n"
    "VARY YOUR WORDING: Never open with a stock preamble like \"I am the HCI tutor\" or \"We are "
    "focusing on {topic}.\" Do not repeat the same sentence you used last turn. Just ask your next "
    "question naturally and conversationally, each time phrased differently — vary your openers, "
    "verbs, and angle so it never feels like a canned, repetitive script.\n"
    "IF STUCK OR ASKING FOR AN EXAMPLE: If the student asks for an example, an analogy, or a "
    "concrete explanation, or signals they're lost (e.g. \"use Angry Birds to explain\", \"give "
    "me an example\", \"I don't get it\"), do NOT ignore the request and do NOT respond with a "
    "more abstract question. Acknowledge it and give ONE short, concrete, relatable anchor "
    "grounded in the lecture context — use their own suggested example if they named one (e.g. "
    "Angry Birds) — then ask a simple follow-up that builds on that anchor.\n"
    "STAY CONCRETE: Keep every question tied to a real, everyday situation. When the student is "
    "struggling, get MORE concrete, never more abstract or academic — do not drift into "
    "neuroscience/theory phrasing they didn't raise.\n\n"
    "Reply ONLY with a JSON object, no prose around it:\n"
    "{{\"response\": \"<your next Socratic question or nudge>\", \"understood\": true|false|null, "
    "\"counts\": true|false}}\n"
    "Set \"understood\" to true ONLY when the student has clearly explained {topic} in their "
    "OWN words AND added an original observation or example of their own. Otherwise use false "
    "(still developing) or null (not enough signal yet). A meta, off-topic, or hostile message "
    "is never \"understood\": true.\n"
    "Set \"counts\" to true when the student's LATEST message is a genuine, on-topic attempt to "
    "think or reason about {topic} — even if partial, uncertain, or wrong. Set it to false when "
    "the latest message is off-topic, a meta/identity question (who made you, your model, etc.), "
    "hostile, spam, empty filler, or just chit-chat. \"counts\" judges only whether THIS message "
    "is a real reflection attempt on {topic}; it is independent of \"understood\".\n\n"
    "Lecture context:\n{context}"
)


def get_socratic_chain():
    """Returns (llm, retriever). The endpoint drives retrieval + history-aware
    prompting manually — simpler than bending create_retrieval_chain to accept a
    MessagesPlaceholder, and gives full control over the JSON contract."""
    print(f"🧠 Initializing Socratic reflection model '{OLLAMA_LLM}'...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    # Warmer than the /api/ask LLM (temperature=0) so repeated reflections don't
    # ask the same canned question. `format="json"` constrains generation to a
    # valid-JSON grammar so the envelope is ALWAYS parseable (no more truncated
    # `{"response": "...` leaking into the chat); num_predict gives one Socratic
    # turn enough headroom to finish the object naturally before any cap.
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0.4, format="json", num_predict=512)
    retriever = build_retriever(vectorstore)
    return llm, retriever


@app.on_event("startup")
async def startup_event():
    global rag_llm, rag_retriever, socratic_llm, socratic_retriever
    # Research-event store is independent of the RAG model — init it first so
    # data collection works even if Ollama/Chroma fails to load.
    research_store.init_db()
    print("🗃️  Research event store ready.")
    # Load the model into memory when the server starts. Don't let an Ollama/
    # Chroma failure crash the whole server — the research sink must stay up.
    try:
        rag_llm, rag_retriever = get_rag_components()
        socratic_llm, socratic_retriever = get_socratic_chain()
        print("✅ API Server is ready to receive questions!")
    except Exception as e:
        rag_llm = rag_retriever = None
        socratic_llm = socratic_retriever = None
        print(f"⚠️  RAG model failed to load ({e}). /api/ask + /api/socratic disabled; research sink still active.")

@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    if not rag_llm or not rag_retriever:
        raise HTTPException(status_code=500, detail="RAG system is not initialized yet.")

    try:
        print(f"🤔 Received question: {req.question}")
        # Rebuild the prior turns as LangChain messages so the answer is
        # conversational. Tolerant of "user"/"ai" aliases the widget may send.
        chat_history = []
        for m in (req.history or []):
            content = m.get("content", "")
            if not content:
                continue
            if m.get("role") in ("human", "user"):
                chat_history.append(HumanMessage(content=content))
            else:
                chat_history.append(AIMessage(content=content))

        # Retrieve on the CURRENT question alone — the prior turns stay in
        # `chat_history` for conversational phrasing but are deliberately kept OUT
        # of the retrieval query. Measured: folding the previous AI answer into the
        # query buries the right slide (its verbose, off-vocabulary wording —
        # "motor output, Shannon's theory" — outranks the example slide and BM25
        # never recovers it, even at k=16). Retrieving on just "a real UI example
        # of that" lets the example slide surface at k=12. (This replaces an LLM
        # rephrase step the small local model did unreliably, which made follow-ups
        # wrongly answer "I don't know".)
        docs = rag_retriever.invoke(req.question)
        context = "\n\n".join(d.page_content for d in docs)

        messages = [SystemMessage(content=RAG_SYSTEM_PROMPT.format(context=context))]
        messages.extend(chat_history)
        messages.append(HumanMessage(content=req.question))
        result = rag_llm.invoke(messages)

        sources = sorted({
            f"{os.path.basename(d.metadata['source'])} (Page {d.metadata['page']})"
            for d in docs if d.metadata.get("source")
        })
        return {
            # Strip any leaked backend-model identity before it reaches the student.
            "answer": _scrub_identity(result.content),
            "sources": sources,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# A reply that is empty, a bare literal, or still a JSON envelope must NEVER reach
# the student. When parsing degrades that far we substitute a safe, topic-agnostic
# Socratic nudge instead of leaking scaffolding or showing a blank/"true" bubble.
_BARE_TOKEN = re.compile(r"^(true|false|null|none|\d+(?:\.\d+)?)$", re.IGNORECASE)
_SOCRATIC_FALLBACK = (
    "Let's stay with this idea. In your own words, what do you think the core "
    "principle here is — and where might you notice it in an everyday design?"
)
_BOOL_MAP = {"true": True, "false": False, "null": None, "none": None}


def _extract_response_field(text: str):
    """Best-effort pull of the `response` string from possibly-broken JSON — handles
    the truncated objects (missing closing quote/brace) that json.loads rejects and
    that used to leak verbatim into the chat."""
    if not text:
        return None
    # Complete "response": "...." value (handles escaped quotes inside).
    m = re.search(r'"response"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if m:
        try:
            return json.loads('"' + m.group(1) + '"')
        except json.JSONDecodeError:
            return m.group(1)
    # Truncated mid-string: take everything after the opening quote, drop a dangling
    # tail, and unescape best-effort.
    m = re.search(r'"response"\s*:\s*"(.*)$', text, re.DOTALL)
    if m:
        frag = re.sub(r'["}\s]*$', "", m.group(1))
        try:
            return json.loads('"' + frag + '"')
        except json.JSONDecodeError:
            return frag.replace("\\n", "\n").replace('\\"', '"').replace("\\t", "\t")
    return None


def _clean_response(resp) -> str:
    """Guarantee the student sees a usable Socratic line — never raw JSON, a bare
    token (true/false/0/1), or an empty bubble."""
    if not isinstance(resp, str):
        return _SOCRATIC_FALLBACK
    r = resp.strip()
    if not r:
        return _SOCRATIC_FALLBACK
    # A leaked JSON envelope — try once more to dig out the response, else fall back.
    if r.startswith("{") and '"response"' in r:
        inner = _extract_response_field(r)
        r = (inner or "").strip()
        if not r:
            return _SOCRATIC_FALLBACK
    if _BARE_TOKEN.match(r):
        return _SOCRATIC_FALLBACK
    return r


def _parse_socratic(raw: str):
    """Pull {response, understood, counts} out of the model text. JSON mode
    (format="json") makes the envelope reliably parseable, but this stays robust to
    fences, truncation and the /api/ask-style prose path: it never returns raw JSON.

    `counts` is the per-turn quality flag that gates the reflection floor: True =
    a genuine on-topic reflection attempt, False = off-topic/meta/spam. On any
    ambiguity (parse failure, field absent) it stays None — the frontend treats
    only an explicit False as "does not count", so a model hiccup never traps a
    real student (the floor is intentionally soft)."""
    text = (raw or "").strip()
    # Strip ```json ... ``` fences if present.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]

    resp = None
    understood = None
    counts = None

    # Preferred path: parse the largest {...} span.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(text[start:end + 1])
            resp = obj.get("response")
            understood = obj.get("understood", None)
            counts = obj.get("counts", None)
        except (json.JSONDecodeError, AttributeError):
            pass

    # Degraded path: strict parse failed or no usable response — recover by regex
    # (covers truncated JSON) for the response and the two flags independently.
    if not isinstance(resp, str) or not resp.strip():
        resp = _extract_response_field(text)
        if understood is None:
            mu = re.search(r'"understood"\s*:\s*(true|false|null)', text, re.IGNORECASE)
            if mu:
                understood = _BOOL_MAP[mu.group(1).lower()]
        if counts is None:
            mc = re.search(r'"counts"\s*:\s*(true|false|null)', text, re.IGNORECASE)
            if mc:
                counts = _BOOL_MAP[mc.group(1).lower()]

    if understood not in (True, False, None):
        understood = None
    if counts not in (True, False, None):
        counts = None
    return _clean_response(resp), understood, counts


# A student asking for an example/analogy or signalling they're lost. A buried
# system-prompt rule gets ignored by a small model, so we detect this and inject a
# forceful LAST-position instruction (obeyed far more reliably) carrying a
# guaranteed concrete anchor for the topic — so even a weak model has something
# real to lean on instead of abstracting further.
_EXAMPLE_REQUEST = re.compile(
    r"\b(example|examples|analog\w*|illustrat\w*|explain|simpl\w+|"
    r"i\s*do\s*n['o]?t\s*(get|understand|know)|do\s*n['o]?t\s*get\s*it|"
    r"confus\w*|stuck|lost|no\s*idea|use\s+.+\s+to\s+explain|like\s+what|such\s+as)\b",
    re.IGNORECASE,
)

# Deterministic per-topic anchors (the guaranteed half of the fix). Keyed by a
# lowercase substring of the topic title the frontend sends ({ topic: topicTitle }).
# Injected when a student is stuck / asks for an example so the tutor always has ONE
# concrete, everyday illustration to offer rather than retreating into abstraction.
# Hand-written to match the 13 COMP3423 topics in lib/topic-definitions.ts.
_EXAMPLE_BANK = {
    "fitts": "a big button in the corner of your phone is easy to tap, while a tiny link in the middle needs careful aiming",
    "gestalt": "seeing a face in a car's headlights-and-grille, or reading a few scattered dots as one shape",
    "hick": "a coffee menu with 3 choices is instant, but a remote with 50 buttons makes you stop and hunt",
    "miller": "a phone number written 9123 4567 is split into two chunks so it fits in your head",
    "consistency": "the word \"GREEN\" printed in red ink is slow to read because the cues clash; consistent cues read instantly",
    "weber": "adding one candle to a single candle is obvious, but adding one candle to a hundred you cannot notice at all",
    "norman": "turning a steering wheel: you form the goal to turn, act, see the car move, then check it matched what you wanted",
    "mental model": "a door with a flat metal plate says \"push\" and one with a handle says \"pull\" before you read any sign",
    "affordance": "a door with a flat metal plate says \"push\" and one with a handle says \"pull\" before you read any sign",
    "problem solving": "finding a brand-new route home the first time your usual road is closed",
    "visual perception": "the two lines in the Müller-Lyer illusion look different lengths even though they are identical",
    "language": "\"I saw her duck\" — did she lower her head, or does she own a bird? Same words, two meanings",
    "ergonomic": "a chair set too high leaves your feet dangling and your back aching after an hour",
    "experiment": "timing how fast users find the \"Buy\" button on two different page layouts to see which wins",
}


def _topic_example(topic: str) -> str:
    """Best concrete anchor for a topic title, or '' if none matches."""
    t = (topic or "").lower()
    for key, ex in _EXAMPLE_BANK.items():
        if key in t:
            return ex
    return ""


@app.post("/api/socratic")
async def socratic_reflection(req: SocraticRequest):
    if not socratic_llm or not socratic_retriever:
        raise HTTPException(status_code=500, detail="Socratic tutor is not initialized yet.")

    try:
        # Anchor retrieval on the topic + the ORIGINAL reflection question (the
        # first assistant turn the frontend seeded), NOT the latest student
        # message. Adversarial/off-topic input ("who made you", "shut up") was
        # polluting the query and dragging the tutor off the topic. The LLM still
        # sees the full history below for steering; only retrieval is anchored.
        opener = next(
            (m.get("content", "") for m in req.history if m.get("role") == "assistant"),
            "",
        )
        query = f"{req.topic}. {opener}".strip()
        docs = socratic_retriever.invoke(query)
        context = "\n\n".join(d.page_content for d in docs)

        messages = [SystemMessage(content=SOCRATIC_SYSTEM_PROMPT.format(topic=req.topic, context=context))]
        for m in req.history:
            content = m.get("content", "")
            if m.get("role") == "human":
                messages.append(HumanMessage(content=content))
            else:
                messages.append(AIMessage(content=content))

        last_human = next(
            (m.get("content", "") for m in reversed(req.history) if m.get("role") == "human"),
            "",
        )
        # Forceful LAST-position nudge when the student asks for an example or is
        # stuck — even e4b follows a final imperative far more reliably than a rule
        # buried mid-prompt. Carries a guaranteed concrete anchor from the bank so
        # the model can't retreat into abstraction. Suppressed on identity probes
        # (those must be redirected, never answered).
        if last_human and _EXAMPLE_REQUEST.search(last_human) and not _IDENTITY_PATTERNS.search(last_human):
            anchor = _topic_example(req.topic)
            anchor_line = f" A concrete anchor you may use: {anchor}." if anchor else ""
            messages.append(SystemMessage(content=(
                f"The student is stuck or asking for a concrete example/analogy. In your reply "
                f"you MUST give ONE short, concrete, everyday example that illustrates {req.topic} "
                f"(use the exact example they named, e.g. Angry Birds, if any).{anchor_line} THEN "
                f"ask one simple question about it. Do NOT reply with an abstract question and do "
                f"NOT ignore their request. Still reply as the required JSON object."
            )))

        result = socratic_llm.invoke(messages)
        response, understood, counts = _parse_socratic(result.content)
        # Backstop the system-prompt identity rule (small local model is unreliable).
        response = _scrub_identity(response)

        # Deterministic backstop for the quality gate: an identity / meta probe is
        # never a reflection turn, regardless of what the model flagged. High
        # precision (only fires on explicit identity terms in the student's own
        # latest message), so it won't wrongly reject a genuine reflection.
        if last_human and _IDENTITY_PATTERNS.search(last_human):
            counts = False
            understood = False

        sources = sorted({
            f"{os.path.basename(d.metadata['source'])} (Page {d.metadata['page']})"
            for d in docs if d.metadata.get("source")
        })
        return {"response": response, "sources": sources, "understood": understood, "counts": counts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Flip-learning research data sink ──────────────────────────────────────────
# Cookie storage still drives the live app; these endpoints give the PAPER a
# centralised, aggregatable record of learning events across participants.

@app.post("/api/research/event")
async def research_event(event: ResearchEvent):
    try:
        row_id = research_store.record_event(event.model_dump())
        return {"ok": True, "id": row_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/research/summary")
async def research_summary():
    return research_store.summary()


@app.get("/api/research/export")
async def research_export(format: str = "json"):
    """Dump all collected events for analysis. format=json (default) or csv."""
    rows = research_store.fetch_all()
    if format == "csv":
        import csv
        import io
        cols = [
            "id", "participant_id", "event_type", "topic_id", "mode", "score",
            "played_understanding_first", "duration_ms", "client_ts", "server_ts", "meta",
        ]
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=cols)
        writer.writeheader()
        for r in rows:
            writer.writerow({c: r.get(c) for c in cols})
        return PlainTextResponse(
            buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=research_events.csv"},
        )
    return JSONResponse(rows)


if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8080 to avoid conflicts. reload=True is a dev
    # convenience, but the auto-reloader watches the whole folder — and Chroma
    # writes hci_chroma_db_local/chroma.sqlite3 (+ WAL) on every query, which
    # would trip a reload MID-REQUEST and drop in-flight answers. Exclude the
    # vector DB and logs so only real code edits trigger a reload.
    uvicorn.run(
        "rag_api:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        reload_excludes=["hci_chroma_db_local/*", "*.sqlite3", "*.sqlite3-*", "*.log"],
    )