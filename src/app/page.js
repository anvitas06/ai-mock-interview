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
    const getScoreColor = (scoreStr) => {
        if (!scoreStr) return '#94a3b8';
        // Extract just the first number found in the string
        const match = scoreStr.match(/\d+/);
        const score = match ? parseInt(match[0]) : NaN;
        
        if (isNaN(score)) return '#94a3b8'; 
        if (score >= 8) return '#10b981';   
        if (score >= 5) return '#fbbf24';   
        return '#ef4444';                   
    };
    
    // 👉 NEW: The "pointer" that lets us kill the network request if the user interrupts
    const abortControllerRef = useRef(null); 

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

    // 6. LOGIC: VOICE INPUT (Manual click for now)
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Browser not supported. Use Chrome!");
        const recognition = new SpeechRecognition();
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => setInput(event.results[0][0].transcript);
        recognition.start();
    };

    // 👉 NEW: TEXT-TO-SPEECH HELPER
    // This function actually makes the browser speak out loud.
    const speakText = (text) => {
        console.log("👉 Mentor is trying to say:", text);

        // If the browser doesn't support speech synthesis, bail out early.
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

        // Clean markdown a bit before speaking.
        const cleanText = text.replace(/\*/g, '').trim();
        if (!cleanText) return;

        // Create a new utterance for this chunk of text.
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05; // Slightly faster to sound strict
        utterance.pitch = 0.9; // Slightly lower pitch

        // 🔒 GC-SAFETY HACK:
        // Keep a global array of "active" utterances on window so that
        // the JS engine cannot garbage-collect them while they are still playing.
        if (!window.__activeUtterances) {
            // We attach this only once for the lifetime of the page.
            window.__activeUtterances = [];
        }
        window.__activeUtterances.push(utterance);

        // Log what the browser audio engine is doing.
        utterance.onend = () => {
            console.log('[TTS] onend fired for utterance:', cleanText);
            // Remove the finished utterance from the global array.
            window.__activeUtterances = window.__activeUtterances.filter(u => u !== utterance);
        };

        utterance.onerror = (event) => {
            console.log('[TTS] onerror fired for utterance:', cleanText, 'error:', event?.error || event);
            // On error, also remove it from the global array.
            window.__activeUtterances = window.__activeUtterances.filter(u => u !== utterance);
        };

        // Actually enqueue the utterance with the browser's speech engine.
        window.speechSynthesis.speak(utterance);
    };

    // 👉 NEW: INTERRUPT AI HELPER
    // We will call this later when the microphone detects the user speaking
    const interruptAI = () => {
        if (loading && abortControllerRef.current) {
            console.log('[Frontend] User interrupted! Aborting request...');
            abortControllerRef.current.abort();
            window.speechSynthesis.cancel(); // Stop the audio playing
        }
    };

    // 7. LOGIC: SEND MESSAGE
    // 7. LOGIC: SEND MESSAGE
    const handleSend = async (overrideMessage = null) => {
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
                    
                    // 🌟 THE X-RAY LOGGER: This will print every single word to your console
                    console.log("🟢 SERVER SENT:", chunkValue);
            
                    const cleanChunk = chunkValue; 
            
                    accumulatedText += cleanChunk;
                    sentenceBuffer += cleanChunk; 
            
                    const sentenceMatch = sentenceBuffer.match(/([^.?!]+[.?!]+)/);
                    if (sentenceMatch) {
                        const completeSentence = sentenceMatch[1];
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
    
            // Logic for the 4-question report
            if (accumulatedText.toLowerCase().includes("score") || aiMessageCount >= 3) {
                saveToHistory(accumulatedText);
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
                                <button key={role} onClick={() => startInterview(role)} style={{ padding: '25px', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '15px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>{role}</button>
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
                        {messages.map((m, i) => (
    <div key={i} style={{ 
        alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end', 
        
        /* --- ADD THIS LINE BELOW --- */
        borderLeft: m.text.includes('/10') ? `4px solid ${getScoreColor(m.text)}` : 'none',
        
        background: m.role === 'ai' ? '#334155' : '#0ea5e9', 
        padding: '15px', 
        borderRadius: '15px', 
        maxWidth: '85%', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' 
    }}>
        <ReactMarkdown>{m.text}</ReactMarkdown>
    </div>
))}
                            {loading && <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>Mentor is thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', background: '#1e293b', padding: '12px', borderRadius: '50px', border: '1px solid #334155', alignItems: 'center' }}>
                            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '10px 15px', outline: 'none', fontSize: '1rem' }} placeholder="Type your answer or use the mic..." />
                            
                            <button onClick={startListening} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', filter: isListening ? 'drop-shadow(0 0 8px #ef4444)' : 'none' }}>
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
    color: getScoreColor(item.score), // 👈 Dynamic color!
    fontWeight: 'bold', 
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
}}>
    {/* Adding a small dot indicator for extra professional look */}
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