"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function InterviewApp() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const abortRef = useRef(null);

    useEffect(() => { setIsMounted(true); }, []);

    const speak = (t) => {
        if (typeof window === 'undefined') return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t.replace(/[*#]/g, ''));
        window.speechSynthesis.speak(u);
        console.log("🔊 Speaking:", t);
    };

    const handleSend = async () => {
        console.log("🚀 Clicked Send");
        if (!input.trim() || loading) return;

        setLoading(true);
        const userText = input;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput("");
        abortRef.current = new AbortController();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ text: userText }], role: "Developer" }),
                signal: abortRef.current.signal
            });

            console.log("📡 Status:", res.status);
            if (!res.ok) throw new Error("Busy");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";

            setMessages(prev => [...prev, { role: 'ai', text: "" }]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                console.log("📥 Chunk:", chunk);
                fullText += chunk;
                buffer += chunk;

                if (/[.?!]/.test(buffer) || buffer.length > 40) {
                    speak(buffer);
                    buffer = "";
                }

                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1].text = fullText;
                    return next;
                });
            }
        } catch (e) {
            console.error("❌ Error:", e);
            setMessages(prev => [...prev, { role: 'ai', text: "Error: " + e.message }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', background: '#0f172a', color: '#fff', minHeight: '100vh' }}>
            <h1>Mock Interview</h1>
            <div style={{ height: '300px', overflowY: 'auto', background: '#1e293b', padding: '10px', marginBottom: '10px' }}>
                {messages.map((m, i) => <div key={i} style={{ margin: '10px 0', color: m.role === 'ai' ? '#38bdf8' : '#fff' }}><b>{m.role.toUpperCase()}:</b> {m.text}</div>)}
            </div>
            <input value={input} onChange={e => setInput(e.target.value)} style={{ width: '70%', padding: '10px' }} placeholder="Type here..." />
            <button onClick={handleSend} disabled={loading} style={{ padding: '10px 20px' }}>{loading ? "Thinking..." : "Send"}</button>
        </div>
    );
}