"""Rebuild the HCI ChromaDB from the local lecture PDFs.

Why this exists: the original DB (built via PyPDFDirectoryLoader's *default*
text-extraction mode) stored space-mangled chunks like
"Index of Difficultydependson the task" — words concatenated with no spaces.
nomic-embed-text then embeds that garbled text far from any natural-language
query, so the most relevant slides never make it into the top-k and the tutor
answers "I do not know" on topics that ARE in the slides.

Fix: extract with pypdf's `extraction_mode="layout"`, which preserves spatial
layout and restores word spacing (verified to recover the Fitts' Law IoD/IoP
formula slide). Same splitter params and metadata schema as before so
rag_api.py keeps working unchanged.

Usage:
    python rebuild_db.py            # build into ./hci_chroma_db_local
"""

import os
import glob
import warnings

warnings.filterwarnings("ignore")
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

PDF_DIR = "."
DB_DIR = "./hci_chroma_db_local"
OLLAMA_EMBEDDING = "nomic-embed-text"


def load_pages_layout(pdf_dir: str) -> list[Document]:
    """Load every PDF page using layout-preserving extraction.

    Metadata matches the original PyPDFLoader schema (source=filename,
    page=0-indexed) so rag_api.py's source dedup keeps working.
    """
    docs: list[Document] = []
    pdfs = sorted(glob.glob(os.path.join(pdf_dir, "*.pdf")))
    print(f"Found {len(pdfs)} PDFs.")
    for path in pdfs:
        name = os.path.basename(path)
        try:
            reader = PdfReader(path)
        except Exception as e:
            print(f"  SKIP {name}: {e}")
            continue
        page_count = 0
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text(extraction_mode="layout") or ""
            except Exception:
                # Some pages (rotated text) fail layout mode — fall back.
                text = page.extract_text() or ""
            text = text.strip()
            if not text:
                continue
            docs.append(Document(page_content=text, metadata={"source": name, "page": i}))
            page_count += 1
        print(f"  {name}: {page_count} pages")
    return docs


def main():
    print("Loading PDFs with layout extraction...")
    docs = load_pages_layout(PDF_DIR)
    print(f"Loaded {len(docs)} non-empty pages.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""],
    )
    splits = splitter.split_documents(docs)
    print(f"Created {len(splits)} chunks. Embedding with '{OLLAMA_EMBEDDING}' (this takes a few minutes)...")

    Chroma.from_documents(
        documents=splits,
        embedding=OllamaEmbeddings(model=OLLAMA_EMBEDDING),
        persist_directory=DB_DIR,
    )
    print(f"Done. Vector DB rebuilt at {DB_DIR} ({len(splits)} chunks).")


if __name__ == "__main__":
    main()
