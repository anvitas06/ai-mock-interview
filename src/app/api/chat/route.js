import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// 🌟 FIX 1: Use 'edge' runtime. It prevents Next.js from dropping the stream.
export const runtime = 'edge';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level, questionCount } = await req.json();

    // 🌟 FIX 2: Filter out any empty "ghost" messages that crash Gemini instantly
    const cleanMessages = messages.filter(m => m.text && m.text.trim() !== '');

    const formattedMessages = cleanMessages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text,
    }));

    if (formattedMessages.length > 0 && formattedMessages[0].role === 'assistant') {
        formattedMessages.unshift({ 
            role: 'user', 
            content: `Hello, I am ready to start my ${level} ${role} interview.` 
        });
    }

    const systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. 
Your goal is to help the student improve for their upcoming interview. Ask one question at a time. Do not give away the full answer immediately.`;
    
    const result = streamText({
      model: google('gemini-2.0-flash'),
      system: systemPrompt,
      messages: formattedMessages,
    });

    // 🌟 FIX 3: The 100% Version-Proof Return
    // Instead of relying on .toTextStreamResponse() which causes version errors,
    // we pipe the raw textStream directly into a standard Web Response.
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('[Backend Error]:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}