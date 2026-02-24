import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ID', 'SoldierID', 'StartDate', 'EndDate',
  'LeaveType', 'ConstraintType', 'Priority', 'Status',
]

const REQ_ROW_1 = ['req-1', 's1', '2026-03-20', '2026-03-22', 'After', 'Family event', '7', 'Pending']
const REQ_ROW_2 = ['req-2', 's2', '2026-03-25', '2026-03-27', 'Long', 'University exam', '9', 'Approved']

describe('LeaveRequestRepository', () => {
  let mockSheets: GoogleSheetsService
  let cache: SheetCache
  let repo: LeaveRequestRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    cache = new SheetCache()
    repo = new LeaveRequestRepository(mockSheets, SHEET_ID, cache)
  })

  describe('list()', () => {
    it('returns all leave requests', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, REQ_ROW_1, REQ_ROW_2])
      const requests = await repo.list()
      expect(requests).toHaveLength(2)
      expect(requests[0].id).toBe('req-1')
      expect(requests[1].status).toBe('Approved')
    })

    it('returns empty array when only header exists', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.list()).toHaveLength(0)
    })

    it('uses cache on second call', async () => {
      const spy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, REQ_ROW_1])
      await repo.list()
      await repo.list()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getById()', () => {
    it('returns request by id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, REQ_ROW_1, REQ_ROW_2])
      const req = await repo.getById('req-2')
      expect(req).not.toBeNull()
      expect(req!.constraintType).toBe('University exam')
    })

    it('returns null for unknown id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.getById('missing')).toBeNull()
    })
  })

  describe('create()', () => {
    it('appends new row and returns the request', async () => {
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const req = await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        constraintType: 'Medical appointment',
        priority: 8,
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(req.soldierId).toBe('s3')
      expect(req.status).toBe('Pending')
      expect(req.id).toBeTruthy()
    })

    it('writes header row first when sheet is completely empty', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        constraintType: 'Medical',
        priority: 5,
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'LeaveRequests!A1:H1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledOnce()
    })

    it('rescues existing data row and writes header when sheet has data but no header', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([REQ_ROW_1])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

      await repo.create({
        soldierId: 's3',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        constraintType: 'Medical',
        priority: 5,
      })

      expect(updateSpy).toHaveBeenCalledWith(SHEET_ID, 'LeaveRequests!A1:H1', [HEADER_ROW])
      expect(appendSpy).toHaveBeenCalledTimes(2)
      expect(appendSpy).toHaveBeenNthCalledWith(1, SHEET_ID, expect.any(String), [REQ_ROW_1])
    })
  })

  describe('updateStatus()', () => {
    it('updates the status of a request', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, REQ_ROW_1])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.updateStatus('req-1', 'Approved')

      expect(updateSpy).toHaveBeenCalledOnce()
      const writtenRow: string[][] = updateSpy.mock.calls[0][2]
      expect(writtenRow[0][7]).toBe('Approved')
    })

    it('throws if request not found', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      await expect(repo.updateStatus('ghost', 'Approved')).rejects.toThrow()
    })
  })
})
