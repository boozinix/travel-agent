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

  // "back" from DONE → go back to CONFIRM_OPTION (flight list)
  if (conversation && conversation.state === ConversationState.DONE && trimmed === 'back') {
    const ctx: ConversationContext = JSON.parse(conversation.context || '{}')
    const route = MVP_ROUTES.find((r) => r.id === ctx.routeId)
    if (route && ctx.chosenDate) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.CONFIRM_OPTION },
      })
      // Re-show flight list from pending offers
      const offers = await prisma.pendingOffer.findMany({
        where: { conversationId: conversation.id },
        orderBy: { offerIndex: 'asc' },
      })
      if (offers.length > 0) {
        const chosenLabel = ctx.dateLabels?.[ctx.dates?.indexOf(ctx.chosenDate) ?? 0] ?? ctx.chosenDate
        let replyText = `${route.label} — ${chosenLabel}:\n\n`
        for (const o of offers) {
          replyText += `${o.offerIndex}. ${o.airline} $${o.priceAmount} | ${o.originAirport}→${o.destinationAirport}\n`
        }
        replyText += "\nReply with a number for the booking link, 'back' to pick a different date, or 'reset'."
        await prisma.conversationMessage.create({
          data: { conversationId: conversation.id, direction: 'INBOUND', body: messageBody },
        })
        await prisma.conversationMessage.create({
          data: { conversationId: conversation.id, direction: 'OUTBOUND', body: replyText },
        })
        return replyText
      }
    }
  }

  // "back" from ERROR → go to menu
  if (conversation && conversation.state === ConversationState.ERROR && trimmed === 'back') {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: ConversationState.IDLE },
    })
    return buildMainMenu()
  }

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
          replyText += "\nReply 1, 2, or 3. Or 'back' to change route."
          nextState = ConversationState.ASK_TRIP_DATE
        } else {
          replyText = buildMainMenu()
          nextState = ConversationState.IDLE
        }
        break
      }

      case ConversationState.ASK_TRIP_DATE: {
        const ctx: ConversationContext = JSON.parse(conversation.context || '{}')
        if (!ctx.dates || !ctx.routeId) {
          replyText = "Something went wrong. Type 'reset' to start over."
          nextState = ConversationState.ERROR
          break
        }

        if (trimmed === 'back') {
          replyText = buildMainMenu()
          nextState = ConversationState.IDLE
          break
        }

        const num = parseInt(trimmed, 10)
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
            replyText += "\nReply with a number for the booking link, 'back' to pick a different date, or 'reset'."

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
                    bookingLink: f.bookingLink || '',
                    economyLink: f.economyLink || '',
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
          replyText = `Reply 1, 2, or 3 to pick a date. Or 'back' to change route.`
        }
        break
      }

      case ConversationState.CONFIRM_OPTION: {
        if (trimmed === 'back') {
          const ctx: ConversationContext = JSON.parse(conversation.context || '{}')
          const route = MVP_ROUTES.find((r) => r.id === ctx.routeId)!
          replyText = `${route.label} — pick a ${route.dayName}:\n`
          const labels = ctx.dateLabels ?? ctx.dates ?? []
          for (let i = 0; i < labels.length; i++) {
            replyText += `${i + 1}. ${labels[i]}\n`
          }
          replyText += "\nReply 1, 2, or 3. Or 'back' to change route."
          nextState = ConversationState.ASK_TRIP_DATE
          break
        }

        const num = parseInt(trimmed, 10)
        if (!isNaN(num)) {
          const offer = await prisma.pendingOffer.findFirst({
            where: { conversationId: conversation.id, offerIndex: num },
          })
          if (offer?.bookingLink) {
            replyText = `${offer.airline} ${offer.originAirport}→${offer.destinationAirport} $${offer.priceAmount}\n\nBasic Economy: ${offer.bookingLink}`
            if (offer.economyLink) {
              replyText += `\n\nStandard Economy: ${offer.economyLink}`
            }
            replyText += "\n\nType 'back' to pick a different flight, A or B for a new search, or 'reset'."
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
