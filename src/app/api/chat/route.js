export const runtime = 'nodejs';

import { streamText, convertToModelMessages } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// CRITICAL: Validate API key immediately on module load
if (!process.env.GEMINI_API_KEY) {
  console.error('[Backend] CRITICAL: GEMINI_API_KEY environment variable is not set');
}

export async function POST(req) {
  console.log('[Backend] Request START');
  
  // CRITICAL: Early validation to prevent 500 errors downstream
  if (!process.env.GEMINI_API_KEY) {
    console.log('[Backend] Request FINISH: missing API key');
    return new Response(
      JSON.stringify({ 
        error: 'Server configuration error: GEMINI_API_KEY is not configured. Please add your Gemini API key in the environment variables.' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    const { messages } = await req.json();
    const recentMessages = messages.slice(-6);

    // CRITICAL FIX: Use AI SDK Google provider configured for v1 API
    // This fixes the 404 error by accessing gemini-2.0-flash via v1 instead of v1beta
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1', // CRITICAL: Use v1 API
    });

    // Use Vercel AI SDK for streaming with 2026 performance standard model
    const result = streamText({
      model: google('gemini-2.0-flash-exp'), // 2026 performance standard (use -exp suffix for latest)
      system: 'You are a Technical Interviewer. After 6 questions, stop and give a report.',
      messages: await convertToModelMessages(recentMessages),
      maxRetries: 2, // Automatic retry for transient failures
    });

    console.log('[Backend] Request FINISH: streaming started');
    
    // Return AI SDK streaming response (SSE format for useChat)
    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('[Backend] Request FINISH: error', error);
    
    // Enhanced error categorization
    const errorMessage = String(error.message || error);
    const isRateLimit = errorMessage.includes('429') || 
      /rate|quota|RESOURCE_EXHAUSTED/i.test(errorMessage);
    const isNotFound = errorMessage.includes('404') || 
      /not found|does not exist/i.test(errorMessage);
    const isAuth = errorMessage.includes('401') || errorMessage.includes('403') ||
      /unauthorized|forbidden|invalid api key/i.test(errorMessage);
    
    let status = 500;
    let friendlyError = 'An unexpected error occurred. Please try again.';
    
    if (isRateLimit) {
      status = 429;
      friendlyError = 'Too many requests. Please wait a moment and try again.';
    } else if (isNotFound) {
      status = 404;
      friendlyError = 'Model not found. Please check the model configuration.';
    } else if (isAuth) {
      status = 401;
      friendlyError = 'Authentication failed. Please check your API key.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: friendlyError,
        details: errorMessage 
      }),
      { 
        status, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
