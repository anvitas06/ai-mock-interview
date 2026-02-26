import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is missing in Vercel Environment Variables!");

    const groq = createGroq({ apiKey: apiKey });
    const { messages, role, level } = await req.json();

    const aiQuestions = messages.filter(m => m.role === 'assistant');
    const questionCount = aiQuestions.length;

    let systemInstruction = `You are a strict technical interviewer. You are interviewing a ${level} candidate for a ${role} position. Ask exactly one technical question. Keep it brief. Do not provide the answer.`;

    if (questionCount >= 3) {
      systemInstruction = `THE INTERVIEW IS OVER. 
      Do not ask any more questions.
      Provide a concise summary of the candidate's performance based on their answers. 
      List 1 strength and 1 area for improvement. 
      You MUST end your response with the exact text: "Score: X/10" (replace X with their actual score based on a strict evaluation).`;
    }

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemInstruction,
      messages: messages.slice(-6), 
    });

    // 🚨 PURE TEXT STREAM (Removes all Vercel proprietary formatting)
    return new Response(result.textStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error) {
    console.error("Backend Error Caught:", error);
    return new Response(JSON.stringify({ error: `Backend Crash: ${error.message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}