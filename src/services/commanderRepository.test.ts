import { describe, it, expect, beforeEach } from 'vitest'
import { CommanderRepository } from './commanderRepository'
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

describe('CommanderRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: CommanderRepository

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
    repo = new CommanderRepository(mockContext)
  })
  it('list() returns all commanders', async () => {
    mockDatabase.commanders = []
    expect(await repo.list()).toEqual([])
  })

  it('list() parses commander rows correctly', async () => {
    mockDatabase.commanders = [
      {
        id: 'cmd-1',
        email: 'yossi@example.com',
        unitId: 'unit-1',
        addedAt: '2026-01-01T00:00:00.000Z',
        addedBy: 'admin@example.com',
      },
    ]
    const commanders = await repo.list()
    expect(commanders).toHaveLength(1)
    expect(commanders[0]).toMatchObject({ id: 'cmd-1', email: 'yossi@example.com', unitId: 'unit-1' })
  })

  it('listByUnit() returns only commanders for the given unitId', async () => {
    mockDatabase.commanders = [
      {
        id: 'cmd-1',
        email: 'yossi@example.com',
        unitId: 'unit-1',
        addedAt: '2026-01-01T00:00:00.000Z',
        addedBy: 'admin@example.com',
      },
      {
        id: 'cmd-2',
        email: 'dana@example.com',
        unitId: 'unit-2',
        addedAt: '2026-01-02T00:00:00.000Z',
        addedBy: 'admin@example.com',
      },
    ]
    const result = await repo.listByUnit('unit-1')
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('yossi@example.com')
  })

  it('createCommander() adds commander to database', async () => {
    const cmd = await repo.createCommander({ email: 'moshe@example.com', unitId: 'unit-1' }, 'admin@example.com')

    expect(mockDatabase.commanders).toHaveLength(1)
    expect(cmd.email).toBe('moshe@example.com')
    expect(cmd.unitId).toBe('unit-1')
  })

  it('remove() deletes commander from database', async () => {
    mockDatabase.commanders = [
      {
        id: 'cmd-1',
        email: 'yossi@example.com',
        unitId: 'unit-1',
        addedAt: '2026-01-01T00:00:00.000Z',
        addedBy: 'admin@example.com',
      },
      {
        id: 'cmd-2',
        email: 'dana@example.com',
        unitId: 'unit-1',
        addedAt: '2026-01-02T00:00:00.000Z',
        addedBy: 'admin@example.com',
      },
    ]

    await repo.remove('cmd-1')

    expect(mockDatabase.commanders).toHaveLength(1)
    expect(mockDatabase.commanders[0].id).toBe('cmd-2')
  })
})
