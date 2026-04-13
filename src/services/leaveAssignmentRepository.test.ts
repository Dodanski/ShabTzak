import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
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

describe('LeaveAssignmentRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: LeaveAssignmentRepository

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
    repo = new LeaveAssignmentRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all leave assignments', async () => {
      mockDatabase.leaveAssignments = [
        {
          id: 'a1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          isWeekend: true,
          isLocked: false,
          requestId: 'req-1',
          createdAt: '2026-02-01T10:00:00',
        },
        {
          id: 'a2',
          soldierId: 's2',
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          leaveType: 'Long',
          isWeekend: false,
          isLocked: true,
          requestId: 'req-2',
          createdAt: '2026-02-01T11:00:00',
        },
      ]

      const assignments = await repo.list()
      expect(assignments).toHaveLength(2)
      expect(assignments[0].isWeekend).toBe(true)
      expect(assignments[1].isLocked).toBe(true)
    })

    it('returns empty array when no assignments exist', async () => {
      mockDatabase.leaveAssignments = []
      expect(await repo.list()).toHaveLength(0)
    })
  })

  describe('listBySoldier()', () => {
    it('returns only assignments for a given soldier', async () => {
      mockDatabase.leaveAssignments = [
        {
          id: 'a1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          isWeekend: true,
          isLocked: false,
          requestId: 'req-1',
          createdAt: '2026-02-01T10:00:00',
        },
        {
          id: 'a2',
          soldierId: 's2',
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          leaveType: 'Long',
          isWeekend: false,
          isLocked: true,
          requestId: 'req-2',
          createdAt: '2026-02-01T11:00:00',
        },
      ]

      const assignments = await repo.listBySoldier('s1')
      expect(assignments).toHaveLength(1)
      expect(assignments[0].id).toBe('a1')
    })
  })

  describe('create()', () => {
    it('creates and adds leave assignment to database', async () => {
      const assignment = await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'After',
        isWeekend: false,
        requestId: 'req-3',
      })

      expect(mockDatabase.leaveAssignments).toHaveLength(1)
      expect(assignment.soldierId).toBe('s3')
      expect(assignment.isLocked).toBe(false)
      expect(assignment.id).toBeTruthy()
    })
  })

  describe('setLocked()', () => {
    it('locks an assignment', async () => {
      mockDatabase.leaveAssignments = [{
        id: 'a1',
        soldierId: 's1',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        leaveType: 'After',
        isWeekend: true,
        isLocked: false,
        requestId: 'req-1',
        createdAt: '2026-02-01T10:00:00',
      }]

      await repo.setLocked('a1', true)

      expect(mockDatabase.leaveAssignments[0].isLocked).toBe(true)
    })

    it('throws if assignment not found', async () => {
      mockDatabase.leaveAssignments = []
      await expect(repo.setLocked('ghost', true)).rejects.toThrow()
    })
  })

  describe('createBatch()', () => {
    it('creates multiple assignments at once', async () => {
      const assignments = await repo.createBatch([
        {
          soldierId: 's1',
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          leaveType: 'After',
          isWeekend: false,
        },
        {
          soldierId: 's2',
          startDate: '2026-04-05',
          endDate: '2026-04-07',
          leaveType: 'Long',
          isWeekend: true,
        },
      ])

      expect(mockDatabase.leaveAssignments).toHaveLength(2)
      expect(assignments).toHaveLength(2)
      expect(assignments[0].soldierId).toBe('s1')
      expect(assignments[1].soldierId).toBe('s2')
    })
  })

  describe('deleteByIds()', () => {
    it('deletes specific assignments by id', async () => {
      mockDatabase.leaveAssignments = [
        {
          id: 'a1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          isWeekend: true,
          isLocked: false,
          requestId: 'req-1',
          createdAt: '2026-02-01T10:00:00',
        },
        {
          id: 'a2',
          soldierId: 's2',
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          leaveType: 'Long',
          isWeekend: false,
          isLocked: true,
          requestId: 'req-2',
          createdAt: '2026-02-01T11:00:00',
        },
      ]

      await repo.deleteByIds(['a1'])

      expect(mockDatabase.leaveAssignments).toHaveLength(1)
      expect(mockDatabase.leaveAssignments[0].id).toBe('a2')
    })

    it('handles empty id list gracefully', async () => {
      mockDatabase.leaveAssignments = [
        {
          id: 'a1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          isWeekend: true,
          isLocked: false,
          requestId: 'req-1',
          createdAt: '2026-02-01T10:00:00',
        },
      ]

      await repo.deleteByIds([])

      expect(mockDatabase.leaveAssignments).toHaveLength(1)
    })
  })
})
