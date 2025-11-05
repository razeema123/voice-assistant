'use client';
import { useChat } from 'ai/react';
import React, { useEffect, useRef, useState } from 'react';

type Msg = {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
};

export default function ChatPage() {
  const { messages, input, setInput, handleSubmit, append } = useChat() as any; // cast to any until you add proper types
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'en'
  );
  const recognitionRef = useRef<any>(null);

  // Setup Web Speech API SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = language;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Quick fix: use `any` for event typing
    rec.onresult = (ev: any) => {
      const last = ev.results[ev.results.length - 1];
      setInput(last[0].transcript);
    };

    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
  }, [language, setInput]);

  const toggleListen = () => {
    const rec = recognitionRef.current;
    if (!rec) return alert('SpeechRecognition not available.');
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Play assistant messages via TTS when they arrive
  useEffect(() => {
    const msgs = (messages || []) as Msg[];
    const last = msgs[msgs.length - 1];
    if (!last) return;
    if (last.role === 'assistant') {
      playTTS(last.content);
    }
  }, [messages, language]);

  function playTTS(text: string) {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language;
    const voices = speechSynthesis.getVoices();
    const found = voices.find(v => v.lang.startsWith(language));
    if (found) utter.voice = found;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h1>Voice + Text Assistant (MVP)</h1>

      <div style={{ marginBottom: 12 }}>
        <label>
          Language:
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ml">Malayalam</option>
            <option value="fr">French</option>
          </select>
        </label>
      </div>

      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, minHeight: 240 }}>
        {((messages || []) as Msg[]).map((m) => (
          <div key={m.id} style={{ margin: '8px 0' }}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(e);
        }}
        style={{ marginTop: 12, display: 'flex', gap: 8 }}
      >
        <input
          value={input || ''}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say or type something..."
          style={{ flex: 1, padding: 8 }}
        />

        <button type="button" onClick={toggleListen}>
          {listening ? 'Stop' : 'Mic'}
        </button>

        <button type="submit">Send</button>
      </form>
    </div>
  );
}
