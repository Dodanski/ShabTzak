import { describe, it, expect } from 'vitest'
import { buildAvailabilityMatrix } from './availabilityMatrix'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

function makeSoldier(id: string): Soldier {
  return {
    id, name: `Soldier ${id}`, role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  }
}

function makeTask(id: string, startTime: string, endTime: string): Task {
  return {
    id, taskType: 'Guard', startTime, endTime,
    durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
    minRestAfter: 6, isSpecial: false,
  }
}

function makeTaskAssignment(taskId: string, soldierId: string): TaskAssignment {
  return {
    scheduleId: `sched-${taskId}`, taskId, soldierId,
    assignedRole: 'Driver', isLocked: false,
    createdAt: '2026-02-01T00:00:00', createdBy: 'scheduler',
  }
}

function makeLeaveAssignment(soldierId: string, start: string, end: string): LeaveAssignment {
  return {
    id: `leave-${soldierId}`, soldierId,
    startDate: start, endDate: end,
    leaveType: 'After', isWeekend: false, isLocked: false,
    createdAt: '2026-02-01T00:00:00',
  }
}

const SOLDIERS = [makeSoldier('s1'), makeSoldier('s2'), makeSoldier('s3')]
const DATES = ['2026-03-20', '2026-03-21']

describe('buildAvailabilityMatrix', () => {
  it('marks all soldiers as available when no assignments exist', () => {
    const matrix = buildAvailabilityMatrix(SOLDIERS, [], [], [], DATES)

    expect(matrix.get('2026-03-20')?.get('s1')).toBe('available')
    expect(matrix.get('2026-03-20')?.get('s2')).toBe('available')
    expect(matrix.get('2026-03-21')?.get('s3')).toBe('available')
  })

  it('marks soldier on leave as on-leave', () => {
    const leave = makeLeaveAssignment('s1', '2026-03-20', '2026-03-21')
    const matrix = buildAvailabilityMatrix(SOLDIERS, [], [], [leave], DATES)

    expect(matrix.get('2026-03-20')?.get('s1')).toBe('on-leave')
    expect(matrix.get('2026-03-21')?.get('s1')).toBe('on-leave')
    expect(matrix.get('2026-03-20')?.get('s2')).toBe('available')
  })

  it('marks soldier with task on that day as on-task', () => {
    const task = makeTask('t1', '2026-03-20T08:00:00Z', '2026-03-20T16:00:00Z')
    const assignment = makeTaskAssignment('t1', 's2')
    const matrix = buildAvailabilityMatrix(SOLDIERS, [task], [assignment], [], DATES)

    expect(matrix.get('2026-03-20')?.get('s2')).toBe('on-task')
    expect(matrix.get('2026-03-21')?.get('s2')).toBe('available') // next day: available
  })

  it('on-leave takes priority over on-task', () => {
    const task = makeTask('t1', '2026-03-20T08:00:00Z', '2026-03-20T16:00:00Z')
    const taskAssignment = makeTaskAssignment('t1', 's1')
    const leaveAssignment = makeLeaveAssignment('s1', '2026-03-20', '2026-03-20')
    const matrix = buildAvailabilityMatrix(SOLDIERS, [task], [taskAssignment], [leaveAssignment], DATES)

    expect(matrix.get('2026-03-20')?.get('s1')).toBe('on-leave')
  })

  it('handles multi-day tasks spanning multiple dates', () => {
    // task spans March 20-21 (e.g. overnight Pillbox)
    const task = makeTask('t1', '2026-03-20T22:00:00Z', '2026-03-21T06:00:00Z')
    const assignment = makeTaskAssignment('t1', 's3')
    const matrix = buildAvailabilityMatrix(SOLDIERS, [task], [assignment], [], DATES)

    expect(matrix.get('2026-03-20')?.get('s3')).toBe('on-task')
    expect(matrix.get('2026-03-21')?.get('s3')).toBe('on-task')
  })

  it('returns an entry for every date and soldier', () => {
    const matrix = buildAvailabilityMatrix(SOLDIERS, [], [], [], DATES)

    for (const date of DATES) {
      expect(matrix.has(date)).toBe(true)
      for (const s of SOLDIERS) {
        expect(matrix.get(date)?.has(s.id)).toBe(true)
      }
    }
  })
})
