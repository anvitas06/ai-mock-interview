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
    if (aiQuestions >= 3) {
      systemInstruction = `THE INTERVIEW IS OVER. 
      Analyze the candidate's performance based on:
      1. Technical Accuracy.
      2. Communication Speed (Note if they hit the 5-minute time limit).
      
      Structure your response exactly like this:
      📊 INTERVIEW REPORT
      
      - **Good Qualities**: [List 2]
      - **Bad Qualities**: [List 2]
      - **Improvements**: [Specific technical advice]
      - **Conclusion**: [Final thoughts on hireability]
      
      Score: X/10`;
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