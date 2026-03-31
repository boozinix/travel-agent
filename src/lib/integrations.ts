import { getPublicBaseUrl } from './constants'
import { isWhatsAppConfigured } from './whatsapp'

export type IntegrationStatus = {
  database: boolean
  ignav: boolean
  twilio: boolean
  whatsapp: boolean
  messaging: boolean
  cronSecret: boolean
  publicBaseUrl: string
  smsWebhookUrl: string
  whatsappWebhookUrl: string
}

export function getIntegrationStatus(): IntegrationStatus {
  const base = getPublicBaseUrl()
  const twilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  )
  const whatsapp = isWhatsAppConfigured()
  return {
    database: Boolean(process.env.DATABASE_URL),
    ignav: Boolean(process.env.IGNAV_API_KEY),
    twilio,
    whatsapp,
    messaging: twilio || whatsapp,
    cronSecret: Boolean(process.env.CRON_SECRET),
    publicBaseUrl: base,
    smsWebhookUrl: `${base}/api/sms`,
    whatsappWebhookUrl: `${base}/api/whatsapp`,
  }
}
