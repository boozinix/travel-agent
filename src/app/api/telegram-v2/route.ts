import { NextResponse } from 'next/server'
import { parseTelegramUpdate, sendLongTelegramMessage } from '@/lib/telegram'
import { processV2Message } from '@/lib/telegramAI'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = parseTelegramUpdate(body)
    if (!parsed) return NextResponse.json({ ok: true })

    const { chatId, text, username } = parsed

    const reply = await processV2Message(chatId, text, username)

    await sendLongTelegramMessage(
      chatId,
      reply,
      process.env.TELEGRAM_BOT_TOKEN_V2
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Telegram V2 webhook]', err)
    return NextResponse.json({ ok: true })
  }
}
