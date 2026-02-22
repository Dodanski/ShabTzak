import { describe, it, expect } from 'vitest'
import { serializeSoldier, serializeTask, serializeLeaveRequest, serializeLeaveAssignment } from './serializers'
import type { Soldier, Task, LeaveRequest, LeaveAssignment } from '../models'

describe('Data Serializers', () => {
  describe('serializeSoldier', () => {
    it('serializes a soldier to a row', () => {
      const soldier: Soldier = {
        id: '1',
        name: 'David Cohen',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
        initialFairness: 0,
        currentFairness: 2.5,
        status: 'Active',
        hoursWorked: 16,
        weekendLeavesCount: 1,
        midweekLeavesCount: 2,
        afterLeavesCount: 3,
      }
      const row = serializeSoldier(soldier)
      expect(row).toEqual([
        '1', 'David Cohen', 'Driver', '2026-01-01', '2026-08-31',
        '0', '2.5', 'Active', '16', '1', '2', '3',
      ])
    })

    it('produces same length as header row', () => {
      const soldier: Soldier = {
        id: '2', name: 'Moshe', role: 'Medic',
        serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
        initialFairness: 1, currentFairness: 1, status: 'Active',
        hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
      }
      expect(serializeSoldier(soldier)).toHaveLength(12)
    })
  })

  describe('serializeLeaveRequest', () => {
    it('serializes a leave request to a row', () => {
      const req: LeaveRequest = {
        id: 'req-1',
        soldierId: 'soldier-1',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        leaveType: 'After',
        constraintType: 'Family event',
        priority: 7,
        status: 'Pending',
      }
      const row = serializeLeaveRequest(req)
      expect(row).toEqual([
        'req-1', 'soldier-1', '2026-03-20', '2026-03-22',
        'After', 'Family event', '7', 'Pending',
      ])
    })
  })

  describe('serializeTask', () => {
    it('serializes a task to a row', () => {
      const task: Task = {
        id: 'task-1',
        taskType: 'Guard',
        startTime: '2026-03-20T08:00:00',
        endTime: '2026-03-20T16:00:00',
        durationHours: 8,
        roleRequirements: [{ role: 'Driver', count: 1 }],
        minRestAfter: 6,
        isSpecial: false,
      }
      const row = serializeTask(task)
      expect(row[0]).toBe('task-1')
      expect(row[1]).toBe('Guard')
      expect(row[4]).toBe('8')
      expect(JSON.parse(row[5])).toEqual([{ role: 'Driver', count: 1 }])
      expect(row[7]).toBe('false')
    })
  })

  describe('serializeLeaveAssignment', () => {
    it('serializes a leave assignment to a row', () => {
      const assignment: LeaveAssignment = {
        id: 'assign-1',
        soldierId: 'soldier-2',
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        leaveType: 'After',
        isWeekend: true,
        isLocked: false,
        requestId: 'req-1',
        createdAt: '2026-02-01T10:00:00',
      }
      const row = serializeLeaveAssignment(assignment)
      expect(row[0]).toBe('assign-1')
      expect(row[5]).toBe('true')
      expect(row[6]).toBe('false')
      expect(row[7]).toBe('req-1')
    })
  })
})
