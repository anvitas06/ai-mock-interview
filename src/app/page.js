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
    const [isListening, setIsListening] = useState(false);
    const [history, setHistory] = useState([]);
    const [isMounted, setIsMounted] = useState(false);
    
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null); 
    const recognitionRef = useRef(null);

    // Load history and pre-unlock voices
    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
        if (typeof window !== 'undefined') {
            window.speechSynthesis.getVoices();
        }
    }, []);

    useEffect(() => {
        if (view === 'interview') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, view]);

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        
        // Clean text of markdown stars and extra JSON noise
        const cleanText = text.replace(/[*#`]/g, '').replace(/\{"text":/g, '').trim();
        if (!cleanText || cleanText.length < 2) return;

        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0; 
        const voices = window.speechSynthesis.getVoices();
        // Priority to English voices
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        
        window.speechSynthesis.speak(utterance);
        console.log("🔊 Actually speaking now:", cleanText);
    };

    const startInterview = (role) => {
        // Essential for Chrome: Unlock audio on button click
        const unlock = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlock);
        console.log("🔊 Audio Engine Unlocked via Gesture");

        setSelectedRole(role);
        setView('interview');
        const firstMsg = `Hello. I am your **${level}** level Mentor for **${role}**. Question 1: Can you introduce yourself and tell me about your experience?`;
        setMessages([{ role: 'ai', text: firstMsg }]);
        // Speak the first message manually since it's hardcoded
        setTimeout(() => speakText(firstMsg), 500);
    };

    const handleSend = async (overrideMessage = null) => {
        window.speechSynthesis.cancel(); 
        if (abortControllerRef.current) abortControllerRef.current.abort(); 
        
        const userText = (overrideMessage ?? input).toString().trim();
        if (loading || isSendCoolingDown || !userText) return;

        setIsSendCoolingDown(true);
        setTimeout(() => setIsSendCoolingDown(false), 2000);
        setLoading(true);
        abortControllerRef.current = new AbortController(); 

        const aiMessageCount = messages.filter(m => m.role === 'ai').length;
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setInput("");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', text: userText }],
                    role: selectedRole,
                    level: level,
                    questionCount: aiMessageCount,
                }),
            });
        
            console.log("📡 Response Status:", response.status);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let accumulatedText = "";
            let sentenceBuffer = ""; 

            setMessages(prev => [...prev, { role: 'ai', text: "" }]);

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    let chunkValue = decoder.decode(value, { stream: true });
                    
                    // JSON Bypass: If the chunk contains JSON noise, clean it
                    if (chunkValue.includes('"text":')) {
                        try {
                            const cleaned = chunkValue.match(/"text":"(.*)"/);
                            if (cleaned) chunkValue = cleaned[1];
                        } catch(e) {}
                    }

                    accumulatedText += chunkValue;
                    sentenceBuffer += chunkValue;

                    // Trigger speech if we hit punctuation OR the buffer is getting too long (Force-Speak)
                    if (/[.?!]/.test(sentenceBuffer) || sentenceBuffer.length > 60) {
                        console.log("🔊 AI is saying:", sentenceBuffer); 
                        speakText(sentenceBuffer);
                        sentenceBuffer = ""; 
                    }

                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        updatedMessages[updatedMessages.length - 1].text = accumulatedText;
                        return updatedMessages;
                    });
                }
            }

            // Final check for report saving
            if (accumulatedText.includes("Score:")) {
                const newRecord = { 
                    id: Date.now(), 
                    role: selectedRole, 
                    level, 
                    score: accumulatedText.match(/Score: \d+\/\d+/)?.[0] || "Completed", 
                    date: new Date().toLocaleDateString(), 
                    feedback: accumulatedText 
                };
                const updated = [newRecord, ...history];
                setHistory(updated);
                localStorage.setItem('interview_history', JSON.stringify(updated));
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error("Fetch error:", error);
                setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I hit a snag. Please check your connection." }]);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' && (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8', fontWeight: '800' }}>Strict Mentor</h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '40px' }}>No mercy technical interview prep.</p>
                        
                        <div style={{ marginBottom: '30px' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}>{l}</button>
                             ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '15px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{selectedRole}</h2>
                                <span style={{ color: '#38bdf8' }}>{level} Level</span>
                            </div>
                            <button onClick={() => setView('landing')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>End Interview</button>
                        </div>

                        <div style={{ height: '500px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #334155' }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', background: m.role === 'ai' ? '#334155' : '#0ea5e9', padding: '15px', borderRadius: '15px', maxWidth: '85%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                    <ReactMarkdown>{m.text}</ReactMarkdown>
                                </div>
                            ))}
                            {loading && <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>Mentor is typing...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', background: '#1e293b', padding: '12px', borderRadius: '50px', border: '1px solid #334155' }}>
                            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '10px 15px', outline: 'none', fontSize: '1rem' }} placeholder="Type your answer..." />
                            <button onClick={() => handleSend()} disabled={loading} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '25px', padding: '12px 30px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>SEND</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}