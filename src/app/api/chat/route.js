import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level, questionCount } = await req.json();

    // 1. Initialize Persona
    let systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. Ask one question at a time.`;

    // 2. 🛑 THE SAFETY NET
    if (messages.length >= 7 || questionCount >= 4) {
      systemPrompt = `THE INTERVIEW IS OVER. Provide a final summary of the user's performance. 
      You MUST end your response with a clear score in this format: "Score: X/10".`;
    }

    // 3. THE SLICE (Bypass 429 Errors)
    const limitedHistory = messages.slice(-2).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }));

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: limitedHistory,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('[Backend Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}