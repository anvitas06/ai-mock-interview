import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();
    
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    // 🚨 COUNTING LOGIC: How many questions has the AI already asked?
    const aiQuestions = messages.filter(m => m.role === 'assistant').length;

    let systemInstruction = `You are a strict technical interviewer for a ${level} ${role} position. Ask exactly one short technical question.`;

    // 🚨 TRIGGER AFTER 3 QUESTIONS
    if (aiQuestions >= 5) {
      systemInstruction = `THE INTERVIEW IS OVER. 
      Act as a Senior Technical Recruitment Manager. 
      Provide a Formal Candidate Assessment Report based on the following criteria:
      1. Technical Proficiency (Depth of knowledge)
      2. Communication Articulation (Clarity and speed)
      3. Time Management (Efficiency under 5-min pressure)
      
      Structure your response EXACTLY like this:
      # CANDIDATE ASSESSMENT REPORT
      
      ### 1. Executive Summary
      [Brief overview of candidate hireability]
      
      ### 2. Core Strengths
      * [Strength 1]
      * [Strength 2]
      
      ### 3. Areas for Development
      * [Improvement 1]
      * [Improvement 2]
      
      ### 4. Technical Performance Conclusion
      [Detailed summary of bad vs good qualities]
      
      ---
      **FINAL DECISION: [HIRE / DO NOT HIRE]**
      **SCORE: X/10**`;
    }

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemInstruction,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    return new Response(result.textStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}