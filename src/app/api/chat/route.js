import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

// 🚨 REMOVED 'edge' - Using standard Node.js for stability
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { messages } = await req.json();
    
    // 🚨 Check for API Key inside the function to be safe
    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: "API Key missing in Vercel settings" }), { status: 500 });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: "You are a helpful assistant.",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    // 🚨 Pure pipe to Response
    return result.toDataStreamResponse();

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}