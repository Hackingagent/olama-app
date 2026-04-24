from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # local dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # Change 'llama3' to your preferred model if needed
        response = ollama.chat(model='llama3.2:3b', messages=[
            {
                'role': 'system',
                'content': 'You are a helpful and concise AI voice assistant. Speak naturally as if you are a real person talking.'
            },
            {
                'role': 'user',
                'content': request.message
            }
        ])
        
        return {"response": response['message']['content']}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
