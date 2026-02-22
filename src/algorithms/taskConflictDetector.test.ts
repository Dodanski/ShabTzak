import { describe, it, expect } from 'vitest'
import { detectTaskConflicts } from './taskConflictDetector'
import type { Soldier, Task, TaskAssignment, TaskSchedule } from '../models'

function makeSoldier(id: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id, name: `Soldier ${id}`, role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id, taskType: 'Guard',
    startTime: '2026-03-20T08:00:00Z',
    endTime: '2026-03-20T16:00:00Z',
    durationHours: 8,
    roleRequirements: [{ role: 'Driver', count: 1 }],
    minRestAfter: 6,
    isSpecial: false,
    ...overrides,
  }
}

function makeAssignment(taskId: string, soldierId: string, role = 'Driver'): TaskAssignment {
  return {
    scheduleId: `sched-${taskId}`, taskId, soldierId,
    assignedRole: role as TaskAssignment['assignedRole'],
    isLocked: false,
    createdAt: '2026-02-01T00:00:00', createdBy: 'scheduler',
  }
}

describe('Task Conflict Detector', () => {
  it('returns no conflicts for an empty schedule', () => {
    const schedule: TaskSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-20',
      assignments: [], conflicts: [],
    }
    const result = detectTaskConflicts(schedule, [], [])
    expect(result).toHaveLength(0)
  })

  it('detects REST_PERIOD_VIOLATION when soldier has insufficient rest', () => {
    // task1: ends 14:00Z, rest=6h → can't start until 20:00Z
    // task2: starts 18:00Z → violation
    const task1 = makeTask('t1', {
      endTime: '2026-03-20T14:00:00Z',
      minRestAfter: 6,
    })
    const task2 = makeTask('t2', {
      startTime: '2026-03-20T18:00:00Z',
      endTime: '2026-03-20T22:00:00Z',
    })
    const schedule: TaskSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-20',
      assignments: [
        makeAssignment('t1', 's1'),
        makeAssignment('t2', 's1'),
      ],
      conflicts: [],
    }
    const result = detectTaskConflicts(schedule, [task1, task2], [makeSoldier('s1')])
    expect(result.some(c => c.type === 'REST_PERIOD_VIOLATION')).toBe(true)
    expect(result.find(c => c.type === 'REST_PERIOD_VIOLATION')?.affectedSoldierIds).toContain('s1')
  })

  it('does not flag soldiers with sufficient rest between tasks', () => {
    // task1: ends 08:00Z, rest=6h → available from 14:00Z
    // task2: starts 16:00Z → sufficient rest ✓
    const task1 = makeTask('t1', {
      startTime: '2026-03-20T00:00:00Z',
      endTime: '2026-03-20T08:00:00Z',
      minRestAfter: 6,
    })
    const task2 = makeTask('t2', {
      startTime: '2026-03-20T16:00:00Z',
      endTime: '2026-03-20T22:00:00Z',
    })
    const schedule: TaskSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-20',
      assignments: [
        makeAssignment('t1', 's1'),
        makeAssignment('t2', 's1'),
      ],
      conflicts: [],
    }
    const result = detectTaskConflicts(schedule, [task1, task2], [makeSoldier('s1')])
    expect(result.filter(c => c.type === 'REST_PERIOD_VIOLATION')).toHaveLength(0)
  })

  it('detects NO_ROLE_AVAILABLE when task role requirement is unfulfilled', () => {
    // Task needs 2 Drivers but only 1 assigned
    const task = makeTask('t1', {
      roleRequirements: [{ role: 'Driver', count: 2 }],
    })
    const schedule: TaskSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-20',
      assignments: [makeAssignment('t1', 's1')],
      conflicts: [],
    }
    const result = detectTaskConflicts(schedule, [task], [makeSoldier('s1')])
    expect(result.some(c => c.type === 'NO_ROLE_AVAILABLE')).toBe(true)
    expect(result.find(c => c.type === 'NO_ROLE_AVAILABLE')?.affectedTaskIds).toContain('t1')
  })

  it('does not flag tasks with all role requirements fulfilled', () => {
    const task = makeTask('t1', {
      roleRequirements: [{ role: 'Driver', count: 1 }],
    })
    const schedule: TaskSchedule = {
      startDate: '2026-03-20', endDate: '2026-03-20',
      assignments: [makeAssignment('t1', 's1')],
      conflicts: [],
    }
    const result = detectTaskConflicts(schedule, [task], [makeSoldier('s1')])
    expect(result.filter(c => c.type === 'NO_ROLE_AVAILABLE')).toHaveLength(0)
  })
})
