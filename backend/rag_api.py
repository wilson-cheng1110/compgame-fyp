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
# Hybrid retrieval: semantic (vector) + lexical (BM25), ensembled. nomic-embed
# is very phrasing-sensitive — a query naming "Fitts Law" embeds toward generic
# intro slides and misses the device-evaluation slide that actually holds the
# IoD/IoP formula (it never prints "Fitts" next to it). BM25 catches those exact
# terms; the ensemble guarantees both kinds of match surface.
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate

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

class QuestionRequest(BaseModel):
    question: str


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

def get_rag_chain():
    print(f"🔌 Initializing database and Ollama '{OLLAMA_LLM}' model...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)

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

    retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, vector_retriever],
        weights=[0.5, 0.5],
    )

    system_prompt = (
        "You are an expert teaching assistant for the COMP3423 Human-Computer Interaction course. "
        "Use the following pieces of retrieved context from the professor's lecture slides to answer the question. "
        "If you don't know the answer, just say that you don't know. Do not make up information. "
        "Keep the answer concise and highly relevant to the context.\n\n"
        "Context: {context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)

@app.on_event("startup")
async def startup_event():
    global rag_chain
    # Research-event store is independent of the RAG model — init it first so
    # data collection works even if Ollama/Chroma fails to load.
    research_store.init_db()
    print("🗃️  Research event store ready.")
    # Load the model into memory when the server starts. Don't let an Ollama/
    # Chroma failure crash the whole server — the research sink must stay up.
    try:
        rag_chain = get_rag_chain()
        print("✅ API Server is ready to receive questions!")
    except Exception as e:
        rag_chain = None
        print(f"⚠️  RAG model failed to load ({e}). /api/ask disabled; research sink still active.")

@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    if not rag_chain:
        raise HTTPException(status_code=500, detail="RAG system is not initialized yet.")
    
    try:
        print(f"🤔 Received question: {req.question}")
        response = rag_chain.invoke({"input": req.question})
        
        # Deduplicate sources
        sources = set([f"{os.path.basename(doc.metadata['source'])} (Page {doc.metadata['page']})" for doc in response['context']])
        
        return {
            "answer": response['answer'],
            "sources": sorted(list(sources))
        }
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