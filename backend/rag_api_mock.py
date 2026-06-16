import os
import warnings
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

warnings.filterwarnings("ignore")

app = FastAPI(title="HCI RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

# Predefined responses for demo
RESPONSES = {
    "miller": {
        "answer": "Miller's Law, established by George Miller in 1956, states that the capacity of working memory is limited to approximately 7 ± 2 items or 'chunks'. A chunk is a meaningful unit - a digit, word, or concept grouped together. This limitation is fundamental to UI design: users scanning a menu can hold ~7 items in working memory before losing track. Therefore, designers should organize information into logical groups (chunking) to reduce cognitive load. For example, breaking a 10-digit phone number into groups (555-123-4567) makes it easier to remember than 5551234567.",
        "sources": ["02 COMP3423 Human Info Proc 1.pdf (Page 5)", "02 COMP3423 Human Info Proc 2.pdf (Page 3)"]
    },
    "fitts": {
        "answer": "Fitts' Law describes the relationship between the distance to a target, the size of the target, and the time it takes to select it. Formally: MT = a + b * log2(D/W + 1), where MT is movement time, D is distance, and W is target width. The key insight: smaller targets farther away take longer to select. This applies to UI buttons, menu items, and touch targets. Practical implications: important buttons should be large (increase W), placed at screen edges or corners (reduce D), or use 'magic corners' where the cursor stops at screen boundaries.",
        "sources": ["01 COMP3423 Introducing HCI 1.pdf (Page 8)", "01 COMP3423 Introducing HCI 2.pdf (Page 6)"]
    },
    "gestalt": {
        "answer": "Gestalt principles describe how humans group visual elements into wholes. Key principles: (1) Proximity - nearby elements are perceived as grouped; (2) Similarity - similar-looking elements are grouped; (3) Continuity - the eye follows smooth lines; (4) Closure - we complete incomplete shapes; (5) Figure-ground - we distinguish objects from backgrounds. In UI design, use proximity to relate related controls, similarity to group buttons by function (e.g., all danger actions in red), and continuity in navigation flows to guide user attention.",
        "sources": ["03 COMP3423 Visual 1.pdf (Page 4)", "03 COMP3423 Visual 2.pdf (Page 5)"]
    }
}

@app.on_event("startup")
async def startup_event():
    print("RAG API Server is ready!")

@app.post("/api/ask")
async def ask_question(req: QuestionRequest):
    question = req.question.lower()

    # Try to match question to a predefined response
    for keyword, response_data in RESPONSES.items():
        if keyword in question:
            return response_data

    # Default response if no match
    return {
        "answer": "I can help with Miller's Law, Fitts' Law, or Gestalt Principles from the COMP3423 course. Which would you like to learn about?",
        "sources": ["COMP3423 Lecture Notes"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_api_mock:app", host="0.0.0.0", port=8080, reload=False)
