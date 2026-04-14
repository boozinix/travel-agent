import { ConversationState } from '@prisma/client'
import { prisma } from './db'
import { MVP_ROUTES, getNextDates, formatDateLabel, toISODate, type MVPRoute } from './routes'
import { searchMVPRoute, formatMVPFlightLine } from './mvpSearch'

type ConversationContext = {
  routeId?: 'A' | 'B'
  dates?: string[]       // YYYY-MM-DD[]
  dateLabels?: string[]
  chosenDate?: string
}

// identifier is either a phone number or a Telegram chat ID (numeric string)
export async function processIncomingMessage(identifier: string, messageBody: string): Promise<string> {
  let user = await prisma.user.findUnique({
    where: { phoneNumber: identifier },
    include: { preferences: true },
  })
  if (!user) {
    // If identifier looks like a Telegram chat ID (all digits), also set telegramChatId
    const isTelegramId = /^\d+$/.test(identifier)
    await prisma.user.create({
      data: {
        phoneNumber: identifier,
        ...(isTelegramId ? { telegramChatId: identifier } : {}),
      },
    })
    user = await prisma.user.findUniqueOrThrow({
      where: { phoneNumber: identifier },
      include: { preferences: true },
    })
  }

  let conversation = await prisma.conversation.findFirst({
    where: { userId: user.id, state: { not: ConversationState.DONE } },
    orderBy: { createdAt: 'desc' },
  })

  const trimmed = messageBody.trim().toLowerCase()
  const isReset = trimmed === 'reset'

  if (!conversation || conversation.state === ConversationState.DONE || isReset) {
    if (isReset && conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.DONE },
      })
    }
    conversation = await prisma.conversation.create({
      data: { userId: user.id, phoneNumber: identifier, state: ConversationState.IDLE },
    })
    if (isReset) {
      return buildMainMenu()
    }
  }

  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, direction: 'INBOUND', body: messageBody },
  })

  let replyText = "I didn't catch that. Type A, B, or reset."
  let nextState = conversation.state

  try {
    switch (conversation.state) {
      case ConversationState.IDLE: {
        const pick = trimmed
        if (pick === 'a' || pick === 'b') {
          const route = MVP_ROUTES.find((r) => r.id === pick.toUpperCase())!
          const dates = getNextDates(route.dayOfWeek, 3)
          const labels = dates.map(formatDateLabel)
          const isos = dates.map(toISODate)

          const ctx: ConversationContext = {
            routeId: route.id,
            dates: isos,
            dateLabels: labels,
          }
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { context: JSON.stringify(ctx) },
          })

          replyText = `${route.label} — pick a ${route.dayName}:\n`
          for (let i = 0; i < labels.length; i++) {
            replyText += `${i + 1}. ${labels[i]}\n`
          }
          replyText += '\nReply 1, 2, or 3.'
          nextState = ConversationState.ASK_TRIP_DATE
        } else {
          replyText = buildMainMenu()
          nextState = ConversationState.IDLE
        }
        break
      }

      case ConversationState.ASK_TRIP_DATE: {
        const num = parseInt(trimmed, 10)
        const ctx: ConversationContext = JSON.parse(conversation.context || '{}')
        if (!ctx.dates || !ctx.routeId) {
          replyText = "Something went wrong. Type 'reset' to start over."
          nextState = ConversationState.ERROR
          break
        }

        if (num >= 1 && num <= ctx.dates.length) {
          const chosenDate = ctx.dates[num - 1]
          const chosenLabel = ctx.dateLabels?.[num - 1] ?? chosenDate
          const route = MVP_ROUTES.find((r) => r.id === ctx.routeId)!

          ctx.chosenDate = chosenDate
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { context: JSON.stringify(ctx) },
          })

          replyText = `Searching ${route.label} flights for ${chosenLabel}…`

          await prisma.pendingOffer.deleteMany({ where: { conversationId: conversation.id } })

          const flights = await searchMVPRoute(route, chosenDate)

          if (flights.length > 0) {
            replyText = `${route.label} — ${chosenLabel}:\n\n`
            for (let i = 0; i < flights.length; i++) {
              replyText += `${i + 1}. ${formatMVPFlightLine(flights[i])}\n`
            }
            replyText += "\nReply with the number for the booking link, or 'reset' to start over."

            await Promise.all(
              flights.map((f, i) =>
                prisma.pendingOffer.create({
                  data: {
                    conversationId: conversation.id,
                    offerIndex: i + 1,
                    originAirport: f.originAirport,
                    destinationAirport: f.destinationAirport,
                    departureDate: chosenDate,
                    airline: f.airline,
                    flightNumber: f.flightNumber,
                    departureTimeLocal: f.departureTime,
                    arrivalTimeLocal: f.arrivalTime,
                    priceCurrency: f.currency,
                    priceAmount: f.price,
                    cabin: 'ECONOMY',
                    rawOffer: JSON.stringify(f),
                    bookingLink: f.bookingLink || 'https://www.google.com/travel/flights',
                  },
                })
              )
            )
            nextState = ConversationState.CONFIRM_OPTION
          } else {
            replyText = `No nonstop flights found for ${chosenLabel}. Try another date or type 'reset'.`
            nextState = ConversationState.ASK_TRIP_DATE
          }

          // Mark any open ReminderLogs as responded since user is engaging
          await prisma.reminderLog.updateMany({
            where: { userId: user.id, respondedAt: null },
            data: { respondedAt: new Date() },
          })
        } else {
          replyText = `Reply 1, 2, or 3 to pick a date. Or 'reset' to start over.`
        }
        break
      }

      case ConversationState.CONFIRM_OPTION: {
        const num = parseInt(trimmed, 10)
        if (!isNaN(num)) {
          const offer = await prisma.pendingOffer.findFirst({
            where: { conversationId: conversation.id, offerIndex: num },
          })
          if (offer?.bookingLink) {
            replyText = `${offer.airline} ${offer.originAirport}→${offer.destinationAirport} $${offer.priceAmount}\n\nBook here: ${offer.bookingLink}\n\nType A or B to search again, or 'reset'.`
            nextState = ConversationState.DONE

            // Mark any open ReminderLogs as responded
            await prisma.reminderLog.updateMany({
              where: { userId: user.id, respondedAt: null },
              data: { respondedAt: new Date() },
            })
          } else {
            replyText = 'Invalid option. Pick a number from the list above.'
          }
        } else {
          replyText = 'Reply with a flight number (1, 2, 3…) or type reset.'
        }
        break
      }

      default:
        replyText = buildMainMenu()
        nextState = ConversationState.IDLE
        break
    }
  } catch (err: unknown) {
    console.error('State Machine Error:', err)
    replyText = "Something went wrong. Type 'reset' to try again."
    nextState = ConversationState.ERROR
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: nextState },
  })

  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, direction: 'OUTBOUND', body: replyText },
  })

  return replyText
}

function buildMainMenu(): string {
  return `Travel Agent — pick a route:\n\nA. NYC → SFO (Fridays)\nB. SFO → NYC (Sundays)\n\nReply A or B.`
}
