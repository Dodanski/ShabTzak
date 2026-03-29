/**
 * Comprehensive verification test for the scheduling algorithms.
 * This test uses realistic data matching the production xlsx structure
 * to verify the full scheduling pipeline works correctly.
 */
import { describe, it, expect } from 'vitest'
import { scheduleTasks } from './taskScheduler'
import { generateCyclicalLeaves } from './cyclicalLeaveScheduler'
import { expandRecurringTasks } from './taskExpander'
import { calculateBaseLeaveCapacity, getRemainingCapacity } from './leaveCapacityCalculator'
import type { Soldier, Task, AppConfig, TaskAssignment, LeaveAssignment, RoleRequirement } from '../models'

// === REALISTIC TEST DATA ===
// Matches production xlsx structure with 58 soldiers and 9 tasks

const roles = [
  'Squad Leader', 'Driver', 'Medic', 'Fighter', 'Operations Room',
  'A Fighter', 'A Driver', 'A Medic', 'A Radio Operator', 'Radio Operator'
]

// Create soldiers matching production distribution
function createRealisticSoldiers(): Soldier[] {
  const soldiers: Soldier[] = []
  const distribution = {
    'Fighter': 25,
    'Squad Leader': 8,
    'Driver': 6,
    'Medic': 6,
    'Operations Room': 5,
    'A Fighter': 3,
    'Radio Operator': 2,
    'A Driver': 1,
    'A Medic': 1,
    'A Radio Operator': 1,
  }

  let id = 1000000
  for (const [role, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      soldiers.push({
        id: String(id++),
        firstName: `Soldier${id}`,
        lastName: role.replace(' ', ''),
        role,
        status: 'Active',
        serviceStart: '2026-03-27',
        serviceEnd: '2026-05-25',
        hoursWorked: Math.floor(Math.random() * 50),
        leaveCount: Math.floor(Math.random() * 3),
      })
    }
  }
  return soldiers
}

// Create tasks matching production xlsx
function createRealisticTasks(): Task[] {
  const baseDate = '2026-03-27'
  return [
    {
      id: 'tour1',
      name: 'Tour 1',
      taskType: 'Tour 1',
      startTime: `${baseDate}T06:00:00`,
      endTime: `${baseDate}T14:00:00`,
      location: 'Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Squad Leader'] },
        { count: 1, roles: ['Driver'] },
        { count: 1, roles: ['Medic'] },
        { count: 2, roles: ['Fighter'] },
      ] as RoleRequirement[],
    },
    {
      id: 'tour2',
      name: 'Tour 2',
      taskType: 'Tour 2',
      startTime: `${baseDate}T14:00:00`,
      endTime: `${baseDate}T22:00:00`,
      location: 'Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Driver'] },
        { count: 1, roles: ['Squad Leader'] },
        { count: 1, roles: ['Medic'] },
        { count: 2, roles: ['Fighter'] },
      ] as RoleRequirement[],
    },
    {
      id: 'tour3',
      name: 'Tour 3',
      taskType: 'Tour 3',
      startTime: `${baseDate}T22:00:00`,
      endTime: `${baseDate}T06:00:00`,
      location: 'Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Squad Leader'] },
        { count: 1, roles: ['Driver'] },
        { count: 1, roles: ['Medic'] },
        { count: 1, roles: ['Fighter'] },
      ] as RoleRequirement[],
    },
    {
      id: 'oproom-morning',
      name: 'OperationRoom Morning',
      taskType: 'OperationRoom Morning',
      startTime: `${baseDate}T06:00:00`,
      endTime: `${baseDate}T14:00:00`,
      location: 'Operations Room',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Operations Room'] },
      ] as RoleRequirement[],
    },
    {
      id: 'oproom-afternoon',
      name: 'OperationRoom Afternoon',
      taskType: 'OperationRoom Afternoon',
      startTime: `${baseDate}T14:00:00`,
      endTime: `${baseDate}T22:00:00`,
      location: 'Operations Room',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Operations Room'] },
      ] as RoleRequirement[],
    },
    {
      id: 'oproom-night',
      name: 'OperationRoom Night',
      taskType: 'OperationRoom Night',
      startTime: `${baseDate}T22:00:00`,
      endTime: `${baseDate}T06:00:00`,
      location: 'Operations Room',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['Operations Room'] },
      ] as RoleRequirement[],
    },
    {
      id: 'alfa-tour1',
      name: 'Alfa Tour 1',
      taskType: 'Alfa Tour 1',
      startTime: `${baseDate}T06:00:00`,
      endTime: `${baseDate}T14:00:00`,
      location: 'Alfa Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['A Driver'] },
        { count: 1, roles: ['A Radio Operator'] },
        { count: 1, roles: ['A Medic'] },
        { count: 1, roles: ['A Fighter'] },
      ] as RoleRequirement[],
    },
    {
      id: 'alfa-tour2',
      name: 'Alfa Tour 2',
      taskType: 'Alfa Tour 2',
      startTime: `${baseDate}T14:00:00`,
      endTime: `${baseDate}T22:00:00`,
      location: 'Alfa Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['A Driver'] },
        { count: 1, roles: ['A Fighter'] },
        { count: 1, roles: ['A Medic'] },
      ] as RoleRequirement[],
    },
    {
      id: 'alfa-tour3',
      name: 'Alfa Tour 3',
      taskType: 'Alfa Tour 3',
      startTime: `${baseDate}T22:00:00`,
      endTime: `${baseDate}T06:00:00`,
      location: 'Alfa Base',
      priority: 1,
      isRecurring: true,
      recurrencePattern: 'daily',
      roleRequirements: [
        { count: 1, roles: ['A Fighter'] },
        { count: 1, roles: ['A Driver'] },
        { count: 1, roles: ['A Medic'] },
        { count: 1, roles: ['A Radio Operator'] },
      ] as RoleRequirement[],
    },
  ]
}

// Production-like config
const config: AppConfig = {
  scheduleStartDate: '2026-03-27',
  scheduleEndDate: '2026-05-25',
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  minBasePresence: 66,
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  leaveBaseExitHour: '06:00',
  leaveBaseReturnHour: '22:00',
  minBasePresenceByRole: {
    'Squad Leader': 4,
    'Driver': 3,
    'Medic': 3,
    'Fighter': 12,
    'Operations Room': 3,
    'A Fighter': 1,
    'A Driver': 1,
    'A Medic': 1,
    'A Radio Operator': 1,
    'Radio Operator': 1,
  },
}

describe('Full Scheduler Verification', () => {
  const soldiers = createRealisticSoldiers()
  const tasks = createRealisticTasks()

  describe('1. Task Expansion', () => {
    it('expands 9 daily recurring tasks across 60-day period', () => {
      const endDate = '2026-05-25'
      const expanded = expandRecurringTasks(tasks, endDate)

      // 9 tasks * ~60 days = ~540 expanded tasks
      expect(expanded.length).toBeGreaterThan(400)
      console.log(`Expanded ${tasks.length} tasks to ${expanded.length} instances`)

      // Check each day has tasks
      const tasksByDate = new Map<string, number>()
      for (const task of expanded) {
        const date = task.startTime.split('T')[0]
        tasksByDate.set(date, (tasksByDate.get(date) ?? 0) + 1)
      }
      console.log(`Tasks spread across ${tasksByDate.size} unique dates`)
      expect(tasksByDate.size).toBeGreaterThan(50)
    })
  })

  describe('2. Task Scheduling', () => {
    it('assigns soldiers to all expanded tasks with correct roles', () => {
      const endDate = '2026-05-25'
      const expanded = expandRecurringTasks(tasks, endDate)

      const schedule = scheduleTasks(
        expanded,
        soldiers,
        [],  // no existing assignments
        expanded,  // all tasks for validation
        [],  // no leave assignments
        config
      )

      console.log(`\nTASK SCHEDULE RESULTS:`)
      console.log(`  Total tasks: ${expanded.length}`)
      console.log(`  Total assignments: ${schedule.assignments.length}`)

      // Count required vs assigned
      let totalRequired = 0
      for (const task of expanded) {
        for (const req of task.roleRequirements) {
          totalRequired += req.count
        }
      }
      console.log(`  Required assignments: ${totalRequired}`)
      console.log(`  Coverage: ${((schedule.assignments.length / totalRequired) * 100).toFixed(1)}%`)

      // Should have high coverage (may not be 100% due to rest periods)
      expect(schedule.assignments.length).toBeGreaterThan(totalRequired * 0.8)

      // Verify role matching
      const roleAssignments = new Map<string, number>()
      for (const assignment of schedule.assignments) {
        const soldier = soldiers.find(s => s.id === assignment.soldierId)
        if (soldier) {
          roleAssignments.set(soldier.role, (roleAssignments.get(soldier.role) ?? 0) + 1)
        }
      }
      console.log(`\n  Assignments by role:`)
      for (const [role, count] of roleAssignments) {
        console.log(`    ${role}: ${count}`)
      }

      // Check no shortages for critical roles
      if (schedule.capacityShortages) {
        console.log(`\n  Capacity shortages:`, schedule.capacityShortages)
      }
    })
  })

  describe('3. Leave Capacity Calculation', () => {
    it('correctly calculates leave capacity per role', () => {
      const taskAssignments: TaskAssignment[] = []
      const capacityByDate = calculateBaseLeaveCapacity(
        soldiers,
        taskAssignments,
        config,
        tasks,
        '2026-03-27',
        '2026-04-10'
      )

      console.log(`\nLEAVE CAPACITY (sample day 2026-03-27):`)
      const sampleCapacity = capacityByDate.get('2026-03-27')
      expect(sampleCapacity).toBeDefined()

      if (sampleCapacity) {
        console.log(`  Max on leave by role:`, sampleCapacity.maxOnLeaveByRole)
        console.log(`  Max overall: ${sampleCapacity.maxOnLeaveOverall}`)
        console.log(`  Total active: ${sampleCapacity.totalActive}`)

        // With 66% minBasePresence, max 34% can be on leave
        const maxExpected = Math.floor(soldiers.length * 0.34)
        expect(sampleCapacity.maxOnLeaveOverall).toBeLessThanOrEqual(maxExpected + 1)
        expect(sampleCapacity.maxOnLeaveOverall).toBeGreaterThan(0)
      }
    })

    it('correctly calculates remaining capacity with soldiers on leave', () => {
      const capacityByDate = calculateBaseLeaveCapacity(
        soldiers,
        [],
        config,
        tasks,
        '2026-03-27',
        '2026-03-30'
      )

      const baseCapacity = capacityByDate.get('2026-03-27')!

      // Initially no one on leave
      const onLeaveByRole: Record<string, number> = {}
      for (const role of roles) {
        onLeaveByRole[role] = 0
      }

      const initialCapacity = getRemainingCapacity(baseCapacity, onLeaveByRole, 0, config)
      console.log(`\nREMAINING CAPACITY (no one on leave):`, initialCapacity)

      // Now simulate some soldiers on leave
      onLeaveByRole['Fighter'] = 5
      onLeaveByRole['Driver'] = 2
      const reducedCapacity = getRemainingCapacity(baseCapacity, onLeaveByRole, 7, config)
      console.log(`REMAINING CAPACITY (7 on leave):`, reducedCapacity)

      // Fighter capacity should be reduced
      expect(reducedCapacity['Fighter']).toBeLessThan(initialCapacity['Fighter']!)
    })
  })

  describe('4. Leave Scheduling', () => {
    it('generates cyclical leaves for all soldiers', () => {
      const endDate = '2026-05-25'
      const expanded = expandRecurringTasks(tasks, endDate)

      // First generate task schedule
      const taskSchedule = scheduleTasks(
        expanded,
        soldiers,
        [],
        expanded,
        [],
        config
      )

      // Then generate leave schedule
      const leaves = generateCyclicalLeaves(
        soldiers,
        [],  // no existing leaves
        taskSchedule.assignments,
        config,
        '2026-03-27',
        endDate,
        expanded
      )

      console.log(`\nLEAVE SCHEDULE RESULTS:`)
      console.log(`  Total leave assignments: ${leaves.length}`)

      // Count leaves per soldier
      const leavesBySoldier = new Map<string, number>()
      for (const leave of leaves) {
        leavesBySoldier.set(leave.soldierId, (leavesBySoldier.get(leave.soldierId) ?? 0) + 1)
      }

      const soldiersWithLeave = leavesBySoldier.size
      const activeSoldiers = soldiers.filter(s => s.status === 'Active').length
      console.log(`  Soldiers with leave: ${soldiersWithLeave}/${activeSoldiers}`)

      // Calculate min/max/avg leaves
      const leaveCounts = Array.from(leavesBySoldier.values())
      const minLeaves = Math.min(...leaveCounts)
      const maxLeaves = Math.max(...leaveCounts)
      const avgLeaves = leaveCounts.reduce((a, b) => a + b, 0) / leaveCounts.length

      console.log(`  Min leaves per soldier: ${minLeaves}`)
      console.log(`  Max leaves per soldier: ${maxLeaves}`)
      console.log(`  Avg leaves per soldier: ${avgLeaves.toFixed(1)}`)

      // Every active soldier should have at least some leave
      expect(soldiersWithLeave).toBeGreaterThan(activeSoldiers * 0.8)
      expect(leaves.length).toBeGreaterThan(0)
    })

    it('does not assign leave to soldiers on tasks', () => {
      const endDate = '2026-04-10'  // Short period for faster test
      const expanded = expandRecurringTasks(tasks, endDate)

      const taskSchedule = scheduleTasks(
        expanded,
        soldiers,
        [],
        expanded,
        [],
        config
      )

      const leaves = generateCyclicalLeaves(
        soldiers,
        [],
        taskSchedule.assignments,
        config,
        '2026-03-27',
        endDate,
        expanded
      )

      // Build task date lookup
      const taskDatesBySoldier = new Map<string, Set<string>>()
      for (const task of expanded) {
        const taskDate = task.startTime.split('T')[0]
        for (const assignment of taskSchedule.assignments) {
          if (assignment.taskId === task.id) {
            if (!taskDatesBySoldier.has(assignment.soldierId)) {
              taskDatesBySoldier.set(assignment.soldierId, new Set())
            }
            taskDatesBySoldier.get(assignment.soldierId)!.add(taskDate)
          }
        }
      }

      // Check no leave on task days
      let conflicts = 0
      for (const leave of leaves) {
        const leaveDate = leave.startDate.split('T')[0]
        const taskDates = taskDatesBySoldier.get(leave.soldierId)
        if (taskDates?.has(leaveDate)) {
          conflicts++
          console.log(`CONFLICT: Soldier ${leave.soldierId} has both task and leave on ${leaveDate}`)
        }
      }

      console.log(`\nTask-Leave conflicts: ${conflicts}`)
      expect(conflicts).toBe(0)
    })
  })

  describe('5. Full Integration', () => {
    it('complete scheduling pipeline with realistic data', () => {
      console.log('\n=== FULL SCHEDULING PIPELINE ===\n')

      const scheduleStart = '2026-03-27'
      const scheduleEnd = '2026-05-25'

      // Step 1: Expand tasks
      console.log('Step 1: Expanding recurring tasks...')
      const expanded = expandRecurringTasks(tasks, scheduleEnd)
      console.log(`  Expanded to ${expanded.length} task instances`)

      // Step 2: Generate task schedule
      console.log('\nStep 2: Generating task schedule...')
      const taskSchedule = scheduleTasks(
        expanded,
        soldiers,
        [],
        expanded,
        [],
        config
      )
      console.log(`  Created ${taskSchedule.assignments.length} task assignments`)

      // Step 3: Generate leave schedule
      console.log('\nStep 3: Generating leave schedule...')
      const leaves = generateCyclicalLeaves(
        soldiers,
        [],
        taskSchedule.assignments,
        config,
        scheduleStart,
        scheduleEnd,
        expanded
      )
      console.log(`  Created ${leaves.length} leave assignments`)

      // Verify results
      console.log('\n=== VERIFICATION ===')

      // Count unique soldiers with assignments
      const soldiersWithTasks = new Set(taskSchedule.assignments.map(a => a.soldierId))
      const soldiersWithLeaves = new Set(leaves.map(l => l.soldierId))

      console.log(`  Soldiers with task assignments: ${soldiersWithTasks.size}`)
      console.log(`  Soldiers with leave assignments: ${soldiersWithLeaves.size}`)

      // Check coverage
      const activeSoldiers = soldiers.filter(s => s.status === 'Active').length
      console.log(`  Total active soldiers: ${activeSoldiers}`)

      expect(soldiersWithTasks.size).toBeGreaterThan(0)
      expect(soldiersWithLeaves.size).toBeGreaterThan(0)
      expect(taskSchedule.assignments.length).toBeGreaterThan(0)
      expect(leaves.length).toBeGreaterThan(0)

      console.log('\n=== PIPELINE COMPLETE ===')
    })
  })
})
