// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, language } = body;

    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant. Always respond in ${language || 'English'} clearly and politely.`,
    };

    const result = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [systemMessage, ...messages],
      temperature: 0.4,
    });

    // Some SDKs nest text differently — handle all cases
    const text =
      (result as any).text ||
      (result as any).output_text ||
      (result as any).content ||
      JSON.stringify(result);

    // ✅ Return plain string (no Promise)
    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('AI request failed:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
