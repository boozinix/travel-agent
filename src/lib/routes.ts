/**
 * MVP hardcoded routes.
 *
 * Route A: NYC → SFO (Fridays)
 * Route B: SFO → NYC (Sundays)
 */

export type MVPRoute = {
  id: 'A' | 'B'
  label: string
  origins: string[]
  destinations: string[]
  dayOfWeek: number // 0=Sun … 5=Fri
  dayName: string
  depWindowStart: string // HH:MM (local)
  depWindowEnd: string
  preferredTimeStart: string // ideal dep window for 34% score boost
  preferredTimeEnd: string
}

export const ROUTE_A: MVPRoute = {
  id: 'A',
  label: 'NYC → SFO',
  origins: ['JFK', 'EWR'],
  destinations: ['SFO', 'SJC', 'OAK'],
  dayOfWeek: 5, // Friday
  dayName: 'Friday',
  depWindowStart: '17:00',
  depWindowEnd: '22:00',
  preferredTimeStart: '19:00',
  preferredTimeEnd: '20:00',
}

export const ROUTE_B: MVPRoute = {
  id: 'B',
  label: 'SFO → NYC',
  origins: ['SFO', 'SJC', 'OAK'],
  destinations: ['JFK', 'EWR'],
  dayOfWeek: 0, // Sunday
  dayName: 'Sunday',
  depWindowStart: '14:00',
  depWindowEnd: '22:00',
  preferredTimeStart: '20:00',
  preferredTimeEnd: '21:30',
}

export const MVP_ROUTES = [ROUTE_A, ROUTE_B] as const

/** Get the next N dates for a given day-of-week (0=Sun, 5=Fri, etc.) from today. */
export function getNextDates(dayOfWeek: number, count: number): Date[] {
  const dates: Date[] = []
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let daysAhead = (dayOfWeek - d.getDay() + 7) % 7
  if (daysAhead === 0) daysAhead = 7

  d.setDate(d.getDate() + daysAhead)

  for (let i = 0; i < count; i++) {
    dates.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return dates
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** YYYY-MM-DD for API calls */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
