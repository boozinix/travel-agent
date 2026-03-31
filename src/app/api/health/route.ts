import { NextResponse } from 'next/server'
import { getIntegrationStatus } from '@/lib/integrations'

export async function GET() {
  const integrations = getIntegrationStatus()
  const ready =
    integrations.database && integrations.ignav && integrations.messaging
  return NextResponse.json({
    ok: true,
    ready,
    integrations: {
      database: integrations.database,
      ignav: integrations.ignav,
      whatsapp: integrations.whatsapp,
      twilio: integrations.twilio,
      cronSecret: integrations.cronSecret,
      publicBaseUrl: integrations.publicBaseUrl,
      smsWebhookPath: '/api/sms',
    },
  })
}
