import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, questionCount } = await req.json()
    // 1. Initialize the prompt with the default coaching persona
    let systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. Ask one question at a time.`;

    // 2. 🛑 THE SAFETY NET: Check if it's time to end the interview
    // If the count is 4 or message history is 7+, switch to Report mode
    if (messages.length >= 6 || questionCount >= 4) {
      // RETURN THE REPORT IMMEDIATELY
   }

    // 3. Send the CORRECT systemPrompt to the model
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'), 
      system: systemPrompt, 
      messages: formattedMessages,
    });

    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    console.error('[Backend Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}