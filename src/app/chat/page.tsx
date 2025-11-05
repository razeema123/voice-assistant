'use client';
import React, { useEffect, useRef, useState } from 'react';

type Msg = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState('en');
  const recognitionRef = useRef<any>(null);

  // 🎤 Voice recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

  // 🗣️ Text-to-speech for assistant replies
  const playTTS = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language;
    const voices = speechSynthesis.getVoices();
    const found = voices.find((v) => v.lang.startsWith(language));
    if (found) utter.voice = found;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  };

  // 💬 Send message
  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userText },
    ]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userText }],
          language,
        }),
      });

      const text = await res.text();
      const assistantText = String(text);

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: assistantText },
      ]);

      playTTS(assistantText);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: '⚠️ Error fetching response.' },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // 🆕 Start new chat
  const startNewChat = () => {
    setMessages([]);
    setInput('');
    speechSynthesis.cancel();
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-4">
      <div className="max-w-xl w-full flex flex-col bg-neutral-800 rounded-2xl shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Voice + Text Assistant</h1>
          <button
            onClick={startNewChat}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md text-sm"
          >
            New Chat
          </button>
        </div>

        <div className="mb-3 flex gap-2 items-center">
          <label className="text-sm">Language:</label>
          <select
            className="bg-neutral-700 text-white rounded-md p-1"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ml">Malayalam</option>
            <option value="fr">French</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto bg-neutral-900 rounded-lg p-3 mb-4 min-h-[300px]">
          {messages.length === 0 && (
            <p className="text-neutral-500 text-sm text-center mt-8">
              👋 Start chatting with your AI assistant!
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`my-2 ${
                m.role === 'user'
                  ? 'text-right text-blue-300'
                  : 'text-left text-green-300'
              }`}
            >
              <div className="inline-block px-3 py-2 rounded-lg bg-neutral-700">
                <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong>{' '}
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-neutral-700 pt-2"
        >
          <input
            className="flex-1 bg-neutral-700 rounded-md p-2 focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say or type something..."
          />
          <button
            type="button"
            onClick={toggleListen}
            className="bg-yellow-500 text-black px-3 py-1 rounded-md text-sm hover:bg-yellow-400"
          >
            {listening ? 'Stop' : '🎙️ Mic'}
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md text-sm"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
