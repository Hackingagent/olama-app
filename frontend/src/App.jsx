import { useState, useRef, useEffect } from 'react'
import './index.css'

function App() {
  const [messages, setMessages] = useState([
    { id: 1, type: 'ai', text: 'Hello! I am your AI assistant powered by Ollama. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  
  const mediaRecorder = useRef(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/health');
      if (res.ok) setIsConnected(true);
    } catch (e) {
      setIsConnected(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Request WebM format natively
        mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        setIsRecording(true);

        const chunks = [];
        mediaRecorder.current.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.current.onstop = () => {
          // Send the recorded chunk array as a playable Blob
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          sendAudioMessage(audioBlob, audioUrl);
          
          // Stop all audio tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.current.start();
      } catch (err) {
        console.error("Error accessing microphone", err);
        setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Error accessing microphone. Please allow permissions in your browser.' }]);
      }
    }
  };

  const sendAudioMessage = async (audioBlob, audioUrl) => {
    // Add user audio message to chat visually to show it's an actual voice mail
    const msgId = Date.now();
    setMessages(prev => [...prev, { 
      id: msgId, 
      type: 'user', 
      isAudio: true,
      audioUrl: audioUrl,
      text: '🤖 Transcribing voice mail...' 
    }]);
    
    setIsTyping(true);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_mail.webm');

    try {
      const res = await fetch('http://localhost:8000/api/chat/audio', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.response) {
        // Replace "Transcribing" with what the AI actually heard
        setMessages(prev => prev.map(msg => 
          msg.id === msgId ? { ...msg, text: `"${data.transcript}"` } : msg
        ));
        
        // Add AI response
        setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', text: data.response }]);
        speakText(data.response);
      } else {
        setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', text: 'Sorry, I encountered an error. ' + (data.error || '') }]);
        setMessages(prev => prev.map(msg => 
          msg.id === msgId ? { ...msg, text: `Failed to transcribe` } : msg
        ));
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'ai', text: 'Error connecting to backend.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendTextMessage = async (textToSubmit = input) => {
    if (!textToSubmit.trim()) return;

    const newMsg = { id: Date.now(), type: 'user', text: textToSubmit };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSubmit })
      });
      
      const data = await res.json();
      
      if (data.response) {
        setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: data.response }]);
        speakText(data.response);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Sorry, I encountered an error. ' + (data.error || '') }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Error connecting to backend.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isRecording) {
      sendTextMessage();
    }
  };

  return (
    <div className="app-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
          Ollama Voice Assistant
        </h1>
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : ''}`}></div>
          {isConnected ? 'Connected' : 'Backend Offline'}
        </div>
      </div>

      <div className="chat-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type} ${msg.isAudio ? 'audio-message' : ''}`}>
             <div className="message-content">
               {msg.text}
               {msg.isAudio && msg.audioUrl && (
                 <audio src={msg.audioUrl} controls className="audio-player" />
               )}
             </div>
          </div>
        ))}
        {isTyping && (
          <div className="message ai">
            <div className="typing-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <button 
          className={`icon-button ${isRecording ? 'mic-active' : ''}`}
          onClick={toggleRecording}
          title={isRecording ? "Stop recording & Send" : "Record Voice Mail"}
        >
          {isRecording ? (
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
             </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          )}
        </button>
        <input 
          type="text" 
          placeholder={isRecording ? "Recording Voice Mail... Click Square to send." : "Type a message or click Mic for voice mail..."} 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isRecording}
        />
        <button className="icon-button primary" onClick={() => sendTextMessage()} title="Send Message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default App
