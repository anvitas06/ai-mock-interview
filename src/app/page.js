"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

// Global memory for audio to prevent Chrome's garbage collection bug
if (typeof window !== 'undefined') {
    window.speechUtterances = []; 
}

export default function InterviewApp() {
    // 1. All State Definitions first
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [history, setHistory] = useState([]);
    const [isMounted, setIsMounted] = useState(false);
    const [cooldown, setCooldown] = useState(0); 
    const messagesEndRef = useRef(null);

    // 2. All Utility Functions
    const stopVoice = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            window.speechUtterances = [];
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        stopVoice();
        const cleanText = text.replace(/[*#`]/g, '').trim();
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        window.speechUtterances.push(utterance);
        window.speechSynthesis.speak(utterance);
    };

    // 3. AI SDK Hook
    const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
        api: '/api/chat',
        body: { role: selectedRole, level: level },
        onFinish: (message) => {
            speakText(message.content);
        }
    });

    // 4. All Effects
    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
    }, []);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 5. User Interaction Handlers
    const startInterview = (role) => {
        stopVoice();
        setSelectedRole(role);
        setView('interview');
        setMessages([]);
        setCooldown(0);
        const firstMsg = `Hello. I am your ${level} level Mentor for ${role}. Question 1: Tell me about your experience?`;
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: firstMsg }]);
        setTimeout(() => speakText(firstMsg), 500);
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' && (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8' }}>Strict Mentor v6</h1>
                        <p style={{ color: '#94a3b8' }}>Select a role to start.</p>
                        <div style={{ margin: '30px 0' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}>{l}</button>
                             ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', borderRadius: '15px', border: '1px solid #334155', cursor: 'pointer', fontWeight: 'bold' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h2>{selectedRole} <span style={{fontSize: '0.8rem', color: '#38bdf8'}}>{level}</span></h2>
                            <button onClick={() => { stopVoice(); setView('landing'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>End Interview</button>
                        </div>
                        
                        <div style={{ height: '450px', overflowY: 'auto', background: '#020617', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #1e293b' }}>
                            {messages.map((m) => {
                                const isReport = m.content.includes("Score:");
                                return (
                                    <div 
                                        key={m.id} 
                                        style={{ 
                                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', 
                                            background: isReport ? 'linear-gradient(135deg, #1e293b, #0f172a)' : (m.role === 'user' ? '#38bdf8' : '#1e293b'),
                                            color: m.role === 'user' ? '#0f172a' : '#fff',
                                            padding: '12px 18px', 
                                            borderRadius: '15px', 
                                            maxWidth: '85%',
                                            border: isReport ? '2px solid #38bdf8' : 'none',
                                            fontFamily: isReport ? 'monospace' : 'inherit'
                                        }}
                                    >
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                );
                            })}
                            {isLoading && <div style={{ color: '#38bdf8' }}>AI is thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                stopVoice();
                                if (cooldown > 0 || !input.trim() || isLoading) return;
                                handleSubmit(e);
                                setCooldown(300); 
                            }} 
                            style={{ display: 'flex', gap: '10px', marginTop: '20px', background: '#1e293b', padding: '10px', borderRadius: '50px' }}
                        >
                            <input 
                                id="user-input" name="user-input"
                                value={input} onChange={handleInputChange} 
                                disabled={isLoading || cooldown > 0} 
                                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', paddingLeft: '15px', outline: 'none' }} 
                                placeholder={cooldown > 0 ? `Wait ${formatTime(cooldown)}...` : "Type answer..."} 
                            />
                            <button 
                                type="submit" 
                                disabled={isLoading || cooldown > 0 || !input.trim()} 
                                style={{ background: (isLoading || cooldown > 0) ? '#475569' : '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '25px', padding: '12px 25px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {cooldown > 0 ? formatTime(cooldown) : "SEND"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}