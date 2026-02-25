import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role } = await req.json();

    // ULTRA-SHORT PROMPT: Every character counts toward your 429 limit
    const systemPrompt = `Interviewer for ${role}. Ask 1 short question. End with "Score: 8/10" after 3 turns.`;

    // THE 1-MESSAGE RULE: Only send the last message. 
    // This makes the request tiny so it never hits the 429 limit.
    const lastMessage = messages.slice(-1).map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }));

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: lastMessage, 
    });

    return new Response(result.textStream);

  } catch (error) {
    return new Response("Server Busy", { status: 429 });
  }
}