import { describe, it, expect } from 'vitest'
import {
  getSoldiersOnLeave,
  getPresenceCount,
  meetsMinimumPresence,
} from './presenceValidator'
import type { Soldier, LeaveAssignment, AppConfig } from '../models'

function makeSoldier(id: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id, name: `Soldier ${id}`, role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeAssignment(soldierId: string, start: string, end: string): LeaveAssignment {
  return {
    id: `assign-${soldierId}`, soldierId,
    startDate: start, endDate: end,
    leaveType: 'After', isWeekend: false, isLocked: false,
    createdAt: '2026-02-01T00:00:00',
  }
}

const BASE_CONFIG: Partial<AppConfig> = {
  minBasePresence: 70,
}

describe('Presence Validator', () => {
  const soldiers = [
    makeSoldier('s1'),
    makeSoldier('s2'),
    makeSoldier('s3'),
    makeSoldier('s4'),
    makeSoldier('s5', { status: 'Injured' }),
  ]

  const assignments: LeaveAssignment[] = [
    makeAssignment('s1', '2026-03-20', '2026-03-23'),
    makeAssignment('s2', '2026-03-21', '2026-03-22'),
  ]

  describe('getSoldiersOnLeave', () => {
    it('returns soldiers on leave on a given date', () => {
      const onLeave = getSoldiersOnLeave(soldiers, assignments, '2026-03-21')
      const ids = onLeave.map(s => s.id)
      expect(ids).toContain('s1')
      expect(ids).toContain('s2')
    })

    it('returns empty array when no one is on leave', () => {
      const onLeave = getSoldiersOnLeave(soldiers, assignments, '2026-04-01')
      expect(onLeave).toHaveLength(0)
    })

    it('excludes soldiers not on leave on that date', () => {
      const onLeave = getSoldiersOnLeave(soldiers, assignments, '2026-03-22')
      const ids = onLeave.map(s => s.id)
      expect(ids).toContain('s1')
      // s2 ends on 22nd — still on leave (inclusive end date)
      expect(ids).toContain('s2')
      expect(ids).not.toContain('s3')
    })
  })

  describe('getPresenceCount', () => {
    it('counts active soldiers not on leave', () => {
      // 5 soldiers: s5 is injured (excluded), s1+s2 on leave → 2 present
      const count = getPresenceCount(soldiers, assignments, '2026-03-21')
      expect(count).toBe(2) // s3, s4
    })

    it('counts all active soldiers when nobody is on leave', () => {
      const count = getPresenceCount(soldiers, [], '2026-03-21')
      expect(count).toBe(4) // s1-s4 (s5 injured)
    })
  })

  describe('meetsMinimumPresence', () => {
    it('returns false when presence drops below minimum percentage', () => {
      // 2 out of 4 active = 50%, threshold = 70%
      expect(meetsMinimumPresence(soldiers, assignments, '2026-03-21', BASE_CONFIG as AppConfig)).toBe(false)
    })

    it('returns true when presence meets minimum', () => {
      // Only s1 on leave: 3/4 = 75% ≥ 70%
      const oneLeave = [makeAssignment('s1', '2026-03-25', '2026-03-26')]
      expect(meetsMinimumPresence(soldiers, oneLeave, '2026-03-25', BASE_CONFIG as AppConfig)).toBe(true)
    })

    it('returns true when no one is on leave', () => {
      expect(meetsMinimumPresence(soldiers, [], '2026-03-21', BASE_CONFIG as AppConfig)).toBe(true)
    })
  })
})
