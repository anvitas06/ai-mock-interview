"use client";
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function InterviewApp() {
    const [view, setView] = useState('landing'); 
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSendCoolingDown, setIsSendCoolingDown] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const history = []; // Simplified for testing
    
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null); 

    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') window.speechSynthesis.getVoices();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const cleanText = text.replace(/[*#`]/g, '').trim();
        if (!cleanText) return;

        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        window.speechSynthesis.speak(utterance);
        console.log("🔊 SPEAKING:", cleanText);
    };

    const handleSend = async () => {
        console.log("🚀 handleSend triggered!"); // STEP 1
        if (loading || !input.trim()) return;

        setLoading(true);
        const userText = input;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput("");
        abortControllerRef.current = new AbortController();

        try {
            console.log("📡 Fetching from API..."); // STEP 2
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', text: userText }],
                    role: selectedRole,
                    level: level,
                    questionCount: messages.filter(m => m.role === 'ai').length,
                }),
            });

            console.log("📡 Response Status:", response.status); // STEP 3

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
            let sentenceBuffer = "";

            setMessages(prev => [...prev, { role: 'ai', text: "" }]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                console.log("📥 Received Chunk:", chunk); // STEP 4
                
                accumulatedText += chunk;
                sentenceBuffer += chunk;

                if (/[.?!]/.test(sentenceBuffer) || sentenceBuffer.length > 50) {
                    speakText(sentenceBuffer);
                    sentenceBuffer = ""; 
                }

                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1].text = accumulatedText;
                    return updated;
                });
            }
        } catch (error) {
            console.error("❌ Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const startInterview = (role) => {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); // Unlock
        setSelectedRole(role);
        setView('interview');
        const m = `Hello. I am your Mentor for ${role}. Question 1: Tell me about your experience.`;
        setMessages([{ role: 'ai', text: m }]);
        setTimeout(() => speakText(m), 500);
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh' }}>
            {view === 'landing' ? (
                <div style={{ textAlign: 'center', marginTop: '50px' }}>
                    <h1>Strict Mentor</h1>
                    <button onClick={() => startInterview('React.js')} style={{ padding: '20px', cursor: 'pointer' }}>Start React Interview</button>
                </div>
            ) : (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ height: '400px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '10px' }}>
                        {messages.map((m, i) => <div key={i} style={{ marginBottom: '10px' }}>{m.text}</div>)}
                        <div ref={messagesEndRef} />
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex' }}>
                        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, padding: '10px' }} />
                        <button onClick={handleSend} style={{ padding: '10px' }}>SEND</button>
                    </div>
                </div>
            )}
        </div>
    );
}