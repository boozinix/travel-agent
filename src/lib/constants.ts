/** Local dev port — keep in sync with `package.json` scripts. */
export const APP_DEV_PORT = 3020

/**
 * Public URL for webhooks (Twilio must match this exactly when validating signatures).
 * Local: http://localhost:3020 — use ngrok URL + set TWILIO_WEBHOOK_URL when testing SMS.
 */
export function getPublicBaseUrl(): string {
  const fromEnv =
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return `http://localhost:${APP_DEV_PORT}`
}

export function webhookUrl(path: string): string {
  const base = getPublicBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
