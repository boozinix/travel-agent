import { createOpenAI } from '@ai-sdk/openai'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { prisma } from './db'
import { searchFlights } from './flightSearch'

const CONVERSATION_EXPIRE_HOURS = 24
const MAX_HISTORY_MESSAGES = 20

function buildSystemPrompt(userName: string | null, prefs: {
  preferredAirlines?: string
  seatPreference?: string | null
  nonstopOnly?: boolean
  maxPrice?: number | null
} | null): string {
  const today = new Date().toISOString().split('T')[0]
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  let profileSection = ''
  if (userName) {
    profileSection += `User's name: ${userName}\n`
  } else {
    profileSection += `User's name: Unknown — ask for their name first before anything else. Use saveUserName to store it.\n`
  }

  if (prefs) {
    const parts: string[] = []
    if (prefs.preferredAirlines) parts.push(`Preferred airlines: ${prefs.preferredAirlines}`)
    if (prefs.seatPreference) parts.push(`Seat preference: ${prefs.seatPreference}`)
    if (prefs.nonstopOnly) parts.push(`Prefers nonstop flights`)
    if (prefs.maxPrice) parts.push(`Max price: $${prefs.maxPrice}`)
    if (parts.length > 0) {
      profileSection += `Preferences: ${parts.join(', ')}\n`
    } else {
      profileSection += `Preferences: None saved yet\n`
    }
  } else {
    profileSection += `Preferences: None saved yet\n`
  }

  return `You are a friendly flight booking assistant on Telegram called Textpedia. Today is ${dayName}, ${today}.

${profileSection}
BEHAVIOR RULES:
1. If the user's name is unknown, greet them warmly and ask for their name first. Once they tell you, use the saveUserName tool immediately.
2. After learning their name, ask ONE question: "Do you have any airline preferences, seat preferences (window/aisle), or do you prefer nonstop flights?" Use saveUserPreferences to store their answer. If they say no or want to skip, move on.
3. For flight requests, parse: origin city, destination city, departure date, and optionally return date.
4. Convert city names to IATA airport codes (New York = JFK, San Francisco = SFO, Los Angeles = LAX, Chicago = ORD, London = LHR, Paris = CDG, etc.). For cities with multiple airports, use the main one.
5. Priority for preferences: What the user says in this message > Their saved profile > Sensible defaults.
6. If critical info is missing (origin or destination), ask ONE clarifying question, then search.
7. If date is missing, assume the next reasonable date and tell the user what you assumed.
8. Call the searchFlights tool to find flights. For round trips, call it twice (outbound leg, then return leg).
9. Present results clearly:
   - Show up to 5 flights
   - Format: "1. Airline $Price | ORIGIN→DEST departure–arrival"
   - Use 12-hour times (e.g., 7:30pm not 19:30)
   - Put each booking link on its own line so Telegram makes it clickable
   - If both Basic Economy and Standard Economy links are available, show both
10. When the user picks a flight by number, show that flight's booking link prominently.
11. Be concise. No walls of text. No emojis unless the user uses them.
12. If the user says something unrelated to flights, gently redirect: "I help with flight bookings! Try something like 'Find me a flight from NYC to LA next Friday.'"
13. For "new search" or "start over", just help with the new request directly.
14. Remember: you are providing BOOKING LINKS. The user clicks the link and books directly with the airline. You do not process payments.`
}

export async function processV2Message(
  chatId: string,
  text: string,
  username?: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return 'The bot is not configured yet. Please try again later.'
  }

  // 1. Look up or create user by telegramChatId
  let user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    include: { preferences: true },
  })

  if (!user) {
    // Also check if a V1 user exists with this chatId in phoneNumber
    user = await prisma.user.findFirst({
      where: { phoneNumber: chatId },
      include: { preferences: true },
    })
    if (user && !user.telegramChatId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      })
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        phoneNumber: chatId,
        telegramChatId: chatId,
        name: username || null,
      },
      include: { preferences: true },
    })
  }

  // 2. Find active V2 conversation or create one
  let conversation = await prisma.conversation.findFirst({
    where: {
      userId: user.id,
      source: 'v2-telegram',
      state: { not: 'DONE' },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Auto-expire old conversations
  if (conversation) {
    const ageHours = (Date.now() - conversation.updatedAt.getTime()) / (1000 * 60 * 60)
    if (ageHours > CONVERSATION_EXPIRE_HOURS) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: 'DONE' },
      })
      conversation = null
    }
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        phoneNumber: chatId,
        source: 'v2-telegram',
        state: 'IDLE',
      },
    })
  }

  // 3. Save inbound message
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      body: text,
    },
  })

  // 4. Load conversation history
  const history = await prisma.conversationMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: MAX_HISTORY_MESSAGES,
  })

  const messages: { role: 'user' | 'assistant'; content: string }[] = history.map((m) => ({
    role: m.direction === 'INBOUND' ? 'user' as const : 'assistant' as const,
    content: m.body,
  }))

  // 5. Build system prompt
  const prefs = user.preferences
    ? {
        preferredAirlines: user.preferences.preferredAirlines || undefined,
        seatPreference: user.preferences.seatPreference,
        nonstopOnly: user.preferences.nonstopOnly,
        maxPrice: user.preferences.maxPrice,
      }
    : null

  const systemPrompt = buildSystemPrompt(user.name, prefs)

  // 6. Call DeepSeek
  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  })

  const userId = user.id

  const result = await generateText({
    model: deepseek('deepseek-chat'),
    system: systemPrompt,
    messages,
    maxSteps: 6,
    tools: {
      searchFlights: tool({
        description: 'Search for flights between two airports on a specific date. Returns flight options with prices and booking links.',
        parameters: z.object({
          origin: z.string().describe('IATA airport code for origin (e.g., JFK, SFO, LHR)'),
          destination: z.string().describe('IATA airport code for destination (e.g., LAX, CDG, NRT)'),
          dateFrom: z.string().describe('Departure date in YYYY-MM-DD format'),
          dateTo: z.string().describe('Same as dateFrom for one-way search'),
        }),
        execute: async ({ origin, destination, dateFrom, dateTo }) => {
          console.log(`[V2 AI] Searching: ${origin} → ${destination} on ${dateFrom}`)
          try {
            const results = await searchFlights({
              origin,
              destination,
              dateFrom,
              dateTo,
              preferences: prefs ? {
                nonstopOnly: prefs.nonstopOnly,
                maxPrice: prefs.maxPrice,
                preferredAirlines: prefs.preferredAirlines,
              } : undefined,
            })
            return results
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            console.error(`[V2 AI] Flight search error:`, msg)
            return { error: `Flight search failed: ${msg}` }
          }
        },
      }),

      saveUserName: tool({
        description: "Save the user's name. Call this when the user tells you their name.",
        parameters: z.object({
          name: z.string().describe("The user's name"),
        }),
        execute: async ({ name }) => {
          await prisma.user.update({
            where: { id: userId },
            data: { name },
          })
          console.log(`[V2 AI] Saved name: ${name} for user ${userId}`)
          return { success: true, name }
        },
      }),

      saveUserPreferences: tool({
        description: "Save or update the user's flight preferences. Call this when the user mentions airline preferences, seat preferences, nonstop preference, or budget.",
        parameters: z.object({
          preferredAirlines: z.string().optional().describe('Comma-separated airline names or IATA codes (e.g., "Delta, United" or "DL, UA")'),
          seatPreference: z.enum(['window', 'aisle']).optional().describe('Seat preference'),
          nonstopOnly: z.boolean().optional().describe('Whether user prefers nonstop flights'),
          maxPrice: z.number().optional().describe('Maximum price in USD'),
        }),
        execute: async (prefData) => {
          const data: Record<string, unknown> = {}
          if (prefData.preferredAirlines !== undefined) data.preferredAirlines = prefData.preferredAirlines
          if (prefData.seatPreference !== undefined) data.seatPreference = prefData.seatPreference
          if (prefData.nonstopOnly !== undefined) data.nonstopOnly = prefData.nonstopOnly
          if (prefData.maxPrice !== undefined) data.maxPrice = prefData.maxPrice

          await prisma.preference.upsert({
            where: { userId },
            create: {
              userId,
              preferredAirlines: prefData.preferredAirlines ?? '',
              seatPreference: prefData.seatPreference ?? null,
              nonstopOnly: prefData.nonstopOnly ?? false,
              maxPrice: prefData.maxPrice ?? null,
            },
            update: data,
          })
          console.log(`[V2 AI] Saved preferences for user ${userId}:`, prefData)
          return { success: true, saved: prefData }
        },
      }),
    },
  })

  const reply = result.text || "I couldn't generate a response. Please try again."

  // 7. Save outbound message
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      body: reply,
    },
  })

  // Touch conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  })

  return reply
}
