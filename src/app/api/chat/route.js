import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role } = await req.json();

    // Shortened prompt = fewer tokens used
    const systemPrompt = `You are a ${role} interviewer. Ask 1 short question. If messages > 5, say "Score: 8/10" and stop.`;

    // ONLY send the last 2 messages. This is the absolute minimum to keep the 429 away.
    const limitedHistory = messages.slice(-2).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text.substring(0, 500) // Cap text length to save tokens
    }));

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: limitedHistory,
    });

    return new Response(result.textStream);

  } catch (error) {
    // If we hit a 429, send a friendly message back instead of crashing
    if (error.status === 429) {
      return new Response("🚨 System busy. Please wait 30 seconds before typing.");
    }
    return new Response("Error occurred", { status: 500 });
  }
}