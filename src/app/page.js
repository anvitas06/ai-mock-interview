"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import {
  Mic, Code, Square, PhoneOff, History, ChevronRight, Sparkles, Zap, User, Volume2,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } },
};

const glassCardHover = {
  scale: 1.02,
  backgroundColor: "rgba(255,255,255,0.08)",
  transition: { type: "spring", stiffness: 300, damping: 20 },
};

export default function PrismApp() {
  // --- UI STATES (From v0) ---
  const [activeView, setActiveView] = useState("landing");
  const [isMounted, setIsMounted] = useState(false);

  // --- YOUR ORIGINAL CORE LOGIC STATES ---
  const [selectedRole, setSelectedRole] = useState(null);
  const [level, setLevel] = useState("Junior");
  const [voiceGender, setVoiceGender] = useState("female");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [forceSubmitText, setForceSubmitText] = useState(null);

  // --- REFS ---
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptBuffer = useRef("");

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 🚨 YOUR WATCHDOG TIMER LOGIC (Unchanged)
  useEffect(() => {
    if (forceSubmitText && !isLoading && !isInterviewComplete) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.stop();
      
      const textToSend = forceSubmitText;
      setForceSubmitText(null);
      transcriptBuffer.current = "";
      setInterimTranscript("");
      
      handleFinalSubmit({ preventDefault: () => {} }, textToSend);
    }
  }, [forceSubmitText, isLoading, isInterviewComplete]);

  const stopVoice = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
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
      if (voiceGender.toLowerCase() === 'male') {
        return isEnglish && (name.includes('google us english') || name.includes('guy') || name.includes('david'));
      } else {
        return isEnglish && (name.includes('google uk english female') || name.includes('aria'));
      }
    });

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 0.9;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (!isInterviewComplete) startListening();
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
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
      transcriptBuffer.current = "";
    };

    recognition.onresult = (event) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      transcriptBuffer.current = currentTranscript;
      setInterimTranscript(currentTranscript);
      
      silenceTimerRef.current = setTimeout(() => {
        if (transcriptBuffer.current.trim()) {
          setForceSubmitText(transcriptBuffer.current);
        }
      }, 2000);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    
    recognition.start();
  };

  const startCall = (role) => {
    stopVoice();
    setSelectedRole(role);
    setQuestionCount(0);
    setMessages([]);
    setActiveView("call");
    setIsInterviewComplete(false);
    
    const introMsg = `Hello. I am your ${level} Mentor for ${role}. Before we begin the technical assessment, please tell me a bit about your background and experience.`;
    setMessages([{ id: Date.now().toString(), role: 'assistant', content: introMsg }]);
    
    setTimeout(() => speakText(introMsg), 500);
  };

  const handleFinalSubmit = async (e, directTranscript = null) => {
    if (e) e.preventDefault();
    const finalPayload = directTranscript;
    if (!finalPayload || !finalPayload.trim() || isLoading || isInterviewComplete || !selectedRole) return;

    stopVoice();
    setIsLoading(true);

    const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: finalPayload }];
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
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: accumulatedText }]);
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
        setTimeout(() => setActiveView("history"), 3000); // Auto-redirect to history
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const techOptions = [
    { name: "React.js", icon: "⚛️", color: "from-cyan-500 to-blue-500" },
    { name: "Node.js", icon: "🟢", color: "from-green-500 to-emerald-500" },
    { name: "DSA", icon: "🧮", color: "from-purple-500 to-pink-500" },
    { name: "Java", icon: "☕", color: "from-orange-500 to-red-500" },
  ];

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden relative">
      {/* V0 Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-zinc-800/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-blue-950/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-gradient-radial from-purple-950/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {/* === LANDING VIEW === */}
        {activeView === "landing" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0, y: -20 }} className="relative z-10 min-h-screen flex flex-col px-6 py-12 max-w-5xl mx-auto">
            <motion.div variants={itemVariants} className="text-center mb-12">
              <motion.h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-4 lowercase" style={{ textShadow: "0 0 40px rgba(255,255,255,0.3), 0 0 80px rgba(255,255,255,0.1)" }}>
                prism
              </motion.h1>
              <motion.p className="text-2xl md:text-3xl font-medium bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} style={{ backgroundSize: "200% 200%" }}>
                Debug your interview skills.
              </motion.p>
            </motion.div>

            <motion.div variants={itemVariants} className="mb-10 p-5 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-zinc-400"><Zap className="w-4 h-4" /><span className="text-sm font-medium">Level</span></div>
                  <div className="flex gap-1 p-1 rounded-xl bg-white/5">
                    {["Junior", "Mid", "Senior"].map((l) => (
                      <motion.button key={l} onClick={() => setLevel(l)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${level === l ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{l}</motion.button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-zinc-400"><Volume2 className="w-4 h-4" /><span className="text-sm font-medium">Voice</span></div>
                  <div className="flex gap-1 p-1 rounded-xl bg-white/5">
                    {["Female", "Male"].map((voice) => (
                      <motion.button key={voice} onClick={() => setVoiceGender(voice)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${voiceGender === voice ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{voice}</motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="mb-10">
              <h2 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5" /> Select Your Domain</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {techOptions.map((tech) => (
                  <motion.button key={tech.name} onClick={() => startCall(tech.name)} className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 text-center overflow-hidden" whileHover={glassCardHover} whileTap={{ scale: 0.98 }}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${tech.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    <span className="text-4xl mb-3 block">{tech.icon}</span>
                    <span className="text-white font-semibold">{tech.name}</span>
                    <ChevronRight className="w-4 h-4 mx-auto mt-2 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-auto text-center">
              <motion.button onClick={() => setActiveView("history")} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group" whileHover={{ scale: 1.05 }}>
                <History className="w-4 h-4" /><span>View Past Call Reports</span><ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* === LIVE CALL VIEW === */}
        {activeView === "call" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 min-h-screen flex flex-col px-6 py-8 max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 p-4 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10">
              <div className="flex items-center gap-3"><User className="w-5 h-5 text-zinc-400" /><span className="text-white font-semibold">{selectedRole} • {level}</span></div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-purple-500 animate-pulse" : isListening ? "bg-green-500 animate-pulse" : "bg-cyan-500"}`} />
                <span className="font-mono text-lg text-white">Question {questionCount}/4</span>
              </div>
            </motion.div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <motion.div className="relative w-64 h-64 mb-12" animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <motion.div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)", filter: "blur(30px)" }} animate={{ rotate: isLoading ? 1080 : 360 }} transition={{ duration: isLoading ? 2 : 8, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute inset-4 rounded-full" style={{ background: "conic-gradient(from 0deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)" }} animate={{ rotate: 360, boxShadow: ["0 0 40px rgba(6, 182, 212, 0.5)", "0 0 100px rgba(236, 72, 153, 0.5)", "0 0 40px rgba(6, 182, 212, 0.5)"] }} transition={{ rotate: { duration: 4, repeat: Infinity, ease: "linear" }, boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }} />
                <div className="absolute inset-8 rounded-full bg-zinc-950 flex items-center justify-center">
                  <motion.div animate={{ scale: isListening ? [1, 1.2, 1] : 1, opacity: isListening ? [0.5, 1, 0.5] : 1 }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                    <Mic className="w-16 h-16 text-white/80" />
                  </motion.div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-2xl mx-auto text-center px-8 py-6 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 min-h-[100px] w-full">
                <motion.p className="text-zinc-400 italic text-lg leading-relaxed" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity }}>
                   {isLoading ? "Mentor is thinking..." : isListening ? `"${interimTranscript}"` : "Agent Active..."}
                </motion.p>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-4 mt-8">
              {isSpeaking && (
                <motion.button onClick={() => { stopVoice(); startListening(); }} className="flex items-center gap-3 px-8 py-4 rounded-xl bg-white/10 backdrop-blur-2xl border border-white/20 text-white font-semibold" whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" }} whileTap={{ scale: 0.98 }}>
                  <Square className="w-5 h-5" /> INTERRUPT
                </motion.button>
              )}
              <motion.button onClick={() => { stopVoice(); setActiveView("history"); }} className="flex items-center gap-3 px-8 py-4 rounded-xl bg-red-500/20 backdrop-blur-2xl border border-red-500/30 text-red-400 font-semibold" whileHover={{ scale: 1.02, backgroundColor: "rgba(239, 68, 68, 0.3)" }} whileTap={{ scale: 0.98 }}>
                <PhoneOff className="w-5 h-5" /> END SESSION
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* === HISTORY VIEW === */}
        {activeView === "history" && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ type: "spring", stiffness: 80, damping: 20 }} className="relative z-10 min-h-screen flex flex-col px-6 py-8 max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                 <History className="w-6 h-6 text-zinc-400" />
                 <h1 className="text-2xl font-bold text-white">Call History</h1>
              </div>
              <button onClick={() => setActiveView("landing")} className="text-sm bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition">Back to Home</button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex-1 p-8 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 overflow-auto">
              <div className="flex flex-col gap-4">
                {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('intervu_history') || '[]').length > 0 ? (
                  JSON.parse(localStorage.getItem('intervu_history')).map((item) => (
                    <motion.div key={item.id} className="p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
                      <h3 className="text-xl font-bold mb-1">{item.role} <span className="text-sm font-normal text-zinc-500">({item.level})</span></h3>
                      <p className="text-sm text-zinc-500 mb-4">{item.date}</p>
                      <div className="prose prose-invert max-w-none text-sm text-zinc-300">
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-center py-10">No past calls found. Complete an interview to see your report here.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}