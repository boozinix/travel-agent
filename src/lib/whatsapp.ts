const GRAPH_API_VERSION = 'v23.0'

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  return { token, phoneNumberId }
}

export function isWhatsAppConfigured(): boolean {
  const { token, phoneNumberId } = getConfig()
  return Boolean(token && phoneNumberId)
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const { token, phoneNumberId } = getConfig()
  if (!token || !phoneNumberId) {
    console.warn('WhatsApp not configured — would send to', to, ':', text)
    return false
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error('WhatsApp send failed:', res.status, err)
    return false
  }

  return true
}

type WAIncomingMessage = {
  from: string
  body: string
  messageId: string
  timestamp: string
} | null

/**
 * Parse Meta's webhook payload into a simple { from, body } or null if not a text message.
 */
export function parseIncomingWhatsApp(payload: Record<string, unknown>): WAIncomingMessage {
  try {
    const entry = (payload.entry as Record<string, unknown>[] | undefined)?.[0]
    const changes = (entry?.changes as Record<string, unknown>[] | undefined)?.[0]
    const value = changes?.value as Record<string, unknown> | undefined
    const messages = value?.messages as Record<string, unknown>[] | undefined
    const msg = messages?.[0]

    if (!msg || msg.type !== 'text') return null

    const textObj = msg.text as { body?: string } | undefined
    if (!textObj?.body) return null

    return {
      from: String(msg.from ?? ''),
      body: textObj.body,
      messageId: String(msg.id ?? ''),
      timestamp: String(msg.timestamp ?? ''),
    }
  } catch {
    return null
  }
}
