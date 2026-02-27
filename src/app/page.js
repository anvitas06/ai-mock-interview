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
    
    // Timer States
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [timerActive, setTimerActive] = useState(false);
    const timerRef = useRef(null);
    
    // Chat States
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [liveAnswer, setLiveAnswer] = useState(""); 

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => { setIsMounted(true); }, []);

    // Timer Logic
    useEffect(() => {
        if (timerActive && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && timerActive) {
            handleTimeUp();
        }
        return () => clearInterval(timerRef.current);
    }, [timerActive, timeLeft]);

    const handleTimeUp = () => {
        clearInterval(timerRef.current);
        setTimerActive(false);
        const timeoutEvent = { preventDefault: () => {} };
        setTextInput("TIME EXPIRED: Candidate did not answer in time.");
        handleFinalSubmit(timeoutEvent);
    };

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
    }, [messages, liveAnswer]);

    const startInterview = (role) => {
        stopVoice();
        setSelectedRole(role);
        setView('interview');
        setTextInput(""); 
        setMessages([]);
        
        const firstMsg = `Hello. I am your ${level} Mentor for ${role}. Question 1: Tell me about your experience?`;
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: firstMsg }]);
        
        // 🚨 Start Timer for first question
        setTimeLeft(300);
        setTimerActive(true);
        
        setTimeout(() => speakText(firstMsg), 500);
    };

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        stopVoice();
        
        // 🚨 Stop current timer
        clearInterval(timerRef.current);
        setTimerActive(false);

        if (isListening) recognitionRef.current?.stop();
        if (!textInput.trim() || isLoading) return;
        
        const userText = textInput;
        setTextInput(""); 
        setIsLoading(true);
        setLiveAnswer(""); 

        const updatedMessages = [...messages, { id: Date.now().toString(), role: 'user', content: userText }];
        setMessages(updatedMessages);

        let response; 
        try {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: updatedMessages.map(({ role, content }) => ({ role, content })), 
                    role: selectedRole, 
                    level: level 
                }),
            });

            if (!response.ok) throw new Error(`Server failed with status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                setLiveAnswer(accumulatedText);
            }

            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: accumulatedText }]);
            setLiveAnswer(""); 
            speakText(accumulatedText);

            // 🚨 Restart Timer for the next question (if not finished)
            if (!accumulatedText.includes("Score:")) {
                setTimeLeft(300);
                setTimerActive(true);
            }

        } catch (error) {
            alert("NETWORK ERROR: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div style={{ 
            padding: '40px 20px', 
            background: 'linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%)', 
            color: '#EAD6D0', 
            minHeight: '100vh', 
            fontFamily: "'Geist', sans-serif",
            position: 'relative'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                {view === 'landing' ? (
                    <div style={{ textAlign: 'center', marginTop: '60px' }}>
                        <h1 style={{ 
                            fontSize: '4.5rem', 
                            color: '#EAD6D0',
                            fontWeight: '900',
                            letterSpacing: '-0.04em',
                            marginBottom: '12px',
                            lineHeight: '1.1'
                        }}>STRICT MENTOR</h1>
                        <p style={{ 
                            color: '#b5a0a8', 
                            fontSize: '1.1rem', 
                            marginBottom: '60px',
                            letterSpacing: '0.05em',
                            fontWeight: '300'
                        }}>Professional AI Technical Assessment</p>
                        
                        <div style={{ margin: '60px 0', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                             {['Junior', 'Mid-Level', 'Senior'].map((l) => (
                                <button key={l} onClick={() => setLevel(l)} style={{ 
                                    padding: '14px 32px', 
                                    borderRadius: '30px', 
                                    border: '0.5px solid #EAD6D0', 
                                    background: level === l ? '#EAD6D0' : 'transparent', 
                                    color: level === l ? '#3D2C3F' : '#EAD6D0', 
                                    cursor: 'pointer', 
                                    fontWeight: '700',
                                    fontSize: '0.95rem',
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    backdropFilter: level !== l ? 'blur(10px)' : 'none',
                                    letterSpacing: '-0.02em'
                                }}>{l}</button>
                             ))}
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <button 
                                    key={role} 
                                    onClick={() => startInterview(role)} 
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = '0 20px 60px rgba(234, 214, 208, 0.12)';
                                        e.currentTarget.style.borderColor = 'rgba(234, 214, 208, 0.5)';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.backdropFilter = 'blur(15px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(234, 214, 208, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(234, 214, 208, 0.15)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.backdropFilter = 'blur(10px)';
                                    }}
                                    style={{ 
                                        padding: '40px 28px', 
                                        background: 'rgba(61, 44, 63, 0.25)',
                                        backdropFilter: 'blur(10px)',
                                        border: '0.5px solid rgba(234, 214, 208, 0.15)', 
                                        borderRadius: '24px', 
                                        color: '#EAD6D0', 
                                        fontWeight: '700', 
                                        fontSize: '1.3rem', 
                                        cursor: 'pointer', 
                                        transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        boxShadow: '0 8px 25px rgba(234, 214, 208, 0.05)',
                                        letterSpacing: '-0.03em'
                                    }}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '0.5px solid rgba(234, 214, 208, 0.1)' }}>
                            <div>
                                <h2 style={{ 
                                    margin: 0, 
                                    fontSize: '2.2rem', 
                                    fontWeight: '800',
                                    color: '#EAD6D0',
                                    letterSpacing: '-0.04em'
                                }}>{selectedRole}</h2>
                                <span style={{ color: '#b5a0a8', fontSize: '0.95rem', letterSpacing: '0.02em' }}>{level} Proficiency Level</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#b5a0a8', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>Time Remaining</span>
                                <div style={{ 
                                    fontSize: '2.8rem', 
                                    fontWeight: '900',
                                    color: timeLeft < 30 ? '#ef4444' : '#EAD6D0',
                                    letterSpacing: '-0.04em',
                                    fontVariantNumeric: 'tabular-nums'
                                }}>
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            background: 'rgba(30, 41, 59, 0.35)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '32px', 
                            padding: '40px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '28px', 
                            border: '0.5px solid rgba(234, 214, 208, 0.1)',
                            boxShadow: 'inset 0 2px 8px rgba(234, 214, 208, 0.03)'
                        }}>
                            {messages?.map((m) => {
                                const isReport = m.content?.includes("CANDIDATE ASSESSMENT REPORT");
                                return (
                                    <div key={m.id} style={{ 
                                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                        padding: '20px 28px',
                                        borderRadius: '24px',
                                        background: m.role === 'user' ? '#EAD6D0' : (isReport ? 'rgba(61, 44, 63, 0.6)' : 'rgba(234, 214, 208, 0.05)'),
                                        color: m.role === 'user' ? '#3D2C3F' : '#EAD6D0',
                                        border: m.role === 'assistant' && !isReport ? '0.5px solid rgba(234, 214, 208, 0.15)' : (isReport ? '0.5px solid rgba(234, 214, 208, 0.25)' : 'none'),
                                        boxShadow: isReport ? '0 15px 45px rgba(0,0,0,0.3)' : 'none',
                                        lineHeight: '1.7',
                                        backdropFilter: !isReport && m.role === 'assistant' ? 'blur(8px)' : 'none'
                                    }}>
                                        {isReport && <div style={{ color: '#EAD6D0', fontWeight: '900', marginBottom: '16px', borderBottom: '0.5px solid rgba(234, 214, 208, 0.2)', paddingBottom: '12px', letterSpacing: '-0.02em' }}>📊 ASSESSMENT REPORT</div>}
                                        <ReactMarkdown>{m.content || ""}</ReactMarkdown>
                                    </div>
                                );
                            })}

                            {liveAnswer && (
                                <div style={{ 
                                    alignSelf: 'flex-start', 
                                    background: 'rgba(234, 214, 208, 0.05)', 
                                    color: '#EAD6D0', 
                                    padding: '20px 28px', 
                                    borderRadius: '24px', 
                                    maxWidth: '85%',
                                    border: '0.5px solid rgba(234, 214, 208, 0.15)',
                                    backdropFilter: 'blur(8px)',
                                    lineHeight: '1.7'
                                }}>
                                    <ReactMarkdown>{liveAnswer}</ReactMarkdown>
                                </div>
                            )}

                            {isLoading && !liveAnswer && <div style={{ color: '#b5a0a8', fontStyle: 'italic', fontSize: '0.95rem', letterSpacing: '0.02em' }}>Analyzing response...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <button 
                                type="button"
                                onClick={startListening}
                                onMouseEnter={(e) => {
                                    if (!isListening) {
                                        e.currentTarget.style.boxShadow = '0 0 25px rgba(234, 214, 208, 0.2)';
                                        e.currentTarget.style.transform = 'scale(1.08)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                                style={{ 
                                    width: '62px', 
                                    height: '62px', 
                                    borderRadius: '50%', 
                                    background: isListening ? '#ef4444' : 'rgba(61, 44, 63, 0.4)',
                                    backdropFilter: isListening ? 'none' : 'blur(10px)',
                                    border: '0.5px solid rgba(234, 214, 208, 0.2)', 
                                    cursor: 'pointer', 
                                    fontSize: '22px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    flexShrink: 0
                                }}
                            >
                                {isListening ? '🛑' : '🎤'}
                            </button>

                            <form onSubmit={handleFinalSubmit} style={{ 
                                flex: 1, 
                                display: 'flex', 
                                gap: '12px', 
                                background: 'rgba(61, 44, 63, 0.2)',
                                backdropFilter: 'blur(12px)',
                                padding: '10px 18px', 
                                borderRadius: '22px', 
                                border: '0.5px solid rgba(234, 214, 208, 0.15)',
                                transition: 'all 0.3s ease'
                            }}>
                                <input 
                                    value={textInput} 
                                    onChange={(e) => setTextInput(e.target.value)} 
                                    disabled={isLoading} 
                                    placeholder="Type your technical response..." 
                                    style={{ 
                                        flex: 1, 
                                        background: 'transparent', 
                                        border: 'none', 
                                        color: '#EAD6D0', 
                                        paddingLeft: '8px', 
                                        outline: 'none', 
                                        fontSize: '0.95rem',
                                        letterSpacing: '-0.01em',
                                        placeholder: { color: '#b5a0a8' }
                                    }}
                                    style={{
                                        flex: 1, 
                                        background: 'transparent', 
                                        border: 'none', 
                                        color: '#EAD6D0', 
                                        paddingLeft: '8px', 
                                        outline: 'none', 
                                        fontSize: '0.95rem',
                                        letterSpacing: '-0.01em'
                                    }}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isLoading || !textInput.trim()}
                                    onMouseEnter={(e) => {
                                        if (!isLoading && textInput.trim()) {
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(234, 214, 208, 0.25)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                    style={{ 
                                        background: (isLoading || !textInput.trim()) ? 'rgba(234, 214, 208, 0.1)' : '#EAD6D0', 
                                        color: (isLoading || !textInput.trim()) ? '#b5a0a8' : '#3D2C3F', 
                                        border: 'none', 
                                        borderRadius: '14px', 
                                        padding: '12px 26px', 
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        cursor: (isLoading || !textInput.trim()) ? 'not-allowed' : 'pointer', 
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        letterSpacing: '-0.02em'
                                    }}>
                                    SEND
                                </button>
                            </form>
                            
                            <button 
                                onClick={() => { stopVoice(); setView('landing'); }} 
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#ef4444';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#ef4444';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                                style={{ 
                                    background: 'transparent', 
                                    color: '#ef4444', 
                                    border: '0.5px solid #ef4444', 
                                    padding: '12px 22px', 
                                    borderRadius: '14px', 
                                    cursor: 'pointer', 
                                    fontWeight: '700', 
                                    fontSize: '0.85rem',
                                    transition: 'all 0.3s ease',
                                    letterSpacing: '-0.02em',
                                    flexShrink: 0
                                }}>EXIT</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
