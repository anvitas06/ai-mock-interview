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
    
    const [timeLeft, setTimeLeft] = useState(300); 
    const [timerActive, setTimerActive] = useState(false);
    const timerRef = useRef(null);
    const [questionCount, setQuestionCount] = useState(0); // 0 = Background phase
const [isInterviewComplete, setIsInterviewComplete] = useState(false);
    
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [liveAnswer, setLiveAnswer] = useState(""); 
    const [voiceGender, setVoiceGender] = useState('female'); // Default to female

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => { setIsMounted(true); }, []);

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

    useEffect(() => {
        // This pre-loads the voices so the 'find' logic works on the first click
        const loadVoices = () => window.speechSynthesis.getVoices();
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

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
        window.speechSynthesis.cancel();
        
        let cleanText = text.replace(/[*#`]/g, '').replace(/Question \d+:/gi, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
    
        // 🚨 DYNAMIC GENDER FILTER
        const selectedVoice = voices.find(v => {
            const name = v.name.toLowerCase();
            const isEnglish = v.lang.includes('en');
            
            if (voiceGender === 'male') {
                // Look for common male voice names or "Male" tags
                return isEnglish && (name.includes('google us english') || name.includes('guy') || name.includes('david') || name.includes('male'));
            } else {
                // Look for common female voice names or "Female" tags
                return isEnglish && (name.includes('google uk english female') || name.includes('zira') || name.includes('aria') || name.includes('female'));
            }
        });
    
        if (selectedVoice) utterance.voice = selectedVoice;
        
        utterance.rate = 0.9;
        utterance.pitch = voiceGender === 'male' ? 0.8 : 1.0; // Slightly deeper for male
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
        setQuestionCount(0); // Start at background check
        setMessages([]);
        
        const introMsg = `Hello. I am your ${level} Mentor for ${role}. Before we begin the technical assessment, please tell me a bit about your background and experience.`;
        setMessages([{ id: Date.now().toString(), role: 'assistant', content: introMsg }]);
        
        setTimeLeft(300);
        setTimerActive(true);
        setTimeout(() => speakText(introMsg), 500);
    };

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        // Added a check to make sure selectedRole exists before running
        if (!textInput.trim() || isLoading || isInterviewComplete || !selectedRole) return;
    
        stopVoice();
        clearInterval(timerRef.current);
        setTimerActive(false);
    
        const userText = textInput;
        setTextInput("");
        setIsLoading(true);
        setLiveAnswer("");
    
        const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: userText }];
        setMessages(newMessages);
    
        const nextCount = questionCount + 1;
        setQuestionCount(nextCount);
    
        // 🚨 FIXED: Changed 'role' to 'selectedRole' to prevent the ReferenceError
        let strictInstructions = `You are a strict, stone-faced technical interviewer for a ${level} ${selectedRole} position. 
        RULE 1: NEVER give feedback, hints, or praise. 
        RULE 2: Be extremely brief and clinical. `;
    
        if (nextCount < 5) {
            strictInstructions += `Ask Question ${nextCount} of 4. Format: "Question ${nextCount}: [Question]".`;
        } else {
            strictInstructions += `Generate the final CANDIDATE ASSESSMENT REPORT now.`;
        }
    
        const apiMessages = [...newMessages, { role: 'user', content: `[SYSTEM: ${strictInstructions}]` }];
    
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: apiMessages.map(m => ({ role: m.role, content: m.content })), 
                    role: selectedRole, // Ensure this matches your API expectations
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
    
            if (nextCount < 5) {
                setTimeLeft(300);
                setTimerActive(true);
            } else {
                setIsInterviewComplete(true);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            setIsLoading(false); // 🚨 CRITICAL: This turns off "Analyzing" if the API fails
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
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}>{l}</button>
                             ))}
                        </div>
                        {/* 🎤 VOICE SELECTION SECTION */}
<div style={{ marginTop: '30px', textAlign: 'center' }}>
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
                        
                        {/* 🚨 FIXED: Grid is now exactly 2 columns wide */}
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
        // 🚨 THIS IS THE "MICRO-INTERACTION"
        whileHover={{ 
            scale: 1.03, 
            backgroundColor: "rgba(61, 44, 63, 0.4)",
            boxShadow: "0 0 20px rgba(234, 214, 208, 0.1)"
        }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
        // 🚨 THIS IS THE "AESTHETIC" STYLE
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
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', gap: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '0.5px solid rgba(234, 214, 208, 0.1)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800', color: '#EAD6D0', letterSpacing: '-0.04em' }}>{selectedRole}</h2>
                                <span style={{ color: '#b5a0a8', fontSize: '0.95rem' }}>{level} Proficiency Level</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#b5a0a8', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>Time Remaining</span>
                                <div style={{ 
                                    fontSize: '2.8rem', 
                                    fontWeight: '900',
                                    color: timeLeft < 30 ? '#ef4444' : '#EAD6D0',
                                    letterSpacing: '-0.04em'
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
                            border: '0.5px solid rgba(234, 214, 208, 0.1)'
                        }}>
                            {messages?.map((m) => {
    const isReport = m.content?.includes("ASSESSMENT REPORT");
    return (
        <div key={m.id} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: isReport ? '100%' : '85%',
            padding: '28px',
            borderRadius: '24px',
            background: isReport ? 'rgba(61, 44, 63, 0.7)' : (m.role === 'user' ? '#EAD6D0' : 'rgba(234, 214, 208, 0.05)'),
            color: m.role === 'user' ? '#3D2C3F' : '#EAD6D0',
            border: isReport ? '1px solid #EAD6D0' : '0.5px solid rgba(234, 214, 208, 0.1)',
            boxShadow: isReport ? '0 20px 50px rgba(0,0,0,0.3)' : 'none',
        }}>
            {isReport && <h3 style={{ marginBottom: '15px' }}>📊 Final Evaluation</h3>}
            <ReactMarkdown>{m.content}</ReactMarkdown>
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
                                    backdropFilter: 'blur(8px)'
                                }}>
                                    <ReactMarkdown>{liveAnswer}</ReactMarkdown>
                                </div>
                            )}

                            {isLoading && !liveAnswer && <div style={{ color: '#b5a0a8', fontStyle: 'italic' }}>Analyzing...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <button 
                                type="button"
                                onClick={startListening}
                                style={{ 
                                    width: '62px', 
                                    height: '62px', 
                                    borderRadius: '50%', 
                                    background: isListening ? '#ef4444' : 'rgba(61, 44, 63, 0.4)',
                                    border: '0.5px solid rgba(234, 214, 208, 0.2)', 
                                    cursor: 'pointer', 
                                    fontSize: '22px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}
                            >
                                {isListening ? '🛑' : '🎤'}
                            </button>

                            <form onSubmit={handleFinalSubmit} style={{ 
                                flex: 1, 
                                display: 'flex', 
                                gap: '12px', 
                                background: 'rgba(61, 44, 63, 0.2)',
                                padding: '10px 18px', 
                                borderRadius: '22px', 
                                border: '0.5px solid rgba(234, 214, 208, 0.15)'
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
                                        fontSize: '0.95rem'
                                    }}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isLoading || !textInput.trim()}
                                    style={{ 
                                        background: (isLoading || !textInput.trim()) ? 'rgba(234, 214, 208, 0.1)' : '#EAD6D0', 
                                        color: (isLoading || !textInput.trim()) ? '#b5a0a8' : '#3D2C3F', 
                                        border: 'none', 
                                        borderRadius: '14px', 
                                        padding: '12px 26px', 
                                        fontWeight: '800',
                                        cursor: (isLoading || !textInput.trim()) ? 'not-allowed' : 'pointer', 
                                        transition: 'all 0.3s ease'
                                    }}>
                                    SEND
                                </button>
                            </form>
                            
                            <button 
                                onClick={() => { stopVoice(); setView('landing'); }} 
                                style={{ 
                                    background: 'transparent', 
                                    color: '#ef4444', 
                                    border: '0.5px solid #ef4444', 
                                    padding: '12px 22px', 
                                    borderRadius: '14px', 
                                    cursor: 'pointer', 
                                    fontWeight: '700', 
                                    fontSize: '0.85rem'
                                }}>EXIT</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}