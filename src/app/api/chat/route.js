import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();

    // Count how many questions AI has asked
    const aiCount = messages.filter(m => m.role === 'assistant').length;

    let systemPrompt = `You are a strict ${level} interviewer for ${role}. Ask one short technical question.`;

    // 🛑 After 3 AI turns, force the score report
    if (aiCount >= 3) {
      systemPrompt = `INTERVIEW OVER. Summarize the user's performance for a ${level} level. 
      You MUST end the response with: "Score: X/10".`;
    }

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: messages.slice(-4), // Small history keeps token usage low
    });

    return result.toDataStreamResponse();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Server Busy" }), { status: 429 });
  }
}