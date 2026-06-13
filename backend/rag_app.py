import os
import argparse
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# Configuration
PDF_DIR = "/Users/kelvincheung/Downloads/HCI-lec"
DB_DIR = "./hci_chroma_db"

def build_vectorstore():
    print(f"📂 Loading PDFs from {PDF_DIR}...")
    loader = PyPDFDirectoryLoader(PDF_DIR)
    docs = loader.load()
    print(f"✅ Loaded {len(docs)} pages.")

    print("✂️ Splitting text into readable chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    splits = text_splitter.split_documents(docs)
    print(f"✅ Created {len(splits)} text chunks.")

    print("🧠 Generating embeddings and building vector database...")
    # This requires OPENAI_API_KEY to be set in your terminal
    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=OpenAIEmbeddings(),
        persist_directory=DB_DIR
    )
    print(f"✅ Vector database successfully built at: {DB_DIR}")

def ask_question(question):
    # Load the existing database
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OpenAIEmbeddings())
    
    # Configure retriever to fetch the top 4 most relevant chunks
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

    # Initialize the LLM
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

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
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)

    print(f"\n🤔 Question: {question}")
    print("⏳ Searching slides and generating answer...\n")
    
    response = rag_chain.invoke({"input": question})
    
    print(f"💡 Answer:\n{response['answer']}\n")
    print("📚 Sources:")
    
    # Deduplicate sources for cleaner output
    sources = set([f"{os.path.basename(doc.metadata['source'])} (Page {doc.metadata['page']})" for doc in response['context']])
    for source in sorted(sources):
        print(f" - {source}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HCI Course RAG System")
    parser.add_argument("--build", action="store_true", help="Build the vector database from the PDFs")
    parser.add_argument("--ask", type=str, help="Ask a question to the course materials")
    args = parser.parse_args()

    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("⚠️  WARNING: OPENAI_API_KEY environment variable is not set.")
        print("Please run: export OPENAI_API_KEY='your-api-key'")
        exit(1)

    if args.build:
        build_vectorstore()
    elif args.ask:
        ask_question(args.ask)
    else:
        print("Please specify an action. Examples:")
        print("  python rag_app.py --build")
        print("  python rag_app.py --ask \"What is Human Information Processing?\"")