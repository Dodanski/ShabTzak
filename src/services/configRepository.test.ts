import { describe, it, expect, beforeEach } from 'vitest'
import { ConfigRepository } from './configRepository'
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

describe('ConfigRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: ConfigRepository

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
    repo = new ConfigRepository(mockContext)
  })

  describe('read()', () => {
    it('returns config from database', async () => {
      mockDatabase.config.leaveRatioDaysInBase = 10
      mockDatabase.config.leaveRatioDaysHome = 4
      mockDatabase.config.longLeaveMaxDays = 4
      mockDatabase.config.minBasePresence = 20
      mockDatabase.config.maxDrivingHours = 8
      mockDatabase.config.defaultRestPeriod = 6

      const config = await repo.read()
      expect(config.leaveRatioDaysInBase).toBe(10)
      expect(config.leaveRatioDaysHome).toBe(4)
      expect(config.longLeaveMaxDays).toBe(4)
      expect(config.minBasePresence).toBe(20)
      expect(config.maxDrivingHours).toBe(8)
      expect(config.defaultRestPeriod).toBe(6)
    })

    it('includes adminEmails from config', async () => {
      mockDatabase.config.adminEmails = ['alice@example.com', 'bob@example.com']

      const cfg = await repo.read()
      expect(cfg.adminEmails).toEqual(['alice@example.com', 'bob@example.com'])
    })

    it('returns empty adminEmails when not configured', async () => {
      mockDatabase.config.adminEmails = []

      const cfg = await repo.read()
      expect(cfg.adminEmails).toEqual([])
    })
  })

  describe('write()', () => {
    it('updates config values in database', async () => {
      await repo.write({ leaveRatioDaysInBase: 12, leaveRatioDaysHome: 5 })

      expect(mockDatabase.config.leaveRatioDaysInBase).toBe(12)
      expect(mockDatabase.config.leaveRatioDaysHome).toBe(5)
    })
  })

  describe('writeAdminEmails()', () => {
    it('updates adminEmails in config', async () => {
      await repo.writeAdminEmails(['alice@example.com', 'bob@example.com'])

      expect(mockDatabase.config.adminEmails).toEqual(['alice@example.com', 'bob@example.com'])
    })

    it('overwrites existing adminEmails', async () => {
      mockDatabase.config.adminEmails = ['old@example.com']

      await repo.writeAdminEmails(['alice@example.com'])

      expect(mockDatabase.config.adminEmails).toEqual(['alice@example.com'])
    })
  })
})
