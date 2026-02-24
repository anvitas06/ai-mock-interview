import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level, questionCount } = await req.json();

    // 1. Set the default persona
    let systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. Ask one question at a time. Do not give away the full answer immediately.`;

    // 2. 🛑 THE SAFETY NET: Check BOTH questionCount AND message length
    // questionCount 4 means AI has spoken 4 times. messages.length 7 means 4 AI + 3 User messages.
    if (questionCount >= 4 || messages.length >= 7) {
      systemPrompt = `THE INTERVIEW IS OVER. Do NOT ask any more questions. 
      Instantly generate a highly professional "Interview Prep Report" summarizing the user's strengths and areas for improvement. 
      You MUST include a final score out of 10 formatted exactly like this: "Score: X/10".`;
    }

    const cleanMessages = messages.filter(m => m.text && m.text.trim() !== '');
    const formattedMessages = cleanMessages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text,
    }));

    // Ensure the conversation starts correctly for the AI SDK
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'assistant') {
        formattedMessages.unshift({ 
            role: 'user', 
            content: `Hello, I am ready to start my ${level} ${role} interview.` 
        });
    }

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