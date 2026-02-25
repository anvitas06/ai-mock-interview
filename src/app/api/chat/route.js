import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level, questionCount } = await req.json();

    let systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. Ask one specific question at a time.`;

    if (messages.length >= 7 || questionCount >= 4) {
      systemPrompt = `THE INTERVIEW IS OVER. Summarize the user's performance. You MUST end with "Score: X/10".`;
    }

    const limitedHistory = messages.slice(-2).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }));

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: limitedHistory,
    });

    // Use the standard textStream for manual frontend readers
    return new Response(result.textStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('[Backend Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}