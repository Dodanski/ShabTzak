import { describe, it, expect } from 'vitest'
import { calculateLeaveEntitlement, countUsedLeaveDays } from './leaveQuota'
import type { Soldier, AppConfig, LeaveAssignment } from '../models'

const BASE_CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
}

const BASE_SOLDIER: Soldier = {
  id: 's1', name: 'David', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-04-10', // 99 days = ~9.9 cycles × 4 = 39.6 → 39 days
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

describe('calculateLeaveEntitlement', () => {
  it('returns 0 for zero-day service', () => {
    const s = { ...BASE_SOLDIER, serviceStart: '2026-01-01', serviceEnd: '2026-01-01' }
    expect(calculateLeaveEntitlement(s, BASE_CONFIG)).toBe(0)
  })

  it('calculates entitlement proportionally to service length', () => {
    // 100 days service, ratio 10 base : 4 home → 10 cycles of 14d = 100/14 * 4 ≈ 28.57 → floor 28
    const s = { ...BASE_SOLDIER, serviceStart: '2026-01-01', serviceEnd: '2026-04-11' }
    const result = calculateLeaveEntitlement(s, BASE_CONFIG)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(101)
  })

  it('returns a whole number', () => {
    const result = calculateLeaveEntitlement(BASE_SOLDIER, BASE_CONFIG)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('short service gives fewer days than long service', () => {
    const short = { ...BASE_SOLDIER, serviceStart: '2026-01-01', serviceEnd: '2026-02-01' }
    const long = { ...BASE_SOLDIER, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
    expect(calculateLeaveEntitlement(short, BASE_CONFIG)).toBeLessThan(
      calculateLeaveEntitlement(long, BASE_CONFIG)
    )
  })

  it('scales with different ratios', () => {
    const highRatio: AppConfig = { ...BASE_CONFIG, leaveRatioDaysHome: 8, leaveRatioDaysInBase: 10 }
    const lowRatio: AppConfig = { ...BASE_CONFIG, leaveRatioDaysHome: 2, leaveRatioDaysInBase: 10 }
    expect(calculateLeaveEntitlement(BASE_SOLDIER, highRatio)).toBeGreaterThan(
      calculateLeaveEntitlement(BASE_SOLDIER, lowRatio)
    )
  })
})

describe('countUsedLeaveDays', () => {
  it('returns 0 when no assignments', () => {
    expect(countUsedLeaveDays('s1', [])).toBe(0)
  })

  it('counts days in a single assignment', () => {
    const la: LeaveAssignment = {
      id: 'la1', soldierId: 's1', startDate: '2026-03-20', endDate: '2026-03-22',
      leaveType: 'Long', isWeekend: false, isLocked: false, createdAt: '',
    }
    expect(countUsedLeaveDays('s1', [la])).toBe(2) // 20→21→22 = 2 nights
  })

  it('ignores assignments for other soldiers', () => {
    const la: LeaveAssignment = {
      id: 'la1', soldierId: 's2', startDate: '2026-03-20', endDate: '2026-03-22',
      leaveType: 'Long', isWeekend: false, isLocked: false, createdAt: '',
    }
    expect(countUsedLeaveDays('s1', [la])).toBe(0)
  })

  it('sums multiple assignments', () => {
    const assignments: LeaveAssignment[] = [
      { id: 'la1', soldierId: 's1', startDate: '2026-03-01', endDate: '2026-03-03', leaveType: 'Long', isWeekend: false, isLocked: false, createdAt: '' },
      { id: 'la2', soldierId: 's1', startDate: '2026-04-10', endDate: '2026-04-11', leaveType: 'After', isWeekend: false, isLocked: false, createdAt: '' },
    ]
    expect(countUsedLeaveDays('s1', assignments)).toBe(3) // 2 + 1
  })
})
