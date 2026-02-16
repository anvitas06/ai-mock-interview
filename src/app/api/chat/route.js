export const runtime = 'nodejs';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { messages } = await req.json();

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "You are a Technical Interviewer. After 6 questions, stop and give a report."
    });

    // START STREAMING
    const result = await model.generateContentStream({
      contents: messages.map(m => ({
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

    return new Response(stream);

  } catch (error) {
    console.error("DEBUG:", error);
    return new Response(error.message, { status: 500 });
  }
}