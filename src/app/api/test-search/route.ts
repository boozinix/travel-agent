import { NextResponse } from 'next/server'
import { searchFlights } from '@/lib/flightSearch'

/**
 * GET /api/test-search?from=NYC&to=SFO&date=2026-05-01
 * Quick endpoint to verify Ignav flight search is working.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = url.searchParams.get('from') || 'NYC'
  const to = url.searchParams.get('to') || 'SFO'
  const date = url.searchParams.get('date') || '2026-05-01'

  try {
    const flights = await searchFlights({
      origin: from,
      destination: to,
      dateFrom: date,
      dateTo: date,
    })

    return NextResponse.json({
      query: { from, to, date },
      count: flights.length,
      flights,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
