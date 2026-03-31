import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { processIncomingMessage } from '@/lib/stateMachine'
import { escapeTwiMLMessage } from '@/lib/twiml'
import { getPublicBaseUrl } from '@/lib/constants'

export async function POST(req: Request) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)

    const authToken = process.env.TWILIO_AUTH_TOKEN
    const shouldValidate =
      authToken && process.env.TWILIO_VALIDATE_SIGNATURE !== 'false'

    if (shouldValidate) {
      const signature = req.headers.get('X-Twilio-Signature')
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? `${getPublicBaseUrl()}/api/sms`
      const body: Record<string, string> = {}
      params.forEach((value, key) => {
        body[key] = value
      })
      if (!signature || !twilio.validateRequest(authToken, signature, webhookUrl, body)) {
        return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 })
      }
    }

    const body = params.get('Body')
    const rawFrom = params.get('From')

    if (!body || !rawFrom) {
      return NextResponse.json(
        { error: 'Missing Body or From (Twilio webhook)' },
        { status: 400 }
      )
    }

    // WhatsApp sends "whatsapp:+15551234567"; normalize to just the phone number
    const from = rawFrom.replace(/^whatsapp:/, '')

    const replyMessage = await processIncomingMessage(from, body)
    const safe = escapeTwiMLMessage(replyMessage)

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safe}</Message>
</Response>`

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    })
  } catch (error) {
    console.error('Error handling SMS from Twilio:', error)
    const fallback = escapeTwiMLMessage('System error. Please try again shortly.')
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${fallback}</Message></Response>`,
      { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  }
}
