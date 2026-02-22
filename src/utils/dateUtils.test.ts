import { describe, it, expect } from 'vitest'
import {
  isWeekend,
  calculateNights,
  formatDate,
  parseDate,
  isSameDay,
  addDays,
} from './dateUtils'

describe('Date Utils', () => {
  describe('isWeekend', () => {
    it('returns true for Friday', () => {
      const friday = new Date('2026-03-20') // Friday
      expect(isWeekend(friday)).toBe(true)
    })

    it('returns true for Saturday', () => {
      const saturday = new Date('2026-03-21') // Saturday
      expect(isWeekend(saturday)).toBe(true)
    })

    it('returns false for Sunday', () => {
      const sunday = new Date('2026-03-22') // Sunday
      expect(isWeekend(sunday)).toBe(false)
    })

    it('returns false for weekdays', () => {
      const monday = new Date('2026-03-23') // Monday
      expect(isWeekend(monday)).toBe(false)
    })
  })

  describe('calculateNights', () => {
    it('calculates 1 night for consecutive days', () => {
      const start = new Date('2026-03-20')
      const end = new Date('2026-03-21')
      expect(calculateNights(start, end)).toBe(1)
    })

    it('calculates 3 nights correctly', () => {
      const start = new Date('2026-03-20')
      const end = new Date('2026-03-23')
      expect(calculateNights(start, end)).toBe(3)
    })

    it('returns 0 for same day', () => {
      const date = new Date('2026-03-20')
      expect(calculateNights(date, date)).toBe(0)
    })
  })

  describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date('2026-03-20')
      expect(formatDate(date)).toBe('2026-03-20')
    })
  })

  describe('parseDate', () => {
    it('parses ISO date string', () => {
      const date = parseDate('2026-03-20')
      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth()).toBe(2) // 0-indexed
      expect(date.getDate()).toBe(20)
    })
  })

  describe('isSameDay', () => {
    it('returns true for same day', () => {
      const date1 = new Date('2026-03-20T10:00:00')
      const date2 = new Date('2026-03-20T15:00:00')
      expect(isSameDay(date1, date2)).toBe(true)
    })

    it('returns false for different days', () => {
      const date1 = new Date('2026-03-20')
      const date2 = new Date('2026-03-21')
      expect(isSameDay(date1, date2)).toBe(false)
    })
  })

  describe('addDays', () => {
    it('adds days to date', () => {
      const date = new Date('2026-03-20')
      const result = addDays(date, 3)
      expect(formatDate(result)).toBe('2026-03-23')
    })

    it('subtracts days with negative number', () => {
      const date = new Date('2026-03-20')
      const result = addDays(date, -5)
      expect(formatDate(result)).toBe('2026-03-15')
    })
  })
})
