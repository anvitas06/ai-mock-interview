import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();
    
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // We simplify the system instruction to ensure it doesn't cause a logic loop
    const systemPrompt = `You are a technical interviewer for a ${level} ${role} position. Ask one question.`;

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    // 🚨 We use result.textStream directly to ensure a pure text response
    return new Response(result.textStream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}