from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
import os

DB_DIR = "./hci_chroma_db_local"
OLLAMA_EMBEDDING = "nomic-embed-text"

print("🔌 Loading database...")
vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING))

# Get all metadata from the database
db_data = vectorstore.get()

# Extract just the filenames that made it into the database
saved_files = set()
if 'metadatas' in db_data and db_data['metadatas']:
    for meta in db_data['metadatas']:
        if 'source' in meta:
            filename = os.path.basename(meta['source'])
            saved_files.add(filename)

print(f"\n📂 Found {len(saved_files)} unique files actually stored in the database:")
for f in sorted(saved_files):
    print(f" - {f}")

print("\nAre the '02 COMP3423' files in this list?")