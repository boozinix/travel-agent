import type { Preference } from '@prisma/client'
import { searchFlightsAmadeus } from './amadeus'

export type FlightSearchResult = {
  id: string
  airline: string
  flightNumber: string
  price: number
  currency: string
  departureTime: string
  arrivalTime: string
  bookingLink: string
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

/**
 * Normalize user-typed dates to YYYY-MM-DD (what Ignav expects).
 * Accepts: "23/04/2026", "2026-04-23", "04-23-2026", or already YYYY-MM-DD.
 */
function normalizeDate(input: string): string {
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return s
}

type IgnavSegment = {
  marketing_carrier_code?: string
  flight_number?: string
  operating_carrier_name?: string
  departure_airport?: string
  departure_time_local?: string
  arrival_airport?: string
  arrival_time_local?: string
  duration_minutes?: number
}

type IgnavItinerary = {
  ignav_id?: string
  price?: { amount?: number; currency?: string }
  outbound?: { carrier?: string; segments?: IgnavSegment[]; duration_minutes?: number }
  cabin_class?: string
}

async function fetchBookingLink(apiKey: string, ignavId: string): Promise<string> {
  try {
    const res = await fetch('https://ignav.com/api/fares/booking-links', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignav_id: ignavId }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const links = data?.booking_links as { url?: string }[] | undefined
    return links?.[0]?.url ?? ''
  } catch {
    return ''
  }
}

export async function searchFlights(params: {
  origin: string
  destination: string
  dateFrom: string
  dateTo: string
  preferences?: FlightPreferenceInput | null
}): Promise<FlightSearchResult[]> {
  const apiKey = process.env.IGNAV_API_KEY
  const date = normalizeDate(params.dateFrom)
  const prefs = params.preferences

  // Try Amadeus first if credentials are available
  if (process.env.AMADEUS_CLIENT_ID) {
    try {
      const amadeusResults = await searchFlightsAmadeus({
        origin: params.origin,
        destination: params.destination,
        date,
        nonstopOnly: prefs?.nonstopOnly ?? false,
        max: 10,
      })
      if (amadeusResults.length > 0) {
        return applyPreferenceFilters(amadeusResults, prefs, 5)
      }
    } catch (err) {
      console.warn('[Amadeus] Search error, falling back to Ignav:', err)
    }
  }

  if (!apiKey) {
    const o = params.origin.toUpperCase()
    const d = params.destination.toUpperCase()
    const mock: FlightSearchResult[] = [
      {
        id: `mock-${o}-1`,
        airline: 'Delta',
        flightNumber: 'DL407',
        price: 289,
        currency: 'USD',
        departureTime: `${date}T17:30:00`,
        arrivalTime: `${date}T20:45:00`,
        bookingLink: `https://www.delta.com/us/en/flight-search/book-a-flight?tripType=ONE_WAY&fromAirport=${o}&toAirport=${d}&departureDate=${date}&paxCount=1&cabinType=MAIN_CABIN`,
        segmentCount: 1,
      },
      {
        id: `mock-${o}-2`,
        airline: 'United',
        flightNumber: 'UA681',
        price: 315,
        currency: 'USD',
        departureTime: `${date}T19:15:00`,
        arrivalTime: `${date}T22:30:00`,
        bookingLink: `https://www.united.com/en/us/flifo/summary?type=booking&from=${o}&to=${d}&departure=${date}&cabin=ECONOMY&pax=1:0:0`,
        segmentCount: 1,
      },
      {
        id: `mock-${o}-3`,
        airline: 'American',
        flightNumber: 'AA253',
        price: 274,
        currency: 'USD',
        departureTime: `${date}T20:30:00`,
        arrivalTime: `${date}T23:45:00`,
        bookingLink: `https://www.aa.com/booking/find-flights?locale=en_US&origin=${o}&destination=${d}&departDate=${date}&adults=1&cabinType=coach&tripType=OneWay`,
        segmentCount: 1,
      },
    ]
    return applyPreferenceFilters(mock, prefs, 5)
  }

  const body: Record<string, string | number | boolean> = {
    origin: params.origin.trim().toUpperCase(),
    destination: params.destination.trim().toUpperCase(),
    departure_date: date,
  }

  if (prefs?.nonstopOnly) {
    body.stops = 0
  }

  const res = await fetch('https://ignav.com/api/fares/one-way', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.warn(`[Ignav] API error: ${res.status} ${errText} — using fallback links`)
  }

  const data = res.ok ? await res.json() : { itineraries: [] }
  const itineraries = (data?.itineraries ?? []) as IgnavItinerary[]
  if (itineraries.length === 0) {
    // Ignav returned no results — fall back to direct airline booking links
    console.warn(`[Ignav] No itineraries returned — using fallback direct airline links`)
    const o = params.origin.toUpperCase()
    const d = params.destination.toUpperCase()
    const fallback: FlightSearchResult[] = [
      {
        id: 'fallback-1',
        airline: 'Delta',
        flightNumber: 'DL',
        price: 0,
        currency: 'USD',
        departureTime: `${date}T19:00:00`,
        arrivalTime: `${date}T22:15:00`,
        bookingLink: `https://www.delta.com/us/en/flight-search/book-a-flight?tripType=ONE_WAY&fromAirport=${o}&toAirport=${d}&departureDate=${date}&paxCount=1&cabinType=MAIN_CABIN`,
        segmentCount: 1,
      },
      {
        id: 'fallback-2',
        airline: 'United',
        flightNumber: 'UA',
        price: 0,
        currency: 'USD',
        departureTime: `${date}T20:00:00`,
        arrivalTime: `${date}T23:15:00`,
        bookingLink: `https://www.united.com/en/us/flifo/summary?type=booking&from=${o}&to=${d}&departure=${date}&cabin=ECONOMY&pax=1:0:0`,
        segmentCount: 1,
      },
      {
        id: 'fallback-3',
        airline: 'American',
        flightNumber: 'AA',
        price: 0,
        currency: 'USD',
        departureTime: `${date}T21:00:00`,
        arrivalTime: `${date}T00:15:00`,
        bookingLink: `https://www.aa.com/booking/find-flights?locale=en_US&origin=${o}&destination=${d}&departDate=${date}&adults=1&cabinType=coach&tripType=OneWay`,
        segmentCount: 1,
      },
    ]
    return fallback
  }

  const mapped: FlightSearchResult[] = itineraries.map((it) => {
    const segs = it.outbound?.segments ?? []
    const first = segs[0]
    return {
      id: it.ignav_id ?? '',
      airline: it.outbound?.carrier ?? first?.operating_carrier_name ?? 'Unknown',
      flightNumber: first
        ? `${first.marketing_carrier_code ?? ''}${first.flight_number ?? ''}`
        : '—',
      price: it.price?.amount ?? 0,
      currency: it.price?.currency ?? 'USD',
      departureTime: first?.departure_time_local ?? '',
      arrivalTime: segs.length > 0 ? (segs[segs.length - 1].arrival_time_local ?? '') : '',
      bookingLink: '',
      segmentCount: segs.length || 1,
    }
  })

  const sorted = [...mapped].sort((a, b) => a.price - b.price)
  const filtered = applyPreferenceFilters(sorted, prefs, 5)

  const withLinks = await Promise.all(
    filtered.map(async (f) => {
      if (f.id) {
        const link = await fetchBookingLink(apiKey, f.id)
        if (link) return { ...f, bookingLink: link }
      }
      return { ...f, bookingLink: `https://www.google.com/travel/flights?q=${params.origin}+to+${params.destination}+${date}` }
    })
  )

  return withLinks
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
