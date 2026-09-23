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

Also ingests plain-text/Markdown reference notes from ./corpus_notes (in
addition to the PDFs). These are authored HCI reference notes for topics the
2023 lecture decks do not cover -- currently `norman`, `hicks-law`, and
`webers-law`, the three topics `check_corpus_coverage.py` reports as UNCOVERED.
They go through the identical splitter + metadata schema, so the tutor is
grounded on them exactly as on a lecture slide. Drop a new .md/.txt in
corpus_notes and re-run to extend coverage; nothing else changes.

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
NOTES_DIR = "./corpus_notes"
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


def load_notes(notes_dir: str) -> list[Document]:
    """Load authored reference notes (.md/.txt) as documents.

    Same metadata schema as the PDF loader (source=filename, page=0-indexed).
    A note is not paginated, so it is a single page-0 document; the splitter
    then chunks it exactly like a lecture page. Missing dir -> no notes, so a
    checkout without any notes still rebuilds a PDF-only store unchanged.
    """
    docs: list[Document] = []
    if not os.path.isdir(notes_dir):
        print(f"No notes dir at {notes_dir} (skipping).")
        return docs
    paths = sorted(glob.glob(os.path.join(notes_dir, "*.md"))
                   + glob.glob(os.path.join(notes_dir, "*.txt")))
    print(f"Found {len(paths)} reference note(s) in {notes_dir}.")
    for path in paths:
        name = os.path.basename(path)
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read().strip()
        except Exception as e:
            print(f"  SKIP {name}: {e}")
            continue
        if not text:
            continue
        docs.append(Document(page_content=text, metadata={"source": name, "page": 0}))
        print(f"  {name}: {len(text)} chars")
    return docs


def main():
    print("Loading PDFs with layout extraction...")
    docs = load_pages_layout(PDF_DIR)
    print(f"Loaded {len(docs)} non-empty pages.")

    notes = load_notes(NOTES_DIR)
    docs += notes
    print(f"Loaded {len(notes)} reference note(s); {len(docs)} source documents total.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""],
    )
    splits = splitter.split_documents(docs)
    print(f"Created {len(splits)} chunks. Embedding with '{OLLAMA_EMBEDDING}' (this takes a few minutes)...")

    # Embed in sub-batches rather than one Chroma.from_documents() shot. That
    # single call hands ALL chunks to nomic-embed-text in ONE Ollama /embed
    # request, and the runner crashes on an oversized batch ("Post .../tokenize:
    # actively refused"): batch 128 works, 512 fails. So build the persistent
    # store first, then add_documents() in conservative <=128 batches. Same
    # collection name (default "langchain") / persist dir / metadata as before,
    # so rag_api.py reads it unchanged.
    EMBED_BATCH = 100
    vectorstore = Chroma(
        embedding_function=OllamaEmbeddings(model=OLLAMA_EMBEDDING),
        persist_directory=DB_DIR,
    )
    for start in range(0, len(splits), EMBED_BATCH):
        batch = splits[start:start + EMBED_BATCH]
        vectorstore.add_documents(batch)
        print(f"  embedded {min(start + EMBED_BATCH, len(splits))}/{len(splits)} chunks")
    print(f"Done. Vector DB rebuilt at {DB_DIR} ({len(splits)} chunks).")


if __name__ == "__main__":
    main()
