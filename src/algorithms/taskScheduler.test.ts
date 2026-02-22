import { describe, it, expect } from 'vitest'
import { scheduleTasks } from './taskScheduler'
import type { Soldier, Task, TaskAssignment } from '../models'

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

describe('Task Scheduler', () => {
  it('assigns a soldier to a single task', () => {
    const task = makeTask('t1')
    const soldier = makeSoldier('s1')
    const result = scheduleTasks([task], [soldier], [])
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].soldierId).toBe('s1')
    expect(result.assignments[0].taskId).toBe('t1')
  })

  it('returns empty assignments when no soldiers match role', () => {
    const task = makeTask('t1', { roleRequirements: [{ role: 'Medic', count: 1 }] })
    const soldier = makeSoldier('s1', { role: 'Driver' })
    const result = scheduleTasks([task], [soldier], [])
    expect(result.assignments).toHaveLength(0)
  })

  it('assigns by fairness: lower fairness soldier assigned first', () => {
    // Task needs 1 Driver; 2 Drivers available, only 1 slot
    const task = makeTask('t1', { roleRequirements: [{ role: 'Driver', count: 1 }] })
    const highFairness = makeSoldier('s1', { hoursWorked: 40 }) // fairness = 40
    const lowFairness = makeSoldier('s2')                        // fairness = 0
    const result = scheduleTasks([task], [highFairness, lowFairness], [])
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0].soldierId).toBe('s2')
  })

  it('does not assign soldier still in rest period', () => {
    // task1: ends at 14:00Z, rest=6h → can't start until 20:00Z
    // task2: starts at 18:00Z → within rest period
    const task1 = makeTask('t1', {
      startTime: '2026-03-20T08:00:00Z',
      endTime: '2026-03-20T14:00:00Z',
      minRestAfter: 6,
    })
    const task2 = makeTask('t2', {
      startTime: '2026-03-20T18:00:00Z',
      endTime: '2026-03-20T22:00:00Z',
      minRestAfter: 6,
    })
    const soldier = makeSoldier('s1')
    const existingAssignment: TaskAssignment = {
      scheduleId: 'sched-t1', taskId: 't1', soldierId: 's1',
      assignedRole: 'Driver', isLocked: false,
      createdAt: '2026-02-01T00:00:00', createdBy: 'admin',
    }
    const result = scheduleTasks([task1, task2], [soldier], [existingAssignment])
    // Existing assignment preserved; task2 not assigned (rest violation)
    expect(result.assignments.some(a => a.taskId === 't1')).toBe(true)
    expect(result.assignments.some(a => a.taskId === 't2')).toBe(false)
  })

  it('handles multiple role requirements in one task', () => {
    const task = makeTask('t1', {
      roleRequirements: [
        { role: 'Driver', count: 1 },
        { role: 'Medic', count: 1 },
      ],
    })
    const driver = makeSoldier('s1', { role: 'Driver' })
    const medic = makeSoldier('s2', { role: 'Medic' })
    const result = scheduleTasks([task], [driver, medic], [])
    expect(result.assignments).toHaveLength(2)
    const roles = result.assignments.map(a => a.assignedRole)
    expect(roles).toContain('Driver')
    expect(roles).toContain('Medic')
  })

  it('returns a TaskSchedule with correct date range', () => {
    const task = makeTask('t1', {
      startTime: '2026-03-20T08:00:00Z',
      endTime: '2026-03-20T16:00:00Z',
    })
    const result = scheduleTasks([task], [makeSoldier('s1')], [])
    expect(result.startDate).toBe('2026-03-20')
    expect(result.endDate).toBe('2026-03-20')
  })
})
