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

    const getScoreColor = (scoreStr) => {
        if (!scoreStr) return '#94a3b8';
        const match = scoreStr.match(/\d+/);
        const score = match ? parseInt(match[0]) : NaN;
        if (score >= 8) return '#10b981';   
        if (score >= 5) return '#fbbf24';   
        return '#ef4444';                   
    };

    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
        // Pre-load voices
        window.speechSynthesis.getVoices();
    }, []);

    useEffect(() => {
        if (view === 'interview') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, view]);

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        const cleanText = text.replace(/\*/g, '').trim();
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0; 
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        window.speechSynthesis.speak(utterance);
        console.log("🔊 Actually speaking now:", cleanText);
    };

    const startInterview = (role) => {
        const unlock = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlock);
        setSelectedRole(role);
        setView('interview');
        setMessages([{ role: 'ai', text: `Hello. I am your **${level}** level Mentor for **${role}**. Question 1: Can you introduce yourself and tell me about your experience?` }]);
    };

    const handleSend = async (overrideMessage = null) => {
        window.speechSynthesis.cancel(); 
        if (abortControllerRef.current) abortControllerRef.current.abort(); 
        if (loading || isSendCoolingDown || !((overrideMessage ?? input) || '').toString().trim()) return;

        setIsSendCoolingDown(true);
        setTimeout(() => setIsSendCoolingDown(false), 2000);
        setLoading(true);
        abortControllerRef.current = new AbortController(); 

        const userMessage = (overrideMessage ?? input).toString().trim();
        const aiMessageCount = messages.filter(m => m.role === 'ai').length;
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setInput("");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', text: userMessage }],
                    role: selectedRole,
                    level: level,
                    questionCount: aiMessageCount,
                }),
            });
        
            console.log("📡 Status:", response.status);

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
                    const chunkValue = decoder.decode(value, { stream: true });
                    accumulatedText += chunkValue;
                    sentenceBuffer += chunkValue;

                    if (/[.?!]/.test(sentenceBuffer) || sentenceBuffer.length > 50) {
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
            if (sentenceBuffer.trim()) speakText(sentenceBuffer);
            if (accumulatedText.includes("Score:")) {
                const newRecord = { id: Date.now(), role: selectedRole, level, score: accumulatedText.match(/Score: \d+\/\d+/)?.[0] || "Completed", date: new Date().toLocaleDateString(), feedback: accumulatedText };
                const updated = [newRecord, ...history];
                setHistory(updated);
                localStorage.setItem('interview_history', JSON.stringify(updated));
            }
        } catch (error) {
            if (error.name !== 'AbortError') setMessages(prev => [...prev, { role: 'ai', text: `Error: ${error.message}` }]);
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
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8' }}>Strict Mentor</h1>
                        <div style={{ marginBottom: '30px' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer' }}>{l}</button>
                             ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '15px', cursor: 'pointer' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>{selectedRole} ({level})</h2>
                            <button onClick={() => setView('landing')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px' }}>Quit</button>
                        </div>
                        <div style={{ height: '480px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', background: m.role === 'ai' ? '#334155' : '#0ea5e9', padding: '15px', borderRadius: '15px', maxWidth: '85%' }}>
                                    <ReactMarkdown>{m.text}</ReactMarkdown>
                                </div>
                            ))}
                            {loading && <div style={{ color: '#38bdf8' }}>Mentor is thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', background: '#1e293b', padding: '12px', borderRadius: '50px' }}>
                            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none' }} placeholder="Type your answer..." />
                            <button onClick={() => handleSend()} disabled={loading} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '25px', padding: '12px 30px' }}>SEND</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}