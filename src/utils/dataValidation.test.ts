import { describe, it, expect } from 'vitest'
import {
  validateSoldier,
  validateTask,
  validateLeaveRequest,
  validateLeaveAssignment,
  validateTaskAssignment,
  validateConfig,
  crossValidate,
  validateAllData,
  formatValidationResult,
} from './dataValidation'
import type { Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment, AppConfig } from '../models'

// Test data factory helpers
function makeSoldier(overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: 's1',
    firstName: 'David',
    lastName: 'Cohen',
    role: 'Driver',
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    taskType: 'Guard',
    startTime: '2026-03-20T08:00:00',
    endTime: '2026-03-20T16:00:00',
    durationHours: 8,
    roleRequirements: [{ roles: ['Driver'], count: 1 }],
    minRestAfter: 6,
    isSpecial: false,
    ...overrides,
  }
}

function makeLeaveRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'req1',
    soldierId: 's1',
    startDate: '2026-03-20',
    endDate: '2026-03-22',
    leaveType: 'After',
    constraintType: 'Preference',
    priority: 5,
    status: 'Pending',
    ...overrides,
  }
}

function makeLeaveAssignment(overrides: Partial<LeaveAssignment> = {}): LeaveAssignment {
  return {
    id: 'la1',
    soldierId: 's1',
    startDate: '2026-03-20',
    endDate: '2026-03-22',
    leaveType: 'After',
    isWeekend: false,
    isLocked: false,
    createdAt: '2026-03-01T00:00:00',
    ...overrides,
  }
}

function makeTaskAssignment(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    scheduleId: 'sched1',
    taskId: 't1',
    soldierId: 's1',
    assignedRole: 'Driver',
    isLocked: false,
    createdAt: '2026-03-01T00:00:00',
    createdBy: 'admin',
    ...overrides,
  }
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    leaveRatioDaysInBase: 10,
    leaveRatioDaysHome: 4,
    longLeaveMaxDays: 4,
    minBasePresence: 20,
    minBasePresenceByRole: {},
    maxDrivingHours: 8,
    defaultRestPeriod: 6,
    leaveBaseExitHour: '06:00',
    leaveBaseReturnHour: '22:00',
    ...overrides,
  } as AppConfig
}

describe('Data Validation', () => {
  describe('validateSoldier', () => {
    it('returns no errors for valid soldier', () => {
      const soldier = makeSoldier()
      const errors = validateSoldier(soldier)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for missing ID', () => {
      const soldier = makeSoldier({ id: '' })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'id' && e.severity === 'error')).toBe(true)
    })

    it('reports error for missing role', () => {
      const soldier = makeSoldier({ role: '' as any })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'role' && e.severity === 'error')).toBe(true)
    })

    it('reports error for invalid service start date', () => {
      const soldier = makeSoldier({ serviceStart: 'invalid' })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'serviceStart' && e.severity === 'error')).toBe(true)
    })

    it('reports error for invalid service end date', () => {
      const soldier = makeSoldier({ serviceEnd: 'not-a-date' })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'serviceEnd' && e.severity === 'error')).toBe(true)
    })

    it('reports error when end date is before start date', () => {
      const soldier = makeSoldier({ serviceStart: '2026-06-01', serviceEnd: '2026-01-01' })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.message.includes('before start date'))).toBe(true)
    })

    it('reports warning for invalid status', () => {
      const soldier = makeSoldier({ status: 'Unknown' as any })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'status' && e.severity === 'warning')).toBe(true)
    })

    it('reports warning for soldier with no name', () => {
      const soldier = makeSoldier({ firstName: '', lastName: '' })
      const errors = validateSoldier(soldier)
      expect(errors.some(e => e.field === 'name' && e.severity === 'warning')).toBe(true)
    })
  })

  describe('validateTask', () => {
    it('returns no errors for valid task', () => {
      const task = makeTask()
      const errors = validateTask(task)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for missing ID', () => {
      const task = makeTask({ id: '' })
      const errors = validateTask(task)
      expect(errors.some(e => e.field === 'id' && e.severity === 'error')).toBe(true)
    })

    it('reports error for missing task type', () => {
      const task = makeTask({ taskType: '' })
      const errors = validateTask(task)
      expect(errors.some(e => e.field === 'taskType' && e.severity === 'error')).toBe(true)
    })

    it('reports error for empty roleRequirements', () => {
      const task = makeTask({ roleRequirements: [] })
      const errors = validateTask(task)
      expect(errors.some(e => e.field === 'roleRequirements' && e.message.includes('no role requirements'))).toBe(true)
    })

    it('reports error for roleRequirements with empty roles array', () => {
      const task = makeTask({ roleRequirements: [{ roles: [], count: 1 }] })
      const errors = validateTask(task)
      expect(errors.some(e => e.message.includes('no roles specified'))).toBe(true)
    })

    it('reports error for roleRequirements with count 0', () => {
      const task = makeTask({ roleRequirements: [{ roles: ['Driver'], count: 0 }] })
      const errors = validateTask(task)
      expect(errors.some(e => e.message.includes('count must be positive'))).toBe(true)
    })

    it('accepts time-only format for startTime', () => {
      const task = makeTask({ startTime: '08:00:00', endTime: '16:00:00' })
      const errors = validateTask(task)
      const timeErrors = errors.filter(e => e.field === 'startTime' || e.field === 'endTime')
      expect(timeErrors).toHaveLength(0)
    })

    it('handles old format with single role field', () => {
      const task = makeTask({ roleRequirements: [{ role: 'Driver', count: 1 } as any] })
      const errors = validateTask(task)
      // Should not report missing roles since it falls back to 'role' field
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })
  })

  describe('validateLeaveRequest', () => {
    it('returns no errors for valid leave request', () => {
      const request = makeLeaveRequest()
      const errors = validateLeaveRequest(request)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for missing soldier ID', () => {
      const request = makeLeaveRequest({ soldierId: '' })
      const errors = validateLeaveRequest(request)
      expect(errors.some(e => e.field === 'soldierId')).toBe(true)
    })

    it('reports error when end date is before start date', () => {
      const request = makeLeaveRequest({ startDate: '2026-03-25', endDate: '2026-03-20' })
      const errors = validateLeaveRequest(request)
      expect(errors.some(e => e.message.includes('before start date'))).toBe(true)
    })
  })

  describe('validateLeaveAssignment', () => {
    it('returns no errors for valid leave assignment', () => {
      const assignment = makeLeaveAssignment()
      const errors = validateLeaveAssignment(assignment)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for missing soldier ID', () => {
      const assignment = makeLeaveAssignment({ soldierId: '' })
      const errors = validateLeaveAssignment(assignment)
      expect(errors.some(e => e.field === 'soldierId')).toBe(true)
    })
  })

  describe('validateTaskAssignment', () => {
    it('returns no errors for valid task assignment', () => {
      const assignment = makeTaskAssignment()
      const errors = validateTaskAssignment(assignment)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for missing task ID', () => {
      const assignment = makeTaskAssignment({ taskId: '' })
      const errors = validateTaskAssignment(assignment)
      expect(errors.some(e => e.field === 'taskId')).toBe(true)
    })

    it('reports error for missing assigned role', () => {
      const assignment = makeTaskAssignment({ assignedRole: '' as any })
      const errors = validateTaskAssignment(assignment)
      expect(errors.some(e => e.field === 'assignedRole')).toBe(true)
    })
  })

  describe('validateConfig', () => {
    it('returns no errors for valid config', () => {
      const config = makeConfig()
      const errors = validateConfig(config)
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for invalid leave ratio', () => {
      const config = makeConfig({ leaveRatioDaysInBase: 0 })
      const errors = validateConfig(config)
      expect(errors.some(e => e.field === 'leaveRatioDaysInBase')).toBe(true)
    })

    it('reports error for invalid exit hour format', () => {
      const config = makeConfig({ leaveBaseExitHour: 'invalid' })
      const errors = validateConfig(config)
      expect(errors.some(e => e.field === 'leaveBaseExitHour')).toBe(true)
    })
  })

  describe('crossValidate', () => {
    it('returns no errors for consistent data', () => {
      const soldiers = [makeSoldier({ id: 's1', role: 'Driver' })]
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Driver'], count: 1 }] })]
      const errors = crossValidate(soldiers, tasks, [], [], [])
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
    })

    it('reports error for role mismatch between soldiers and tasks', () => {
      const soldiers = [makeSoldier({ id: 's1', role: 'Medic' })]
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Driver'], count: 1 }] })]
      const errors = crossValidate(soldiers, tasks, [], [], [])
      expect(errors.some(e => e.message.includes('Tasks require roles'))).toBe(true)
    })

    it('does not report mismatch for Any role', () => {
      const soldiers = [makeSoldier({ id: 's1', role: 'Medic' })]
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Any'], count: 1 }] })]
      const errors = crossValidate(soldiers, tasks, [], [], [])
      expect(errors.filter(e => e.message.includes('Tasks require roles'))).toHaveLength(0)
    })

    it('reports error for leave request referencing non-existent soldier', () => {
      const soldiers = [makeSoldier({ id: 's1' })]
      const leaveRequests = [makeLeaveRequest({ soldierId: 's999' })]
      const errors = crossValidate(soldiers, [], leaveRequests, [], [])
      expect(errors.some(e => e.message.includes('non-existent soldier'))).toBe(true)
    })

    it('reports error when no active soldiers exist', () => {
      const soldiers = [makeSoldier({ id: 's1', status: 'Inactive' })]
      const errors = crossValidate(soldiers, [], [], [], [])
      expect(errors.some(e => e.message.includes('No active soldiers'))).toBe(true)
    })
  })

  describe('validateAllData', () => {
    it('returns valid=true for valid data', () => {
      const soldiers = [makeSoldier()]
      const tasks = [makeTask()]
      const result = validateAllData(soldiers, tasks, [], [], [])
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns valid=false when errors exist', () => {
      const soldiers = [makeSoldier({ role: '' as any })]
      const tasks = [makeTask()]
      const result = validateAllData(soldiers, tasks, [], [], [])
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('detects role mismatches in summary', () => {
      const soldiers = [makeSoldier({ role: 'Medic' })]
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Driver'], count: 1 }] })]
      const result = validateAllData(soldiers, tasks, [], [], [])
      expect(result.summary.roleMismatches).toContain('Driver')
    })

    it('calculates summary statistics correctly', () => {
      const soldiers = [
        makeSoldier({ id: 's1', role: 'Driver' }),
        makeSoldier({ id: 's2', role: '' as any }), // Invalid
      ]
      const tasks = [
        makeTask({ id: 't1' }),
        makeTask({ id: 't2', roleRequirements: [] }), // Invalid
      ]
      const result = validateAllData(soldiers, tasks, [], [], [])
      expect(result.summary.soldiers.total).toBe(2)
      expect(result.summary.soldiers.errors).toBe(1)
      expect(result.summary.tasks.total).toBe(2)
      expect(result.summary.tasks.errors).toBe(1)
    })
  })

  describe('formatValidationResult', () => {
    it('formats valid result correctly', () => {
      const result = validateAllData([makeSoldier()], [makeTask()], [], [], [])
      const formatted = formatValidationResult(result)
      expect(formatted).toContain('DATA IS VALID')
      expect(formatted).toContain('Soldiers: 1/1 valid')
    })

    it('formats errors correctly', () => {
      const soldiers = [makeSoldier({ role: '' as any })]
      const result = validateAllData(soldiers, [], [], [], [])
      const formatted = formatValidationResult(result)
      expect(formatted).toContain('ERROR')
      expect(formatted).toContain('role')
    })

    it('shows role mismatches', () => {
      const soldiers = [makeSoldier({ role: 'Medic' })]
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Driver', 'Fighter'], count: 1 }] })]
      const result = validateAllData(soldiers, tasks, [], [], [])
      const formatted = formatValidationResult(result)
      expect(formatted).toContain('ROLE MISMATCH')
    })
  })

  describe('Real-world scenarios', () => {
    it('detects common issue: task with malformed JSON roleRequirements', () => {
      // This simulates what happens when JSON parsing fails and returns empty array
      const task = makeTask({ roleRequirements: [] })
      const errors = validateTask(task)
      expect(errors.some(e => e.message.includes('no role requirements'))).toBe(true)
    })

    it('detects common issue: soldier with Hebrew role vs English task role', () => {
      const soldiers = [makeSoldier({ role: 'נהג' })] // Hebrew "Driver"
      const tasks = [makeTask({ roleRequirements: [{ roles: ['Driver'], count: 1 }] })]
      const errors = crossValidate(soldiers, tasks, [], [], [])
      expect(errors.some(e => e.message.includes('Tasks require roles'))).toBe(true)
    })

    it('detects common issue: all soldiers inactive', () => {
      const soldiers = [
        makeSoldier({ id: 's1', status: 'Inactive' }),
        makeSoldier({ id: 's2', status: 'Inactive' }),
      ]
      const errors = crossValidate(soldiers, [], [], [], [])
      expect(errors.some(e => e.message.includes('No active soldiers'))).toBe(true)
    })

    it('handles task with old single-role format', () => {
      const task: Task = {
        id: 't1',
        taskType: 'Guard',
        startTime: '08:00:00',
        endTime: '16:00:00',
        durationHours: 8,
        roleRequirements: [{ role: 'Driver', count: 1 } as any], // Old format
        minRestAfter: 6,
        isSpecial: false,
      }
      const soldiers = [makeSoldier({ role: 'Driver' })]
      const result = validateAllData(soldiers, [task], [], [], [])
      // Should not have role mismatch since old format is supported
      expect(result.summary.roleMismatches).toHaveLength(0)
    })
  })
})
