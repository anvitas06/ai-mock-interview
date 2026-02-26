"use client";
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function InterviewApp() {
    const [isMounted, setIsMounted] = useState(false);
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [isListening, setIsListening] = useState(false);
    const [textInput, setTextInput] = useState(""); 
    
    // 🚨 OUR OWN RAW STATE (Bypassing Vercel's hook)
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => { setIsMounted(true); }, []);

    const stopVoice = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };

    const speakText = (text) => {
        if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
        stopVoice();
        const cleanText = text.toString().replace(/[*#`]/g, '').trim();
        if (!cleanText) return;
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(v => v.lang.includes('en-US')) || voices[0];
        window.speechSynthesis.speak(utterance);
    };

    const startListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Your browser does not support speech recognition.");
            return;
        }

        stopVoice(); 
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setTextInput(prev => prev ? prev + " " + transcript : transcript);
        };

        recognition.start();
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const startInterview = (role) => {
        stopVoice();
        setSelectedRole(role);
        setView('interview');
        setTextInput(""); 
        
        const firstMsg = `Hello. I am your ${level} Mentor for ${role}. Question 1: Tell me about your experience?`;
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: firstMsg }]);
        setTimeout(() => speakText(firstMsg), 500);
    };

    // 🚨 RAW JAVASCRIPT FETCH (Unbreakable by package updates)
    // 🚨 RAW JAVASCRIPT FETCH 
    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        stopVoice();
        if (isListening) recognitionRef.current?.stop();
        if (!textInput.trim() || isLoading) return;
        
        const userText = textInput;
        setTextInput(""); 
        setIsLoading(true);

        const updatedMessages = [...messages, { id: Date.now().toString(), role: 'user', content: userText }];
        setMessages(updatedMessages);

        // 🚨 We must declare 'response' up here so Claude's catch block can see it!
        let response; 

        try {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 🚨 NEW CLEAN BODY: Strips out the 'id' so Groq doesn't crash
                body: JSON.stringify({ 
                    messages: updatedMessages.map(({ role, content }) => ({ role, content })), 
                    role: selectedRole, 
                    level: level 
                }),
            });

            if (!response.ok) {
                // This triggers the catch block below if the server crashes
                throw new Error(`Server failed with status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = "";
            const assistantMessageId = (Date.now() + 1).toString();

            setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                aiResponseText += decoder.decode(value, { stream: true });
                
                setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId ? { ...msg, content: aiResponseText } : msg
                ));
            }

            speakText(aiResponseText);

        // 🚨 CLAUDE'S GUARDRAIL ADDED HERE
        } catch (error) {
            let msg = error.message;    
            try { 
                const d = await response?.json(); 
                msg = d?.error || msg; 
            } catch {}    
            alert("NETWORK ERROR: " + msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {view === 'landing' ? (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8' }}>Strict Mentor 5.1</h1>
                        <p style={{ color: '#94a3b8' }}>Fixed Vanilla React Override</p>
                        
                        <div style={{ margin: '40px 0' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer', fontWeight: 'bold' }}>{l}</button>
                             ))}
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', borderRadius: '15px', border: '1px solid #334155', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>{role}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{selectedRole}</h2>
                                <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>{level} Level</span>
                            </div>
                            <button onClick={() => { stopVoice(); setView('landing'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>End Interview</button>
                        </div>
                        
                        <div style={{ background: '#1e293b', borderRadius: '20px', padding: '30px', textAlign: 'center', marginBottom: '20px', border: '1px solid #334155' }}>
                            <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <button 
                                    type="button"
                                    onClick={startListening}
                                    style={{ width: '80px', height: '80px', borderRadius: '50%', background: isListening ? '#ef4444' : '#38bdf8', border: 'none', cursor: 'pointer', fontSize: '30px', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {isListening ? '🛑' : '🎤'}
                                </button>
                            </div>
                            <div style={{ color: '#94a3b8', fontStyle: 'italic', minHeight: '24px' }}>
                                {isListening ? "Listening..." : "Tap mic to speak, or type below"}
                            </div>
                        </div>

                        <form onSubmit={handleFinalSubmit} style={{ display: 'flex', gap: '10px', background: '#1e293b', padding: '10px', borderRadius: '50px', marginBottom: '20px' }}>
                            <input 
                                value={textInput} 
                                onChange={(e) => setTextInput(e.target.value)} 
                                disabled={isLoading} 
                                placeholder="Type your answer here..." 
                                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', paddingLeft: '15px', outline: 'none', fontSize: '16px' }} 
                            />
                            <button type="submit" disabled={isLoading || !textInput.trim()} style={{ background: (isLoading || !textInput.trim()) ? '#475569' : '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '25px', padding: '12px 30px', fontWeight: 'bold', cursor: (isLoading || !textInput.trim()) ? 'not-allowed' : 'pointer' }}>
                                SEND
                            </button>
                        </form>

                        <div style={{ flex: 1, overflowY: 'auto', background: '#020617', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #1e293b' }}>
                            {messages?.map((m) => {
                                const isReport = m.content?.includes("Score:");
                                return (
                                    <div key={m.id} style={{ 
                                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', 
                                        background: isReport ? 'linear-gradient(135deg, #1e293b, #0f172a)' : (m.role === 'user' ? '#38bdf8' : '#1e293b'), 
                                        color: m.role === 'user' ? '#0f172a' : '#fff', 
                                        padding: '15px 20px', 
                                        borderRadius: '15px', 
                                        maxWidth: '90%',
                                        border: isReport ? '2px solid #38bdf8' : 'none',
                                        fontFamily: isReport ? 'monospace' : 'inherit',
                                        boxShadow: isReport ? '0 0 15px rgba(56, 189, 248, 0.1)' : 'none'
                                    }}>
                                        {isReport && <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.2rem', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>📊 INTERVIEW REPORT</div>}
                                        <ReactMarkdown>{m.content || ""}</ReactMarkdown>
                                    </div>
                                );
                            })}
                            {isLoading && <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>Evaluating...</div>}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}