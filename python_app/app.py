import gradio as gr
import ollama
from faster_whisper import WhisperModel
import tempfile
import os
from gtts import gTTS

MODEL_NAME = "llama3.2:3b"

print("Loading Whisper model...")
try:
    whisper_model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
except Exception as e:
    print("Warning: Could not load whisper initially.", e)
    whisper_model = None

def get_ollama_response(history, text: str):
    messages = [{"role": "system", "content": "You are a helpful and concise AI voice assistant. Speak naturally as if you are a real person talking."}]
    
    for msg in history:
        messages.append({"role": msg['role'], "content": msg['content']})
        
    messages.append({"role": "user", "content": text})
    response = ollama.chat(model=MODEL_NAME, messages=messages)
    return response['message']['content']

def process_chat(audio_path, text_input, history):
    global whisper_model
    input_text = ""
    
    # Prioritize voice if provided
    if audio_path:
        if whisper_model is None:
             whisper_model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
        segments, _ = whisper_model.transcribe(audio_path, beam_size=5)
        input_text = " ".join([seg.text for seg in segments])
    elif text_input:
        input_text = text_input

    if not input_text.strip():
        return history, "", None

    # Step 1: Get AI response
    response_text = get_ollama_response(history, input_text)
    
    # Step 2: Text-to-Speech Generation
    output_audio_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
    tts = gTTS(response_text, lang='en')
    tts.save(output_audio_path)
    
    # Step 3: Append input and response to history using the REQUIRED Gradio 6 Dict format
    history.append({"role": "user", "content": input_text})
    history.append({"role": "assistant", "content": response_text})
    
    # Clear text input and return
    return history, "", output_audio_path

# Create Gradio UI (Removed unsupported theme and Chatbot type keywords for Gradio v6 compatibility)
with gr.Blocks(title="Pure Python AI Voice Assistant") as demo:
    gr.Markdown("# 🤖 Python Native Local AI Voice Assistant\n*Powered by Gradio, Ollama (llama3.2:3b), and Faster-Whisper*.")
    
    chatbot = gr.Chatbot(height=500)
    
    # Hidden audio player that automatically plays AI responses
    audio_output = gr.Audio(label="AI Voice", autoplay=True, visible=False)
    
    with gr.Row():
        audio_input = gr.Audio(sources=["microphone"], type="filepath", label="Mic: Record a Voice Mail (Submit by clicking Send)")
        text_input = gr.Textbox(label="Message", placeholder="Type a message...", scale=3)
        send_btn = gr.Button("Send", variant="primary")

    # Wire up button and enter key
    send_btn.click(
        fn=process_chat,
        inputs=[audio_input, text_input, chatbot],
        outputs=[chatbot, text_input, audio_output]
    ).then(
        fn=lambda: None,
        inputs=[],
        outputs=[audio_input]  # Automatically clear the mic recording after sending
    )
    
    text_input.submit(
        fn=process_chat,
        inputs=[audio_input, text_input, chatbot],
        outputs=[chatbot, text_input, audio_output]
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
