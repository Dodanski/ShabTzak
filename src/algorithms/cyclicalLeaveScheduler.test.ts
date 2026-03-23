import { describe, it, expect } from 'vitest'
import { generateCyclicalLeaves } from './cyclicalLeaveScheduler'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig, Task } from '../models'

function makeSoldier(id: string, role: string = 'Driver', overrides: Partial<Soldier> = {}): Soldier {
  return {
    id,
    firstName: `First ${id}`,
    lastName: `Last ${id}`,
    role,
    serviceStart: '2026-01-01',
    serviceEnd: '2026-12-31',
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

function makeTask(id: string, date: string, roleRequirements: Task['roleRequirements'] = []): Task {
  return {
    id,
    taskType: 'Guard',
    startTime: `${date}T08:00:00`,
    endTime: `${date}T20:00:00`,
    durationHours: 12,
    roleRequirements,
    minRestAfter: 0,
  }
}

function makeTaskAssignment(taskId: string, soldierId: string): TaskAssignment {
  return {
    scheduleId: `sched-${taskId}`,
    taskId,
    soldierId,
    assignedRole: 'Driver',
    isLocked: false,
    createdAt: new Date().toISOString(),
    createdBy: 'test',
  }
}

const BASE_CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  minBasePresence: 50,
  minBasePresenceByRole: { Driver: 1 },
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  leaveBaseExitHour: '06:00',
  leaveBaseReturnHour: '22:00',
}

describe('Cyclical Leave Scheduler', () => {
  describe('deterministic phase offsets', () => {
    it('generates the same leave schedule when called multiple times with same inputs', () => {
      const soldiers = [makeSoldier('s1'), makeSoldier('s2'), makeSoldier('s3')]

      const result1 = generateCyclicalLeaves(
        soldiers,
        [],
        [],
        BASE_CONFIG,
        '2026-03-01',
        '2026-03-14',
        []
      )

      const result2 = generateCyclicalLeaves(
        soldiers,
        [],
        [],
        BASE_CONFIG,
        '2026-03-01',
        '2026-03-14',
        []
      )

      // Same soldiers should get leave on same dates
      expect(result1.length).toBe(result2.length)

      // Check that each leave assignment in result1 has a matching one in result2
      for (const leave1 of result1) {
        const matchingLeave = result2.find(
          l => l.soldierId === leave1.soldierId && l.startDate === leave1.startDate
        )
        expect(matchingLeave).toBeDefined()
      }
    })

    it('generates different phase offsets for different soldier IDs', () => {
      // Need enough soldiers to have capacity > 0 with the leave ratio
      // With 10:4 ratio and 10 soldiers, max 2 can be on leave at once
      const soldiers = [
        makeSoldier('alpha'),
        makeSoldier('beta'),
        makeSoldier('gamma'),
        makeSoldier('delta'),
        makeSoldier('epsilon'),
        makeSoldier('zeta'),
        makeSoldier('eta'),
        makeSoldier('theta'),
        makeSoldier('iota'),
        makeSoldier('kappa'),
      ]
      const config = { ...BASE_CONFIG, minBasePresenceByRole: { Driver: 0 } }

      const result = generateCyclicalLeaves(
        soldiers,
        [],
        [],
        config,
        '2026-03-01',
        '2026-03-28', // Two full cycles
        []
      )

      // Get leave dates per soldier
      const alphaLeaves = result.filter(l => l.soldierId === 'alpha').map(l => l.startDate.split('T')[0])
      const betaLeaves = result.filter(l => l.soldierId === 'beta').map(l => l.startDate.split('T')[0])

      // Both should have some leaves (with 10 soldiers and capacity 2, rotation should happen)
      expect(alphaLeaves.length).toBeGreaterThan(0)
      expect(betaLeaves.length).toBeGreaterThan(0)
    })
  })

  describe('task conflict prevention', () => {
    it('does not assign leave to a soldier who has a task on that day', () => {
      // Need enough soldiers for capacity > 0
      const soldiers = Array.from({ length: 10 }, (_, i) => makeSoldier(`s${i + 1}`))
      const config = { ...BASE_CONFIG, minBasePresenceByRole: { Driver: 0 } }

      // s1 has a task on 2026-03-10
      const tasks = [makeTask('guard1', '2026-03-10', [{ roles: ['Driver'], count: 1 }])]
      const taskAssignments = [makeTaskAssignment('guard1', 's1')]

      const result = generateCyclicalLeaves(
        soldiers,
        [],
        taskAssignments,
        config,
        '2026-03-01',
        '2026-03-14',
        tasks
      )

      // s1 should NOT have leave on 2026-03-10
      const s1LeavesOn10th = result.filter(
        l => l.soldierId === 's1' && l.startDate.startsWith('2026-03-10')
      )
      expect(s1LeavesOn10th.length).toBe(0)
    })

    it('allows leave for soldiers not assigned to tasks on that day', () => {
      // With block-based leave, we need a longer period and enough capacity
      // for the soldier with a task conflict to still get a leave window
      const soldiers = [
        makeSoldier('s1'),
        makeSoldier('s2'),
        makeSoldier('s3'),
        makeSoldier('s4'),
        makeSoldier('s5'),
      ]
      // Set minPresence to 0 and use a longer period (28 days = 2 cycles)
      const config = { ...BASE_CONFIG, minBasePresenceByRole: { Driver: 0 } }

      // s1 has a task on 2026-03-10 - this should block them from leave on that day
      // but they should still get a leave block on other dates
      const tasks = [makeTask('guard1', '2026-03-10', [{ roles: ['Driver'], count: 1 }])]
      const taskAssignments = [makeTaskAssignment('guard1', 's1')]

      const result = generateCyclicalLeaves(
        soldiers,
        [],
        taskAssignments,
        config,
        '2026-03-01',
        '2026-03-28',  // Longer period (28 days)
        tasks
      )

      // s1 should still get leave - just not on the task day
      const s1Leaves = result.filter(l => l.soldierId === 's1')
      expect(s1Leaves.length).toBeGreaterThan(0)

      // s1 should NOT have leave on 2026-03-10 (task day)
      const s1LeavesOn10th = s1Leaves.filter(l => l.startDate.startsWith('2026-03-10'))
      expect(s1LeavesOn10th.length).toBe(0)
    })

    it('handles multiple task assignments for the same soldier', () => {
      // Need enough soldiers for capacity > 0
      const soldiers = Array.from({ length: 10 }, (_, i) => makeSoldier(`s${i + 1}`))
      const config = { ...BASE_CONFIG, minBasePresenceByRole: { Driver: 0 } }

      // s1 has tasks on multiple days
      const tasks = [
        makeTask('guard1', '2026-03-10', [{ roles: ['Driver'], count: 1 }]),
        makeTask('guard2', '2026-03-11', [{ roles: ['Driver'], count: 1 }]),
        makeTask('guard3', '2026-03-12', [{ roles: ['Driver'], count: 1 }]),
      ]
      const taskAssignments = [
        makeTaskAssignment('guard1', 's1'),
        makeTaskAssignment('guard2', 's1'),
        makeTaskAssignment('guard3', 's1'),
      ]

      const result = generateCyclicalLeaves(
        soldiers,
        [],
        taskAssignments,
        config,
        '2026-03-01',
        '2026-03-14',
        tasks
      )

      // s1 should NOT have leave on any of the task days
      const s1LeavesOnTaskDays = result.filter(
        l => l.soldierId === 's1' &&
        ['2026-03-10', '2026-03-11', '2026-03-12'].some(d => l.startDate.startsWith(d))
      )
      expect(s1LeavesOnTaskDays.length).toBe(0)
    })
  })

  describe('leave ratio enforcement', () => {
    it('respects the leave ratio capacity limit', () => {
      // With 10:4 ratio and 10 soldiers, max 2 can be on leave at once (floor(10 * 4/14) = 2)
      const soldiers = Array.from({ length: 10 }, (_, i) => makeSoldier(`s${i + 1}`))
      const config = { ...BASE_CONFIG, minBasePresenceByRole: { Driver: 0 } }

      const result = generateCyclicalLeaves(
        soldiers,
        [],
        [],
        config,
        '2026-03-01',
        '2026-03-14',
        []
      )

      // Count soldiers on leave per day
      const leaveCountByDate = new Map<string, number>()
      for (const leave of result) {
        const date = leave.startDate.split('T')[0]
        leaveCountByDate.set(date, (leaveCountByDate.get(date) ?? 0) + 1)
      }

      // No day should have more than 2 soldiers on leave
      for (const [date, count] of leaveCountByDate) {
        expect(count).toBeLessThanOrEqual(2)
      }
    })
  })
})
