import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetupService } from './setupService'
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

const SHEET_ID = 'test-sheet-id'
const ALL_TABS = Object.values(SHEET_TABS) // ['TaskSchedule', 'LeaveRequests', 'LeaveSchedule']

describe('SetupService', () => {
  let mockSheets: GoogleSheetsService
  let service: SetupService

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    service = new SetupService(mockSheets, SHEET_ID)
  })

  describe('checkTabs()', () => {
    it('marks all tabs as existing when all are present', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const results = await service.checkTabs()
      expect(results.every(r => r.exists)).toBe(true)
      expect(results.map(r => r.tab)).toEqual(expect.arrayContaining(ALL_TABS))
    })

    it('marks missing tabs as not existing', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue([SHEET_TABS.TASK_SCHEDULE])
      const results = await service.checkTabs()
      const taskSchedule = results.find(r => r.tab === SHEET_TABS.TASK_SCHEDULE)
      const leaveRequests = results.find(r => r.tab === SHEET_TABS.LEAVE_REQUESTS)
      expect(taskSchedule?.exists).toBe(true)
      expect(leaveRequests?.exists).toBe(false)
    })
  })

  describe('initializeMissingTabs()', () => {
    it('creates only missing tabs and writes their headers', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue([SHEET_TABS.TASK_SCHEDULE])
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      const created = results.filter(r => r.created)
      const skipped = results.filter(r => !r.created)

      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.TASK_SCHEDULE)
      expect(skipped.map(r => r.tab)).toContain(SHEET_TABS.TASK_SCHEDULE)

      // batchUpdate called once with 2 missing tabs (3 total - 1 existing)
      expect(batchSpy).toHaveBeenCalledOnce()
      const requests: object[] = batchSpy.mock.calls[0][1]
      expect(requests.length).toBe(2)

      // headers written for each created tab
      expect(updateSpy).toHaveBeenCalledTimes(2)
    })

    it('does nothing when all tabs exist', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      expect(results.every(r => !r.created)).toBe(true)
      expect(batchSpy).not.toHaveBeenCalled()
    })
  })

  describe('tabPrefix support', () => {
    it('checkTabs() returns prefixed tab names when tabPrefix is set', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue(['Alpha_Company_TaskSchedule']),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id', 'Alpha_Company')
      const statuses = await setup.checkTabs()
      const taskStatus = statuses.find(s => s.tab === 'Alpha_Company_TaskSchedule')
      expect(taskStatus?.exists).toBe(true)
      const leaveStatus = statuses.find(s => s.tab === 'Alpha_Company_LeaveRequests')
      expect(leaveStatus?.exists).toBe(false)
    })

    it('checkTabs() uses bare tab names when tabPrefix is empty', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue([SHEET_TABS.TASK_SCHEDULE]),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id')
      const statuses = await setup.checkTabs()
      expect(statuses.find(s => s.tab === SHEET_TABS.TASK_SCHEDULE)?.exists).toBe(true)
    })

    it('initializeMissingTabs() creates and writes headers to prefixed tab names', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue([]),
        batchUpdate: vi.fn().mockResolvedValue(undefined),
        updateValues: vi.fn().mockResolvedValue(undefined),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id', 'Alpha_Company')
      await setup.initializeMissingTabs()
      const batchArg = mockSheets.batchUpdate.mock.calls[0][1] as Array<{ addSheet: { properties: { title: string } } }>
      expect(batchArg.some(r => r.addSheet.properties.title === 'Alpha_Company_TaskSchedule')).toBe(true)
      expect(mockSheets.updateValues).toHaveBeenCalledWith(
        'sheet-id',
        'Alpha_Company_TaskSchedule!A1',
        expect.arrayContaining([expect.any(Array)])
      )
    })
  })
})
