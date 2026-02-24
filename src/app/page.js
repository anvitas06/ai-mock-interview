"use client";
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function InterviewApp() {
    // 1. STATE
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
    const recognitionRef = useRef(null); // 👉 ADDED: Pointer for the microphone

    const getScoreColor = (scoreStr) => {
        if (!scoreStr) return '#94a3b8';
        const match = scoreStr.match(/\d+/);
        const score = match ? parseInt(match[0]) : NaN;
        
        if (isNaN(score)) return '#94a3b8'; 
        if (score >= 8) return '#10b981';   
        if (score >= 5) return '#fbbf24';   
        return '#ef4444';                   
    };

    // 2. INITIAL LOAD
    useEffect(() => {
        setIsMounted(true);
        const saved = JSON.parse(localStorage.getItem('interview_history') || '[]');
        setHistory(saved);
    }, []);

    // 3. AUTO-SCROLL
    useEffect(() => {
        if (view === 'interview') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, view]);

    // 4. LOGIC: START INTERVIEW
    const startInterview = (role) => {
        const unlock = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlock);
        console.log("🔊 Audio Engine Unlocked");
    
        setSelectedRole(role);
        setView('interview');
        setMessages([{ role: 'ai', text: `Hello. I am your **${level}** level Mentor for **${role}**. Question 1: Can you introduce yourself and tell me about your experience with ${role}?` }]);
    };

    // 5. LOGIC: SAVE TO HISTORY
    const saveToHistory = (finalText, manualScore = null) => {
        const scoreMatch = finalText.match(/(\d+\/\d+)/) || finalText.match(/(\d+)\s*\/\s*10/);
        const detectedScore = scoreMatch ? `Score: ${scoreMatch[0]}` : (manualScore || "Completed");

        const newRecord = {
            id: Date.now(),
            role: selectedRole,
            level: level,
            score: detectedScore,
            date: new Date().toLocaleDateString(),
            transcript: messages, 
            feedback: finalText
        };

        const updated = [newRecord, ...history];
        setHistory(updated);
        localStorage.setItem('interview_history', JSON.stringify(updated));
    };

    // 6. LOGIC: VOICE INPUT (Start/Stop Toggle)
    const toggleListening = () => {
        // If we are already listening, stop it
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        // Instantly shut the AI up when you click the mic
        window.speechSynthesis.cancel();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice recognition is not supported in this browser. Please use Google Chrome!");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            // Append spoken text to whatever is already typed
            setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        };

        recognition.onerror = (event) => {
            console.error("Microphone error:", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert("Microphone access is blocked! Please click the lock icon in your URL bar to allow it.");
            }
        };
        
        recognition.onend = () => setIsListening(false);
        
        recognition.start();
    };

    // 👉 TEXT-TO-SPEECH HELPER
    // 👉 TEXT-TO-SPEECH HELPER
    const speakText = (text) => { // 👈 Change 'kText' back to 'const speakText'
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        
        if (window.speechSynthesis.speaking) {
            // Optional: window.speechSynthesis.cancel(); 
        }
    
        const cleanText = text.replace(/\*/g, '').trim();
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05; 
        utterance.pitch = 0.9; 

        if (!window.__activeUtterances) {
            window.__activeUtterances = [];
        } 
        
        window.__activeUtterances.push(utterance);

        utterance.onend = () => {
            window.__activeUtterances = window.__activeUtterances.filter(u => u !== utterance);
        };

        utterance.onerror = (event) => {
            window.__activeUtterances = window.__activeUtterances.filter(u => u !== utterance);
        };

        window.speechSynthesis.speak(utterance);
    };

    // 👉 INTERRUPT AI HELPER
    const interruptAI = () => {
        if (loading && abortControllerRef.current) {
            console.log('[Frontend] User interrupted! Aborting request...');
            abortControllerRef.current.abort();
            window.speechSynthesis.cancel(); 
        }
    };

    // 7. LOGIC: SEND MESSAGE
    const handleSend = async (overrideMessage = null) => {
        // 🛑 MUTE AI: Clears audio queue and kills network stream if AI is talking
        window.speechSynthesis.cancel(); 
        if (abortControllerRef.current) abortControllerRef.current.abort(); 

        if (loading || isSendCoolingDown || !((overrideMessage ?? input) || '').toString().trim()) return;

        setIsSendCoolingDown(true);
        setTimeout(() => setIsSendCoolingDown(false), 3000);

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
    
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(errorBody || `Server Error: ${response.status}`);
            }
    
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
                
                    // Look for punctuation to speak a full sentence
                    const sentenceMatch = sentenceBuffer.match(/([^.?!]+[.?!]+)/);
                    if (sentenceMatch) {
                        const completeSentence = sentenceMatch[1];
                        console.log("🔊 AI is saying:", completeSentence); // Check your F12 console for this!
                        speakText(completeSentence);
                        sentenceBuffer = sentenceBuffer.substring(sentenceMatch[0].length);
                    }
            
                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        updatedMessages[updatedMessages.length - 1].text = accumulatedText;
                        return updatedMessages;
                    });
                }
            }
    
            if (sentenceBuffer.trim()) {
                speakText(sentenceBuffer);
            }
    
           // 🌟 UPDATED LOGIC FOR THE FINAL REPORT
// We wait until the AI has asked 4 questions.
if (accumulatedText.includes("/10") || accumulatedText.toLowerCase().includes("score:")) {
    saveToHistory(accumulatedText);
    console.log("✅ Report Saved to History");
}
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[Frontend] Aborted.');
            } else {
                setMessages(prev => [...prev, { role: 'ai', text: `Error: ${error.message}` }]);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div suppressHydrationWarning style={{ padding: '20px', background: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                
                {/* --- LANDING VIEW --- */}
                {view === 'landing' && (
                    <div style={{ textAlign: 'center', marginTop: '80px' }}>
                        <h1 style={{ fontSize: '3.5rem', color: '#38bdf8', margin: '0' }}>Strict Mentor</h1>
                        <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '40px' }}>AI-powered technical interviews with zero mercy.</p>
                        
                        <div style={{ marginBottom: '30px' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ margin: '0 5px', padding: '12px 25px', borderRadius: '25px', border: '1px solid #38bdf8', background: level === l ? '#38bdf8' : 'transparent', color: level === l ? '#0f172a' : '#38bdf8', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>{l}</button>
                             ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
    <button 
        key={role} 
        onClick={() => {
            // 🎙️ THE VOICE FIX: This "wakes up" the speakers for the deployed site
            if (typeof window !== 'undefined') {
                const wakeUp = new SpeechSynthesisUtterance("");
                window.speechSynthesis.speak(wakeUp);
            }
            startInterview(role);
        }} 
        style={{ padding: '25px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '15px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
    >
        {role}
    </button>
))}
                        </div>

                        <button onClick={() => setView('history')} style={{ marginTop: '40px', background: 'none', border: 'none', color: '#94a3b8', textDecoration: 'underline', cursor: 'pointer' }}>View Session History ({history.length})</button>
                    </div>
                )}

                {/* --- INTERVIEW VIEW --- */}
                {view === 'interview' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{selectedRole} Interview</h2>
                                <span style={{ color: '#38bdf8' }}>{level} Level</span>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                
                                <button onClick={() => { saveToHistory("User exited early", "N/A"); setView('landing'); }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Quit</button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', background: '#1e293b', height: '8px', borderRadius: '4px', marginBottom: '20px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min((messages.filter(m => m.role === 'ai').length / 5) * 100, 100)}%`, background: '#38bdf8', height: '100%', transition: 'width 0.8s ease' }} />
                        </div>

                        {/* Chat Box */}
                        <div style={{ height: '480px', overflowY: 'auto', background: '#1e293b', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid #334155' }}>
                        {messages.map((m, i) => {
                            // 🌟 THE VISUAL UPGRADE: Detect if this message is the final report
                            const isReport = m.role === 'ai' && (m.text.includes('/10') || m.text.includes('Score:'));
                            
                            return (
                                <div key={i} style={{ 
                                    alignSelf: isReport ? 'center' : (m.role === 'ai' ? 'flex-start' : 'flex-end'), 
                                    background: isReport ? 'linear-gradient(145deg, #0f172a, #1e293b)' : (m.role === 'ai' ? '#334155' : '#0ea5e9'), 
                                    border: isReport ? '2px solid #38bdf8' : 'none',
                                    padding: isReport ? '30px' : '15px', 
                                    borderRadius: isReport ? '20px' : '15px', 
                                    width: isReport ? '100%' : 'fit-content',
                                    maxWidth: isReport ? '100%' : '85%', 
                                    boxShadow: isReport ? '0 10px 25px -5px rgba(56, 189, 248, 0.15)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    fontSize: isReport ? '1.1rem' : '1rem',
                                    lineHeight: '1.6',
                                    color: isReport ? '#f8fafc' : '#fff'
                                }}>
                                    <ReactMarkdown>{m.text}</ReactMarkdown>
                                </div>
                            );
                        })}
                            {loading && <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>Mentor is thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', background: '#1e293b', padding: '12px', borderRadius: '50px', border: '1px solid #334155', alignItems: 'center' }}>
                            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '10px 15px', outline: 'none', fontSize: '1rem' }} placeholder="Type your answer or use the mic..." />
                            
                            {/* 👉 UPDATED: Now uses toggleListening */}
                            <button onClick={toggleListening} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', filter: isListening ? 'drop-shadow(0 0 8px #ef4444)' : 'none' }}>
                                {isListening ? '🛑' : '🎙️'}
                            </button>

                            <button
                                onClick={() => handleSend()}
                                disabled={loading || isSendCoolingDown}
                                style={{
                                    background: '#0ea5e9',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '25px',
                                    padding: '12px 30px',
                                    cursor: (loading || isSendCoolingDown) ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold',
                                    transition: '0.2s',
                                    opacity: (loading || isSendCoolingDown) ? 0.6 : 1,
                                }}
                            >
                                SEND
                            </button>
                        </div>
                    </>
                )}

                {/* --- HISTORY VIEW --- */}
                {view === 'history' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ fontSize: '2rem' }}>Interview History</h2>
                            <button onClick={() => setView('landing')} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>Back Home</button>
                        </div>
                        {history.length === 0 ? <p style={{ color: '#94a3b8' }}>No interviews recorded yet.</p> : (
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {history.map(item => (
                                    <div key={item.id} style={{ background: '#1e293b', padding: '20px', borderRadius: '15px', border: '1px solid #334155' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, color: '#38bdf8' }}>{item.role} ({item.level})</h3>
                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{item.date}</span>
                                        </div>
                                        <div style={{ 
                                            marginTop: '10px', 
                                            color: getScoreColor(item.score),
                                            fontWeight: 'bold', 
                                            fontSize: '1.2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <span style={{ 
                                                height: '10px', 
                                                width: '10px', 
                                                borderRadius: '50%', 
                                                background: getScoreColor(item.score) 
                                            }}></span>
                                            {item.score}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}