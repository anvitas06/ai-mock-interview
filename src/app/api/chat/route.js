export const runtime = 'nodejs';

import { GoogleGenerativeAI } from "@google/generative-ai";
// Stable model ID for this interview app
const MODEL_ID = "gemini-1.5-flash";
const SYSTEM_INSTRUCTION =
  "You are a Technical Interviewer. After 6 questions, stop and give a report.";

// Simple exponential backoff wrapper around Gemini streaming.
// Retries on 429 (rate limit) with growing delays: 500ms, 1000ms, 2000ms.
async function generateWithBackoff(model, recentMessages, signal) {
  const maxRetries = 3;
  const baseDelayMs = 500;

  const contents = recentMessages.map(m => ({
    role: m.role === 'ai' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.parts?.[0]?.text ?? m.text ?? '') }],
  }));

  let attempt = 0;

  // Helper to detect rate-limit style errors from Gemini.
  const isRateLimitError = (err) => {
    const message = String(err?.message || err || '');
    const statusFromError =
      err?.status ||
      err?.response?.status ||
      err?.cause?.status ||
      err?.cause?.response?.status;

    return (
      statusFromError === 429 ||
      message.includes('429') ||
      /rate|quota|RESOURCE_EXHAUSTED/i.test(message)
    );
  };

  // Keep trying until success or non-retryable / too many attempts.
  // This function itself never swallows errors; it either returns
  // a valid stream result or throws the final error.
  // It respects the AbortSignal to avoid wasting quota.
  // (If aborted before a retry, we surface an AbortError.)
  while (true) {
    if (signal?.aborted) {
      const abortError = new Error('Aborted before calling Gemini generateContentStream');
      abortError.name = 'AbortError';
      throw abortError;
    }

    try {
      return await model.generateContentStream(
        { contents },
        { signal }
      );
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= maxRetries) {
        throw err;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt); // 500, 1000, 2000
      console.log(
        '[Backend] 429 rate limit from Gemini, backing off for',
        delayMs,
        'ms before retry',
        attempt + 1
      );

      // #region agent log
      fetch('http://127.0.0.1:7677/ingest/c3f2bbca-3a28-4c6c-b0a6-12a84a35a98e', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': 'ca86f3',
        },
        body: JSON.stringify({
          sessionId: 'ca86f3',
          runId: 'pre-fix',
          hypothesisId: 'H3',
          location: 'src/app/api/chat/route.js:20-60',
          message: 'Gemini 429, scheduling retry with backoff',
          data: { attempt, delayMs },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}

export async function POST(req) {
  console.log('[Backend] Request START');
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured: missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json();
    const recentMessages = messages.slice(-6);

    // 👉 SAFETY CHECK: log how much we are sending to Gemini
    const payloadStats = recentMessages.reduce(
      (acc, m) => {
        const text = String(m.parts?.[0]?.text ?? m.text ?? '');
        acc.totalMessages += 1;
        acc.totalChars += text.length;
        return acc;
      },
      { totalMessages: 0, totalChars: 0 }
    );
    console.log('[Backend] Gemini payload stats:', payloadStats);

    // #region agent log
    fetch('http://127.0.0.1:7677/ingest/c3f2bbca-3a28-4c6c-b0a6-12a84a35a98e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ca86f3',
      },
      body: JSON.stringify({
        sessionId: 'ca86f3',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/app/api/chat/route.js:24-35',
        message: 'Gemini payload stats before generateContentStream',
        data: { payloadStats },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // If the client already cancelled before we even hit Gemini,
    // don't start a generation at all (saves quota).
    if (req.signal?.aborted) {
      console.log('[Backend] Request aborted before calling Gemini.');
      return new Response(null, { status: 204 });
    }

    // Initialize a fresh Gemini client + model per request to avoid any
    // potential stale instances contributing to 429 behavior.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_ID,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    // 1. START STREAMING with exponential backoff on 429.
    // We only ever send the last 6 messages to Gemini (recentMessages),
    // and we pass through the request's AbortSignal so cancellations
    // stop retries and active generations as early as possible.
    let result;
    try {
      result = await generateWithBackoff(model, recentMessages, req.signal);
    } catch (genError) {
      const genMessage = String(genError?.message || genError || '');
      const isQuotaLike = /429|rate|quota|RESOURCE_EXHAUSTED/i.test(genMessage);
      const isSafetyLike = /safety/i.test(genMessage);

      console.log('[Backend] Gemini generateContentStream error.message:', genMessage);
      console.log(
        '[Backend] Gemini generateContentStream category:',
        isQuotaLike ? 'QUOTA/RATE_LIMIT' : (isSafetyLike ? 'SAFETY' : 'OTHER')
      );

      throw genError;
    }

    const stream = new ReadableStream({
      async start(controller) {
        // Optional: extra visibility into aborts while streaming
        const abortHandler = () => {
          console.log('[Backend] Abort signal received inside stream start.');
          // We rely on the loop + AbortError handling to cleanly stop,
          // but make sure the client side sees a closed stream.
          try {
            controller.close();
          } catch (_) {}
        };

        if (req.signal) {
          req.signal.addEventListener('abort', abortHandler);
        }

        try {
          for await (const chunk of result.stream) {
            // 2. Break the loop immediately if the user interrupts
            if (req.signal?.aborted) {
              console.log('[Backend] Stream aborted by user interruption.');
              break; 
            }
            const chunkText = chunk.text();
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
          controller.close();
        } catch (streamError) {
          // Gracefully handle stream interruptions during active chunking
          if (streamError.name === 'AbortError') {
            console.log('[Backend] Stream successfully aborted mid-flight.');
          } else {
            controller.error(streamError);
          }
        } finally {
          if (req.signal) {
            req.signal.removeEventListener('abort', abortHandler);
          }
        }
      },
    });

    console.log('[Backend] Request FINISH: success');
    return new Response(stream);

  } catch (error) {
    // 3. Catch the AbortError before it triggers a 500 status code
    if (error.name === 'AbortError') {
      console.log('[Backend] Request aborted before streaming started.');
      return new Response(null, { status: 204 }); 
    }

    const message = String(error?.message || error || '');

    // #region agent log
    fetch('http://127.0.0.1:7677/ingest/c3f2bbca-3a28-4c6c-b0a6-12a84a35a98e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ca86f3',
      },
      body: JSON.stringify({
        sessionId: 'ca86f3',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'src/app/api/chat/route.js:108-140',
        message: 'Gemini error caught in route handler',
        data: {
          message,
          name: error?.name || null,
          status: error?.status || error?.response?.status || null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const statusFromError =
      error?.status ||
      error?.response?.status ||
      error?.cause?.status ||
      error?.cause?.response?.status;

    const isRateLimit =
      statusFromError === 429 ||
      message.includes('429') ||
      /rate|quota|RESOURCE_EXHAUSTED/i.test(message);

    const isModelNotFound =
      statusFromError === 404 ||
      /not found/i.test(message) ||
      /models?\//i.test(message);

    const status = isRateLimit ? 429 : (isModelNotFound ? 404 : 500);

    // Friendly, actionable messages for common failures.
    const friendlyError = isRateLimit
      ? "Take a breath, the mentor is busy. Try again in a moment."
      : isModelNotFound
        ? `Model not found: "${MODEL_ID}". If this persists, try "gemini-1.5-flash" or check model access for your API key.`
        : (error?.message || 'Unknown error');

    const body = JSON.stringify({ error: friendlyError });
    console.log('[Backend] Request FINISH: error', status, friendlyError);

    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}