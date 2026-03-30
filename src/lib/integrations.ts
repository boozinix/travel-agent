import { getPublicBaseUrl } from './constants'

export type IntegrationStatus = {
  database: boolean
  tequila: boolean
  twilio: boolean
  cronSecret: boolean
  publicBaseUrl: string
  smsWebhookUrl: string
}

export function getIntegrationStatus(): IntegrationStatus {
  const base = getPublicBaseUrl()
  return {
    database: Boolean(process.env.DATABASE_URL),
    tequila: Boolean(process.env.TEQUILA_API_KEY),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
    ),
    cronSecret: Boolean(process.env.CRON_SECRET),
    publicBaseUrl: base,
    smsWebhookUrl: `${base}/api/sms`,
  }
}
