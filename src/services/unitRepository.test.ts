import { describe, it, expect, beforeEach } from 'vitest'
import { UnitRepository } from './unitRepository'
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

describe('UnitRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: UnitRepository

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
    repo = new UnitRepository(mockContext)
  })
  it('list() returns all units', async () => {
    mockDatabase.units = []
    expect(await repo.list()).toEqual([])
  })

  it('list() parses unit rows correctly', async () => {
    mockDatabase.units = [
      {
        id: 'unit-1',
        name: 'Alpha',
        spreadsheetId: 'sheet-abc',
        tabPrefix: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin@example.com',
      },
    ]
    const units = await repo.list()
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc' })
  })

  it('create() adds unit to database', async () => {
    const unit = await repo.create({
      name: 'Bravo',
      spreadsheetId: 'sheet-xyz',
      tabPrefix: 'Bravo',
    })

    expect(mockDatabase.units).toHaveLength(1)
    expect(unit.name).toBe('Bravo')
    expect(unit.spreadsheetId).toBe('sheet-xyz')
    expect(unit.tabPrefix).toBe('Bravo')
  })

  it('list() retrieves tabPrefix correctly', async () => {
    mockDatabase.units = [
      {
        id: 'unit-1',
        name: 'Alpha',
        spreadsheetId: 'sheet-abc',
        tabPrefix: 'Alpha',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin@example.com',
      },
    ]
    const units = await repo.list()
    expect(units[0].tabPrefix).toBe('Alpha')
  })

  it('delete() removes unit from database', async () => {
    mockDatabase.units = [
      {
        id: 'unit-1',
        name: 'Alpha',
        spreadsheetId: 'sheet-abc',
        tabPrefix: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin@example.com',
      },
      {
        id: 'unit-2',
        name: 'Bravo',
        spreadsheetId: 'sheet-xyz',
        tabPrefix: 'Bravo',
        createdAt: '2026-01-02T00:00:00.000Z',
        createdBy: 'admin@example.com',
      },
    ]

    await repo.delete('unit-1')

    expect(mockDatabase.units).toHaveLength(1)
    expect(mockDatabase.units[0].id).toBe('unit-2')
    expect(mockDatabase.units[0].tabPrefix).toBe('Bravo')
  })
})
