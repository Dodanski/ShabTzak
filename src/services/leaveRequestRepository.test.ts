import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveRequestRepository } from './leaveRequestRepository'
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

describe('LeaveRequestRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: LeaveRequestRepository

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
    repo = new LeaveRequestRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all leave requests', async () => {
      mockDatabase.leaveRequests = [
        {
          id: 'req-1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          constraintType: 'Family event',
          priority: 7,
          status: 'Pending',
        },
        {
          id: 'req-2',
          soldierId: 's2',
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          leaveType: 'Long',
          constraintType: 'University exam',
          priority: 9,
          status: 'Approved',
        },
      ]

      const requests = await repo.list()
      expect(requests).toHaveLength(2)
      expect(requests[0].id).toBe('req-1')
      expect(requests[1].status).toBe('Approved')
    })

    it('returns empty array when no requests exist', async () => {
      mockDatabase.leaveRequests = []
      expect(await repo.list()).toHaveLength(0)
    })
  })

  describe('getById()', () => {
    it('returns request by id', async () => {
      mockDatabase.leaveRequests = [
        {
          id: 'req-1',
          soldierId: 's1',
          startDate: '2026-03-20',
          endDate: '2026-03-22',
          leaveType: 'After',
          constraintType: 'Family event',
          priority: 7,
          status: 'Pending',
        },
        {
          id: 'req-2',
          soldierId: 's2',
          startDate: '2026-03-25',
          endDate: '2026-03-27',
          leaveType: 'Long',
          constraintType: 'University exam',
          priority: 9,
          status: 'Approved',
        },
      ]

      const req = await repo.getById('req-2')
      expect(req).not.toBeNull()
      expect(req!.constraintType).toBe('University exam')
    })

    it('returns null for unknown id', async () => {
      mockDatabase.leaveRequests = []
      expect(await repo.getById('missing')).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates a new leave request and adds it to the database', async () => {
      const req = await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'Long',
        constraintType: 'Medical appointment',
        priority: 8,
      })

      expect(mockDatabase.leaveRequests).toHaveLength(1)
      expect(req.soldierId).toBe('s3')
      expect(req.status).toBe('Pending')
      expect(req.id).toBeTruthy()
      expect(mockDatabase.leaveRequests[0]).toMatchObject({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        priority: 8,
        status: 'Pending',
      })
    })

    it('allows multiple leave requests to be created', async () => {
      const req1 = await repo.create({
        soldierId: 's1',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'Long',
        constraintType: 'Medical',
        priority: 5,
      })

      const req2 = await repo.create({
        soldierId: 's2',
        startDate: '2026-04-10',
        endDate: '2026-04-12',
        leaveType: 'After',
        constraintType: 'Vacation',
        priority: 7,
      })

      expect(mockDatabase.leaveRequests).toHaveLength(2)
      expect(mockDatabase.leaveRequests[0].id).toBe(req1.id)
      expect(mockDatabase.leaveRequests[1].id).toBe(req2.id)
    })
  })

  describe('updateStatus()', () => {
    it('updates the status of a request', async () => {
      mockDatabase.leaveRequests = [{
        id: 'req-1',
        soldierId: 's1',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        leaveType: 'After',
        constraintType: 'Family event',
        priority: 7,
        status: 'Pending',
      }]

      await repo.updateStatus('req-1', 'Approved')

      expect(mockDatabase.leaveRequests[0].status).toBe('Approved')
    })

    it('throws if request not found', async () => {
      mockDatabase.leaveRequests = []
      await expect(repo.updateStatus('ghost', 'Approved')).rejects.toThrow()
    })
  })

})
