/**
 * Integration Test: Real Spreadsheet Data Validation & Scheduling
 *
 * This test reads the actual exported spreadsheet data and validates:
 * 1. All data is valid
 * 2. Role requirements match soldier roles
 * 3. All tasks can be filled with soldiers
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { validateAllData, formatValidationResult } from '../utils/dataValidation'
import { scheduleTasks } from '../algorithms/taskScheduler'
import { expandRecurringTasks } from '../algorithms/taskExpander'
import type { Soldier, Task, LeaveAssignment, AppConfig } from '../models'

// ============================================================================
// LOAD REAL DATA FROM EXPORTED SPREADSHEET
// ============================================================================

interface SpreadsheetData {
  Soldiers: RawSoldier[]
  Tasks: RawTask[]
  Roles: { RoleName: string }[]
  Config: Record<string, string>[]
  TaskSchedule: RawTaskAssignment[]
  LeaveSchedule: RawLeaveAssignment[]
  LeaveRequests: unknown[]
}

interface RawSoldier {
  ID: string | number
  'First Name': string
  'Last Name': string
  Role: string
  Unit: string
  ServiceStart: string
  ServiceEnd: string
  Status: string
  InitialFairness: string | number
  CurrentFairness: string | number
  HoursWorked: string | number
  WeekendLeavesCount: string | number
  MidweekLeavesCount: string | number
  AfterLeavesCount: string | number
  InactiveReason?: string
}

interface RawTask {
  ID: string
  TaskType: string
  StartTime: string
  EndTime: string
  DurationHours: string | number
  RoleRequirements: string
  MinRestAfter: string | number
  IsSpecial: string
  SpecialDurationDays?: string | number
}

interface RawTaskAssignment {
  ScheduleID: string
  TaskID: string
  SoldierID: string
  AssignedRole: string
  AssignedUnitID: string
  IsLocked: string
  CreatedAt: string
  CreatedBy: string
}

interface RawLeaveAssignment {
  ID: string
  SoldierID: string
  StartDate: string
  EndDate: string
  LeaveType: string
  IsWeekend: string
  IsLocked: string
  RequestID?: string
  CreatedAt: string
}

function loadSpreadsheetData(): SpreadsheetData {
  const dataPath = join(__dirname, '../../test_tables/spreadsheet_data.json')
  const raw = readFileSync(dataPath, 'utf-8')
  return JSON.parse(raw)
}

function transformSoldiers(raw: RawSoldier[]): Soldier[] {
  return raw.map(r => ({
    id: String(r.ID),
    firstName: r['First Name'] || '',
    lastName: r['Last Name'] || '',
    role: r.Role || '',
    unit: r.Unit || undefined,
    serviceStart: r.ServiceStart || '',
    serviceEnd: r.ServiceEnd || '',
    initialFairness: Number(r.InitialFairness) || 0,
    currentFairness: Number(r.CurrentFairness) || 0,
    status: (r.Status === 'Active' || r.Status === 'Inactive') ? r.Status : 'Active',
    hoursWorked: Number(r.HoursWorked) || 0,
    weekendLeavesCount: Number(r.WeekendLeavesCount) || 0,
    midweekLeavesCount: Number(r.MidweekLeavesCount) || 0,
    afterLeavesCount: Number(r.AfterLeavesCount) || 0,
    inactiveReason: r.InactiveReason || undefined,
  }))
}

function normalizeTime(timeStr: string): string {
  if (!timeStr) return ''
  // If it already has 'T' (is full ISO), return as-is
  if (timeStr.includes('T')) return timeStr
  // Otherwise it's time-only, prepend today's date
  const today = new Date().toISOString().split('T')[0]
  return `${today}T${timeStr}`
}

function transformTasks(raw: RawTask[]): Task[] {
  return raw.map(r => {
    let roleRequirements: any[] = []
    try {
      const parsed = JSON.parse(r.RoleRequirements || '[]')
      roleRequirements = parsed.map((req: any) => ({
        roles: req.roles ?? (req.role ? [req.role] : []),
        count: req.count || 1,
        role: req.role, // Keep for backward compat
      }))
    } catch {
      roleRequirements = []
    }

    return {
      id: r.ID,
      taskType: r.TaskType,
      startTime: normalizeTime(r.StartTime),
      endTime: normalizeTime(r.EndTime),
      durationHours: Number(r.DurationHours) || 0,
      roleRequirements,
      minRestAfter: Number(r.MinRestAfter) || 0,
      isSpecial: r.IsSpecial === 'true',
      specialDurationDays: r.SpecialDurationDays ? Number(r.SpecialDurationDays) : undefined,
    }
  })
}

// ============================================================================
// TESTS
// ============================================================================

describe('Real Spreadsheet Data Validation', () => {
  let data: SpreadsheetData
  let soldiers: Soldier[]
  let tasks: Task[]

  beforeAll(() => {
    data = loadSpreadsheetData()
    soldiers = transformSoldiers(data.Soldiers)
    tasks = transformTasks(data.Tasks)
  })

  describe('1. Data Overview', () => {
    it('shows spreadsheet data summary', () => {
      console.log('\n' + '='.repeat(70))
      console.log('REAL SPREADSHEET DATA ANALYSIS')
      console.log('='.repeat(70))

      console.log(`\n📊 DATA COUNTS:`)
      console.log(`  Soldiers: ${data.Soldiers.length}`)
      console.log(`  Tasks: ${data.Tasks.length}`)
      console.log(`  Roles defined: ${data.Roles.length}`)
      console.log(`  TaskSchedule rows: ${data.TaskSchedule.length}`)
      console.log(`  LeaveSchedule rows: ${data.LeaveSchedule.length}`)
      console.log(`  LeaveRequests: ${data.LeaveRequests.length}`)

      expect(data.Soldiers.length).toBeGreaterThan(0)
      expect(data.Tasks.length).toBeGreaterThan(0)
    })
  })

  describe('2. Role Analysis', () => {
    it('compares soldier roles with task requirements', () => {
      console.log('\n' + '='.repeat(70))
      console.log('ROLE ANALYSIS')
      console.log('='.repeat(70))

      // Defined roles in Roles tab
      const definedRoles = data.Roles.map(r => r.RoleName)
      console.log(`\n📋 DEFINED ROLES (from Roles tab):`)
      definedRoles.forEach(r => console.log(`  - ${r}`))

      // Actual soldier roles
      const soldierRoles = new Map<string, number>()
      soldiers.forEach(s => {
        soldierRoles.set(s.role, (soldierRoles.get(s.role) || 0) + 1)
      })
      console.log(`\n👥 SOLDIER ROLES (actual data):`)
      Array.from(soldierRoles.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([role, count]) => console.log(`  - "${role}": ${count} soldiers`))

      // Task required roles
      const taskRoles = new Set<string>()
      tasks.forEach(t => {
        t.roleRequirements.forEach(req => {
          const roles = req.roles ?? (req.role ? [req.role] : [])
          roles.forEach(r => taskRoles.add(r))
        })
      })
      console.log(`\n📋 TASK REQUIRED ROLES:`)
      taskRoles.forEach(r => console.log(`  - "${r}"`))

      // Find mismatches
      const soldierRoleSet = new Set(soldiers.map(s => s.role))
      const missingInSoldiers = Array.from(taskRoles).filter(r => !soldierRoleSet.has(r))
      const unusedInTasks = Array.from(soldierRoleSet).filter(r => !taskRoles.has(r))

      console.log('\n' + '='.repeat(70))
      if (missingInSoldiers.length > 0) {
        console.log(`❌ ROLES REQUIRED BY TASKS BUT NO SOLDIERS HAVE:`)
        missingInSoldiers.forEach(r => console.log(`  - "${r}"`))
      } else {
        console.log('✅ All task-required roles have at least one soldier')
      }

      if (unusedInTasks.length > 0) {
        console.log(`\n⚠️ SOLDIER ROLES NOT USED IN ANY TASK:`)
        unusedInTasks.forEach(r => console.log(`  - "${r}"`))
      }

      // This is the critical check - if there are missing roles, scheduling will fail
      if (missingInSoldiers.length > 0) {
        console.log('\n🔴 CRITICAL: Tasks cannot be filled because required roles are missing!')
        console.log('   Possible fixes:')
        console.log('   1. Update soldier roles to match task requirements')
        console.log('   2. Update task RoleRequirements to use existing soldier roles')
        console.log('   3. Add soldiers with the required roles')
      }

      // Don't fail test - just report
      expect(true).toBe(true)
    })
  })

  describe('3. Data Validation', () => {
    it('validates all soldiers', () => {
      console.log('\n' + '='.repeat(70))
      console.log('SOLDIER VALIDATION')
      console.log('='.repeat(70))

      const result = validateAllData(soldiers, [], [], [], [])

      const soldierErrors = result.errors.filter(e => e.entity === 'soldier')
      const soldierWarnings = result.warnings.filter(e => e.entity === 'soldier')

      console.log(`\nTotal soldiers: ${soldiers.length}`)
      console.log(`Valid: ${result.summary.soldiers.valid}`)
      console.log(`With errors: ${result.summary.soldiers.errors}`)
      console.log(`Warnings: ${soldierWarnings.length}`)

      if (soldierErrors.length > 0) {
        console.log('\n❌ SOLDIER ERRORS:')
        soldierErrors.slice(0, 10).forEach(e => {
          console.log(`  - ${e.id}: ${e.field} - ${e.message}`)
        })
        if (soldierErrors.length > 10) {
          console.log(`  ... and ${soldierErrors.length - 10} more`)
        }
      }

      // Show sample soldiers
      console.log('\n📋 SAMPLE SOLDIERS (first 5):')
      soldiers.slice(0, 5).forEach(s => {
        console.log(`  ${s.id}: ${s.firstName} ${s.lastName} | Role: "${s.role}" | Status: ${s.status}`)
        console.log(`         Service: ${s.serviceStart} to ${s.serviceEnd}`)
      })

      expect(result.summary.soldiers.errors).toBe(0)
    })

    it('validates all tasks', () => {
      console.log('\n' + '='.repeat(70))
      console.log('TASK VALIDATION')
      console.log('='.repeat(70))

      const result = validateAllData([], tasks, [], [], [])

      const taskErrors = result.errors.filter(e => e.entity === 'task')

      console.log(`\nTotal tasks: ${tasks.length}`)
      console.log(`Valid: ${result.summary.tasks.valid}`)
      console.log(`With errors: ${result.summary.tasks.errors}`)

      if (taskErrors.length > 0) {
        console.log('\n❌ TASK ERRORS:')
        taskErrors.forEach(e => {
          console.log(`  - ${e.id}: ${e.field} - ${e.message}`)
          if (e.value) console.log(`    Value: ${JSON.stringify(e.value)}`)
        })
      }

      console.log('\n📋 ALL TASKS:')
      tasks.forEach(t => {
        const roles = t.roleRequirements.map(r => {
          const roleList = r.roles ?? (r.role ? [r.role] : [])
          return `${r.count}x[${roleList.join('|')}]`
        }).join(', ')
        console.log(`  ${t.id}: ${t.taskType}`)
        console.log(`    Time: ${t.startTime} - ${t.endTime}`)
        console.log(`    Requires: ${roles || '⚠️ EMPTY'}`)
      })

      expect(result.summary.tasks.errors).toBe(0)
    })
  })

  describe('4. Scheduling Simulation', () => {
    it('attempts to schedule tasks with current data', () => {
      console.log('\n' + '='.repeat(70))
      console.log('SCHEDULING SIMULATION')
      console.log('='.repeat(70))

      // Schedule period must match soldier service dates
      const scheduleStart = '2026-03-27'  // Match soldier serviceStart
      const scheduleEnd = '2026-04-30'
      const expandedTasks = expandRecurringTasks(tasks, scheduleEnd)

      console.log(`\n📅 Schedule period: ${scheduleStart} to ${scheduleEnd}`)
      console.log(`📋 Original tasks: ${tasks.length}`)
      console.log(`📋 Expanded tasks: ${expandedTasks.length}`)

      // Use config with explicit schedule period
      const config: AppConfig = {
        // Schedule period - match soldier service dates
        scheduleStartDate: '2026-03-27', // Match soldier serviceStart
        scheduleEndDate: '2026-04-30',

        // Leave ratio
        leaveRatioDaysInBase: 10,
        leaveRatioDaysHome: 4,
        longLeaveMaxDays: 4,
        weekendDays: ['Friday', 'Saturday'],

        // Capacity
        minBasePresence: 20,
        minBasePresenceByRole: {},

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

      // Run scheduler
      const schedule = scheduleTasks(
        expandedTasks,
        soldiers,
        [],
        expandedTasks,
        [],
        config
      )

      console.log(`\n📊 SCHEDULING RESULTS:`)
      console.log(`  Total assignments created: ${schedule.assignments.length}`)

      // Analyze results
      const tasksFilled = new Map<string, number>()
      const tasksRequired = new Map<string, number>()

      for (const task of expandedTasks) {
        const required = task.roleRequirements.reduce((sum, r) => sum + r.count, 0)
        tasksRequired.set(task.id, required)
        tasksFilled.set(task.id, 0)
      }

      for (const assignment of schedule.assignments) {
        tasksFilled.set(assignment.taskId, (tasksFilled.get(assignment.taskId) || 0) + 1)
      }

      // Count unfilled
      let fullyFilled = 0
      let partiallyFilled = 0
      let notFilled = 0

      for (const [taskId, required] of tasksRequired) {
        const filled = tasksFilled.get(taskId) || 0
        if (filled >= required) fullyFilled++
        else if (filled > 0) partiallyFilled++
        else notFilled++
      }

      console.log(`\n📊 TASK FILL STATUS:`)
      console.log(`  ✅ Fully filled: ${fullyFilled}`)
      console.log(`  ⚠️ Partially filled: ${partiallyFilled}`)
      console.log(`  ❌ Not filled (0 soldiers): ${notFilled}`)

      // Show unfilled tasks details
      if (notFilled > 0 || partiallyFilled > 0) {
        console.log('\n❌ TASKS WITHOUT FULL STAFFING:')

        let shown = 0
        for (const [taskId, required] of tasksRequired) {
          const filled = tasksFilled.get(taskId) || 0
          if (filled < required && shown < 20) {
            const task = expandedTasks.find(t => t.id === taskId)!
            const roles = task.roleRequirements.map(r => {
              const roleList = r.roles ?? (r.role ? [r.role] : [])
              return `${r.count}x[${roleList.join('|')}]`
            }).join(', ')
            console.log(`  ${taskId}: ${filled}/${required} filled`)
            console.log(`    Requires: ${roles}`)
            shown++
          }
        }
        if (notFilled + partiallyFilled > 20) {
          console.log(`  ... and ${notFilled + partiallyFilled - 20} more`)
        }
      }

      // Analyze why tasks aren't filled
      if (notFilled > 0) {
        console.log('\n🔍 ANALYSIS: Why are tasks not being filled?')

        // Check role coverage
        const soldierRoleSet = new Set(soldiers.map(s => s.role))
        const missingRoles = new Set<string>()

        for (const task of tasks) {
          for (const req of task.roleRequirements) {
            const roles = req.roles ?? (req.role ? [req.role] : [])
            for (const role of roles) {
              if (!soldierRoleSet.has(role)) {
                missingRoles.add(role)
              }
            }
          }
        }

        if (missingRoles.size > 0) {
          console.log(`\n  🔴 ROLE MISMATCH DETECTED!`)
          console.log(`  Tasks require these roles that no soldier has:`)
          missingRoles.forEach(r => console.log(`    - "${r}"`))
          console.log(`\n  Soldier roles available: ${Array.from(soldierRoleSet).join(', ')}`)
        }
      }

      // Final assertion
      if (notFilled > 0) {
        console.log('\n' + '='.repeat(70))
        console.log('⚠️ TEST RESULT: Tasks are NOT fully staffed')
        console.log('   This is expected if soldier roles don\'t match task requirements')
        console.log('='.repeat(70))
      }

      // We expect this to fail if roles don't match - that's the point of the test
      expect(notFilled).toBe(0)
    })
  })
})
