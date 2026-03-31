import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MVP_ROUTES, getNextDates, formatDateLabel, toISODate } from '@/lib/routes'
import { searchMVPRoute, formatMVPFlightLine } from '@/lib/mvpSearch'
import { isWhatsAppConfigured, sendWhatsAppMessage } from '@/lib/whatsapp'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER
const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null

async function sendMessage(to: string, body: string): Promise<boolean> {
  if (isWhatsAppConfigured()) {
    return sendWhatsAppMessage(to.replace(/^\+/, ''), body)
  }
  if (twilioClient && fromPhoneNumber) {
    await twilioClient.messages.create({ body, from: fromPhoneNumber, to })
    return true
  }
  console.warn('No messaging provider — would send to', to, ':', body)
  return false
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const now = new Date()
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
    const currentDay = days[now.getDay()]
    const currentHour = now.getHours()

    const users = await prisma.user.findMany()
    let sentCount = 0

    for (const route of MVP_ROUTES) {
      const triggerDay = route.id === 'A' ? 'THURSDAY' : 'THURSDAY'
      const triggerHour = 18

      if (currentDay !== triggerDay || currentHour !== triggerHour) continue

      const dates = getNextDates(route.dayOfWeek, 3)

      for (const user of users) {
        if (!user.phoneNumber) continue

        let body = `${route.label} options:\n\n`

        for (const date of dates) {
          const iso = toISODate(date)
          const label = formatDateLabel(date)
          try {
            const flights = await searchMVPRoute(route, iso)
            if (flights.length > 0) {
              const best = flights[0]
              body += `${label}: ${formatMVPFlightLine(best)}\n`
            } else {
              body += `${label}: No nonstop flights found\n`
            }
          } catch {
            body += `${label}: Search error\n`
          }
        }

        body += '\nReply A or B to browse interactively.'

        const sent = await sendMessage(user.phoneNumber, body)
        if (sent) sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      currentDay,
      currentHour,
      sentMessages: sentCount,
    })
  } catch (err: unknown) {
    console.error('Cron job error:', err)
    const message = err instanceof Error ? err.message : 'Cron failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
