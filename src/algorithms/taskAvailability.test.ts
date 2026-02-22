import { describe, it, expect } from 'vitest'
import { isTaskAvailable, getRestPeriodEnd, hasRequiredRole, checkDrivingHoursLimit } from './taskAvailability'
import type { Soldier, Task, TaskAssignment, AppConfig } from '../models'

const BASE_CONFIG: Partial<AppConfig> = { maxDrivingHours: 8 }

function makeSoldier(overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: 's1', name: 'Test', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', taskType: 'Guard',
    startTime: '2026-03-20T08:00:00', endTime: '2026-03-20T16:00:00',
    durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
    minRestAfter: 6, isSpecial: false,
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    scheduleId: 'sched-1', taskId: 'task-prev', soldierId: 's1',
    assignedRole: 'Driver', isLocked: false,
    createdAt: '2026-02-01T00:00:00', createdBy: 'admin',
    ...overrides,
  }
}

describe('Task Availability', () => {
  describe('getRestPeriodEnd', () => {
    it('adds rest hours to end time', () => {
      const end = getRestPeriodEnd('2026-03-20T16:00:00Z', 6)
      expect(end).toBe('2026-03-20T22:00:00.000Z')
    })

    it('crosses midnight correctly', () => {
      const end = getRestPeriodEnd('2026-03-20T22:00:00Z', 8)
      expect(end).toBe('2026-03-21T06:00:00.000Z')
    })
  })

  describe('hasRequiredRole', () => {
    it('returns true when soldier role matches requirement', () => {
      const soldier = makeSoldier({ role: 'Driver' })
      const task = makeTask({ roleRequirements: [{ role: 'Driver', count: 1 }] })
      expect(hasRequiredRole(soldier, task)).toBe(true)
    })

    it('returns true for Any role requirement', () => {
      const soldier = makeSoldier({ role: 'Medic' })
      const task = makeTask({ roleRequirements: [{ role: 'Any', count: 1 }] })
      expect(hasRequiredRole(soldier, task)).toBe(true)
    })

    it('returns false when soldier role does not match', () => {
      const soldier = makeSoldier({ role: 'Medic' })
      const task = makeTask({ roleRequirements: [{ role: 'Driver', count: 1 }] })
      expect(hasRequiredRole(soldier, task)).toBe(false)
    })
  })

  describe('isTaskAvailable', () => {
    it('returns true when no prior assignments', () => {
      const soldier = makeSoldier()
      const task = makeTask()
      expect(isTaskAvailable(soldier, task, [], [])).toBe(true)
    })

    it('returns false when soldier is injured', () => {
      const soldier = makeSoldier({ status: 'Injured' })
      const task = makeTask()
      expect(isTaskAvailable(soldier, task, [], [])).toBe(false)
    })

    it('returns false when soldier role does not match and no Any', () => {
      const soldier = makeSoldier({ role: 'Medic' })
      const task = makeTask({ roleRequirements: [{ role: 'Driver', count: 1 }] })
      expect(isTaskAvailable(soldier, task, [], [])).toBe(false)
    })

    it('returns false when soldier is still in rest period', () => {
      const soldier = makeSoldier()
      // Previous task ended at 14:00, rest period = 6h → can't start until 20:00
      const prevTask = makeTask({
        id: 'task-prev',
        endTime: '2026-03-20T14:00:00',
        minRestAfter: 6,
      })
      const assignment = makeAssignment({ taskId: 'task-prev' })
      // New task starts at 18:00 — within rest period
      const newTask = makeTask({
        id: 'task-new',
        startTime: '2026-03-20T18:00:00',
        endTime: '2026-03-20T22:00:00',
      })
      expect(isTaskAvailable(soldier, newTask, [prevTask], [assignment])).toBe(false)
    })

    it('returns true when rest period has elapsed', () => {
      const soldier = makeSoldier()
      const prevTask = makeTask({
        id: 'task-prev',
        endTime: '2026-03-20T08:00:00',
        minRestAfter: 6,
      })
      const assignment = makeAssignment({ taskId: 'task-prev' })
      // New task starts at 16:00 — 8h after end, rest = 6h ✓
      const newTask = makeTask({
        id: 'task-new',
        startTime: '2026-03-20T16:00:00',
        endTime: '2026-03-20T22:00:00',
      })
      expect(isTaskAvailable(soldier, newTask, [prevTask], [assignment])).toBe(true)
    })
  })
})

describe('checkDrivingHoursLimit', () => {
  const driverTask = (id: string, hours: number): Task => makeTask({
    id,
    startTime: '2026-03-20T08:00:00Z',
    endTime: `2026-03-20T${(8 + hours).toString().padStart(2, '0')}:00:00Z`,
    durationHours: hours,
  })

  it('always returns true for non-Driver soldiers', () => {
    const medic = makeSoldier({ role: 'Medic' })
    const task = driverTask('t1', 8)
    expect(checkDrivingHoursLimit(medic, task, [task], [], BASE_CONFIG as AppConfig)).toBe(true)
  })

  it('returns true when Driver has no prior tasks on the same day', () => {
    const driver = makeSoldier({ role: 'Driver' })
    const task = driverTask('t1', 8)
    expect(checkDrivingHoursLimit(driver, task, [task], [], BASE_CONFIG as AppConfig)).toBe(true)
  })

  it('returns false when Driver would exceed maxDrivingHours', () => {
    const driver = makeSoldier({ role: 'Driver' })
    const prev = driverTask('t-prev', 6) // 6h already
    const assignment: TaskAssignment = {
      scheduleId: 's', taskId: 't-prev', soldierId: 's1',
      assignedRole: 'Driver', isLocked: false,
      createdAt: '2026-02-01T00:00:00', createdBy: 'admin',
    }
    const newTask = driverTask('t-new', 4) // +4h → 10 total > 8
    expect(checkDrivingHoursLimit(driver, newTask, [prev, newTask], [assignment], BASE_CONFIG as AppConfig)).toBe(false)
  })

  it('returns true when Driver stays within maxDrivingHours', () => {
    const driver = makeSoldier({ role: 'Driver' })
    const prev = driverTask('t-prev', 4)
    const assignment: TaskAssignment = {
      scheduleId: 's', taskId: 't-prev', soldierId: 's1',
      assignedRole: 'Driver', isLocked: false,
      createdAt: '2026-02-01T00:00:00', createdBy: 'admin',
    }
    const newTask = driverTask('t-new', 4) // 4+4 = 8 = limit, still OK
    expect(checkDrivingHoursLimit(driver, newTask, [prev, newTask], [assignment], BASE_CONFIG as AppConfig)).toBe(true)
  })
})
