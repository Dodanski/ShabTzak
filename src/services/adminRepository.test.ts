import { describe, it, expect, beforeEach } from 'vitest'
import { AdminRepository } from './adminRepository'
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

describe('AdminRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: AdminRepository

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
    repo = new AdminRepository(mockContext)
  })
  it('list() returns empty array when no admins exist', async () => {
    mockDatabase.admins = []
    expect(await repo.list()).toEqual([])
  })

  it('list() parses admin rows correctly', async () => {
    mockDatabase.admins = [
      {
        id: 'admin-1',
        email: 'alice@example.com',
        addedAt: '2026-01-01T00:00:00.000Z',
        addedBy: 'system',
      },
    ]
    const admins = await repo.list()
    expect(admins).toHaveLength(1)
    expect(admins[0]).toMatchObject({ id: 'admin-1', email: 'alice@example.com', addedBy: 'system' })
  })

  it('createAdmin() adds admin to database', async () => {
    const admin = await repo.createAdmin({ email: 'bob@example.com' }, 'alice@example.com')

    expect(mockDatabase.admins).toHaveLength(1)
    expect(admin.email).toBe('bob@example.com')
    expect(admin.addedBy).toBe('alice@example.com')
  })

  it('remove() deletes admin from database', async () => {
    mockDatabase.admins = [
      {
        id: 'admin-1',
        email: 'alice@example.com',
        addedAt: '2026-01-01T00:00:00.000Z',
        addedBy: 'system',
      },
      {
        id: 'admin-2',
        email: 'bob@example.com',
        addedAt: '2026-01-02T00:00:00.000Z',
        addedBy: 'system',
      },
    ]

    await repo.remove('admin-1')

    expect(mockDatabase.admins).toHaveLength(1)
    expect(mockDatabase.admins[0].id).toBe('admin-2')
  })
})
