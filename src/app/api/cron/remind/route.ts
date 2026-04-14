import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTelegramMessage } from '@/lib/telegram'
import { MVP_ROUTES, getNextDates, formatDateLabel, toISODate } from '@/lib/routes'

// Called by Vercel Cron:
//   Wednesday 23:00 UTC (6PM ET) with ?route=A
//   Thursday  23:00 UTC (6PM ET) with ?route=B
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const routeId = searchParams.get('route') as 'A' | 'B' | null
  if (!routeId || !['A', 'B'].includes(routeId)) {
    return NextResponse.json({ error: 'Missing ?route=A or ?route=B' }, { status: 400 })
  }

  const route = MVP_ROUTES.find((r) => r.id === routeId)!

  // Get V1 owner (the user with TELEGRAM_BOT_TOKEN_V1 chat ID)
  const ownerChatId = process.env.V1_USER_TELEGRAM_CHAT_ID
  if (!ownerChatId) {
    return NextResponse.json({ error: 'V1_USER_TELEGRAM_CHAT_ID not set' }, { status: 500 })
  }

  // Find user
  const user = await prisma.user.findFirst({
    where: { OR: [{ telegramChatId: ownerChatId }, { phoneNumber: ownerChatId }] },
  })
  if (!user) {
    return NextResponse.json({ error: 'V1 user not found in DB' }, { status: 404 })
  }

  // Don't remind if there's already an active conversation
  const activeConv = await prisma.conversation.findFirst({
    where: { userId: user.id, state: { notIn: ['DONE', 'ERROR'] } },
  })
  if (activeConv) {
    return NextResponse.json({ skipped: true, reason: 'active conversation exists' })
  }

  // Get next 3 dates for this route
  const dates = getNextDates(route.dayOfWeek, 3)
  const weekOf = toISODate(dates[0])

  // Don't send if already reminded for this week and user responded
  const existingLog = await prisma.reminderLog.findFirst({
    where: { userId: user.id, routeId, weekOf, respondedAt: { not: null } },
  })
  if (existingLog) {
    return NextResponse.json({ skipped: true, reason: 'already responded this week' })
  }

  // Build message
  const dateLines = dates.map((d, i) => `${i + 1}. ${formatDateLabel(d)}`).join('\n')
  const message = `✈️ ${route.label} — which ${route.dayName} do you want to book?\n\n${dateLines}\n\nReply 1, 2, or 3. (or "skip")`

  await sendTelegramMessage(ownerChatId, message)

  // Log the reminder
  await prisma.reminderLog.create({
    data: { userId: user.id, routeId, weekOf, attempts: 1 },
  })

  return NextResponse.json({ sent: true, route: routeId, weekOf })
}
