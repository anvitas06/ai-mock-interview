"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

export default function InterviewApp() {
    const [isMounted, setIsMounted] = useState(false);
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [cooldown, setCooldown] = useState(0); 
    const messagesEndRef = useRef(null);

    // 1. Safety-first Mounting
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const stopVoice = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };

    const speakText = (text) => {
        // 🚨 SAFETY FIX: Check if text actually exists before using .trim()
        if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
        
        stopVoice();
        const cleanText = text.toString().replace(/[*#`]/g, '').trim();
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        window.speechSynthesis.speak(utterance);
    };

    const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
        api: '/api/chat',
        body: { role: selectedRole, level: level },
        onFinish: (message) => {
            if (message?.content) speakText(message.content);
        }
    });

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

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
        
        // Manual message object
        const initialMessage = { 
            id: Date.now().toString(), 
            role: 'assistant', 
            content: firstMsg 
        };
        
        setMessages([initialMessage]);
        setTimeout(() => speakText(firstMsg), 500);
    };

    // 2. CRITICAL: Stop the crash by returning null if not ready
    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' ? (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3rem', color: '#38bdf8' }}>Strict Mentor v8</h1>
                        <p>Prepare for your {level} interview</p>
                        <div style={{ margin: '30px 0' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '10px 20px', borderRadius: '20px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer' }}>{l}</button>
                             ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '20px', background: '#1e293b', color: '#fff', borderRadius: '10px', border: '1px solid #334155', cursor: 'pointer' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3>{selectedRole} Interview</h3>
                            <button onClick={() => { stopVoice(); setView('landing'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer' }}>Quit</button>
                        </div>
                        
                        <div style={{ height: '400px', overflowY: 'auto', background: '#020617', padding: '15px', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #1e293b' }}>
                            {messages?.map((m) => (
                                <div key={m.id} style={{ 
                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', 
                                    background: m.content?.includes("Score:") ? 'linear-gradient(to right, #1e293b, #0f172a)' : (m.role === 'user' ? '#38bdf8' : '#1e293b'), 
                                    color: m.role === 'user' ? '#000' : '#fff', 
                                    padding: '10px 15px', 
                                    borderRadius: '10px', 
                                    maxWidth: '80%',
                                    border: m.content?.includes("Score:") ? '1px solid #38bdf8' : 'none'
                                }}>
                                    <ReactMarkdown>{m.content || ""}</ReactMarkdown>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            stopVoice();
                            // 🚨 SAFETY FIX: Only run if input is not undefined
                            if (cooldown > 0 || !input?.trim() || isLoading) return;
                            handleSubmit(e);
                            setCooldown(300);
                        }} style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <input 
                                value={input || ""} 
                                onChange={handleInputChange} 
                                placeholder={cooldown > 0 ? "Timer active..." : "Type answer..."} 
                                style={{ flex: 1, background: '#1e293b', border: 'none', color: '#fff', padding: '15px', borderRadius: '10px' }} 
                            />
                            <button type="submit" disabled={isLoading || cooldown > 0 || !input?.trim()} style={{ background: '#38bdf8', color: '#000', border: 'none', padding: '0 25px', borderRadius: '10px', fontWeight: 'bold' }}>
                                {cooldown > 0 ? Math.ceil(cooldown/60) + 'm' : 'SEND'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}