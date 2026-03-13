"use client";
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

export default function InterviewApp() {
    const [isMounted, setIsMounted] = useState(false);
    const [view, setView] = useState('landing');
    const [selectedRole, setSelectedRole] = useState(null);
    const [level, setLevel] = useState('Junior');
    const [isListening, setIsListening] = useState(false);
    const [textInput, setTextInput] = useState(""); 
    
    const [questionCount, setQuestionCount] = useState(0); 
    const [isInterviewComplete, setIsInterviewComplete] = useState(false);
    
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [liveAnswer, setLiveAnswer] = useState(""); 
    const [voiceGender, setVoiceGender] = useState('female'); 
    const [interimTranscript, setInterimTranscript] = useState(""); 

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimer = useRef(null);
    const transcriptBuffer = useRef("");

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        const loadVoices = () => window.speechSynthesis.getVoices();
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    const stopVoice = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };

    const speakText = (text) => {
        if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        
        let cleanText = text.replace(/[*#`]/g, '').replace(/Question \d+:/gi, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
    
        const selectedVoice = voices.find(v => {
            const name = v.name.toLowerCase();
            const isEnglish = v.lang.includes('en');
            if (voiceGender === 'male') {
                return isEnglish && (name.includes('google us english') || name.includes('guy') || name.includes('david'));
            } else {
                return isEnglish && (name.includes('google uk english female') || name.includes('aria'));
            }
        });
    
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 0.9;
        
        utterance.onend = () => {
            if (!isInterviewComplete) {
                startListening(); 
            }
        };
    
        window.speechSynthesis.speak(utterance);
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
        
        stopVoice(); 
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.lang = 'en-US';
        // 🚨 Set to true so the browser doesn't hang; WE control the stop now.
        recognition.continuous = true; 
        recognition.interimResults = true; 

        recognition.onstart = () => {
            setIsListening(true);
            setInterimTranscript("");
            transcriptBuffer.current = ""; // Reset buffer
        };

        recognition.onresult = (event) => {
            // 1. Clear the timer the millisecond it hears a new sound
            if (silenceTimer.current) clearTimeout(silenceTimer.current);

            // 2. Gather the text
            let currentTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                currentTranscript += event.results[i][0].transcript;
            }
            
            // 3. Store the text in a Ref (so the timer can access the latest version safely)
            transcriptBuffer.current = currentTranscript;
            setInterimTranscript(currentTranscript); 
            
            // 4. 🚨 THE FORCED TRIGGER: If no new words are spoken for 2 seconds, send it.
            silenceTimer.current = setTimeout(() => {
                if (transcriptBuffer.current.trim() && !isLoading) {
                    recognition.stop(); // Kill the mic
                    const syntheticEvent = { preventDefault: () => {} };
                    handleFinalSubmit(syntheticEvent, transcriptBuffer.current); // Force send
                    setInterimTranscript(""); // Clear subtitles
                }
            }, 2000); 
        };

        recognition.onend = () => {
            setIsListening(false);
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
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
        setQuestionCount(0);
        setMessages([]);
        
        const introMsg = `Hello. I am your ${level} Mentor for ${role}. Before we begin the technical assessment, please tell me a bit about your background and experience.`;
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: introMsg }]);
        
        setTimeout(() => speakText(introMsg), 500);
    };

    const handleFinalSubmit = async (e, directTranscript = null) => {
        if (e) e.preventDefault();
        const finalPayload = directTranscript || textInput;
        if (!finalPayload.trim() || isLoading || isInterviewComplete || !selectedRole) return;
    
        stopVoice();
    
        const userText = finalPayload;
        setTextInput("");
        setIsLoading(true);
        setLiveAnswer("");
    
        const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: userText }];
        setMessages(newMessages);
    
        const nextCount = questionCount + 1;
        setQuestionCount(nextCount);
    
        let strictInstructions = `You are a Senior Technical Lead interviewing a candidate for a ${level} ${selectedRole} role.

INTERACTION STYLE:
1. ACTIVE LISTENING: Start by briefly evaluating their last answer.
2. ADAPTIVE QUESTIONS: Follow the conversation flow.
3. PROFESSIONAL VIBE: Conversational but high-standards. No robot talk.`;

        if (nextCount < 5) {
            strictInstructions += `Provide a 1-sentence feedback on their last response, then ask Question ${nextCount} of 4. Ensure the question is a realistic industry-standard problem for a ${level} level.`;
        } else {
            strictInstructions += `The interview is complete. Analyze the entire conversation and generate the final CANDIDATE ASSESSMENT REPORT.`;
        }
    
        const apiMessages = [...newMessages, { role: 'user', content: `[SYSTEM: ${strictInstructions}]` }];
    
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: apiMessages.map(m => ({ role: m.role, content: m.content })), 
                    role: selectedRole, 
                    level: level 
                }),
            });
    
            if (!response.ok) throw new Error("API failed");
    
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
    
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulatedText += decoder.decode(value, { stream: true });
                setLiveAnswer(accumulatedText);
            }
    
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: accumulatedText }]);
            setLiveAnswer("");
            speakText(accumulatedText);
    
            if (nextCount >= 5) {
                setIsInterviewComplete(true);
                const reportData = {
                    id: Date.now(),
                    role: selectedRole,
                    level: level,
                    date: new Date().toLocaleDateString(),
                    content: accumulatedText
                };
                const existingHistory = JSON.parse(localStorage.getItem('intervu_history') || '[]');
                localStorage.setItem('intervu_history', JSON.stringify([reportData, ...existingHistory]));
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            setIsLoading(false); 
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
                        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                            <motion.h1 
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ 
                                    fontSize: '5rem', 
                                    fontWeight: '800', 
                                    color: '#EAD6D0', 
                                    margin: '0',
                                    letterSpacing: '-0.05em',
                                    lineHeight: '1'
                                }}
                            >
                                Intervu
                            </motion.h1>
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                style={{ 
                                    color: '#EAD6D0', 
                                    opacity: 0.6, 
                                    fontSize: '0.9rem', 
                                    marginTop: '12px',
                                    fontWeight: '500',
                                    letterSpacing: '0.2em',
                                    textTransform: 'uppercase'
                                }}
                            >
                                AI Technical Interview Simulator
                            </motion.p>
                        </div>
                        
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
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}>{l}</button>
                             ))}
                        </div>

                        <div style={{ marginTop: '30px', textAlign: 'center', marginBottom: '40px' }}>
                            <p style={{ color: '#EAD6D0', opacity: 0.6, fontSize: '0.8rem', marginBottom: '12px', letterSpacing: '0.1em' }}>
                                MENTOR VOICE
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                {['female', 'male'].map((gender) => (
                                    <motion.button
                                        key={gender}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setVoiceGender(gender)}
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            background: voiceGender === gender ? '#EAD6D0' : 'transparent',
                                            color: voiceGender === gender ? '#3D2C3F' : '#EAD6D0',
                                            border: '0.5px solid rgba(234, 214, 208, 0.3)',
                                            fontSize: '0.8rem',
                                            textTransform: 'uppercase',
                                            fontWeight: '700',
                                            letterSpacing: '0.1em'
                                        }}
                                    >
                                        {gender}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '24px',
                            maxWidth: '600px',
                            margin: '0 auto' 
                        }}>
                            {['React.js', 'Node.js', 'DSA', 'Java'].map((role) => (
                                <motion.button 
                                    key={role} 
                                    onClick={() => startInterview(role)} 
                                    whileHover={{ scale: 1.03, backgroundColor: "rgba(61, 44, 63, 0.4)", boxShadow: "0 0 20px rgba(234, 214, 208, 0.1)" }}
                                    whileTap={{ scale: 0.97 }}
                                    transition={{ type: "spring", stiffness: 100, damping: 30 }}
                                    style={{ 
                                        padding: '40px 20px', 
                                        background: 'rgba(61, 44, 63, 0.25)',
                                        backdropFilter: 'blur(10px)',
                                        border: '0.5px solid rgba(234, 214, 208, 0.15)', 
                                        borderRadius: '24px', 
                                        color: '#EAD6D0', 
                                        fontWeight: '700', 
                                        fontSize: '1.2rem', 
                                        cursor: 'pointer',
                                        letterSpacing: '-0.03em'
                                    }}
                                >
                                    {role}
                                </motion.button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setView('history')}
                            style={{ marginTop: '30px', opacity: 0.6, background: 'transparent', border: 'none', color: '#EAD6D0', cursor: 'pointer', textDecoration: 'underline', width: '100%' }}
                        >
                            View Past Call Reports
                        </button>
                    </div>
               ) : view === 'history' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: '900' }}>Call History</h1>
                            <button onClick={() => setView('landing')} style={{ color: '#EAD6D0', background: 'rgba(234,214,208,0.1)', padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>BACK</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('intervu_history') || '[]').length > 0 ? (
                                JSON.parse(localStorage.getItem('intervu_history')).map((item) => (
                                    <motion.div 
                                        key={item.id}
                                        whileHover={{ x: 10 }}
                                        style={{ padding: '24px', background: 'rgba(61, 44, 63, 0.3)', borderRadius: '20px', border: '1px solid rgba(234, 214, 208, 0.1)', cursor: 'pointer' }}
                                        onClick={() => {
                                            setMessages([{ id: 'hist', role: 'assistant', content: item.content }]);
                                            setSelectedRole(item.role);
                                            setLevel(item.level);
                                            setIsInterviewComplete(true);
                                            setView('interview');
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{item.role}</h3>
                                                <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>{item.level} • {item.date}</span>
                                            </div>
                                            <span>📄</span>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <p style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>No past calls found.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '0.5px solid rgba(234, 214, 208, 0.1)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800', color: '#EAD6D0', letterSpacing: '-0.04em' }}>{selectedRole}</h2>
                                <span style={{ color: '#b5a0a8', fontSize: '0.95rem' }}>{level} Proficiency</span>
                            </div>
                        </div>
                
                        {!isInterviewComplete ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px', position: 'relative' }}>
                                <motion.div
                                    animate={{ 
                                        scale: isListening ? [1, 1.1, 1] : isLoading ? [1, 1.05, 1] : 1,
                                        boxShadow: isListening ? "0 0 60px rgba(234, 214, 208, 0.4)" : "0 0 20px rgba(234, 214, 208, 0.1)"
                                    }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    style={{
                                        width: '240px', height: '240px', borderRadius: '50%',
                                        background: 'radial-gradient(circle, #EAD6D0 0%, #3D2C3F 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <span style={{ fontSize: '4rem' }}>{isListening ? '🎙️' : isLoading ? '🧠' : '👤'}</span>
                                </motion.div>
                                <div style={{ textAlign: 'center' }}>
                                    <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '10px' }}>
                                        {isListening ? "Listening..." : isLoading ? "Mentor is Thinking..." : "Live Call Active"}
                                    </h2>
                                </div>
                                <div style={{ 
                                    minHeight: '60px', 
                                    width: '100%', 
                                    textAlign: 'center', 
                                    padding: '0 40px', 
                                    fontSize: '1.2rem', 
                                    fontStyle: 'italic', 
                                    color: '#b5a0a8',
                                    opacity: interimTranscript ? 1 : 0 
                                }}>
                                    "{interimTranscript}"
                                </div>
                                <button 
                                    onClick={() => { stopVoice(); setView('landing'); }}
                                    style={{ padding: '15px 40px', borderRadius: '40px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    END CALL
                                </button>
                            </div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}
                            >
                                <div style={{ 
                                    background: 'rgba(30, 41, 59, 0.5)', 
                                    backdropFilter: 'blur(20px)',
                                    padding: '40px', 
                                    borderRadius: '32px', 
                                    border: '1px solid rgba(234, 214, 208, 0.2)' 
                                }}>
                                    <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', fontWeight: '900' }}>Interview Summary</h1>
                                    {messages.filter(m => m.content.includes("ASSESSMENT REPORT")).map((m) => (
                                        <div key={m.id} className="prose prose-invert max-w-none" style={{ color: '#EAD6D0' }}>
                                            <ReactMarkdown>{m.content}</ReactMarkdown>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => { stopVoice(); setView('landing'); setIsInterviewComplete(false); }}
                                        style={{ marginTop: '40px', width: '100%', padding: '20px', borderRadius: '20px', background: '#EAD6D0', color: '#3D2C3F', fontWeight: '800', border: 'none', cursor: 'pointer' }}
                                    >
                                        START NEW MOCK INTERVIEW
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}