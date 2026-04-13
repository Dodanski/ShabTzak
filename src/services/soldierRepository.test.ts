import { describe, it, expect, beforeEach } from 'vitest'
import { SoldierRepository } from './soldierRepository'
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

describe('SoldierRepository', () => {
  let mockDatabase: Database
  let mockContext: ReturnType<typeof useDatabase>
  let repo: SoldierRepository

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
    repo = new SoldierRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all soldiers from the database', async () => {
      mockDatabase.soldiers = [
        {
          id: 's1',
          firstName: 'David',
          lastName: 'Cohen',
          role: 'Driver',
          serviceStart: '2026-01-01',
          serviceEnd: '2026-08-31',
          initialFairness: 0,
          currentFairness: 0,
          status: 'Active',
          hoursWorked: 0,
          weekendLeavesCount: 0,
          midweekLeavesCount: 0,
          afterLeavesCount: 0,
        },
        {
          id: 's2',
          firstName: 'Moshe',
          lastName: 'Levi',
          role: 'Medic',
          serviceStart: '2026-02-01',
          serviceEnd: '2026-09-30',
          initialFairness: 0,
          currentFairness: 1,
          status: 'Active',
          hoursWorked: 8,
          weekendLeavesCount: 1,
          midweekLeavesCount: 0,
          afterLeavesCount: 0,
        },
      ]

      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(2)
      expect(soldiers[0].id).toBe('s1')
      expect(soldiers[0].firstName).toBe('David')
      expect(soldiers[0].lastName).toBe('Cohen')
      expect(soldiers[1].id).toBe('s2')
      expect(soldiers[1].firstName).toBe('Moshe')
      expect(soldiers[1].lastName).toBe('Levi')
    })

    it('returns empty array when no soldiers exist', async () => {
      mockDatabase.soldiers = []
      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(0)
    })
  })

  describe('getById()', () => {
    it('returns soldier by id', async () => {
      mockDatabase.soldiers = [
        {
          id: 's1',
          firstName: 'David',
          lastName: 'Cohen',
          role: 'Driver',
          serviceStart: '2026-01-01',
          serviceEnd: '2026-08-31',
          initialFairness: 0,
          currentFairness: 0,
          status: 'Active',
          hoursWorked: 0,
          weekendLeavesCount: 0,
          midweekLeavesCount: 0,
          afterLeavesCount: 0,
        },
        {
          id: 's2',
          firstName: 'Moshe',
          lastName: 'Levi',
          role: 'Medic',
          serviceStart: '2026-02-01',
          serviceEnd: '2026-09-30',
          initialFairness: 0,
          currentFairness: 1,
          status: 'Active',
          hoursWorked: 8,
          weekendLeavesCount: 1,
          midweekLeavesCount: 0,
          afterLeavesCount: 0,
        },
      ]

      const soldier = await repo.getById('s2')
      expect(soldier).not.toBeNull()
      expect(soldier!.firstName).toBe('Moshe')
      expect(soldier!.lastName).toBe('Levi')
    })

    it('returns null for unknown id', async () => {
      mockDatabase.soldiers = []
      const soldier = await repo.getById('unknown')
      expect(soldier).toBeNull()
    })
  })

  describe('createSoldier()', () => {
    it('creates a new soldier and adds it to the database', async () => {
      const result = await repo.createSoldier({
        id: 'test-id',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Driver',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(mockDatabase.soldiers).toHaveLength(1)
      expect(result.firstName).toBe('Yoni')
      expect(result.lastName).toBe('Ben')
      expect(result.role).toBe('Driver')
      expect(result.status).toBe('Active')
      expect(result.id).toBe('test-id')
      expect(result.initialFairness).toBe(0)
      expect(result.currentFairness).toBe(0)
      expect(result.hoursWorked).toBe(0)
      expect(result.weekendLeavesCount).toBe(0)
    })

    it('uses the provided army ID as the soldier id', async () => {
      const soldier = await repo.createSoldier({
        id: '9876543',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Driver',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(soldier.id).toBe('9876543')
      expect(mockDatabase.soldiers[0].id).toBe('9876543')
    })

    it('adds phone and unit if provided', async () => {
      const soldier = await repo.createSoldier({
        id: 's1',
        firstName: 'David',
        lastName: 'Cohen',
        role: 'Driver',
        phone: '555-1234',
        unit: 'Alpha',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-12-31',
      })

      expect(soldier.phone).toBe('555-1234')
      expect(soldier.unit).toBe('Alpha')
      expect(mockDatabase.soldiers[0].phone).toBe('555-1234')
      expect(mockDatabase.soldiers[0].unit).toBe('Alpha')
    })
  })

  describe('updateSoldier()', () => {
    it('updates an existing soldier', async () => {
      mockDatabase.soldiers = [{
        id: 's1',
        firstName: 'David',
        lastName: 'Cohen',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
        initialFairness: 0,
        currentFairness: 0,
        status: 'Active',
        hoursWorked: 0,
        weekendLeavesCount: 0,
        midweekLeavesCount: 0,
        afterLeavesCount: 0,
      }]

      await repo.updateSoldier({ id: 's1', status: 'Inactive' })

      expect(mockDatabase.soldiers[0].status).toBe('Inactive')
      expect(mockDatabase.soldiers[0].firstName).toBe('David') // Unchanged
    })

    it('throws if soldier not found', async () => {
      mockDatabase.soldiers = []
      await expect(repo.updateSoldier({ id: 'ghost', status: 'Inactive' })).rejects.toThrow()
    })

    it('updates multiple fields at once', async () => {
      mockDatabase.soldiers = [{
        id: 's1',
        firstName: 'David',
        lastName: 'Cohen',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
        initialFairness: 0,
        currentFairness: 5,
        status: 'Active',
        hoursWorked: 10,
        weekendLeavesCount: 0,
        midweekLeavesCount: 0,
        afterLeavesCount: 0,
      }]

      await repo.updateSoldier({
        id: 's1',
        firstName: 'Danny',
        status: 'Inactive',
        inactiveReason: 'Medical leave',
      })

      expect(mockDatabase.soldiers[0].firstName).toBe('Danny')
      expect(mockDatabase.soldiers[0].status).toBe('Inactive')
      expect(mockDatabase.soldiers[0].inactiveReason).toBe('Medical leave')
      expect(mockDatabase.soldiers[0].currentFairness).toBe(5) // Unchanged
    })

    it('updates currentFairness', async () => {
      mockDatabase.soldiers = [{
        id: 's1',
        firstName: 'David',
        lastName: 'Cohen',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
        initialFairness: 0,
        currentFairness: 5,
        status: 'Active',
        hoursWorked: 10,
        weekendLeavesCount: 0,
        midweekLeavesCount: 0,
        afterLeavesCount: 0,
      }]

      await repo.updateSoldier({ id: 's1', currentFairness: 8 })

      expect(mockDatabase.soldiers[0].currentFairness).toBe(8)
    })
  })

})
