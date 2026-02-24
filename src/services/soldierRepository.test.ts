import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SoldierRepository } from './soldierRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
]

const SOLDIER_ROW = [
  's1', 'David Cohen', 'Driver', '2026-01-01', '2026-08-31',
  '0', '0', 'Active', '0', '0', '0', '0',
]

const SOLDIER_ROW_2 = [
  's2', 'Moshe Levi', 'Medic', '2026-02-01', '2026-09-30',
  '0', '1', 'Active', '8', '1', '0', '0',
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
      expect(soldiers[0].name).toBe('David Cohen')
      expect(soldiers[1].id).toBe('s2')
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
      expect(soldier!.name).toBe('Moshe Levi')
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
        name: 'Yoni Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(soldier.name).toBe('Yoni Ben')
      expect(soldier.role).toBe('Squad Leader')
      expect(soldier.status).toBe('Active')
      expect(soldier.id).toBeTruthy()
    })

    it('writes header row first when sheet is completely empty', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        name: 'Yoni Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'Soldiers!A1:L1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledOnce()
    })

    it('rescues existing data row and writes header when sheet has data but no header', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([SOLDIER_ROW])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        name: 'Yoni Ben',
        role: 'Squad Leader',
        serviceStart: '2026-03-01',
        serviceEnd: '2026-10-31',
      })

      // Writes proper header to A1 (overwriting the misplaced data row)
      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'Soldiers!A1:L1', [HEADER_ROW])
      // First append: rescued existing row; second append: new soldier
      expect(appendSpy).toHaveBeenCalledTimes(2)
      expect(appendSpy).toHaveBeenNthCalledWith(1, SHEET_ID, expect.any(String), [SOLDIER_ROW])
    })
  })

  describe('update()', () => {
    it('updates an existing soldier row', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
        HEADER_ROW, SOLDIER_ROW,
      ])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.update({ id: 's1', status: 'Injured' })

      expect(updateSpy).toHaveBeenCalledOnce()
    })

    it('throws if soldier not found', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      await expect(repo.update({ id: 'ghost' })).rejects.toThrow()
    })
  })
})
