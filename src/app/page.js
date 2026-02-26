"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

// 🚨 NUCLEAR FIX 1: Stop Chrome from silently deleting the audio from memory
if (typeof window !== 'undefined') {
    window.speechUtterances = []; 
}

export default function InterviewApp() {
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [history, setHistory] = useState([]);
    const [isMounted, setIsMounted] = useState(false);
    const messagesEndRef = useRef(null);

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel(); 
        
        if (!text || text.length < 2) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        
        // Priority to English voices
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        
        // 🚨 NUCLEAR FIX 2: Push to global array to prevent Garbage Collection bug
        window.speechUtterances.push(utterance);
        
        window.speechSynthesis.speak(utterance);
        console.log("🔊 AI is saying:", text);
    };

    const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
        api: '/api/chat',
        body: {
            role: selectedRole,
            level: level,
        },
        onError: (err) => {
            // 🚨 THIS WILL CATCH SILENT API CRASHES
            console.error("❌ USECHAT API CRASH:", err.message);
        },
        onFinish: (message) => {
            console.log("✅ STREAM FINISHED. AI SAID:", message.content);
            const cleanText = message.content.replace(/[*#`]/g, '').trim();
            speakText(cleanText);

            if (message.content.includes("Score:")) {
                const scoreMatch = message.content.match(/Score:\s*(\d+\/\d+)/i);
                const newRecord = {
                    id: Date.now(),
                    role: selectedRole,
                    level: level,
                    score: scoreMatch ? scoreMatch[1] : "Completed",
                    date: new Date().toLocaleDateString(),
                    feedback: message.content
                };
                setHistory(prev => [newRecord, ...prev]);
                
                const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
                localStorage.setItem('interview_history', JSON.stringify([newRecord, ...saved]));
            }
        }
    });

    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
        if (typeof window !== 'undefined') window.speechSynthesis.getVoices();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, view]);

    const startInterview = (role) => {
        // Prime audio engine
        if (typeof window !== 'undefined') {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
        }
        
        setSelectedRole(role);
        setView('interview');
        setMessages([]);
        
        const firstMsgContent = `Hello. I am your ${level} level Mentor for ${role}. Question 1: Can you introduce yourself and tell me about your experience?`;
        
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: firstMsgContent }]);
        setTimeout(() => speakText(firstMsgContent), 500);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        
        console.log("🚀 1. BUTTON CLICKED! Input:", input);

        if (typeof window !== 'undefined') {
            window.speechSynthesis.cancel();
            console.log("🔊 2. Audio queue cleared.");
        }

        if (!input.trim()) {
            console.warn("⚠️ 3. Input is empty. Aborting.");
            return;
        }
        
        if (isLoading) {
            console.warn("⚠️ 3. AI is already loading. Aborting.");
            return;
        }

        console.log("📡 4. Handing off to Vercel useChat...");
        handleSubmit(e);
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' && (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8', margin: '0' }}>Strict Mentor v2</h1>
                        <p style={{ color: '#94a3b8', marginBottom: '40px' }}>AI-powered technical interviews.</p>
                        <div style={{ marginBottom: '30px' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}>{l}</button>
                             ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>{selectedRole} ({level})</h2>
                            <button onClick={() => setView('landing')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>Quit</button>
                        </div>
                        
                        <div style={{ height: '480px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#0ea5e9' : '#334155', padding: '15px', borderRadius: '15px', maxWidth: '85%' }}>
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            ))}
                            {isLoading && <div style={{ color: '#38bdf8' }}>Mentor is thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '12px', marginTop: '20px', background: '#1e293b', padding: '12px', borderRadius: '50px' }}>
                            <input value={input} onChange={handleInputChange} disabled={isLoading} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '10px', outline: 'none' }} placeholder="Type your answer..." />
                            <button type="submit" disabled={isLoading} style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '25px', padding: '12px 30px', cursor: isLoading ? 'not-allowed' : 'pointer' }}>SEND</button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}