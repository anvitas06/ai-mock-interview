export const runtime = 'nodejs';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  console.log('[Backend] Request START');
  try {
    const { messages } = await req.json();
    const recentMessages = messages.slice(-6);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "You are a Technical Interviewer. After 6 questions, stop and give a report."
    });

    // START STREAMING
    const result = await model.generateContentStream({
      contents: recentMessages.map(m => ({
        role: m.role === 'ai' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.parts?.[0]?.text ?? m.text ?? '') }],
      })),
    });

    // This converts the stream into a format the browser understands
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          controller.enqueue(new TextEncoder().encode(chunkText));
        }
        controller.close();
      },
    });

    console.log('[Backend] Request FINISH: success');
    return new Response(stream);

  } catch (error) {
    const isRateLimit = String(error.message || error).includes('429') || 
      /rate|quota|RESOURCE_EXHAUSTED/i.test(String(error.message || error));
    const status = isRateLimit ? 429 : 500;
    const body = JSON.stringify({ error: error.message || 'Unknown error' });
    console.log('[Backend] Request FINISH: error', status, error.message);
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
  }
}