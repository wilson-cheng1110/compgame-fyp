import os
import argparse
import warnings

# Suppress annoying warnings (like urllib3 and LangChain deprecation notices)
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
PDF_DIR = "/Users/kelvincheung/Downloads/HCI-lec"
DB_DIR = "./hci_chroma_db_local"

# Local models used via Ollama
OLLAMA_LLM = "gemma4"              
OLLAMA_EMBEDDING = "nomic-embed-text" 

def build_vectorstore():
    print(f"📂 Loading PDFs from {PDF_DIR}...")
    loader = PyPDFDirectoryLoader(PDF_DIR)
    docs = loader.load()
    
    # FIX: Clean corrupted PDF text (replace weird bullet points with spaces/newlines)
    for doc in docs:
        doc.page_content = doc.page_content.replace('', '\n- ')
        
    print(f"✅ Loaded and cleaned {len(docs)} pages.")

    print("✂️ Splitting text into readable chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    splits = text_splitter.split_documents(docs)
    print(f"✅ Created {len(splits)} text chunks.")

    print(f"🧠 Generating embeddings using local '{OLLAMA_EMBEDDING}' and building database...")
    print("⏳ (This may take a few minutes depending on your Mac's speed...)")
    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=OllamaEmbeddings(model=OLLAMA_EMBEDDING),
        persist_directory=DB_DIR
    )
    print(f"✅ Vector database successfully built at: {DB_DIR}")

def get_rag_chain():
    # Load the existing database
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))
    
    # Initialize the local Ollama LLM first
    llm = ChatOllama(model=OLLAMA_LLM, temperature=0)

    # Use MultiQueryRetriever to automatically rephrase the question for better slide matching
    base_retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 8, "fetch_k": 30}
    )
    
    retriever = MultiQueryRetriever.from_llm(
        retriever=base_retriever, llm=llm
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

    # Build the RAG chain
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)

def print_response(response):
    print(f"💡 Answer:\n{response['answer']}\n")
    print("📚 Sources:")
    
    # Deduplicate sources for cleaner output
    sources = set([f"{os.path.basename(doc.metadata['source'])} (Page {doc.metadata['page']})" for doc in response['context']])
    for source in sorted(sources):
        print(f" - {source}")

def ask_question(question):
    print(f"🔌 Loading local database and initializing Ollama '{OLLAMA_LLM}' model...")
    rag_chain = get_rag_chain()
    
    print(f"\n🤔 Question: {question}")
    print("⏳ Searching slides and generating answer locally...\n")
    
    response = rag_chain.invoke({"input": question})
    print_response(response)

def chat_mode():
    print(f"🔌 Loading local database and initializing Ollama '{OLLAMA_LLM}' model...")
    rag_chain = get_rag_chain()
    
    print("\n=======================================================")
    print("🤖 HCI Assistant ready! (Type 'exit' or 'quit' to stop)")
    print("=======================================================")
    
    while True:
        try:
            user_input = input("\n🤔 Question: ")
            if user_input.lower() in ['exit', 'quit']:
                print("Goodbye! 👋\n")
                break
            if not user_input.strip():
                continue
                
            print("⏳ Searching slides and generating answer...\n")
            response = rag_chain.invoke({"input": user_input})
            print_response(response)
            
        except KeyboardInterrupt: # Handles Ctrl+C gracefully
            print("\nGoodbye! 👋\n")
            break
        except Exception as e:
            print(f"⚠️ Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HCI Course RAG System (Local via Ollama)")
    parser.add_argument("--build", action="store_true", help="Build the vector database from the PDFs")
    parser.add_argument("--ask", type=str, help="Ask a question to the course materials")
    parser.add_argument("--chat", action="store_true", help="Start an interactive chat loop")
    args = parser.parse_args()

    if args.build:
        build_vectorstore()
    elif args.ask:
        ask_question(args.ask)
    elif args.chat:
        chat_mode()
    else:
        print("Please specify an action. Examples:")
        print("  python rag_app_local.py --build")
        print("  python rag_app_local.py --ask \"What is Human Information Processing?\"")
        print("  python rag_app_local.py --chat")