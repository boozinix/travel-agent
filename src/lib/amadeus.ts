import type { FlightSearchResult } from './flightSearch'

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const clientId = process.env.AMADEUS_CLIENT_ID!
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET!

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Amadeus] Token fetch failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000

  cachedToken = { token: data.access_token, expiresAt }
  return data.access_token
}

// Map IATA carrier code to airline name
function carrierName(code: string): string {
  const names: Record<string, string> = {
    UA: 'United',
    DL: 'Delta',
    AA: 'American',
    B6: 'JetBlue',
    WN: 'Southwest',
    AS: 'Alaska',
    F9: 'Frontier',
    NK: 'Spirit',
    BA: 'British Airways',
    VS: 'Virgin Atlantic',
  }
  return names[code] ?? code
}

// Build a direct booking link for an airline given route+date
function buildBookingLink(carrierCode: string, origin: string, dest: string, date: string): string {
  const links: Record<string, string> = {
    UA: `https://www.united.com/en/us/flifo/summary?type=booking&from=${origin}&to=${dest}&departure=${date}&cabin=ECONOMY&pax=1:0:0`,
    DL: `https://www.delta.com/us/en/flight-search/book-a-flight?tripType=ONE_WAY&fromAirport=${origin}&toAirport=${dest}&departureDate=${date}&paxCount=1&cabinType=MAIN_CABIN`,
    AA: `https://www.aa.com/booking/find-flights?locale=en_US&origin=${origin}&destination=${dest}&departDate=${date}&adults=1&cabinType=coach&tripType=OneWay`,
    B6: `https://www.jetblue.com/booking/flights?from=${origin}&to=${dest}&depart=${date}&isMultiCity=false&noOfRoute=1&lang=en&adults=1&children=0&infants=0&sharedMarket=false&roundTripFaresFlag=false`,
    AS: `https://www.alaskaair.com/search/results?O=${origin}&D=${dest}&OD=${date}&A=1&C=0&L=0&FS=false&BE=false`,
  }
  return links[carrierCode] ?? `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${dest}+${date}`
}

export async function searchFlightsAmadeus(params: {
  origin: string
  destination: string
  date: string
  nonstopOnly?: boolean
  max?: number
}): Promise<FlightSearchResult[]> {
  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return []

  const token = await getAmadeusToken()

  const body = {
    originLocationCode: params.origin.toUpperCase(),
    destinationLocationCode: params.destination.toUpperCase(),
    departureDate: params.date,
    adults: 1,
    nonStop: params.nonstopOnly ?? true,
    max: params.max ?? 10,
    currencyCode: 'USD',
  }

  const res = await fetch('https://test.api.amadeus.com/v2/shopping/flight-offers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`[Amadeus] Search failed: ${res.status}`)
    return []
  }

  const data = await res.json()
  const offers = data?.data ?? []

  return offers.map((offer: Record<string, unknown>) => {
    const itin = (offer.itineraries as Record<string, unknown>[])?.[0]
    const segs = (itin?.segments as Record<string, unknown>[]) ?? []
    const firstSeg = segs[0] as Record<string, unknown> | undefined
    const lastSeg = segs[segs.length - 1] as Record<string, unknown> | undefined
    const carrierCode =
      (offer.validatingAirlineCodes as string[])?.[0] ??
      (firstSeg?.carrierCode as string) ??
      'XX'
    const priceObj = offer.price as Record<string, unknown> | undefined
    const price = parseFloat((priceObj?.grandTotal as string) ?? '0')
    const date = params.date

    const firstDep = firstSeg?.departure as Record<string, unknown> | undefined
    const lastArr = lastSeg?.arrival as Record<string, unknown> | undefined

    return {
      id: (offer.id as string) ?? '',
      airline: carrierName(carrierCode),
      flightNumber: firstSeg
        ? `${firstSeg.carrierCode as string}${firstSeg.number as string}`
        : '—',
      price,
      currency: (priceObj?.currency as string) ?? 'USD',
      departureTime: (firstDep?.at as string) ?? '',
      arrivalTime: (lastArr?.at as string) ?? '',
      bookingLink: buildBookingLink(carrierCode, params.origin, params.destination, date),
      segmentCount: segs.length || 1,
    }
  })
}
