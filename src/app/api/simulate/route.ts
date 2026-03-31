import { NextResponse } from 'next/server'
import { processIncomingMessage } from '@/lib/stateMachine'

/**
 * POST /api/simulate — test the conversation state machine from the browser.
 * Body: { "phone": "+15551234567", "message": "NYC to SFO" }
 * Returns the bot's reply text + conversation state.
 *
 * This lets you test the full flow without Twilio or WhatsApp configured.
 */
export async function POST(req: Request) {
  try {
    const { phone, message } = (await req.json()) as { phone?: string; message?: string }

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Send JSON: { "phone": "+15551234567", "message": "NYC to SFO" }' },
        { status: 400 }
      )
    }

    const reply = await processIncomingMessage(phone, message)

    return NextResponse.json({ phone, sent: message, reply })
  } catch (err: unknown) {
    console.error('Simulate error:', err)
    const msg = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
