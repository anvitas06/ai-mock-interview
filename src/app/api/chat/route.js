import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export const runtime = 'edge';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, role, level, questionCount } = await req.json();

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

    // 🌟 THE FIX: Dynamic System Prompting
    // We start with the standard interviewer prompt...
    let systemPrompt = `You are a professional Technical Interview Coach for a ${level} level ${role} position. 
Your goal is to help the student improve for their upcoming interview. Ask one question at a time. Do not give away the full answer immediately.`;
    
    // ...But if they have answered 4 questions, we completely change the AI's brain!
    if (questionCount >= 4) {
      systemPrompt = `The interview is now OVER. 
Do NOT reply to the user's last answer. Do NOT continue the conversation.
Instead, instantly generate a highly professional "Interview Prep Report".
Format it beautifully with Markdown headings (###).

You MUST strictly follow this exact layout:
### 📊 Final Interview Report
**Role:** ${level} ${role}

### 🌟 Strengths
(List 2 good things they did)

### 📈 Areas for Improvement
(List 2 specific technical concepts they need to study)

### 🎯 Final Verdict
Score: [Insert Score]/10`;
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