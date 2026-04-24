from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama
from faster_whisper import WhisperModel
import tempfile
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper Model (Downloads on first request if missing)
model_size = "tiny.en"
try:
    whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
except Exception as e:
    print(f"Failed to load whisper model immediately: {e}")
    whisper_model = None

class ChatRequest(BaseModel):
    message: str

def get_ollama_response(text: str):
    response = ollama.chat(model='llama3.2:3b', messages=[
        {
            'role': 'system',
            'content': 'You are a helpful and concise AI voice assistant. Speak naturally as if you are a real person talking.'
        },
        {
            'role': 'user',
            'content': text
        }
    ])
    return response['message']['content']

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        reply = get_ollama_response(request.message)
        return {"response": reply}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/chat/audio")
async def chat_audio_endpoint(audio: UploadFile = File(...)):
    global whisper_model
    try:
        # Load model lazily if it failed initially
        if whisper_model is None:
            whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")

        # Save the audio chunk to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Transcribe using Whisper
        segments, _ = whisper_model.transcribe(tmp_path, beam_size=5)
        transcript = " ".join([segment.text for segment in segments])
        
        os.remove(tmp_path)

        if not transcript.strip():
            return {"error": "Could not hear any speech."}

        # Pass transcript to Ollama
        reply = get_ollama_response(transcript)
        
        return {
            "transcript": transcript,
            "response": reply
        }
    except Exception as e:
        return {"error": f"Audio processing error: {str(e)}"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
