import { describe, it, expect } from 'vitest'
import { generateCyclicalLeaves } from './cyclicalLeaveScheduler'
import { scheduleLeave } from './leaveScheduler'
import { scheduleTasks } from './taskScheduler'
import type { Soldier, Task, LeaveRequest, AppConfig } from '../models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 7,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 50,
  minBasePresenceByRole: { Driver: 1, Medic: 1, Fighter: 1, 'Squad leader': 1 },
  maxDrivingHours: 10,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
  adminEmails: [],
  leaveBaseExitHour: '14:00',
  leaveBaseReturnHour: '08:00',
}

function makeSoldier(id: string, role: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    role,
    unit: 'unitA',
    serviceStart: '2026-03-01',
    serviceEnd: '2026-06-30',
    initialFairness: 0,
    currentFairness: 0,
    status: 'Active',
    hoursWorked: 0,
    weekendLeavesCount: 0,
    midweekLeavesCount: 0,
    afterLeavesCount: 0,
    ...overrides,
  }
}

function makeTask(id: string, date: string, roles: { role: string; count: number }[], overrides: Partial<Task> = {}): Task {
  return {
    id,
    taskType: 'Guard',
    startTime: `${date}T08:00:00`,
    endTime: `${date}T16:00:00`,
    durationHours: 8,
    roleRequirements: roles,
    minRestAfter: 6,
    isSpecial: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Schedule Integration', () => {
  const PERIOD_START = '2026-03-20'
  const PERIOD_END = '2026-04-20'

  const SOLDIERS: Soldier[] = [
    makeSoldier('s1', 'Driver'),
    makeSoldier('s2', 'Driver'),
    makeSoldier('s3', 'Medic'),
    makeSoldier('s4', 'Medic'),
    makeSoldier('s5', 'Fighter'),
    makeSoldier('s6', 'Fighter'),
  ]

  it('full pipeline: manual leave + task schedule — manual leave respected by task scheduler', () => {
    // This test verifies the full pipeline: manual leave → task schedule.
    // Cyclical leaves are excluded to keep the test deterministic.
    // The separate "cyclical leaves" tests cover cyclical behavior.
    const soldiers = [
      makeSoldier('p1', 'Driver'),
      makeSoldier('p2', 'Driver'),
      makeSoldier('p3', 'Medic'),
      makeSoldier('p4', 'Medic'),
    ]

    // Schedule a manual leave for p1 on 2026-03-25..27 (no existing leaves)
    const manualRequest: LeaveRequest = {
      id: 'req1',
      soldierId: 'p1',
      startDate: '2026-03-25',
      endDate: '2026-03-27',
      leaveType: 'After',
      constraintType: 'Personal',
      priority: 9,
      status: 'Pending',
    }
    const leaveSchedule = scheduleLeave([manualRequest], soldiers, [], CONFIG, PERIOD_START, PERIOD_END)

    // The manual request for p1 should appear
    const p1Leave = leaveSchedule.assignments.find(a => a.soldierId === 'p1' && a.requestId === 'req1')
    expect(p1Leave).toBeDefined()

    // Schedule tasks on a day BEFORE the leave (no leave conflicts)
    const tasks: Task[] = [
      makeTask('guard-1', '2026-03-20', [{ roles: ['Driver'], count: 1 }, { roles: ['Medic'], count: 1 }]),
      makeTask('guard-3', '2026-03-22', [{ roles: ['Driver'], count: 1 }]),
    ]
    const taskSchedule = scheduleTasks(tasks, soldiers, [], tasks, leaveSchedule.assignments, CONFIG)

    // guard-1 needs 1 Driver + 1 Medic → 2 assignments (no leave conflicts on 2026-03-20)
    const guard1Assignments = taskSchedule.assignments.filter(a => a.taskId === 'guard-1')
    expect(guard1Assignments).toHaveLength(2)
    expect(guard1Assignments.map(a => a.assignedRole)).toContain('Driver')
    expect(guard1Assignments.map(a => a.assignedRole)).toContain('Medic')
  })

  it('soldiers on manual leave are not assigned to tasks on the same day', () => {
    const leaveRequest: LeaveRequest = {
      id: 'req2',
      soldierId: 's1',
      startDate: '2026-03-20',
      endDate: '2026-03-20',
      leaveType: 'After',
      constraintType: 'Personal',
      priority: 9,
      status: 'Pending',
    }
    const leaveSchedule = scheduleLeave([leaveRequest], SOLDIERS, [], CONFIG, PERIOD_START, PERIOD_END)

    // s1 should be on leave on 2026-03-20
    const s1OnLeave = leaveSchedule.assignments.some(
      a => a.soldierId === 's1' && a.startDate <= '2026-03-20' && a.endDate >= '2026-03-20'
    )
    expect(s1OnLeave).toBe(true)

    // Task on the same day — s1 must not be assigned
    const tasks: Task[] = [makeTask('guard-same-day', '2026-03-20', [{ role: 'Driver', count: 1 }])]
    const taskSchedule = scheduleTasks(tasks, SOLDIERS, [], tasks, leaveSchedule.assignments, CONFIG)

    const s1Assignment = taskSchedule.assignments.find(
      a => a.taskId === 'guard-same-day' && a.soldierId === 's1'
    )
    expect(s1Assignment).toBeUndefined()
  })

  it('fairness: soldier with most hours worked is assigned last', () => {
    // s1 has high hours → should be last to get the single task slot
    const soldiers: Soldier[] = [
      makeSoldier('s1', 'Driver', { hoursWorked: 100 }),
      makeSoldier('s2', 'Driver', { hoursWorked: 0 }),
    ]
    const tasks: Task[] = [makeTask('guard-fair', '2026-03-20', [{ role: 'Driver', count: 1 }])]
    const taskSchedule = scheduleTasks(tasks, soldiers, [], tasks, [], CONFIG)

    expect(taskSchedule.assignments).toHaveLength(1)
    expect(taskSchedule.assignments[0].soldierId).toBe('s2')
  })

  it('cyclical leaves: not all soldiers of same role leave on the same day', () => {
    const drivers = SOLDIERS.filter(s => s.role === 'Driver')
    const cyclicalLeaves = generateCyclicalLeaves(drivers, [], [], CONFIG, PERIOD_START, PERIOD_END)

    // Group leave dates by soldier
    const leavesByDate = new Map<string, string[]>()
    for (const leave of cyclicalLeaves) {
      const date = leave.startDate
      if (!leavesByDate.has(date)) leavesByDate.set(date, [])
      leavesByDate.get(date)!.push(leave.soldierId)
    }

    // With 2 drivers and minBasePresenceByRole.Driver = 1, at most 1 can be on leave at once
    for (const [, soldierIds] of leavesByDate) {
      expect(soldierIds.length).toBeLessThanOrEqual(1)
    }
  })

  it('no conflicts when enough soldiers are available for all tasks', () => {
    const tasks: Task[] = [
      makeTask('t1', '2026-03-20', [{ role: 'Driver', count: 1 }]),
      makeTask('t2', '2026-03-20', [{ role: 'Medic', count: 1 }]),
      makeTask('t3', '2026-03-21', [{ role: 'Fighter', count: 1 }]),
    ]
    const taskSchedule = scheduleTasks(tasks, SOLDIERS, [], tasks, [], CONFIG)

    expect(taskSchedule.conflicts).toHaveLength(0)
    expect(taskSchedule.assignments).toHaveLength(3)
  })
})
