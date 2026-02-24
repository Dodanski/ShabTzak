import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetupService } from './setupService'
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

const SHEET_ID = 'test-sheet-id'
const ALL_TABS = Object.values(SHEET_TABS)

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
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers', 'Tasks'])
      const results = await service.checkTabs()
      const soldiers = results.find(r => r.tab === SHEET_TABS.SOLDIERS)
      const version = results.find(r => r.tab === SHEET_TABS.VERSION)
      expect(soldiers?.exists).toBe(true)
      expect(version?.exists).toBe(false)
    })
  })

  describe('initializeMissingTabs()', () => {
    it('creates only missing tabs and writes their headers', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers', 'Tasks'])
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      const created = results.filter(r => r.created)
      const skipped = results.filter(r => !r.created)

      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.SOLDIERS)
      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.TASKS)
      expect(skipped.map(r => r.tab)).toContain(SHEET_TABS.SOLDIERS)

      // batchUpdate called once with all missing tabs
      expect(batchSpy).toHaveBeenCalledOnce()
      const requests: object[] = batchSpy.mock.calls[0][1]
      expect(requests.length).toBe(6) // 8 total - 2 existing

      // headers written for each created tab
      expect(updateSpy).toHaveBeenCalledTimes(6)
    })

    it('does nothing when all tabs exist', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      expect(results.every(r => !r.created)).toBe(true)
      expect(batchSpy).not.toHaveBeenCalled()
    })
  })
})
