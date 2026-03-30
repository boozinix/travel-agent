import type { Preference } from '@prisma/client'
import { normalizeDateForTequila } from './dates'

export type FlightSearchResult = {
  id: string
  airline: string
  flightNumber: string
  price: number
  currency: string
  departureTime: string
  arrivalTime: string
  bookingLink: string
  /** 1 = nonstop */
  segmentCount: number
}

export type FlightPreferenceInput = {
  maxPrice?: number | null
  nonstopOnly?: boolean
  preferredAirlines?: string
  earliestDepTime?: string | null
  latestDepTime?: string | null
}

export function preferenceFromPrisma(p: Preference | null | undefined): FlightPreferenceInput | null {
  if (!p) return null
  return {
    maxPrice: p.maxPrice,
    nonstopOnly: p.nonstopOnly,
    preferredAirlines: p.preferredAirlines,
    earliestDepTime: p.earliestDepTime,
    latestDepTime: p.latestDepTime,
  }
}

function depMinutes(isoLike: string): number | null {
  if (!isoLike) return null
  const part = isoLike.includes('T') ? isoLike.split('T')[1] : isoLike
  const m = part.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function clockToMinutes(clock: string): number | null {
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function matchesPreferredAirline(flight: FlightSearchResult, preferredRaw: string | undefined): boolean {
  if (!preferredRaw) return true
  const raw = preferredRaw.trim().toLowerCase()
  if (!raw || raw === 'any') return true
  const want = preferredRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  if (want.length === 0) return true
  const airline = flight.airline.toUpperCase()
  return want.some((code) => airline.includes(code) || (code.length <= 3 && airline.startsWith(code)))
}

function applyPreferenceFilters(
  flights: FlightSearchResult[],
  prefs: FlightPreferenceInput | null | undefined,
  take = 5
): FlightSearchResult[] {
  if (!prefs) return flights.slice(0, take)

  const out = flights.filter((f) => {
    if (prefs.nonstopOnly && f.segmentCount > 1) return false
    if (prefs.maxPrice != null && Number.isFinite(prefs.maxPrice) && f.price > prefs.maxPrice) {
      return false
    }
    if (!matchesPreferredAirline(f, prefs.preferredAirlines)) return false

    const dep = depMinutes(f.departureTime)
    if (dep != null && prefs.earliestDepTime) {
      const min = clockToMinutes(prefs.earliestDepTime)
      if (min != null && dep < min) return false
    }
    if (dep != null && prefs.latestDepTime) {
      const max = clockToMinutes(prefs.latestDepTime)
      if (max != null && dep > max) return false
    }
    return true
  })

  return out.slice(0, take)
}

export async function searchFlights(params: {
  origin: string
  destination: string
  dateFrom: string
  dateTo: string
  preferences?: FlightPreferenceInput | null
}): Promise<FlightSearchResult[]> {
  const apiKey = process.env.TEQUILA_API_KEY
  const dateFrom = normalizeDateForTequila(params.dateFrom)
  const dateTo = normalizeDateForTequila(params.dateTo)
  const prefs = params.preferences

  if (!apiKey) {
    console.warn('TEQUILA_API_KEY not set. Returning mock data.')
    const mock: FlightSearchResult[] = [
      {
        id: 'mock-1',
        airline: 'Mock Airline',
        flightNumber: 'MK123',
        price: 199.99,
        currency: 'USD',
        departureTime: '2024-05-01T08:00:00',
        arrivalTime: '2024-05-01T11:00:00',
        bookingLink: 'https://www.kiwi.com',
        segmentCount: 1,
      },
      {
        id: 'mock-2',
        airline: 'Blue Skies',
        flightNumber: 'BS456',
        price: 249.5,
        currency: 'USD',
        departureTime: '2024-05-01T14:30:00',
        arrivalTime: '2024-05-01T17:45:00',
        bookingLink: 'https://www.kiwi.com',
        segmentCount: 1,
      },
    ]
    return applyPreferenceFilters(mock, prefs, 5)
  }

  const url = new URL('https://api.tequila.kiwi.com/v2/search')
  url.searchParams.set('fly_from', params.origin.trim().toUpperCase())
  url.searchParams.set('fly_to', params.destination.trim().toUpperCase())
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  url.searchParams.set('curr', 'USD')
  url.searchParams.set('limit', '15')

  if (prefs?.nonstopOnly) {
    url.searchParams.set('max_stopovers', '0')
  }

  const airlines = prefs?.preferredAirlines?.trim()
  if (airlines && airlines.toLowerCase() !== 'any') {
    const codes = airlines
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((c) => c.length <= 3 && c.length > 0)
    if (codes.length > 0) {
      url.searchParams.set('select_airlines', codes.join(','))
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey: apiKey,
      accept: 'application/json',
    },
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Flight search failed: ${res.status} ${res.statusText} ${errText}`)
  }

  const data = await res.json()
  if (!data.data?.length) return []

  const mapped: FlightSearchResult[] = data.data.map((flight: Record<string, unknown>) => {
    const segments = flight.route as Record<string, unknown>[] | undefined
    const first = segments?.[0]
    const airlinesList = flight.airlines as string[] | undefined
    return {
      id: String(flight.id ?? ''),
      airline: airlinesList?.[0] ?? 'Unknown',
      flightNumber:
        first && typeof first.flight_no !== 'undefined'
          ? String(first.flight_no)
          : '—',
      price: Number(flight.price),
      currency: 'USD',
      departureTime: String(flight.local_departure ?? ''),
      arrivalTime: String(flight.local_arrival ?? ''),
      bookingLink: String(flight.deep_link ?? 'https://www.kiwi.com'),
      segmentCount: segments?.length ?? 1,
    }
  })

  const sorted = [...mapped].sort((a, b) => a.price - b.price)
  return applyPreferenceFilters(sorted, prefs, 5)
}

function formatClockFromIsoLike(s: string): string {
  if (!s) return '—'
  const t = s.includes('T') ? s.split('T')[1] : s
  return t.slice(0, 5)
}

export function formatFlightLine(f: FlightSearchResult): string {
  const dep = formatClockFromIsoLike(f.departureTime)
  const arr = formatClockFromIsoLike(f.arrivalTime)
  const stops = f.segmentCount > 1 ? ` (${f.segmentCount - 1} stop${f.segmentCount > 2 ? 's' : ''})` : ''
  return `${f.airline} $${f.price}  ${dep} → ${arr}${stops}`
}
