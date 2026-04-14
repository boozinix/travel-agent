import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { MVP_ROUTES, getNextDates, formatDateLabel } from '@/lib/routes'

const FOLLOWUP_INTERVALS = [
  2 * 60 * 60 * 1000,   // 2 hours after attempt 1
  18 * 60 * 60 * 1000,  // 18 hours after attempt 2
]
const MAX_ATTEMPTS = 3

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const ownerChatId = process.env.V1_USER_TELEGRAM_CHAT_ID
  if (!ownerChatId) return NextResponse.json({ skipped: true })

  const now = Date.now()
  let sentCount = 0

  // Find all unanswered reminder logs with attempts < MAX_ATTEMPTS
  const logs = await prisma.reminderLog.findMany({
    where: { respondedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    include: { user: true },
  })

  for (const log of logs) {
    const intervalMs = FOLLOWUP_INTERVALS[log.attempts - 1]
    if (!intervalMs) continue

    const timeSinceSent = now - log.sentAt.getTime()
    if (timeSinceSent < intervalMs) continue

    // Time to follow up
    const route = MVP_ROUTES.find((r) => r.id === log.routeId)
    if (!route) continue

    const chatId = log.user.telegramChatId ?? log.user.phoneNumber
    const dates = getNextDates(route.dayOfWeek, 3)
    const dateLines = dates.map((d, i) => `${i + 1}. ${formatDateLabel(d)}`).join('\n')
    const message = `⏰ Reminder: ${route.label} — which ${route.dayName}?\n\n${dateLines}\n\nReply 1, 2, or 3. (or "skip")`

    await sendTelegramMessage(chatId, message)
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { attempts: log.attempts + 1, sentAt: new Date() },
    })

    sentCount++
  }

  return NextResponse.json({ sent: sentCount })
}
