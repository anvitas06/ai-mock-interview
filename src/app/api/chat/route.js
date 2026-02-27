import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    
    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "API Key missing in Vercel settings" }), { status: 500 });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: "You are a technical interviewer.",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    // 🚨 MANUALLY PIPE THE STREAM
    // This bypasses the "toDataStreamResponse is not a function" error entirely
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}