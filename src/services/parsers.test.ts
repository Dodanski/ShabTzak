import { describe, it, expect } from 'vitest'
import { parseSoldier, parseTask, parseLeaveRequest, parseLeaveAssignment } from './parsers'

describe('Data Parsers', () => {
  describe('parseSoldier', () => {
    const headerRow = [
      'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
      'InitialFairness', 'CurrentFairness', 'Status',
      'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
    ]
    const dataRow = [
      '1', 'David Cohen', 'Driver', '2026-01-01', '2026-08-31',
      '0', '2.5', 'Active',
      '16', '1', '2', '3',
    ]

    it('parses a soldier row correctly', () => {
      const soldier = parseSoldier(dataRow, headerRow)
      expect(soldier.id).toBe('1')
      expect(soldier.name).toBe('David Cohen')
      expect(soldier.role).toBe('Driver')
      expect(soldier.serviceStart).toBe('2026-01-01')
      expect(soldier.serviceEnd).toBe('2026-08-31')
      expect(soldier.initialFairness).toBe(0)
      expect(soldier.currentFairness).toBe(2.5)
      expect(soldier.status).toBe('Active')
      expect(soldier.hoursWorked).toBe(16)
      expect(soldier.weekendLeavesCount).toBe(1)
      expect(soldier.midweekLeavesCount).toBe(2)
      expect(soldier.afterLeavesCount).toBe(3)
    })

    it('throws for missing required fields', () => {
      expect(() => parseSoldier([], headerRow)).toThrow()
    })
  })

  describe('parseLeaveRequest', () => {
    const headerRow = [
      'ID', 'SoldierID', 'StartDate', 'EndDate',
      'LeaveType', 'ConstraintType', 'Priority', 'Status',
    ]
    const dataRow = [
      'req-1', 'soldier-1', '2026-03-20', '2026-03-22',
      'After', 'Family event', '7', 'Pending',
    ]

    it('parses a leave request row correctly', () => {
      const req = parseLeaveRequest(dataRow, headerRow)
      expect(req.id).toBe('req-1')
      expect(req.soldierId).toBe('soldier-1')
      expect(req.startDate).toBe('2026-03-20')
      expect(req.endDate).toBe('2026-03-22')
      expect(req.leaveType).toBe('After')
      expect(req.constraintType).toBe('Family event')
      expect(req.priority).toBe(7)
      expect(req.status).toBe('Pending')
    })
  })

  describe('parseTask', () => {
    const headerRow = [
      'ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours',
      'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays',
    ]
    const dataRow = [
      'task-1', 'Guard', '2026-03-20T08:00:00', '2026-03-20T16:00:00', '8',
      '[{"role":"Driver","count":1}]', '6', 'false', '',
    ]

    it('parses a task row correctly', () => {
      const task = parseTask(dataRow, headerRow)
      expect(task.id).toBe('task-1')
      expect(task.taskType).toBe('Guard')
      expect(task.durationHours).toBe(8)
      expect(task.roleRequirements).toEqual([{ role: 'Driver', count: 1 }])
      expect(task.minRestAfter).toBe(6)
      expect(task.isSpecial).toBe(false)
    })
  })

  describe('parseLeaveAssignment', () => {
    const headerRow = [
      'ID', 'SoldierID', 'StartDate', 'EndDate',
      'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt',
    ]
    const dataRow = [
      'assign-1', 'soldier-2', '2026-03-20', '2026-03-21',
      'After', 'true', 'false', 'req-1', '2026-02-01T10:00:00',
    ]

    it('parses a leave assignment row correctly', () => {
      const assignment = parseLeaveAssignment(dataRow, headerRow)
      expect(assignment.id).toBe('assign-1')
      expect(assignment.soldierId).toBe('soldier-2')
      expect(assignment.isWeekend).toBe(true)
      expect(assignment.isLocked).toBe(false)
      expect(assignment.requestId).toBe('req-1')
    })
  })
})
