import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();

    // 1. Filter only AI messages to count the questions asked
    const aiQuestions = messages.filter(m => m.role === 'assistant');
    const questionCount = aiQuestions.length;

    // 2. Adjust instructions based on the interview progress
    let systemInstruction = `You are a strict technical interviewer. You are interviewing a ${level} candidate for a ${role} position. Ask exactly one technical question. Keep it brief.`;

    if (questionCount >= 3) {
      systemInstruction = `THE INTERVIEW IS OVER. 
      Provide a concise summary of the candidate's performance. 
      List their strengths and weaknesses. 
      You MUST end your response with the text: "Score: X/10" (where X is their actual score).`;
    }

    // 3. Stream the response back to the v6 frontend
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemInstruction,
      messages: messages.slice(-6), // Keeps memory lean and avoids API rate limits
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error("Backend Error:", error);
    return new Response(JSON.stringify({ error: "Interviewer is busy. Please try again." }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}