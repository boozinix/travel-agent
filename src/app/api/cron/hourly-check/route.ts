import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { notificationMatchesHour } from '@/lib/dates'
import { formatFlightLine, preferenceFromPrisma, searchFlights } from '@/lib/flightSearch'
import { isWhatsAppConfigured, sendWhatsAppMessage } from '@/lib/whatsapp'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER

const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null

async function sendMessage(to: string, body: string): Promise<boolean> {
  if (isWhatsAppConfigured()) {
    const phone = to.replace(/^\+/, '')
    return sendWhatsAppMessage(phone, body)
  }

  if (twilioClient && fromPhoneNumber) {
    await twilioClient.messages.create({ body, from: fromPhoneNumber, to })
    return true
  }

  console.warn('No messaging provider configured — would send to', to, ':', body)
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

    const activeSchedules = await prisma.schedule.findMany({
      where: {
        active: true,
        notificationDay: currentDay,
      },
      include: { user: { include: { preferences: true } } },
    })

    const due = activeSchedules.filter((s) => notificationMatchesHour(s.notificationTime, currentHour))

    let sentCount = 0

    for (const schedule of due) {
      if (!schedule.user?.phoneNumber) continue

      const targetDates = schedule.targetDates
        .split(',')
        .map((d: string) => d.trim())
        .filter(Boolean)

      let messageBody = `Travel alert: ${schedule.directionLabel}\n${schedule.originAirport} → ${schedule.destinationAirport}\n\n`

      for (const date of targetDates) {
        try {
          const flights = await searchFlights({
            origin: schedule.originAirport,
            destination: schedule.destinationAirport,
            dateFrom: date,
            dateTo: date,
            preferences: preferenceFromPrisma(schedule.user.preferences),
          })

          if (flights.length > 0) {
            const best = flights[0]
            messageBody += `${date}: ${formatFlightLine(best)}\n${best.bookingLink}\n\n`
          } else {
            messageBody += `${date}: No flights found.\n\n`
          }
        } catch (e) {
          console.error('Cron flight search error:', e)
          messageBody += `${date}: Search failed (check IGNAV_API_KEY).\n\n`
        }
      }

      const sent = await sendMessage(schedule.user.phoneNumber, messageBody)
      if (sent) sentCount++
    }

    return NextResponse.json({
      success: true,
      currentDay,
      currentHour,
      matchedSchedules: due.length,
      sentMessages: sentCount,
    })
  } catch (err: unknown) {
    console.error('Cron job error:', err)
    const message = err instanceof Error ? err.message : 'Cron failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
