import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { searchFlights } from '@/lib/flightSearch';

export const maxDuration = 30;

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      "It looks like you haven't added your DEEPSEEK_API_KEY to the .env file yet!", 
      { status: 500 }
    );
  }

  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  });

  const { messages } = await req.json();

  const rawResult = streamText({
    model: deepseek('deepseek-chat'),
    system: `You are a friendly flight booking assistant. Use the searchFlights tool to find flights.

IMPORTANT RULES:
- Always use specific IATA airport codes. For New York use JFK. Never use 'NYC' as the destination.
- For San Francisco use SFO.
- Only call searchFlights ONCE per user request with the best airport code. Do NOT retry with multiple airports.
- If results come back with price=$0, it means live pricing wasn't available but you still have DIRECT BOOKING LINKS to Delta, United, and American Airlines — present all 3 links clearly so the user can check prices and book directly.
- Always show the bookingLink as a clickable URL for each airline.
- Be concise and helpful.`,
    messages,
    maxSteps: 4, // allow cyclical tool calling 
    tools: {
      searchFlights: tool({
        description: 'Search for flight options and pricing.',
        parameters: z.object({
          origin: z.string().describe('IATA airport code for origin (e.g. SFO).'),
          destination: z.string().describe('IATA airport code for destination (e.g. NYC, LHR)'),
          dateFrom: z.string().describe('Departure date in YYYY-MM-DD form.'),
          dateTo: z.string().describe('Must exactly match dateFrom.')
        }),
        execute: async ({ origin, destination, dateFrom, dateTo }) => {
          try {
            console.log(`[AI Bot] Searching flights: ${origin} to ${destination} on ${dateFrom}`);
            const results = await searchFlights({ origin, destination, dateFrom, dateTo });
            return results;
          } catch (e: any) {
            console.error(`[AI Bot] Flight search error:`, e.message);
            return { error: `Flight search failed. Tell the user the airline API returned an error: ${e.message}` };
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
