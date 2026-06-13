import os
import warnings
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Suppress annoying warnings
warnings.filterwarnings("ignore")
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_ollama import OllamaEmbeddings
from langchain_ollama import ChatOllama
from langchain_community.vectorstores import Chroma
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# Configuration
DB_DIR = "./hci_chroma_db_local"
OLLAMA_LLM = "gemma4"              
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

def get_rag_chain():
    print(f"🔌 Initializing database and Ollama '{OLLAMA_LLM}' model...")
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)

    base_retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 8, "fetch_k": 30}
    )
    
    retriever = MultiQueryRetriever.from_llm(retriever=base_retriever, llm=llm)

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
    # Load the model into memory when the server starts
    rag_chain = get_rag_chain()
    print("✅ API Server is ready to receive questions!")

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

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8080 to avoid conflicts
    uvicorn.run("rag_api:app", host="0.0.0.0", port=8080, reload=True)