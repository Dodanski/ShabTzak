import { describe, it, expect, beforeEach } from 'vitest'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { Database } from '../types/Database'
import type { useDatabase } from '../contexts/DatabaseContext'

const createMockDatabase = (): Database => ({
  version: 1,
  lastModified: new Date().toISOString(),
  soldiers: [],
  tasks: [],
  units: [],
  leaveRequests: [],
  leaveAssignments: [],
  taskAssignments: [],
  config: {
    scheduleStartDate: '2026-01-01',
    scheduleEndDate: '2026-12-31',
    leaveRatioDaysInBase: 10,
    leaveRatioDaysHome: 4,
    longLeaveMaxDays: 14,
    weekendDays: ['Friday', 'Saturday'],
    minBasePresence: 5,
    minBasePresenceByRole: { Driver: 2, Medic: 1, Commander: 1 },
    maxDrivingHours: 12,
    defaultRestPeriod: 8,
    taskTypeRestPeriods: {},
    adminEmails: [],
    leaveBaseExitHour: '16:00',
    leaveBaseReturnHour: '08:00'
  },
  roles: ['Driver', 'Medic', 'Commander', 'Fighter'],
  admins: [],
  commanders: []
})

describe('TaskAssignmentRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: TaskAssignmentRepository

  beforeEach(() => {
    mockDatabase = createMockDatabase()
    mockContext = {
      database: mockDatabase,
      loading: false,
      error: null,
      reload: async () => {},
      getData: () => mockDatabase,
      setData: (db: Database) => {
        Object.assign(mockDatabase, db)
      }
    }
    repo = new TaskAssignmentRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all task assignments', async () => {
      mockDatabase.taskAssignments = [
        { scheduleId: 'sched-1', taskId: 'task-1', soldierId: 's1', assignedRole: 'Driver', isLocked: false, createdAt: '2026-02-01T10:00:00', createdBy: 'admin' },
        { scheduleId: 'sched-2', taskId: 'task-1', soldierId: 's2', assignedRole: 'Medic', isLocked: true, createdAt: '2026-02-01T10:00:00', createdBy: 'admin' },
        { scheduleId: 'sched-3', taskId: 'task-2', soldierId: 's3', assignedRole: 'Any', isLocked: false, createdAt: '2026-02-01T11:00:00', createdBy: 'admin' },
      ]

      const assignments = await repo.list()
      expect(assignments).toHaveLength(3)
      expect(assignments[0].scheduleId).toBe('sched-1')
      expect(assignments[1].isLocked).toBe(true)
    })

    it('returns empty array when no assignments exist', async () => {
      mockDatabase.taskAssignments = []
      expect(await repo.list()).toHaveLength(0)
    })
  })

  describe('listByTask()', () => {
    it('returns only assignments for a given task', async () => {
      mockDatabase.taskAssignments = [
        { scheduleId: 'sched-1', taskId: 'task-1', soldierId: 's1', assignedRole: 'Driver', isLocked: false, createdAt: '2026-02-01T10:00:00', createdBy: 'admin' },
        { scheduleId: 'sched-2', taskId: 'task-1', soldierId: 's2', assignedRole: 'Medic', isLocked: true, createdAt: '2026-02-01T10:00:00', createdBy: 'admin' },
        { scheduleId: 'sched-3', taskId: 'task-2', soldierId: 's3', assignedRole: 'Any', isLocked: false, createdAt: '2026-02-01T11:00:00', createdBy: 'admin' },
      ]

      const assignments = await repo.listByTask('task-1')
      expect(assignments).toHaveLength(2)
      expect(assignments.every(a => a.taskId === 'task-1')).toBe(true)
    })
  })

  describe('create()', () => {
    it('creates and adds task assignment to database', async () => {
      const assignment = await repo.create({
        taskId: 'task-3',
        soldierId: 's4',
        assignedRole: 'Medic',
        createdBy: 'commander',
      })

      expect(mockDatabase.taskAssignments).toHaveLength(1)
      expect(assignment.taskId).toBe('task-3')
      expect(assignment.assignedRole).toBe('Medic')
      expect(assignment.isLocked).toBe(false)
      expect(assignment.scheduleId).toBeTruthy()
    })
  })

  describe('setLocked()', () => {
    it('locks an assignment', async () => {
      mockDatabase.taskAssignments = [
        { scheduleId: 'sched-1', taskId: 'task-1', soldierId: 's1', assignedRole: 'Driver', isLocked: false, createdAt: '2026-02-01T10:00:00', createdBy: 'admin' },
      ]

      await repo.setLocked('sched-1', true)

      expect(mockDatabase.taskAssignments[0].isLocked).toBe(true)
    })

    it('throws if assignment not found', async () => {
      mockDatabase.taskAssignments = []
      await expect(repo.setLocked('ghost', true)).rejects.toThrow()
    })
  })
})
