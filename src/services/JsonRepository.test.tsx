import { describe, it, expect, beforeEach } from 'vitest'
import { JsonRepository } from './JsonRepository'
import { DatabaseProvider, useDatabase } from '../contexts/DatabaseContext'
import { renderHook } from '@testing-library/react'
import type { Database } from '../types/Database'
import type { Soldier } from '../models'

class TestSoldierRepository extends JsonRepository<Soldier> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'soldiers')
  }
}

describe('JsonRepository', () => {
  const mockDatabase: Database = {
    version: 1,
    lastModified: '2026-03-31T10:00:00.000Z',
    soldiers: [
      { id: 's1', firstName: 'David', lastName: 'Cohen', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
      { id: 's2', firstName: 'Moshe', lastName: 'Levi', role: 'Medic', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 }
    ],
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
    roles: [],
    admins: [],
    commanders: []
  }

  let mockContext: ReturnType<typeof useDatabase>
  let currentDatabase: Database

  beforeEach(() => {
    currentDatabase = JSON.parse(JSON.stringify(mockDatabase))
    mockContext = {
      database: currentDatabase,
      loading: false,
      error: null,
      reload: async () => {},
      getData: () => currentDatabase,
      setData: (db: Database) => {
        currentDatabase = db
      }
    }
  })

  it('lists all entities', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldiers = await repo.list()
    expect(soldiers).toHaveLength(2)
    expect(soldiers[0].id).toBe('s1')
  })

  it('gets entity by id', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldier = await repo.getById('s2')
    expect(soldier).not.toBeNull()
    expect(soldier!.firstName).toBe('Moshe')
  })

  it('returns null for unknown id', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldier = await repo.getById('unknown')
    expect(soldier).toBeNull()
  })

  it('creates new entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const newSoldier: Soldier = {
      id: 's3',
      firstName: 'Yosef',
      lastName: 'Cohen',
      role: 'Commander',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0
    }

    const created = await repo.create(newSoldier)
    expect(created.id).toBe('s3')

    const all = await repo.list()
    expect(all).toHaveLength(3)
  })

  it('updates entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    await repo.update('s1', { firstName: 'Updated' })

    const soldier = await repo.getById('s1')
    expect(soldier!.firstName).toBe('Updated')
  })

  it('deletes entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    await repo.delete('s1')

    const all = await repo.list()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('s2')
  })
})
