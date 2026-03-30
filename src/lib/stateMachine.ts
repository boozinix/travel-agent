import { ConversationState } from '@prisma/client'
import { prisma } from './db'
import { formatFlightLine, preferenceFromPrisma, searchFlights } from './flightSearch'
import { normalizeDateForTequila } from './dates'

function parseRoute(messageBody: string): { origin: string; destination: string } | null {
  const lower = messageBody.toLowerCase()
  const idx = lower.indexOf(' to ')
  if (idx === -1) return null
  const origin = messageBody.slice(0, idx).trim().toUpperCase()
  const destination = messageBody.slice(idx + 4).trim().toUpperCase()
  if (!origin || !destination) return null
  return { origin, destination }
}

export async function processIncomingMessage(phoneNumber: string, messageBody: string): Promise<string> {
  let user = await prisma.user.findUnique({
    where: { phoneNumber },
    include: { preferences: true },
  })
  if (!user) {
    await prisma.user.create({ data: { phoneNumber } })
    user = await prisma.user.findUniqueOrThrow({
      where: { phoneNumber },
      include: { preferences: true },
    })
  }

  let conversation = await prisma.conversation.findFirst({
    where: { userId: user.id, state: { not: ConversationState.DONE } },
    orderBy: { createdAt: 'desc' },
  })

  const isReset = messageBody.toLowerCase().trim() === 'reset'

  if (!conversation || conversation.state === ConversationState.DONE || isReset) {
    if (isReset && conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.DONE },
      })
    }
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        phoneNumber,
        state: ConversationState.IDLE,
      },
    })

    if (isReset) {
      return "Conversation reset. Where would you like to fly from, and where to? (e.g. NYC to SFO)"
    }
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      body: messageBody,
    },
  })

  let replyText = "I didn't quite catch that."
  let nextState = conversation.state

  try {
    switch (conversation.state) {
      case ConversationState.IDLE: {
        const route = parseRoute(messageBody)
        if (route) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { context: JSON.stringify(route) },
          })
          replyText = `Got it, ${route.origin} to ${route.destination}. What date do you want to fly? (e.g. 23/04/2026 or 2026-04-23)`
          nextState = ConversationState.SHOW_OPTIONS
        } else {
          replyText =
            'Welcome to your Travel Agent assistant! Send your route like: NYC to SFO — then I will ask for your travel date.'
          nextState = ConversationState.ASK_TRIP_DATE
        }
        break
      }

      case ConversationState.ASK_TRIP_DATE: {
        const route = parseRoute(messageBody)
        if (route) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { context: JSON.stringify(route) },
          })
          replyText = `Got it, ${route.origin} to ${route.destination}. What date do you want to fly? (e.g. 23/04/2026 or 2026-04-23)`
          nextState = ConversationState.SHOW_OPTIONS
        } else {
          replyText = "Please format your route like this: 'NYC to SFO'."
        }
        break
      }

      case ConversationState.SHOW_OPTIONS: {
        const context = JSON.parse(conversation.context || '{}') as { origin?: string; destination?: string }
        if (!context.origin || !context.destination) {
          replyText = "I lost your route — type 'reset' and send origin to destination again."
          nextState = ConversationState.ERROR
          break
        }

        const dateRaw = messageBody.trim()
        const tequilaDate = normalizeDateForTequila(dateRaw)

        replyText = 'Searching for flights… one moment.'

        await prisma.pendingOffer.deleteMany({ where: { conversationId: conversation.id } })

        const flights = await searchFlights({
          origin: context.origin,
          destination: context.destination,
          dateFrom: tequilaDate,
          dateTo: tequilaDate,
          preferences: preferenceFromPrisma(user.preferences),
        })

        if (flights.length > 0) {
          replyText = 'Here are top options for your date:\n'
          for (let i = 0; i < flights.length; i++) {
            const f = flights[i]
            replyText += `${i + 1}. ${formatFlightLine(f)}\n`
          }
          replyText += "\nReply with the option number for the booking link, or type 'reset' to start over."

          await Promise.all(
            flights.map((f, index) =>
              prisma.pendingOffer.create({
                data: {
                  conversationId: conversation.id,
                  offerIndex: index + 1,
                  originAirport: context.origin!,
                  destinationAirport: context.destination!,
                  departureDate: dateRaw,
                  airline: f.airline,
                  flightNumber: f.flightNumber,
                  departureTimeLocal: f.departureTime,
                  arrivalTimeLocal: f.arrivalTime,
                  priceCurrency: f.currency,
                  priceAmount: f.price,
                  cabin: 'ECONOMY',
                  rawOffer: JSON.stringify(f),
                  bookingLink: f.bookingLink || 'https://www.kiwi.com',
                },
              })
            )
          )
          nextState = ConversationState.CONFIRM_OPTION
        } else {
          replyText =
            "Sorry, no flights for that date. Try another date or type 'reset' for a new route."
          nextState = ConversationState.SHOW_OPTIONS
        }
        break
      }

      case ConversationState.CONFIRM_OPTION: {
        const optionNum = parseInt(messageBody.trim(), 10)
        if (!isNaN(optionNum)) {
          const offer = await prisma.pendingOffer.findFirst({
            where: { conversationId: conversation.id, offerIndex: optionNum },
          })
          if (offer?.bookingLink) {
            replyText = `Great choice! Booking link: ${offer.bookingLink}\n\nHave a safe trip! Reply anytime to search again.`
            nextState = ConversationState.DONE
          } else {
            replyText = 'That option is not available. Pick a number from the list above.'
            nextState = ConversationState.CONFIRM_OPTION
          }
        } else {
          replyText = 'Reply with a number from the options I sent (e.g. 1 or 2).'
          nextState = ConversationState.CONFIRM_OPTION
        }
        break
      }

      default:
        replyText = 'Something went wrong. Type reset to try again.'
        nextState = ConversationState.ERROR
        break
    }
  } catch (err: unknown) {
    console.error('State Machine Error:', err)
    replyText = "Oops — try again or type 'reset'."
    nextState = ConversationState.ERROR
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: nextState },
  })

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      body: replyText,
    },
  })

  return replyText
}
