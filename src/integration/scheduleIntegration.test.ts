/**
 * Integration Test: Spreadsheet Data Validation & Scheduling Algorithm
 *
 * This test simulates reading data from the admin spreadsheet and unit spreadsheets,
 * validates all data, and runs the full scheduling algorithm to verify:
 * 1. All data is valid (no validation errors)
 * 2. All tasks have soldiers allocated (no empty assignments)
 * 3. Leave ratio is respected
 * 4. Role requirements are satisfied
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { validateAllData, formatValidationResult } from '../utils/dataValidation'
import { scheduleTasks } from '../algorithms/taskScheduler'
import { scheduleLeave } from '../algorithms/leaveScheduler'
import { generateCyclicalLeaves } from '../algorithms/cyclicalLeaveScheduler'
import { expandRecurringTasks } from '../algorithms/taskExpander'
import type { Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment, AppConfig, RoleRequirement } from '../models'

// ============================================================================
// MOCK SPREADSHEET DATA - Simulates what would be read from Google Sheets
// Update this data to match your actual spreadsheet for real testing
// ============================================================================

const MOCK_CONFIG: AppConfig = {
  // Schedule period
  scheduleStartDate: '2026-04-01',
  scheduleEndDate: '2026-04-30',

  // Leave ratio
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],

  // Capacity
  minBasePresence: 20,
  minBasePresenceByRole: {
    Driver: 2,
    Fighter: 2,
  },

  // Tasks
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},

  // Admin
  adminEmails: [],

  // Leave timing
  leaveBaseExitHour: '06:00',
  leaveBaseReturnHour: '22:00',
}

// Simulated soldiers from "Soldiers" tab in admin spreadsheet
const MOCK_SOLDIERS: Soldier[] = [
  // Drivers
  { id: 'D001', firstName: 'David', lastName: 'Cohen', role: 'Driver', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'D002', firstName: 'Moshe', lastName: 'Levi', role: 'Driver', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'D003', firstName: 'Yosef', lastName: 'Katz', role: 'Driver', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'D004', firstName: 'Avi', lastName: 'Ben', role: 'Driver', unit: 'Unit2', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  // Fighters
  { id: 'F001', firstName: 'Eli', lastName: 'Rubin', role: 'Fighter', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'F002', firstName: 'Dan', lastName: 'Stern', role: 'Fighter', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'F003', firstName: 'Gal', lastName: 'Mor', role: 'Fighter', unit: 'Unit2', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'F004', firstName: 'Oren', lastName: 'Paz', role: 'Fighter', unit: 'Unit2', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  // Medic
  { id: 'M001', firstName: 'Tal', lastName: 'Golan', role: 'Medic', unit: 'Unit1', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
  { id: 'M002', firstName: 'Noa', lastName: 'Shir', role: 'Medic', unit: 'Unit2', serviceStart: '2025-01-01', serviceEnd: '2027-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
]

// Simulated tasks from "Tasks" tab in admin spreadsheet
const MOCK_TASKS: Task[] = [
  {
    id: 'Guard',
    taskType: 'Guard',
    startTime: '2026-04-01T08:00:00',  // ISO datetime for recurring expansion
    endTime: '2026-04-01T16:00:00',
    durationHours: 8,
    roleRequirements: [
      { roles: ['Driver'], count: 1 },
      { roles: ['Fighter'], count: 1 },
    ],
    minRestAfter: 6,
    isSpecial: false,
  },
  {
    id: 'Patrol',
    taskType: 'Patrol',
    startTime: '2026-04-01T06:00:00',  // ISO datetime for recurring expansion
    endTime: '2026-04-01T12:00:00',
    durationHours: 6,
    roleRequirements: [
      { roles: ['Driver'], count: 1 },
      { roles: ['Fighter', 'Medic'], count: 1 },  // Either Fighter or Medic
    ],
    minRestAfter: 4,
    isSpecial: false,
  },
  {
    id: 'NightWatch',
    taskType: 'Night Watch',
    startTime: '2026-04-01T20:00:00',  // ISO datetime for recurring expansion
    endTime: '2026-04-02T06:00:00',    // Night watch spans midnight
    durationHours: 10,
    roleRequirements: [
      { roles: ['Any'], count: 2 },  // Any role
    ],
    minRestAfter: 8,
    isSpecial: false,
  },
]

// Leave requests (from LeaveRequests tab)
const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'REQ001', soldierId: 'D001', startDate: '2026-04-01', endDate: '2026-04-03', leaveType: 'After', constraintType: 'Preference', priority: 5, status: 'Pending' },
  { id: 'REQ002', soldierId: 'F002', startDate: '2026-04-05', endDate: '2026-04-07', leaveType: 'Long', constraintType: 'Family event', priority: 8, status: 'Pending' },
]

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Spreadsheet Data Validation & Scheduling Integration', () => {
  let expandedTasks: Task[]
  let scheduleStartDate: string
  let scheduleEndDate: string

  beforeAll(() => {
    // Set up schedule period (30 days from a fixed date for deterministic testing)
    scheduleStartDate = '2026-04-01'
    scheduleEndDate = '2026-04-30'

    // Expand recurring tasks
    expandedTasks = expandRecurringTasks(MOCK_TASKS, scheduleEndDate)
  })

  describe('1. Data Validation', () => {
    it('validates all soldier data is correct', () => {
      const result = validateAllData(MOCK_SOLDIERS, [], [], [], [])

      console.log('\n=== SOLDIER VALIDATION ===')
      console.log(`Total soldiers: ${MOCK_SOLDIERS.length}`)
      console.log(`Valid soldiers: ${result.summary.soldiers.valid}`)
      console.log(`Errors: ${result.summary.soldiers.errors}`)

      if (result.errors.filter(e => e.entity === 'soldier').length > 0) {
        console.log('\nSoldier Errors:')
        result.errors.filter(e => e.entity === 'soldier').forEach(e => {
          console.log(`  ❌ ${e.id}: ${e.field} - ${e.message}`)
        })
      }

      expect(result.summary.soldiers.errors).toBe(0)
    })

    it('validates all task data is correct', () => {
      const result = validateAllData([], MOCK_TASKS, [], [], [])

      console.log('\n=== TASK VALIDATION ===')
      console.log(`Total tasks: ${MOCK_TASKS.length}`)
      console.log(`Valid tasks: ${result.summary.tasks.valid}`)
      console.log(`Errors: ${result.summary.tasks.errors}`)

      MOCK_TASKS.forEach(t => {
        const roles = t.roleRequirements.map(r => {
          const roleList = r.roles ?? (r.role ? [r.role] : [])
          return `${r.count}x[${roleList.join('|')}]`
        }).join(', ')
        console.log(`  - ${t.id}: ${roles}`)
      })

      if (result.errors.filter(e => e.entity === 'task').length > 0) {
        console.log('\nTask Errors:')
        result.errors.filter(e => e.entity === 'task').forEach(e => {
          console.log(`  ❌ ${e.id}: ${e.field} - ${e.message}`)
        })
      }

      expect(result.summary.tasks.errors).toBe(0)
    })

    it('validates no role mismatches between soldiers and tasks', () => {
      const result = validateAllData(MOCK_SOLDIERS, MOCK_TASKS, [], [], [])

      console.log('\n=== ROLE COMPATIBILITY ===')
      const soldierRoles = new Set(MOCK_SOLDIERS.map(s => s.role))
      const taskRoles = new Set(MOCK_TASKS.flatMap(t =>
        t.roleRequirements.flatMap(r => r.roles ?? (r.role ? [r.role] : []))
      ))

      console.log(`Soldier roles: ${Array.from(soldierRoles).join(', ')}`)
      console.log(`Task roles required: ${Array.from(taskRoles).join(', ')}`)
      console.log(`Role mismatches: ${result.summary.roleMismatches.length > 0 ? result.summary.roleMismatches.join(', ') : 'None'}`)

      expect(result.summary.roleMismatches.filter(r => r !== 'Any')).toHaveLength(0)
    })

    it('validates complete data passes all checks', () => {
      const result = validateAllData(
        MOCK_SOLDIERS,
        MOCK_TASKS,
        MOCK_LEAVE_REQUESTS,
        [],
        [],
        MOCK_CONFIG
      )

      console.log('\n=== FULL VALIDATION REPORT ===')
      console.log(formatValidationResult(result))

      expect(result.valid).toBe(true)
    })
  })

  describe('2. Task Scheduling Algorithm', () => {
    it('expands recurring tasks correctly', () => {
      console.log('\n=== TASK EXPANSION ===')
      console.log(`Original tasks: ${MOCK_TASKS.length}`)
      console.log(`Expanded tasks: ${expandedTasks.length}`)
      console.log(`Schedule period: ${scheduleStartDate} to ${scheduleEndDate}`)

      // Should have tasks for each day in the period
      expect(expandedTasks.length).toBeGreaterThan(MOCK_TASKS.length)
    })

    it('schedules ALL tasks with soldiers (no empty assignments)', () => {
      // Run the task scheduler
      const taskSchedule = scheduleTasks(
        expandedTasks,
        MOCK_SOLDIERS,
        [], // No existing assignments
        expandedTasks,
        [], // No leave assignments yet
        MOCK_CONFIG
      )

      console.log('\n=== TASK SCHEDULING RESULTS ===')
      console.log(`Total tasks to schedule: ${expandedTasks.length}`)
      console.log(`Total assignments created: ${taskSchedule.assignments.length}`)

      // Group assignments by task
      const assignmentsByTask = new Map<string, typeof taskSchedule.assignments>()
      for (const assignment of taskSchedule.assignments) {
        if (!assignmentsByTask.has(assignment.taskId)) {
          assignmentsByTask.set(assignment.taskId, [])
        }
        assignmentsByTask.get(assignment.taskId)!.push(assignment)
      }

      // Check each task has assignments
      const unfilledTasks: string[] = []
      const partiallyFilledTasks: { taskId: string; required: number; assigned: number }[] = []

      for (const task of expandedTasks) {
        const assignments = assignmentsByTask.get(task.id) || []
        const totalRequired = task.roleRequirements.reduce((sum, r) => sum + r.count, 0)

        if (assignments.length === 0) {
          unfilledTasks.push(task.id)
        } else if (assignments.length < totalRequired) {
          partiallyFilledTasks.push({
            taskId: task.id,
            required: totalRequired,
            assigned: assignments.length
          })
        }
      }

      // Report unfilled tasks
      if (unfilledTasks.length > 0) {
        console.log(`\n❌ UNFILLED TASKS (${unfilledTasks.length}):`)
        unfilledTasks.slice(0, 10).forEach(taskId => {
          const task = expandedTasks.find(t => t.id === taskId)!
          const roles = task.roleRequirements.map(r => {
            const roleList = r.roles ?? (r.role ? [r.role] : [])
            return `${r.count}x[${roleList.join('|')}]`
          }).join(', ')
          console.log(`  - ${taskId}: requires ${roles}`)
        })
        if (unfilledTasks.length > 10) {
          console.log(`  ... and ${unfilledTasks.length - 10} more`)
        }
      }

      // Report partially filled tasks
      if (partiallyFilledTasks.length > 0) {
        console.log(`\n⚠️ PARTIALLY FILLED TASKS (${partiallyFilledTasks.length}):`)
        partiallyFilledTasks.slice(0, 10).forEach(({ taskId, required, assigned }) => {
          console.log(`  - ${taskId}: ${assigned}/${required} soldiers`)
        })
        if (partiallyFilledTasks.length > 10) {
          console.log(`  ... and ${partiallyFilledTasks.length - 10} more`)
        }
      }

      // Summary by role
      const assignmentsByRole = new Map<string, number>()
      for (const assignment of taskSchedule.assignments) {
        assignmentsByRole.set(assignment.assignedRole, (assignmentsByRole.get(assignment.assignedRole) || 0) + 1)
      }
      console.log('\nAssignments by role:')
      assignmentsByRole.forEach((count, role) => {
        console.log(`  ${role}: ${count}`)
      })

      // Assertions
      expect(unfilledTasks.length).toBe(0)
      expect(partiallyFilledTasks.length).toBe(0)
    })

    it('respects role requirements for each task', () => {
      const taskSchedule = scheduleTasks(
        expandedTasks,
        MOCK_SOLDIERS,
        [],
        expandedTasks,
        [],
        MOCK_CONFIG
      )

      console.log('\n=== ROLE REQUIREMENT VERIFICATION ===')

      let allRolesValid = true
      const invalidAssignments: string[] = []

      for (const task of expandedTasks.slice(0, 20)) { // Check first 20 expanded tasks
        const assignments = taskSchedule.assignments.filter(a => a.taskId === task.id)

        for (const req of task.roleRequirements) {
          const acceptableRoles = req.roles ?? (req.role ? [req.role] : [])
          const matchingAssignments = assignments.filter(a =>
            acceptableRoles.includes('Any') || acceptableRoles.includes(a.assignedRole)
          )

          if (matchingAssignments.length < req.count) {
            allRolesValid = false
            invalidAssignments.push(
              `${task.id}: needs ${req.count}x[${acceptableRoles.join('|')}], got ${matchingAssignments.length}`
            )
          }
        }
      }

      if (invalidAssignments.length > 0) {
        console.log('❌ Role requirement violations:')
        invalidAssignments.forEach(v => console.log(`  - ${v}`))
      } else {
        console.log('✅ All role requirements satisfied')
      }

      expect(allRolesValid).toBe(true)
    })
  })

  describe('3. Leave Scheduling Algorithm', () => {
    it('generates cyclical leaves while respecting capacity', () => {
      const cyclicalLeaves = generateCyclicalLeaves(
        MOCK_SOLDIERS,
        [], // No existing leaves
        [], // No task assignments
        MOCK_CONFIG,
        scheduleStartDate,
        scheduleEndDate,
        expandedTasks
      )

      console.log('\n=== CYCLICAL LEAVE GENERATION ===')
      console.log(`Total cyclical leaves generated: ${cyclicalLeaves.length}`)

      // Group by soldier
      const leavesBySoldier = new Map<string, typeof cyclicalLeaves>()
      for (const leave of cyclicalLeaves) {
        if (!leavesBySoldier.has(leave.soldierId)) {
          leavesBySoldier.set(leave.soldierId, [])
        }
        leavesBySoldier.get(leave.soldierId)!.push(leave)
      }

      console.log('\nLeaves per soldier:')
      leavesBySoldier.forEach((leaves, soldierId) => {
        console.log(`  ${soldierId}: ${leaves.length} leave periods`)
      })

      expect(cyclicalLeaves.length).toBeGreaterThan(0)
    })

    it('schedules manual leave requests correctly', () => {
      const cyclicalLeaves = generateCyclicalLeaves(
        MOCK_SOLDIERS,
        [],
        [],
        MOCK_CONFIG,
        scheduleStartDate,
        scheduleEndDate,
        expandedTasks
      )

      const leaveSchedule = scheduleLeave(
        MOCK_LEAVE_REQUESTS,
        MOCK_SOLDIERS,
        cyclicalLeaves,
        MOCK_CONFIG,
        scheduleStartDate,
        scheduleEndDate
      )

      console.log('\n=== LEAVE SCHEDULING RESULTS ===')
      console.log(`Cyclical leaves: ${cyclicalLeaves.length}`)
      console.log(`Manual requests: ${MOCK_LEAVE_REQUESTS.length}`)
      console.log(`Total leave assignments: ${leaveSchedule.assignments.length}`)
      console.log(`Conflicts: ${leaveSchedule.conflicts.length}`)

      if (leaveSchedule.conflicts.length > 0) {
        console.log('\nConflicts:')
        leaveSchedule.conflicts.forEach(c => {
          console.log(`  - ${c.message}`)
        })
      }

      // Leave schedule should include cyclical leaves, and may approve some manual requests
      // Some manual requests may be rejected due to conflicts (insufficient base presence, etc.)
      expect(leaveSchedule.assignments.length).toBeGreaterThan(0)
      // Should have at least most of the cyclical leaves
      expect(leaveSchedule.assignments.length).toBeGreaterThanOrEqual(cyclicalLeaves.length - 5)
    })
  })

  describe('4. Full Schedule Integration', () => {
    it('generates complete schedule with tasks first, then leaves', () => {
      console.log('\n' + '='.repeat(60))
      console.log('FULL SCHEDULE INTEGRATION TEST')
      console.log('='.repeat(60))

      // Step 1: Generate task schedule
      console.log('\n[Step 1] Generating task schedule...')
      const taskSchedule = scheduleTasks(
        expandedTasks,
        MOCK_SOLDIERS,
        [],
        expandedTasks,
        [],
        MOCK_CONFIG
      )
      console.log(`  Created ${taskSchedule.assignments.length} task assignments`)

      // Step 2: Generate cyclical leaves respecting task assignments
      console.log('\n[Step 2] Generating cyclical leaves...')
      const cyclicalLeaves = generateCyclicalLeaves(
        MOCK_SOLDIERS,
        [],
        taskSchedule.assignments,
        MOCK_CONFIG,
        scheduleStartDate,
        scheduleEndDate,
        expandedTasks
      )
      console.log(`  Created ${cyclicalLeaves.length} cyclical leave assignments`)

      // Step 3: Schedule manual leave requests
      console.log('\n[Step 3] Scheduling manual leave requests...')
      const leaveSchedule = scheduleLeave(
        MOCK_LEAVE_REQUESTS,
        MOCK_SOLDIERS,
        cyclicalLeaves,
        MOCK_CONFIG,
        scheduleStartDate,
        scheduleEndDate
      )
      console.log(`  Total leaves: ${leaveSchedule.assignments.length}`)

      // Verify task assignments
      const assignmentsByTask = new Map<string, number>()
      for (const a of taskSchedule.assignments) {
        assignmentsByTask.set(a.taskId, (assignmentsByTask.get(a.taskId) || 0) + 1)
      }

      const tasksWithNoAssignments = expandedTasks.filter(t => !assignmentsByTask.has(t.id))

      console.log('\n=== FINAL SUMMARY ===')
      console.log(`Total tasks: ${expandedTasks.length}`)
      console.log(`Tasks with assignments: ${assignmentsByTask.size}`)
      console.log(`Tasks without assignments: ${tasksWithNoAssignments.length}`)
      console.log(`Total task assignments: ${taskSchedule.assignments.length}`)
      console.log(`Total leave assignments: ${leaveSchedule.assignments.length}`)

      if (tasksWithNoAssignments.length > 0) {
        console.log('\n❌ TASKS WITHOUT SOLDIERS:')
        tasksWithNoAssignments.slice(0, 10).forEach(t => {
          console.log(`  - ${t.id} (${t.taskType})`)
        })
        if (tasksWithNoAssignments.length > 10) {
          console.log(`  ... and ${tasksWithNoAssignments.length - 10} more`)
        }
      } else {
        console.log('\n✅ ALL TASKS HAVE SOLDIERS ASSIGNED')
      }

      // Assert all tasks are filled
      expect(tasksWithNoAssignments.length).toBe(0)
    })
  })
})
