// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages = [], language = 'English' } = body;

    const systemMessage = {
      role: 'system',
      content: `You are a helpful assistant. Always respond in ${language}. Be concise and friendly.`,
    };

    const result = await streamText({
      model: google('gemini-1.5'), // change to your model
      messages: [systemMessage, ...messages],
      temperature: 0.2,
    });

    // Inspect result at runtime if needed:
    // console.log('streamText result', result);

    // common places SDK may put the underlying stream:
    const maybeStream = (result as any).stream ?? (result as any).body ?? (result as any).readable;

    if (maybeStream && typeof (maybeStream as any).getReader === 'function') {
      // It's a ReadableStream (Web) — safe to return directly
      return new Response(maybeStream as unknown as ReadableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Fallback: try to convert the SDK result to text
    const fallbackText = (result as any).text ?? (result as any).outputText ?? JSON.stringify(result);
    return new Response(fallbackText, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('AI request error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
