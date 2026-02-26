import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();

    // 1. Keep prompt short to prevent 429 Rate Limits
    let systemPrompt = `You are a strict ${level} technical interviewer for a ${role} position. Ask one short question at a time.`;

    // 2. Safety Net / Report Trigger
    if (messages.length >= 7) {
      systemPrompt = `THE INTERVIEW IS OVER. Summarize the user's performance. You MUST end your response exactly with "Score: X/10".`;
    }

    // 3. Limit history to the last 2 messages to avoid payload limits
    const limitedHistory = messages.slice(-2).map(m => ({
      role: m.role === 'ai' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text
    }));

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: limitedHistory,
    });

    // The useChat hook expects this specific response format
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('[Backend Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}