import { describe, it, expect, beforeEach } from 'vitest'
import { TaskRepository } from './taskRepository'
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

describe('TaskRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: TaskRepository

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
    repo = new TaskRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all tasks', async () => {
      mockDatabase.tasks = [
        {
          id: 'task-1',
          taskType: 'Guard',
          startTime: '2026-03-20T08:00:00',
          endTime: '2026-03-20T16:00:00',
          durationHours: 8,
          roleRequirements: [{ roles: ['Driver'], count: 1 }],
          minRestAfter: 6,
          isSpecial: false,
        },
        {
          id: 'task-2',
          taskType: 'Pillbox',
          startTime: '2026-03-21T00:00:00',
          endTime: '2026-03-25T00:00:00',
          durationHours: 96,
          roleRequirements: [{ roles: ['Any'], count: 2 }],
          minRestAfter: 8,
          isSpecial: true,
          specialDurationDays: 4,
        },
      ]

      const tasks = await repo.list()
      expect(tasks).toHaveLength(2)
      expect(tasks[0].taskType).toBe('Guard')
      expect(tasks[1].isSpecial).toBe(true)
      expect(tasks[1].specialDurationDays).toBe(4)
    })

    it('returns empty array when no tasks exist', async () => {
      mockDatabase.tasks = []
      expect(await repo.list()).toHaveLength(0)
    })
  })

  describe('getById()', () => {
    it('returns task by id', async () => {
      mockDatabase.tasks = [
        {
          id: 'task-1',
          taskType: 'Guard',
          startTime: '2026-03-20T08:00:00',
          endTime: '2026-03-20T16:00:00',
          durationHours: 8,
          roleRequirements: [{ roles: ['Driver'], count: 1 }],
          minRestAfter: 6,
          isSpecial: false,
        },
        {
          id: 'task-2',
          taskType: 'Pillbox',
          startTime: '2026-03-21T00:00:00',
          endTime: '2026-03-25T00:00:00',
          durationHours: 96,
          roleRequirements: [{ roles: ['Any'], count: 2 }],
          minRestAfter: 8,
          isSpecial: true,
          specialDurationDays: 4,
        },
      ]

      const task = await repo.getById('task-2')
      expect(task).not.toBeNull()
      expect(task!.taskType).toBe('Pillbox')
    })

    it('returns null for unknown id', async () => {
      mockDatabase.tasks = []
      expect(await repo.getById('missing')).toBeNull()
    })
  })

  describe('createTask()', () => {
    it('creates a new task and adds it to the database', async () => {
      const task = await repo.createTask({
        taskType: 'Patrol',
        startTime: '2026-04-01T06:00:00',
        endTime: '2026-04-01T12:00:00',
        roleRequirements: [{ roles: ['Driver'], count: 1 }, { roles: ['Medic'], count: 1 }],
        minRestAfter: 6,
        isSpecial: false,
      })

      expect(mockDatabase.tasks).toHaveLength(1)
      expect(task.taskType).toBe('Patrol')
      expect(task.roleRequirements).toHaveLength(2)
      expect(task.durationHours).toBe(6)
      expect(task.id).toBe('Patrol')
      expect(mockDatabase.tasks[0]).toMatchObject({
        taskType: 'Patrol',
        durationHours: 6,
      })
    })

    it('calculates durationHours from start and end times', async () => {
      const task = await repo.createTask({
        taskType: 'Guard',
        startTime: '2026-04-01T08:00:00',
        endTime: '2026-04-01T20:00:00',
        roleRequirements: [{ roles: ['Any'], count: 1 }],
      })

      expect(task.durationHours).toBe(12)
      expect(mockDatabase.tasks[0].durationHours).toBe(12)
    })

    it('sets default values for optional fields', async () => {
      const task = await repo.createTask({
        taskType: 'Guard',
        startTime: '2026-04-01T08:00:00',
        endTime: '2026-04-01T16:00:00',
        roleRequirements: [{ roles: ['Driver'], count: 2 }],
      })

      expect(task.minRestAfter).toBe(6)
      expect(task.isSpecial).toBe(false)
    })
  })
})
