import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level } = await req.json();

    // 1. Count AI turns to strictly enforce the 3-question limit
    const aiQuestions = messages.filter(m => m.role === 'assistant');
    const questionCount = aiQuestions.length;

    // 2. Dynamic Prompting
    let systemInstruction = `You are a strict technical interviewer. You are interviewing a ${level} candidate for a ${role} position. Ask exactly one technical question. Keep it brief. Do not provide the answer.`;

    // 3. Trigger Report
    if (questionCount >= 3) {
      systemInstruction = `THE INTERVIEW IS OVER. 
      Do not ask any more questions.
      Provide a concise summary of the candidate's performance based on their answers. 
      List 1 strength and 1 area for improvement. 
      You MUST end your response with the exact text: "Score: X/10" (replace X with their actual score based on a strict evaluation).`;
    }

    // 4. Stream response
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemInstruction,
      messages: messages.slice(-6), // Keeps token limits low
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