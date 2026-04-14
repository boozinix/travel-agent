import { NextResponse } from 'next/server';
import { processIncomingMessage } from '@/lib/stateMachine';

export async function POST(req: Request) {
  try {
    // Twilio sends application/x-www-form-urlencoded
    const textData = await req.text();
    const params = new URLSearchParams(textData);

    const from = params.get('From') || '';
    const body = params.get('Body') || '';

    if (!from || !body) {
      return new NextResponse('Invalid Request', { status: 400 });
    }

    // Pass everything as a dictionary for debugging raw payload
    const rawPayload: Record<string, string> = {};
    params.forEach((value, key) => {
      rawPayload[key] = value;
    });

    // Run async process without blocking the Twilio response
    // Actually, on Vercel serverless, we must await it or Vercel kills it.
    await processIncomingMessage(from, body);

    // Return empty TwiML 
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error processing Twilio Webhook', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
