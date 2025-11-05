'use client';
import React, { useEffect, useRef, useState } from 'react';

type Msg = {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
};

export default function ChatPageManual() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState(process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'en');
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);

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

    rec.onresult = (ev: any) => {
      const last = ev.results[ev.results.length - 1];
      setInput(last[0].transcript);
    };

    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, [language]);

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

  // ---------- Robust sendMessage ----------
  async function sendMessage(userText: string) {
    if (!userText.trim()) return;
    // Append user message (string only)
    const userMsg: Msg = { id: `${Date.now()}-u`, role: 'user', content: String(userText) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    abortControllerRef.current = new AbortController();

    try {
      streamingRef.current = true;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userText }], language }),
        signal: abortControllerRef.current.signal,
      });

      // Safety: ensure res is ok
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`API error: ${res.status} ${errText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      // If server streams text chunks with content-type text/*, consume stream
      if (res.body && contentType.includes('text')) {
        // Add a placeholder assistant message and update it incrementally
        const placeholderId = `partial-${Date.now()}`;
        setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', content: '' }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          // Replace last message (placeholder) with updated content
          setMessages(prev => {
            const copy = prev.slice();
            // ensure we update placeholder only
            const idx = copy.findIndex(m => m.id === placeholderId);
            if (idx !== -1) {
              copy[idx] = { id: placeholderId, role: 'assistant', content: assistantText };
            } else {
              copy.push({ id: placeholderId, role: 'assistant', content: assistantText });
            }
            return copy;
          });
        }

        // finalize placeholder -> final id
        setMessages(prev => {
          const copy = prev.slice();
          const idx = copy.findIndex(m => m.id === placeholderId);
          const finalMsg: Msg = { id: `${Date.now()}-a`, role: 'assistant', content: assistantText };
          if (idx !== -1) copy[idx] = finalMsg;
          else copy.push(finalMsg);
          return copy;
        });

        // Play TTS for the final resolved string
        playTTS(assistantText);
      } else {
        // Non-streaming response: ensure we await text() (do NOT put the promise itself into content)
        const text = await res.text(); // await here is crucial
        const assistantMsg: Msg = { id: `${Date.now()}-a`, role: 'assistant', content: String(text) };
        setMessages(prev => [...prev, assistantMsg]);
        playTTS(text);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('sendMessage error:', err);
      setMessages(prev => [...prev, { id: `${Date.now()}-err`, role: 'assistant', content: 'Error: failed to get response.' }]);
    } finally {
      streamingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  }

  // ---------- Render ----------
  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <h1>Voice + Text Assistant (Manual)</h1>
      <div style={{ marginBottom: 12 }}>
        <label>
          Language:{' '}
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ml">Malayalam</option>
            <option value="fr">French</option>
          </select>
        </label>
      </div>

      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, minHeight: 240, background:'#111' }}>
        {messages.map(m => (
          <div key={m.id} style={{ margin: '8px 0', whiteSpace:'pre-wrap' }}>
            <strong style={{ textTransform: 'capitalize' }}>{m.role}:</strong> {String(m.content)}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMessage(input.trim()); }} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Say or type something..." style={{ flex: 1, padding: 12 }} />
        <button type="button" onClick={toggleListen}>{listening ? 'Stop' : 'Mic'}</button>
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
