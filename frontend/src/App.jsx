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
  
  // Speech Recognition Setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = useRef(null);

  useEffect(() => {
    // Check backend health
    checkHealth();

    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      
      recognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
        // Automatically send after voice input
        sendMessage(transcript);
      };

      recognition.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.current.onend = () => {
        setIsRecording(false);
      };
    }
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
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Optional: change voice or rate here
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognition.current?.stop();
    } else {
      setInput(''); // Clear input for new voice command
      recognition.current?.start();
      setIsRecording(true);
    }
  };

  const sendMessage = async (textToSubmit = input) => {
    if (!textToSubmit.trim()) return;

    // Add user message to chat
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
        // Speak the response
        speakText(data.response);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Sorry, I encountered an error. ' + (data.error || '') }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Error: Could not connect to backend. Is the FastAPI server running?' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="app-container">
      {/* Decorative background blur blobs */}
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
          <div key={msg.id} className={`message ${msg.type}`}>
            {msg.text}
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
          title={isRecording ? "Stop recording" : "Speak"}
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
          placeholder="Type a message or use voice..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button className="icon-button primary" onClick={() => sendMessage()} title="Send">
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
