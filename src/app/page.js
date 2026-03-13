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
    const [questionCount, setQuestionCount] = useState(0); 
    const [isInterviewComplete, setIsInterviewComplete] = useState(false);
    
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [liveAnswer, setLiveAnswer] = useState(""); 
    const [voiceGender, setVoiceGender] = useState('female'); 

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
    
        const selectedVoice = voices.find(v => {
            const name = v.name.toLowerCase();
            const isEnglish = v.lang.includes('en');
            
            if (voiceGender === 'male') {
                return isEnglish && (name.includes('google us english') || name.includes('guy') || name.includes('david') || name.includes('male'));
            } else {
                return isEnglish && (name.includes('google uk english female') || name.includes('zira') || name.includes('aria') || name.includes('female'));
            }
        });
    
        if (selectedVoice) utterance.voice = selectedVoice;
        
        utterance.rate = 0.9;
        utterance.pitch = voiceGender === 'male' ? 0.8 : 1.0; 
        window.speechSynthesis.speak(utterance);
    };

    const startListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }
        stopVoice(); // 🚨 KILL AI VOICE IMMEDIATELY WHEN USER STARTS
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => setIsListening(true);
        
        // 🚨 AUTOMATIC SUBMISSION: When the user stops talking, it sends automatically
        recognition.onend = () => {
            setIsListening(false);
            if (textInput.trim()) {
                // We simulate the form submit here
                const syntheticEvent = { preventDefault: () => {} };
                handleFinalSubmit(syntheticEvent);
            }
        };
    
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setTextInput(transcript); 
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
        
        setTimeLeft(300);
        setTimerActive(true);
        setTimeout(() => speakText(introMsg), 500);
    };

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
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
    
        // 🚨 NEW PERSONA: "Elite Executive Mentor"
// 🧠 NEW PERSONA: "The Active Architect"
let strictInstructions = `You are a Senior Technical Lead interviewing a candidate for a ${level} ${selectedRole} role.

INTERACTION STYLE:
1. ACTIVE LISTENING: Start by briefly evaluating their last answer. If they missed something crucial, point it out politely (e.g., "You handled the logic well, though you didn't mention memory complexity.")
2. ADAPTIVE QUESTIONS: Don't just ask a random question. Try to make Question ${nextCount} follow the flow of the conversation.
3. PROFESSIONAL VIBE: Be conversational but high-standards. No "robot talk."

Current Status: `;

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
    
            if (nextCount < 5) {
                setTimeLeft(300);
                setTimerActive(true);
            } else {
                setIsInterviewComplete(true);
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
                    </div>
               ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', gap: '24px' }}>
                    
                    {/* 1. KEEP YOUR HEADER (This shows the Role and Timer) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '0.5px solid rgba(234, 214, 208, 0.1)' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '800', color: '#EAD6D0', letterSpacing: '-0.04em' }}>{selectedRole}</h2>
                            <span style={{ color: '#b5a0a8', fontSize: '0.95rem' }}>{level} Proficiency Level</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#b5a0a8', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>Time Remaining</span>
                            <div style={{ fontSize: '2.8rem', fontWeight: '900', color: timeLeft < 30 ? '#ef4444' : '#EAD6D0' }}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    </div>

                    {/* 2. 🚨 PASTE THE VOICE CALL UI RIGHT HERE 🚨 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '40px' }}>
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
                            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '10px' }}>
                                {isListening ? "Listening..." : isLoading ? "Thinking..." : isInterviewComplete ? "Call Ended" : "Live Call"}
                            </h2>
                            <p style={{ opacity: 0.6, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                {isInterviewComplete ? "Generating Assessment" : "Stay Clear and Concise"}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '20px' }}>
                            {!isInterviewComplete && (
                                <button 
                                    onClick={startListening}
                                    style={{ padding: '20px 40px', borderRadius: '40px', background: '#EAD6D0', color: '#3D2C3F', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                                >
                                    {isListening ? "I'M LISTENING..." : "TAP TO RESPOND"}
                                </button>
                            )}
                            <button 
                                onClick={() => { stopVoice(); setView('landing'); }}
                                style={{ padding: '20px 40px', borderRadius: '40px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', fontWeight: '700', cursor: 'pointer' }}
                            >
                                {isInterviewComplete ? "BACK TO HOME" : "END CALL"}
                            </button>
                        </div>
                    </div>
                    {/* 🚨 END OF VOICE CALL UI 🚨 */}

                </div>
            )}
            </div>
        </div>
    );
}