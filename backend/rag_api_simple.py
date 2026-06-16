import os
import warnings
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

warnings.filterwarnings("ignore")
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate

# Configuration
DB_DIR = "./hci_chroma_db_local"
OLLAMA_LLM = "gemma4"
OLLAMA_EMBEDDING = "nomic-embed-text"

app = FastAPI(title="HCI RAG API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_chain = None

class QuestionRequest(BaseModel):
    question: str

def get_rag_chain():
    print(f"Initializing ChromaDB and Ollama '{OLLAMA_LLM}'...")

    # Load vector store
    vectorstore = Chroma(
        persist_directory=DB_DIR,
        embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING)
    )

    # Get retriever
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 8, "fetch_k": 30}
    )

    # LLM
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)

    # Simple chain function
    def rag_func(question):
        # Retrieve docs
        docs = retriever.invoke(question)

        # Format context
        context_str = "\n\n".join([d.page_content for d in docs])

        # Create prompt
        prompt_text = f"""You are an expert teaching assistant for COMP3423 (Human-Computer Interaction).
Use the following lecture content to answer the question. Keep answers concise and accurate.

LECTURE CONTENT:
{context_str}

QUESTION: {question}

ANSWER:"""

        # Get response
        response = llm.invoke(prompt_text)

        # Extract sources
        sources = []
        for doc in docs:
            if 'source' in doc.metadata:
                source = os.path.basename(doc.metadata['source'])
                page = doc.metadata.get('page', 0)
                sources.append(f"{source} (Page {page})")

        return {
            "answer": response.content if hasattr(response, 'content') else str(response),
            "sources": list(set(sources))
        }

    return rag_func

@app.on_event("startup")
async def startup_event():
    global rag_chain
    rag_chain = get_rag_chain()
    print("API Server is ready to receive questions!")

@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    if not rag_chain:
        raise HTTPException(status_code=500, detail="RAG system not initialized")

    try:
        print(f"Question: {req.question}")
        result = rag_chain(req.question)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_api_simple:app", host="0.0.0.0", port=8080, reload=False)
