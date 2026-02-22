import { describe, it, expect } from 'vitest'
import { isLeaveAvailable, getLeaveConflicts } from './leaveAvailability'
import type { Soldier, LeaveAssignment } from '../models'

function makeSoldier(overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: 's1', name: 'Test', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<LeaveAssignment> = {}): LeaveAssignment {
  return {
    id: 'a1', soldierId: 's1', startDate: '2026-03-20', endDate: '2026-03-22',
    leaveType: 'After', isWeekend: true, isLocked: false, createdAt: '2026-02-01T00:00:00',
    ...overrides,
  }
}

describe('Leave Availability', () => {
  describe('isLeaveAvailable', () => {
    it('returns true when no existing assignments', () => {
      const soldier = makeSoldier()
      expect(isLeaveAvailable(soldier, '2026-03-20', '2026-03-22', [])).toBe(true)
    })

    it('returns false when dates overlap with existing assignment', () => {
      const soldier = makeSoldier()
      const existing = [makeAssignment({ soldierId: 's1', startDate: '2026-03-20', endDate: '2026-03-23' })]
      expect(isLeaveAvailable(soldier, '2026-03-21', '2026-03-24', existing)).toBe(false)
    })

    it('returns true when dates do not overlap', () => {
      const soldier = makeSoldier()
      const existing = [makeAssignment({ soldierId: 's1', startDate: '2026-03-20', endDate: '2026-03-22' })]
      expect(isLeaveAvailable(soldier, '2026-03-23', '2026-03-25', existing)).toBe(true)
    })

    it('only checks assignments for the same soldier', () => {
      const soldier = makeSoldier({ id: 's1' })
      const otherSoldierAssignment = [makeAssignment({ soldierId: 's2', startDate: '2026-03-20', endDate: '2026-03-22' })]
      expect(isLeaveAvailable(soldier, '2026-03-20', '2026-03-22', otherSoldierAssignment)).toBe(true)
    })

    it('returns false when request is outside service period', () => {
      const soldier = makeSoldier({ serviceStart: '2026-03-01', serviceEnd: '2026-06-30' })
      expect(isLeaveAvailable(soldier, '2026-07-01', '2026-07-03', [])).toBe(false)
    })

    it('returns false for discharged soldiers', () => {
      const soldier = makeSoldier({ status: 'Discharged' })
      expect(isLeaveAvailable(soldier, '2026-03-20', '2026-03-22', [])).toBe(false)
    })
  })

  describe('getLeaveConflicts', () => {
    it('returns empty array when no conflicts', () => {
      const soldier = makeSoldier()
      expect(getLeaveConflicts(soldier, '2026-03-20', '2026-03-22', [])).toHaveLength(0)
    })

    it('returns overlap conflict when dates collide', () => {
      const soldier = makeSoldier()
      const existing = [makeAssignment({ soldierId: 's1', startDate: '2026-03-21', endDate: '2026-03-23' })]
      const conflicts = getLeaveConflicts(soldier, '2026-03-20', '2026-03-22', existing)
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts[0].type).toBe('OVERLAPPING_ASSIGNMENT')
    })

    it('returns service period conflict when out of range', () => {
      const soldier = makeSoldier({ serviceEnd: '2026-06-30' })
      const conflicts = getLeaveConflicts(soldier, '2026-07-01', '2026-07-03', [])
      expect(conflicts.length).toBeGreaterThan(0)
    })
  })
})
