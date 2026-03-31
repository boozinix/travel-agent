import { NextResponse } from 'next/server'
import { processIncomingMessage } from '@/lib/stateMachine'
import { parseIncomingWhatsApp, sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * GET — Meta webhook verification challenge.
 * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * POST — Incoming WhatsApp messages from Meta Cloud API.
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json()

    const msg = parseIncomingWhatsApp(payload)

    if (!msg) {
      return NextResponse.json({ status: 'ignored' })
    }

    const phoneNumber = msg.from.startsWith('+') ? msg.from : `+${msg.from}`

    const replyText = await processIncomingMessage(phoneNumber, msg.body)

    await sendWhatsAppMessage(msg.from, replyText)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
