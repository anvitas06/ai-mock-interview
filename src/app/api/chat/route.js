import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();
    
    // 🚨 NECESSARY ADDITION: Validate incoming data to prevent crashes
    if (!messages || !Array.isArray(messages) || !role) {
      return new Response(JSON.stringify({ error: "Invalid request data" }), { status: 400 });
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    // 🚨 YOUR ORIGINAL LOGIC (Unchanged)
    const aiQuestions = messages.filter(m => m.role === 'assistant').length;

    // 🚨 NEW CALL PERSONA: "The Verbal Architect"
let systemInstruction = `You are conducting a LIVE VOICE CALL technical interview for a ${level} ${role}. 
  
RULES FOR VOICE INTERACTION:
1. BREVITY: Responses must be under 30 words. No bullet points. No markdown.
2. ACKNOWLEDGE: Briefly acknowledge their point (e.g., "Got it," or "Fair point") and then ask the next question immediately.
3. FLOW: Keep the conversation moving. If they sound stuck, give a tiny hint and ask the next question.

Interview Phase: `;

if (aiQuestions >= 5) {
    systemInstruction = `The call is ending. Verbally summarize the performance and say goodbye. Then, generate the CANDIDATE ASSESSMENT REPORT.`;
}

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemInstruction,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      // 🚨 NECESSARY ADDITION: Max tokens to prevent cost spikes/infinite loops
      maxTokens: 2000, 
    });

    return new Response(result.textStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    // 🚨 NECESSARY FIX: Return a generic message for security (don't leak error details)
    console.error(error); 
    return new Response(JSON.stringify({ error: "Failed to process interview request" }), { status: 500 });
  }
}