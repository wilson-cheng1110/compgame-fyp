# COMP3423 AI Teaching Assistant & Dashboard

This project contains a Next.js Frontend and a Python RAG (Retrieval-Augmented Generation) Backend. **It is fully compatible with Windows.**

## Prerequisites
Before running, please ensure you have the following installed on your Windows machine:
1. **Node.js** (v18+) - Download from https://nodejs.org/
2. **Python** (v3.9+) - Download from https://www.python.org/ (Make sure to check "Add Python to PATH" during installation)
3. **Ollama** - Download from https://ollama.com/
   After installing Ollama, open PowerShell or Command Prompt and run these two commands to download the local AI models:
   `ollama pull gemma4`
   `ollama pull nomic-embed-text`

---

## Step 1: Start the Python AI Backend (RAG)
The vector database is already pre-built with the course slides.

1. Open PowerShell or Command Prompt and navigate to the backend folder:
   `cd path\to\backend`
2. Create a virtual environment and activate it:
   `python -m venv venv`
   `venv\Scripts\activate`
3. Install the required Python packages:
   `pip install -r requirements.txt`
4. Start the API server:
   `python rag_api.py`

*(Leave this terminal window open. The server will start on port 8080)*

---

## Step 2: Start the Next.js Frontend Website

1. Open a **new, separate** PowerShell or Command Prompt window.
2. Navigate to the frontend folder:
   `cd path\to\frontend`
3. Install the Node modules:
   `npm install`
4. Start the development server:
   `npm run dev`

*(Leave this terminal window open as well)*

---

## Step 3: Use the AI!
1. Open your web browser (Chrome, Edge, etc.) and navigate to **http://localhost:3000**. 
2. You will see the COMPGame dashboard.
3. Look in the **bottom right corner** of the screen and click the blue circular Chat bubble.
4. Ask a question about the course (e.g., *"What is Fitts' Law?"* or *"What are the stages of human information processing?"*). The Next.js website will communicate with the Python RAG backend and display the answer with citations!
