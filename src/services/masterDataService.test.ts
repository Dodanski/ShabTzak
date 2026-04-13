import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MasterDataService } from './masterDataService'
import type { Database } from '../types/Database'
import type { useDatabase } from '../contexts/DatabaseContext'

// Mock the repositories
vi.mock('./adminRepository')
vi.mock('./unitRepository')
vi.mock('./commanderRepository')
vi.mock('./taskRepository')
vi.mock('./configRepository')

import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'

const makeMockDatabase = (): Database => ({
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
    minBasePresenceByRole: {},
    maxDrivingHours: 12,
    defaultRestPeriod: 8,
    taskTypeRestPeriods: {},
    adminEmails: [],
    leaveBaseExitHour: '16:00',
    leaveBaseReturnHour: '08:00'
  },
  roles: [],
  admins: [],
  commanders: []
})

const makeMockContext = (): ReturnType<typeof useDatabase> => {
  const mockDatabase = makeMockDatabase()
  return {
    database: mockDatabase,
    loading: false,
    error: null,
    reload: vi.fn(),
    getData: () => mockDatabase,
    setData: (db: Database) => {
      Object.assign(mockDatabase, db)
    }
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('MasterDataService', () => {
  describe('resolveRole()', () => {
    it('returns { role: "admin" } when email is in admins list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService(makeMockContext())
      const result = await svc.resolveRole('admin@example.com')
      expect(result).toEqual({ role: 'admin' })
    })

    it('returns { role: "commander", unit } when email is in commanders list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([
        { id: 'c1', email: 'cmd@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }
      ])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([
        { id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc', createdAt: '', createdBy: '' }
      ])

      const svc = new MasterDataService(makeMockContext())
      const result = await svc.resolveRole('cmd@example.com')
      expect(result).toEqual({
        role: 'commander',
        unitId: 'unit-1',
        unit: expect.objectContaining({ name: 'Alpha' })
      })
    })

    it('returns null when email is in neither list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService(makeMockContext())
      const result = await svc.resolveRole('unknown@example.com')
      expect(result).toBeNull()
    })

    it('returns null when commander email has no matching unit', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([
        { id: 'c1', email: 'cmd@example.com', unitId: 'unit-orphan', addedAt: '', addedBy: '' }
      ])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService(makeMockContext())
      const result = await svc.resolveRole('cmd@example.com')
      expect(result).toBeNull()
    })
  })

  describe('admin repositories', () => {
    it('exposes tasks, config, history, taskService', () => {
      const svc = new MasterDataService(makeMockContext())
      expect(svc.tasks).toBeDefined()
      expect(svc.config).toBeDefined()
      expect(svc.history).toBeDefined()
      expect(svc.taskService).toBeDefined()
    })
  })

})
