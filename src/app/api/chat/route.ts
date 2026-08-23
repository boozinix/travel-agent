import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { searchFlights, type FlightSearchResult } from '@/lib/flightSearch';

export const maxDuration = 30;

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')}${period}`
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const t = iso.includes('T') ? iso.split('T')[1] : iso
  return to12h(t.slice(0, 5))
}

function formatResultsForLLM(results: FlightSearchResult[]): string {
  // Filter out fallback/mock entries with no real price
  const real = results.filter((r) => r.price > 0)
  if (real.length === 0) return 'No flights found for this route and date. Try a different date or route.'
  let out = ''
  real.forEach((r, i) => {
    out += `${i + 1}. ${r.airline} ${r.flightNumber} — $${r.price} | ${formatTime(r.departureTime)}–${formatTime(r.arrivalTime)}${r.segmentCount > 1 ? ` (${r.segmentCount - 1} stop)` : ' nonstop'}\n`
  })
  return out
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      "It looks like you haven't added your DEEPSEEK_API_KEY to the .env file yet!",
      { status: 500 }
    );
  }

  const today = new Date().toISOString().split('T')[0]
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  });

  const { messages } = await req.json();

  const rawResult = streamText({
    model: deepseek('deepseek-chat'),
    system: `You are a friendly flight booking assistant called Textpedia. Today is ${dayName}, ${today}.

CONVERSATION FLOW — follow these steps IN ORDER. Do NOT skip steps or call searchFlights until you have all 4 pieces.

Step 1: Collect origin, destination, date, and time preference.
  - If the user gives all 4 (e.g. "JFK to LAX Apr 20 morning"), go to Step 2.
  - If anything is missing, ask for ALL missing items in ONE message. Examples:
    - Missing date + time: "What date? And do you prefer morning, afternoon, evening, or anytime?"
    - Missing only time: "Do you prefer morning, afternoon, evening, or anytime?"
    - Missing origin: "Where are you flying from?"
  - IMPORTANT: You MUST ask about time preference if the user hasn't specified one. Do NOT skip this.
  - If the date is in the past (before ${today}), say so and ask for a future date.
  - "Friday" without a date = calculate from today (${today}). Year is always 2026.

Step 2: Search — ONLY after you have origin + destination + date + time preference.
  - Call searchFlights with the IATA codes and date.
  - Convert city names to IATA codes. Also accept codes directly (LGA, DCA, EWR, SJC, etc).

Step 3: Show results as a compact numbered list.
  - Each line: number, airline, flight number, price, departure–arrival times, nonstop/stops.
  - No booking links yet.
  - End with: "Pick a number to get the booking link."
  - Add: "Economy fares shown — say if you want a specific airline, class, or time."

Step 4: When the user picks a number, show that flight's booking link(s) from the raw results.
  - Show both Basic Economy and Standard Economy links if available.
  - Show the full URL so the user can click it.

SMART DEFAULTS (assume — never ask about these):
- Economy cabin, cheapest fares first
- 1 passenger, any airline, nonstop preferred
- Filter out red-eye departures (midnight–5am) unless user asks
- One-way unless user says "round trip" or gives two dates

OTHER:
- For round trips, call searchFlights twice (outbound then return).
- "back" = offer to change date, time, or route. "reset" = start fresh.
- Be concise. No filler.`,
    messages,
    maxSteps: 6,
    tools: {
      searchFlights: tool({
        description: 'Search for flights. Returns real prices and direct airline booking links.',
        parameters: z.object({
          origin: z.string().describe('IATA airport code for origin (e.g. JFK, SFO, LAX)'),
          destination: z.string().describe('IATA airport code for destination (e.g. SFO, JFK, LHR)'),
          dateFrom: z.string().describe('Departure date in YYYY-MM-DD format. Year is 2026.'),
          dateTo: z.string().describe('Same as dateFrom for one-way'),
          nonstopOnly: z.boolean().optional().describe('Filter to nonstop flights only'),
        }),
        execute: async ({ origin, destination, dateFrom, dateTo, nonstopOnly }) => {
          try {
            console.log(`[Chat] Searching: ${origin} → ${destination} on ${dateFrom}`);
            const results = await searchFlights({
              origin,
              destination,
              dateFrom,
              dateTo,
              preferences: nonstopOnly ? { nonstopOnly: true } : undefined,
            });
            // Filter out $0 fallback entries, only pass real priced flights
            const real = results.filter((r) => r.price > 0);
            return { formatted: formatResultsForLLM(real), raw: real };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            console.error(`[Chat] Flight search error:`, msg);
            return { error: `Flight search failed: ${msg}` };
          }
        },
      }),
    },
  });

  // Polyfill for versions where streamText returns a Promise vs directly returning the Stream object
  const result = (rawResult instanceof Promise) ? await rawResult : rawResult;

  // Use the raw data stream parser which perfectly mimics toDataStreamResponse
  try {
    let dataStream: ReadableStream;
    
    if (typeof (result as any).toDataStream === 'function') {
      dataStream = (result as any).toDataStream();
    } else if (typeof (result as any).toAIStream === 'function') {
      dataStream = (result as any).toAIStream();
    } else {
      // Emergency raw stream mapping
      dataStream = (result as any).textStream || (result as any).fullStream;
    }

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch (err) {
    return new Response("AI SDK Stream generation failed.", { status: 500 });
  }
}
