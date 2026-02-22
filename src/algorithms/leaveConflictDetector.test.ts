import { describe, it, expect } from 'vitest'
import { detectLeaveConflicts } from './leaveConflictDetector'
import type { Soldier, LeaveAssignment, LeaveSchedule, AppConfig } from '../models'

function makeSoldier(id: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id, name: `Soldier ${id}`, role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeAssignment(id: string, soldierId: string, start: string, end: string): LeaveAssignment {
  return {
    id, soldierId,
    startDate: start, endDate: end,
    leaveType: 'After', isWeekend: false, isLocked: false,
    createdAt: '2026-02-01T00:00:00',
  }
}

const BASE_CONFIG: Partial<AppConfig> = {
  minBasePresence: 50,
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
}

const SOLDIERS = [
  makeSoldier('s1'),
  makeSoldier('s2'),
  makeSoldier('s3'),
  makeSoldier('s4'),
]

describe('Leave Conflict Detector', () => {
  it('returns no conflicts for an empty schedule', () => {
    const schedule: LeaveSchedule = {
      startDate: '2026-03-01', endDate: '2026-03-31',
      assignments: [], conflicts: [],
    }
    const result = detectLeaveConflicts(schedule, SOLDIERS, BASE_CONFIG as AppConfig)
    expect(result).toHaveLength(0)
  })

  it('returns no conflicts when presence is within limits', () => {
    // 1 out of 4 on leave = 75% present ≥ 50%
    const schedule: LeaveSchedule = {
      startDate: '2026-03-01', endDate: '2026-03-31',
      assignments: [makeAssignment('a1', 's1', '2026-03-20', '2026-03-22')],
      conflicts: [],
    }
    const result = detectLeaveConflicts(schedule, SOLDIERS, BASE_CONFIG as AppConfig)
    expect(result.filter(c => c.type === 'INSUFFICIENT_BASE_PRESENCE')).toHaveLength(0)
  })

  it('detects INSUFFICIENT_BASE_PRESENCE when too many soldiers on leave', () => {
    // 4 soldiers, threshold 75% = need 3 present → at most 1 can be on leave
    // s1 + s2 on leave simultaneously → 50% present < 75%
    const schedule: LeaveSchedule = {
      startDate: '2026-03-01', endDate: '2026-03-31',
      assignments: [
        makeAssignment('a1', 's1', '2026-03-20', '2026-03-22'),
        makeAssignment('a2', 's2', '2026-03-20', '2026-03-22'),
      ],
      conflicts: [],
    }
    const config = { ...BASE_CONFIG, minBasePresence: 75 } as AppConfig
    const result = detectLeaveConflicts(schedule, SOLDIERS, config)
    expect(result.some(c => c.type === 'INSUFFICIENT_BASE_PRESENCE')).toBe(true)
  })

  it('detects OVER_QUOTA when soldier exceeds leave quota', () => {
    // Schedule: March 20-29 = 10 days
    // Quota: (10 / 10) * 4 = 4 days per soldier
    // s1 has 5 days leave (20-24) → OVER_QUOTA
    const schedule: LeaveSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-29',
      assignments: [makeAssignment('a1', 's1', '2026-03-20', '2026-03-24')],
      conflicts: [],
    }
    const result = detectLeaveConflicts(schedule, SOLDIERS, BASE_CONFIG as AppConfig)
    expect(result.some(c => c.type === 'OVER_QUOTA')).toBe(true)
    expect(result.find(c => c.type === 'OVER_QUOTA')?.affectedSoldierIds).toContain('s1')
  })

  it('does not flag soldiers within leave quota', () => {
    // Schedule: March 20-29 = 10 days
    // Quota: (10 / 10) * 4 = 4 days per soldier
    // s1 has exactly 4 days leave (20-23) → no violation
    const schedule: LeaveSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-29',
      assignments: [makeAssignment('a1', 's1', '2026-03-20', '2026-03-23')],
      conflicts: [],
    }
    const result = detectLeaveConflicts(schedule, SOLDIERS, BASE_CONFIG as AppConfig)
    expect(result.filter(c => c.type === 'OVER_QUOTA')).toHaveLength(0)
  })
})
