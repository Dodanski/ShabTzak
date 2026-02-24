import { WEEKEND_DAY_INDICES } from '../constants'

/**
 * Check if a date falls on a weekend (Friday or Saturday)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay()
  return WEEKEND_DAY_INDICES.includes(dayOfWeek)
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.round((end.getTime() - start.getTime()) / msPerDay)
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2)
}

/**
 * Add days to a date (negative to subtract)
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Format datetime as ISO string
 */
export function formatDateTime(date: Date): string {
  return date.toISOString()
}

/**
 * Get date range between two dates (inclusive)
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Formats "YYYY-MM-DD..." as "DD/MM"
 */
export function formatDisplayDate(iso: string): string {
  const date = iso.split('T')[0]
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

/**
 * Check if a date is within service period
 */
export function isWithinServicePeriod(
  date: Date,
  serviceStart: string,
  serviceEnd: string
): boolean {
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const start = parseDate(serviceStart)
  const end = parseDate(serviceEnd)
  return checkDate >= start && checkDate <= end
}
