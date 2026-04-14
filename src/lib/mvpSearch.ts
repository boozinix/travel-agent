import type { MVPRoute } from './routes'
import type { FlightSearchResult } from './flightSearch'
import { searchFlights } from './flightSearch'

export type ScoredFlight = FlightSearchResult & {
  score: number
  originAirport: string
  destinationAirport: string
}

function depMinutes(isoLike: string): number | null {
  if (!isoLike) return null
  const part = isoLike.includes('T') ? isoLike.split('T')[1] : isoLike
  const m = part.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Search all origin×destination pairs for a route on a given date.
 * Filter to nonstop + departure window, then score using route.priceWeight / route.timeWeight.
 */
export async function searchMVPRoute(
  route: MVPRoute,
  date: string
): Promise<ScoredFlight[]> {
  const pairs: { origin: string; destination: string }[] = []
  for (const o of route.origins) {
    for (const d of route.destinations) {
      pairs.push({ origin: o, destination: d })
    }
  }

  const windowStart = clockToMinutes(route.depWindowStart)
  const windowEnd = clockToMinutes(route.depWindowEnd)
  const prefStart = clockToMinutes(route.preferredTimeStart)
  const prefEnd = clockToMinutes(route.preferredTimeEnd)

  const allFlights: (FlightSearchResult & { originAirport: string; destinationAirport: string })[] = []

  const results = await Promise.allSettled(
    pairs.map(async (pair) => {
      const flights = await searchFlights({
        origin: pair.origin,
        destination: pair.destination,
        dateFrom: date,
        dateTo: date,
        preferences: { nonstopOnly: true },
      })
      return { flights, pair }
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const f of r.value.flights) {
        if (f.segmentCount > 1) continue

        const dep = depMinutes(f.departureTime)
        if (dep === null) continue
        if (dep < windowStart || dep > windowEnd) continue

        allFlights.push({
          ...f,
          originAirport: r.value.pair.origin,
          destinationAirport: r.value.pair.destination,
        })
      }
    }
  }

  if (allFlights.length === 0) return []

  // Deduplicate: keep only the first occurrence of each flightNumber+departureTime combo
  const seen = new Set<string>()
  const unique = allFlights.filter((f) => {
    const key = `${f.flightNumber}|${f.departureTime}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const prices = unique.map((f) => f.price)
  const maxPrice = Math.max(...prices)
  const minPrice = Math.min(...prices)
  const priceRange = maxPrice - minPrice || 1

  const scored: ScoredFlight[] = unique.map((f) => {
    const priceScore = 1 - (f.price - minPrice) / priceRange

    const dep = depMinutes(f.departureTime)!
    let timeScore = 0
    if (dep >= prefStart && dep <= prefEnd) {
      timeScore = 1
    } else {
      const distFromPref = Math.min(
        Math.abs(dep - prefStart),
        Math.abs(dep - prefEnd)
      )
      const maxDist = Math.max(prefStart - windowStart, windowEnd - prefEnd)
      timeScore = Math.max(0, 1 - distFromPref / (maxDist || 1))
    }

    const score = route.priceWeight * priceScore + route.timeWeight * timeScore

    return { ...f, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 5)
}

export function formatMVPFlightLine(f: ScoredFlight): string {
  const dep = f.departureTime.includes('T') ? f.departureTime.split('T')[1].slice(0, 5) : '—'
  const arr = f.arrivalTime.includes('T') ? f.arrivalTime.split('T')[1].slice(0, 5) : '—'
  return `${f.airline} $${f.price} | ${f.originAirport}→${f.destinationAirport} ${dep}–${arr}`
}
