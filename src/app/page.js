"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

if (typeof window !== 'undefined') {
    window.speechUtterances = []; 
}

export default function InterviewApp() {
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [history, setHistory] = useState([]);
    const [isMounted, setIsMounted] = useState(false);
    const [cooldown, setCooldown] = useState(0); 
    const messagesEndRef = useRef(null);

    // 🛑 STOP AGENT: Global cancel function
    const stopVoice = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            window.speechUtterances = []; // Clear memory
            console.log("🔇 Voice Interrupted");
        }
    };

    const speakText = (text) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        stopVoice(); // Clear previous before starting new
        
        const cleanText = text.replace(/[*#`]/g, '').trim();
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        
        window.speechUtterances.push(utterance);
        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
        api: '/api/chat',
        body: { role: selectedRole, level: level },
        onFinish: (message) => {
            speakText(message.content);
            if (message.content.includes("Score:")) {
                // Logic to save to local storage (omitted for brevity, keep your existing logic)
            }
        }
    });

    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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

    const onFormSubmit = (e) => {
        e.preventDefault();
        stopVoice(); // 🚨 INTERRUPT: Stop agent the moment user submits
        if (cooldown > 0 || !input.trim() || isLoading) return;
        setCooldown(300); 
        handleSubmit(e);
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' && (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8' }}>Strict Mentor v5</h1>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '40px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', borderRadius: '15px', border: '1px solid #334155', cursor: 'pointer', fontWeight: 'bold' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>{selectedRole} <span style={{fontSize: '0.8rem', color: '#38bdf8'}}>{level}</span></h2>
                            <button onClick={() => { stopVoice(); setView('landing'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>End & Restart</button>
                        </div>
                        
                        <div style={{ height: '500px', overflowY: 'auto', background: '#020617', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #1e293b' }}>
                            {messages.map((m) => {
                                const isReport = m.content.includes("Score:");
                                return (
                                    <div 
                                        key={m.id} 
                                        style={{ 
                                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', 
                                            // 🎨 DIFFERENT LOOK FOR REPORT
                                            background: isReport ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : (m.role === 'user' ? '#38bdf8' : '#1e293b'),
                                            color: m.role === 'user' ? '#0f172a' : '#fff',
                                            padding: '15px', 
                                            borderRadius: '15px', 
                                            maxWidth: '90%',
                                            border: isReport ? '2px solid #38bdf8' : 'none',
                                            fontFamily: isReport ? '"Courier New", Courier, monospace' : 'inherit',
                                            boxShadow: isReport ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none'
                                        }}
                                    >
                                        {isReport && <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.2rem' }}>📊 FINAL PERFORMANCE REPORT</div>}
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={onFormSubmit} style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <input 
                                value={input} onChange={handleInputChange} 
                                disabled={isLoading || cooldown > 0} 
                                style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '15px', borderRadius: '30px', outline: 'none' }} 
                                placeholder={cooldown > 0 ? `Wait ${Math.floor(cooldown/60)}m...` : "Type answer..."} 
                            />
                            <button 
                                type="submit" 
                                disabled={isLoading || cooldown > 0} 
                                style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '30px', padding: '0 30px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                SEND
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}