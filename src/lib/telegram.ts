const TELEGRAM_API = 'https://api.telegram.org'

export async function sendTelegramMessage(chatId: string, text: string, botToken?: string): Promise<void> {
  const token = botToken ?? process.env.TELEGRAM_BOT_TOKEN_V1
  if (!token) {
    console.warn('[Telegram] No bot token set, skipping send')
    return
  }
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[Telegram] sendMessage failed: ${err}`)
  }
}

export async function sendLongTelegramMessage(chatId: string, text: string, botToken?: string): Promise<void> {
  if (text.length <= 4096) {
    await sendTelegramMessage(chatId, text, botToken)
    return
  }
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= 4096) {
      await sendTelegramMessage(chatId, remaining, botToken)
      break
    }
    const splitAt = remaining.lastIndexOf('\n', 4096)
    const cut = splitAt > 0 ? splitAt : 4096
    await sendTelegramMessage(chatId, remaining.slice(0, cut), botToken)
    remaining = remaining.slice(cut).trimStart()
  }
}

export function parseTelegramUpdate(body: unknown): { chatId: string; text: string; username?: string } | null {
  const update = body as Record<string, unknown>
  const message = (update?.message ?? update?.edited_message) as Record<string, unknown> | undefined
  if (!message) return null
  const chat = message.chat as Record<string, unknown> | undefined
  const from = message.from as Record<string, unknown> | undefined
  const chatId = String(chat?.id ?? '')
  const text = (message.text as string) ?? ''
  const username = from?.username as string | undefined
  if (!chatId || !text) return null
  return { chatId, text, username }
}
