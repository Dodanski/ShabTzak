import { describe, it, expect } from 'vitest'
import { scheduleLeave } from './leaveScheduler'
import type { Soldier, LeaveRequest, LeaveAssignment, AppConfig } from '../models'

function makeSoldier(id: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id, name: `Soldier ${id}`, role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeRequest(id: string, soldierId: string, start: string, end: string, overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id, soldierId,
    startDate: start, endDate: end,
    leaveType: 'After',
    constraintType: 'Preference',
    priority: 5,
    status: 'Pending',
    ...overrides,
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

describe('Leave Scheduler', () => {
  it('assigns a single valid request', () => {
    const requests = [makeRequest('r1', 's1', '2026-03-20', '2026-03-22')]
    const result = scheduleLeave(requests, SOLDIERS, [], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].soldierId).toBe('s1')
  })

  it('returns empty assignments when no requests', () => {
    const result = scheduleLeave([], SOLDIERS, [], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.assignments).toHaveLength(0)
  })

  it('skips requests that would violate base presence', () => {
    // 4 soldiers, 50% threshold = need at least 2 present
    // s1 + s2 on leave → 2 present (50%) — OK
    // Adding s3 → 1 present (25%) — BLOCKED
    const requests = [
      makeRequest('r1', 's1', '2026-03-20', '2026-03-22'),
      makeRequest('r2', 's2', '2026-03-20', '2026-03-22'),
      makeRequest('r3', 's3', '2026-03-20', '2026-03-22'),
    ]
    const result = scheduleLeave(requests, SOLDIERS, [], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.assignments).toHaveLength(2)
  })

  it('prioritizes requests with higher priority score', () => {
    // All soldiers present except possibly 1; 50% threshold allows 2 on leave out of 4
    // s1 priority 8, s2 priority 3 → s1 processed first and approved
    const requests = [
      makeRequest('r1', 's1', '2026-03-20', '2026-03-22', { priority: 8 }),
      makeRequest('r2', 's2', '2026-03-20', '2026-03-22', { priority: 3 }),
    ]
    const result = scheduleLeave(requests, SOLDIERS, [], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    // Both can go (2 on leave, 2 present = 50%)
    const ids = result.assignments.map(a => a.soldierId)
    expect(ids).toContain('s1')
    expect(ids).toContain('s2')
  })

  it('respects fairness ordering: lower fairness soldier gets leave first when same priority', () => {
    // 75% threshold = 3 out of 4 must be present → only 1 can go
    // s1 has high fairness (lots of hours worked), s2 has none → s2 should be assigned
    const soldiers = [
      makeSoldier('s1', { hoursWorked: 40 }), // fairness = 40
      makeSoldier('s2'),                        // fairness = 0
      makeSoldier('s3'),
      makeSoldier('s4'),
    ]
    const requests = [
      makeRequest('r1', 's1', '2026-03-20', '2026-03-22', { priority: 5 }),
      makeRequest('r2', 's2', '2026-03-20', '2026-03-22', { priority: 5 }),
    ]
    const config = { ...BASE_CONFIG, minBasePresence: 75 } as AppConfig
    const result = scheduleLeave(requests, soldiers, [], config, '2026-03-01', '2026-03-31')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].soldierId).toBe('s2')
  })

  it('preserves locked existing assignments', () => {
    const locked: LeaveAssignment = {
      id: 'locked-1', soldierId: 's1',
      startDate: '2026-03-10', endDate: '2026-03-12',
      leaveType: 'After', isWeekend: false, isLocked: true,
      createdAt: '2026-02-01T00:00:00',
    }
    const result = scheduleLeave([], SOLDIERS, [locked], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].id).toBe('locked-1')
    expect(result.assignments[0].isLocked).toBe(true)
  })

  it('skips requests for soldiers with overlapping existing assignment', () => {
    const existing: LeaveAssignment = {
      id: 'existing-1', soldierId: 's1',
      startDate: '2026-03-20', endDate: '2026-03-22',
      leaveType: 'After', isWeekend: false, isLocked: false,
      createdAt: '2026-02-01T00:00:00',
    }
    const requests = [makeRequest('r1', 's1', '2026-03-21', '2026-03-23')]
    const result = scheduleLeave(requests, SOLDIERS, [existing], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.assignments.some(a => a.id === 'existing-1')).toBe(true)
    expect(result.assignments.filter(a => a.id !== 'existing-1')).toHaveLength(0)
  })

  it('returns a LeaveSchedule with the correct date range', () => {
    const result = scheduleLeave([], SOLDIERS, [], BASE_CONFIG as AppConfig, '2026-03-01', '2026-03-31')
    expect(result.startDate).toBe('2026-03-01')
    expect(result.endDate).toBe('2026-03-31')
    expect(result.conflicts).toHaveLength(0)
  })
})
