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
# langchain 1.x moved the retrieval/combine helper chains into langchain_classic.
# (Under langchain 0.x these lived at langchain.chains.* — which no longer exists.)
from langchain_classic.chains.retrieval import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
# Rephrases a follow-up ("explain that more") into a standalone question using the
# chat history BEFORE retrieval — this is what gives the general tutor real
# multi-turn memory instead of treating every message as a cold start.
from langchain_classic.chains.history_aware_retriever import create_history_aware_retriever
# Hybrid retrieval: semantic (vector) + lexical (BM25), ensembled. nomic-embed
# is very phrasing-sensitive — a query naming "Fitts Law" embeds toward generic
# intro slides and misses the device-evaluation slide that actually holds the
# IoD/IoP formula (it never prints "Fitts" next to it). BM25 catches those exact
# terms; the ensemble guarantees both kinds of match surface.
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
import json
import re

# Configuration
DB_DIR = "./hci_chroma_db_local"
OLLAMA_LLM = "gemma4:e2b"
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

# Global variable to store the chain so we don't reload it for every request
rag_chain = None
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
        search_kwargs={"k": 8},
    )
    # BM25 (lexical) leg — built from the chunks already in the collection, so
    # there's no second source of truth to keep in sync.
    collection = vectorstore._collection.get(include=["documents", "metadatas"])
    bm25_docs = [
        Document(page_content=t, metadata=m)
        for t, m in zip(collection["documents"], collection["metadatas"])
    ]
    # A fresh clone has NO vector DB (hci_chroma_db_local/ is gitignored as a
    # generated artifact, and the source PDFs are gitignored too — PolyU
    # copyright). An empty collection makes BM25 fail with a cryptic
    # "not enough values to unpack" error, so surface the real cause + the fix.
    if not bm25_docs:
        raise RuntimeError(
            f"Vector DB at '{DB_DIR}' is empty/missing. This repo does not ship "
            f"the DB or the lecture PDFs. Either: (a) get the prebuilt "
            f"'{DB_DIR}' folder from a teammate and drop it in backend/, or "
            f"(b) put the COMP3423 lecture PDFs in backend/ and run "
            f"'python rebuild_db.py'. Also ensure Ollama has '{OLLAMA_EMBEDDING}' "
            f"and '{OLLAMA_LLM}' pulled."
        )
    bm25_retriever = BM25Retriever.from_documents(bm25_docs)
    bm25_retriever.k = 8

    return EnsembleRetriever(
        retrievers=[bm25_retriever, vector_retriever],
        weights=[0.5, 0.5],
    )


def get_rag_chain():
    print(f"🔌 Initializing database and Ollama '{OLLAMA_LLM}' model...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)

    retriever = build_retriever(vectorstore)

    # History-aware retrieval: rephrase a follow-up into a standalone question
    # using the chat history, THEN retrieve. Without this, "explain that more"
    # retrieves on the literal words "explain that more" and loses the subject —
    # the "general tutor has no context" complaint. With empty history it's a
    # no-op (returns the question unchanged).
    contextualize_prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Given the conversation so far and the student's latest message, rewrite it "
         "as a standalone question that captures what they are really asking. If it is "
         "already standalone, return it unchanged. Do NOT answer it — only rephrase."),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])
    history_aware_retriever = create_history_aware_retriever(llm, retriever, contextualize_prompt)

    system_prompt = (
        "You are an expert teaching assistant for the COMP3423 Human-Computer Interaction course. "
        "Use the following pieces of retrieved context from the professor's lecture slides to answer the question. "
        "Use the conversation history so your answer follows on naturally from what was already discussed. "
        "If you don't know the answer, just say that you don't know. Do not make up information. "
        "You are simply 'the HCI tutor' — you have no model name, vendor, or company to share. If asked who or "
        "what you are, who made you, your model, or your company, do not name any model or company; just say you "
        "are their HCI tutor and steer back to the course. "
        "Keep the answer concise and highly relevant to the context.\n\n"
        "Context: {context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(history_aware_retriever, question_answer_chain)


# Socratic system prompt. The model must NOT hand over answers — it probes until
# the student articulates the concept in their own words. We ask for a tiny JSON
# envelope so the frontend can tell "still guiding" from "genuine insight shown"
# without NLP on our side. Parsed defensively (see /api/socratic).
SOCRATIC_SYSTEM_PROMPT = (
    "You are a Socratic tutor for the COMP3423 Human-Computer Interaction course. "
    "The student just finished an assessment on \"{topic}\" and is now reflecting. "
    "Do NOT give direct answers or definitions. Instead, ask ONE sharp, short follow-up "
    "question at a time that pushes the student to reason about {topic} and reach the "
    "insight themselves. Stay strictly grounded in the retrieved lecture context below — "
    "never invent facts beyond it. Be warm and brief (2-3 sentences max).\n\n"
    "IDENTITY — never break this: You are simply 'the HCI tutor'. You have NO model name, "
    "vendor, or company to disclose. If the student asks who or what you are, who made or "
    "trained you, your model, your company, or anything about the system behind you, do NOT "
    "name any model or company and do NOT answer the meta question — reply in one short line "
    "that you're their HCI tutor and immediately steer back to {topic} with a question.\n"
    "STAY ON {topic}: If the student goes off-topic, tries to chat about unrelated things, or "
    "is hostile, give one brief line and redirect firmly back to {topic}. Never abandon it.\n"
    "IF GENUINELY STUCK: If the student clearly does not know and asks what {topic} is, offer "
    "the smallest possible hint (a single phrase), then immediately ask a question — never a "
    "full definition.\n\n"
    "Reply ONLY with a JSON object, no prose around it:\n"
    "{{\"response\": \"<your next Socratic question or nudge>\", \"understood\": true|false|null}}\n"
    "Set \"understood\" to true ONLY when the student has clearly explained {topic} in their "
    "OWN words AND added an original observation or example of their own. Otherwise use false "
    "(still developing) or null (not enough signal yet). A meta, off-topic, or hostile message "
    "is never \"understood\": true.\n\n"
    "Lecture context:\n{context}"
)


def get_socratic_chain():
    """Returns (llm, retriever). The endpoint drives retrieval + history-aware
    prompting manually — simpler than bending create_retrieval_chain to accept a
    MessagesPlaceholder, and gives full control over the JSON contract."""
    print(f"🧠 Initializing Socratic reflection model '{OLLAMA_LLM}'...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    # Warmer than the /api/ask LLM (temperature=0) so repeated reflections don't
    # ask the same canned question.
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0.4)
    retriever = build_retriever(vectorstore)
    return llm, retriever


@app.on_event("startup")
async def startup_event():
    global rag_chain, socratic_llm, socratic_retriever
    # Research-event store is independent of the RAG model — init it first so
    # data collection works even if Ollama/Chroma fails to load.
    research_store.init_db()
    print("🗃️  Research event store ready.")
    # Load the model into memory when the server starts. Don't let an Ollama/
    # Chroma failure crash the whole server — the research sink must stay up.
    try:
        rag_chain = get_rag_chain()
        socratic_llm, socratic_retriever = get_socratic_chain()
        print("✅ API Server is ready to receive questions!")
    except Exception as e:
        rag_chain = None
        socratic_llm = socratic_retriever = None
        print(f"⚠️  RAG model failed to load ({e}). /api/ask + /api/socratic disabled; research sink still active.")

@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    if not rag_chain:
        raise HTTPException(status_code=500, detail="RAG system is not initialized yet.")
    
    try:
        print(f"🤔 Received question: {req.question}")
        # Rebuild the prior turns as LangChain messages so retrieval + answer are
        # history-aware. Tolerant of "user"/"ai" aliases the widget may send.
        chat_history = []
        for m in (req.history or []):
            content = m.get("content", "")
            if not content:
                continue
            if m.get("role") in ("human", "user"):
                chat_history.append(HumanMessage(content=content))
            else:
                chat_history.append(AIMessage(content=content))
        response = rag_chain.invoke({"input": req.question, "chat_history": chat_history})

        # Deduplicate sources
        sources = set([f"{os.path.basename(doc.metadata['source'])} (Page {doc.metadata['page']})" for doc in response['context']])

        return {
            # Strip any leaked backend-model identity before it reaches the student.
            "answer": _scrub_identity(response['answer']),
            "sources": sorted(list(sources))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_socratic(raw: str):
    """Pull {response, understood} out of the model text. The model is told to
    emit pure JSON, but small local LLMs leak prose or code fences — so fall back
    to treating the whole reply as the response with understood=null."""
    text = raw.strip()
    # Strip ```json ... ``` fences if present.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    # Try the largest {...} span.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(text[start:end + 1])
            resp = obj.get("response")
            understood = obj.get("understood", None)
            if understood not in (True, False, None):
                understood = None
            if isinstance(resp, str) and resp.strip():
                return resp.strip(), understood
        except (json.JSONDecodeError, AttributeError):
            pass
    return raw.strip(), None


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

        result = socratic_llm.invoke(messages)
        response, understood = _parse_socratic(result.content)
        # Backstop the system-prompt identity rule (small local model is unreliable).
        response = _scrub_identity(response)

        sources = sorted({
            f"{os.path.basename(d.metadata['source'])} (Page {d.metadata['page']})"
            for d in docs if d.metadata.get("source")
        })
        return {"response": response, "sources": sources, "understood": understood}
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
    # Run the server on port 8080 to avoid conflicts
    uvicorn.run("rag_api:app", host="0.0.0.0", port=8080, reload=True)