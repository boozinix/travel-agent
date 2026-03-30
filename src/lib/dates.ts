/**
 * Tequila / Kiwi search API expects date_from / date_to as dd/mm/yyyy (see Tequila docs).
 */
export function normalizeDateForTequila(input: string): string {
  const trimmed = input.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-')
    return `${d}/${m}/${y}`
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/')
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }

  return trimmed
}

/** Match schedule.notificationTime (e.g. "9:00" or "18:00") to the current local hour. */
export function notificationMatchesHour(notificationTime: string, hour: number): boolean {
  const m = notificationTime.trim().match(/^(\d{1,2})/)
  if (!m) return false
  return parseInt(m[1], 10) === hour
}
