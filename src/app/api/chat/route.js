export const dynamic = 'force-dynamic';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  console.log("--- API KEY STATUS ---", !!process.env.GEMINI_API_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) || {};
    const { message, role, level, questionCount = 0 } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { text: "Server misconfiguration: GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { text: "Invalid request: message is required." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const safeRole = role || "technical";
    const safeLevel = level || "Junior";
    const safeQuestionCount =
      typeof questionCount === "number" && questionCount >= 0
        ? questionCount
        : 0;

    const prompt = `You are a strict ${safeLevel} level technical interviewer for ${safeRole}. So far you have asked ${safeQuestionCount} question(s). Keep the interview focused and ask one clear question or give brief feedback. Reply in markdown. Be concise. User said: ${message.trim()}`;

    const primaryModelId = "gemini-2.5-flash-lite";
    const fallbackModelId = "gemini-3-flash-preview";

    const callModel = async (modelId) => {
      const model = genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    };

    let text;

    try {
      text = await callModel(primaryModelId);
    } catch (modelError) {
      const msg = modelError?.message?.toString().toLowerCase() ?? "";

      if (
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("limit: 0")
      ) {
        return NextResponse.json(
          { text: "Server is busy. Please try again in 1 minute." },
          { status: 429 }
        );
      }

      try {
        text = await callModel(fallbackModelId);
      } catch (fallbackError) {
        const fbMsg = fallbackError?.message?.toString().toLowerCase() ?? "";

        if (
          fbMsg.includes("429") ||
          fbMsg.includes("rate limit") ||
          fbMsg.includes("quota") ||
          fbMsg.includes("limit: 0")
        ) {
          return NextResponse.json(
            { text: "Server is busy. Please try again in 1 minute." },
            { status: 429 }
          );
        }

        return NextResponse.json(
          {
            text:
              fallbackError?.message ||
              "AI model is currently unavailable. Please try again later.",
          },
          { status: 500 }
        );
      }
    }

    if (!text) {
      return NextResponse.json(
        { text: "I couldn't generate a response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    const msg = error?.message?.toString().toLowerCase() ?? "";

    if (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("limit: 0")
    ) {
      return NextResponse.json(
        { text: "Server is busy. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    console.error("--- SERVER CRASH LOG ---");
    console.error(error?.message);

    return NextResponse.json(
      {
        text:
          error?.message ||
          "Something went wrong on the server. Please try again.",
      },
      { status: 500 }
    );
  }
}
