import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ID', 'SoldierID', 'StartDate', 'EndDate',
  'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt',
]

const ASSIGN_ROW_1 = ['a1', 's1', '2026-03-20', '2026-03-22', 'After', 'true', 'false', 'req-1', '2026-02-01T10:00:00']
const ASSIGN_ROW_2 = ['a2', 's2', '2026-03-25', '2026-03-27', 'Long', 'false', 'true', 'req-2', '2026-02-01T11:00:00']

describe('LeaveAssignmentRepository', () => {
  let mockSheets: GoogleSheetsService
  let cache: SheetCache
  let repo: LeaveAssignmentRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    cache = new SheetCache()
    repo = new LeaveAssignmentRepository(mockSheets, SHEET_ID, cache)
  })

  describe('list()', () => {
    it('returns all assignments', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1, ASSIGN_ROW_2])
      const assignments = await repo.list()
      expect(assignments).toHaveLength(2)
      expect(assignments[0].isWeekend).toBe(true)
      expect(assignments[1].isLocked).toBe(true)
    })

    it('returns empty array when only header exists', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.list()).toHaveLength(0)
    })

    it('uses cache on second call', async () => {
      const spy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1])
      await repo.list()
      await repo.list()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('listBySoldier()', () => {
    it('returns only assignments for a given soldier', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1, ASSIGN_ROW_2])
      const assignments = await repo.listBySoldier('s1')
      expect(assignments).toHaveLength(1)
      expect(assignments[0].id).toBe('a1')
    })
  })

  describe('create()', () => {
    it('appends assignment and returns it', async () => {
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const assignment = await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'After',
        isWeekend: false,
        requestId: 'req-3',
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(assignment.soldierId).toBe('s3')
      expect(assignment.isLocked).toBe(false)
      expect(assignment.id).toBeTruthy()
    })

    it('writes header row first when sheet is completely empty', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'After',
        isWeekend: false,
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'LeaveSchedule!A1:I1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledOnce()
    })

    it('rescues existing data row and writes header when sheet has data but no header', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([ASSIGN_ROW_1])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'After',
        isWeekend: false,
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'LeaveSchedule!A1:I1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledTimes(2)
      expect(appendSpy).toHaveBeenNthCalledWith(1, SHEET_ID, expect.any(String), [ASSIGN_ROW_1])
    })
  })

  describe('setLocked()', () => {
    it('locks an assignment', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.setLocked('a1', true)

      expect(updateSpy).toHaveBeenCalledOnce()
      const writtenRow: string[][] = updateSpy.mock.calls[0][2]
      expect(writtenRow[0][6]).toBe('true')
    })

    it('throws if assignment not found', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      await expect(repo.setLocked('ghost', true)).rejects.toThrow()
    })
  })
})
