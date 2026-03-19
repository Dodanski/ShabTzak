import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SoldierRepository } from './soldierRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ID', 'First Name', 'Last Name', 'Role', 'Unit', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]

const OLD_HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]

const SOLDIER_ROW = [
  's1', 'David', 'Cohen', 'Driver', '', '2026-01-01', '2026-08-31',
  '0', '0', 'Active', '0', '0', '0', '0', '',
]

const SOLDIER_ROW_2 = [
  's2', 'Moshe', 'Levi', 'Medic', '', '2026-02-01', '2026-09-30',
  '0', '1', 'Active', '8', '1', '0', '0', '',
]

describe('SoldierRepository', () => {
  let mockSheets: GoogleSheetsService
  let cache: SheetCache
  let repo: SoldierRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    cache = new SheetCache()
    repo = new SoldierRepository(mockSheets, SHEET_ID, cache)
  })

  describe('list()', () => {
    it('returns all soldiers from the sheet', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
        HEADER_ROW, SOLDIER_ROW, SOLDIER_ROW_2,
      ])

      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(2)
      expect(soldiers[0].id).toBe('s1')
      expect(soldiers[0].firstName).toBe('David')
      expect(soldiers[0].lastName).toBe('Cohen')
      expect(soldiers[1].id).toBe('s2')
      expect(soldiers[1].firstName).toBe('Moshe')
      expect(soldiers[1].lastName).toBe('Levi')
    })

    it('returns empty array when only header row exists', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(0)
    })

    it('uses cache on second call', async () => {
      const getSpy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
        HEADER_ROW, SOLDIER_ROW,
      ])

      await repo.list()
      await repo.list()

      expect(getSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getById()', () => {
    it('returns soldier by id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
        HEADER_ROW, SOLDIER_ROW, SOLDIER_ROW_2,
      ])

      const soldier = await repo.getById('s2')
      expect(soldier).not.toBeNull()
      expect(soldier!.firstName).toBe('Moshe')
      expect(soldier!.lastName).toBe('Levi')
    })

    it('returns null for unknown id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      const soldier = await repo.getById('unknown')
      expect(soldier).toBeNull()
    })
  })

  describe('create()', () => {
    it('appends a new soldier row and returns the soldier', async () => {
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const soldier = await repo.create({
        id: 'test-id',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(soldier.firstName).toBe('Yoni')
      expect(soldier.lastName).toBe('Ben')
      expect(soldier.role).toBe('Squad Leader')
      expect(soldier.status).toBe('Active')
      expect(soldier.id).toBeTruthy()
    })

    it('writes header row first when sheet is completely empty', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        id: 'test-id',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'Soldiers!A1:O1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledOnce()
    })

    it('rescues existing data row and writes header when sheet has data but no header', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([SOLDIER_ROW])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        id: 'test-id',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      // Writes proper header to A1 (overwriting the misplaced data row)
      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'Soldiers!A1:O1', [HEADER_ROW])
      // First append: rescued existing row; second append: new soldier
      expect(appendSpy).toHaveBeenCalledTimes(2)
      expect(appendSpy).toHaveBeenNthCalledWith(1, SHEET_ID, expect.any(String), [SOLDIER_ROW])
    })

    it('uses the provided army ID as the soldier id', async () => {
      vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const soldier = await repo.create({
        id: '9876543',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(soldier.id).toBe('9876543')
    })
  })

  describe('update()', () => {
    it('updates an existing soldier row', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
        HEADER_ROW, SOLDIER_ROW,
      ])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.update({ id: 's1', status: 'Inactive' })

      expect(updateSpy).toHaveBeenCalledOnce()
    })

    it('throws if soldier not found', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      await expect(repo.update({ id: 'ghost' })).rejects.toThrow()
    })

    it('serializes inactiveReason when updating status to Inactive', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, SOLDIER_ROW])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.update({ id: 's1', status: 'Inactive', inactiveReason: 'Medical leave' })

      const calledRow = updateSpy.mock.calls[0][2][0] as string[]
      const reasonIdx = HEADER_ROW.indexOf('InactiveReason')
      expect(calledRow[reasonIdx]).toBe('Medical leave')
    })
  })

  describe('auto-migration from old Name column', () => {
    it('create() detects old Name column and rewrites header', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([OLD_HEADER_ROW])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        id: 'test-id',
        firstName: 'Yoni',
        lastName: 'Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      // Detect old header and rewrite it with new format
      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'Soldiers!A1:O1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledOnce()
    })
  })

  describe('tabPrefix', () => {
    it('uses prefixed tab name when tabPrefix is provided', async () => {
      const getSpy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      const prefixedRepo = new SoldierRepository(mockSheets, SHEET_ID, new SheetCache(), 'Alpha_Company')

      await prefixedRepo.list()

      expect(getSpy).toHaveBeenCalledWith(SHEET_ID, 'Alpha_Company!A:O')
    })
  })
})
