import { NextResponse } from 'next/server'
import { parseTelegramUpdate, sendTelegramMessage } from '@/lib/telegram'
import { processIncomingMessage } from '@/lib/stateMachine'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = parseTelegramUpdate(body)
    if (!parsed) return NextResponse.json({ ok: true })

    const { chatId, text } = parsed

    // Run state machine, get reply
    const reply = await processIncomingMessage(chatId, text)

    // Send reply via Telegram
    await sendTelegramMessage(chatId, reply)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Telegram webhook]', err)
    return NextResponse.json({ ok: true }) // Always 200 to Telegram
  }
}
