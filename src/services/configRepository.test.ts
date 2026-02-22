import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigRepository } from './configRepository'
import { GoogleSheetsService } from './googleSheets'
import { DEFAULT_CONFIG } from '../constants'

const SHEET_ID = 'test-sheet-id'

const CONFIG_ROWS = [
  ['Key', 'Value'],
  ['leaveRatioDaysInBase', '10'],
  ['leaveRatioDaysHome', '4'],
  ['longLeaveMaxDays', '4'],
  ['minBasePresence', '20'],
  ['maxDrivingHours', '8'],
  ['defaultRestPeriod', '6'],
]

describe('ConfigRepository', () => {
  let mockSheets: GoogleSheetsService
  let repo: ConfigRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    repo = new ConfigRepository(mockSheets, SHEET_ID)
  })

  describe('read()', () => {
    it('returns typed config from sheet', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue(CONFIG_ROWS)
      const config = await repo.read()
      expect(config.leaveRatioDaysInBase).toBe(10)
      expect(config.leaveRatioDaysHome).toBe(4)
      expect(config.longLeaveMaxDays).toBe(4)
      expect(config.minBasePresence).toBe(20)
      expect(config.maxDrivingHours).toBe(8)
      expect(config.defaultRestPeriod).toBe(6)
    })

    it('falls back to defaults for missing keys', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([['Key', 'Value']])
      const config = await repo.read()
      expect(config.leaveRatioDaysInBase).toBe(DEFAULT_CONFIG.leaveRatioDaysInBase)
      expect(config.maxDrivingHours).toBe(DEFAULT_CONFIG.maxDrivingHours)
    })
  })

  describe('write()', () => {
    it('writes config key-value pairs to the sheet', async () => {
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.write({ leaveRatioDaysInBase: 12, leaveRatioDaysHome: 4 })

      expect(updateSpy).toHaveBeenCalled()
      const writtenRows: string[][] = updateSpy.mock.calls[0][2]
      const keys = writtenRows.map(r => r[0])
      expect(keys).toContain('leaveRatioDaysInBase')
      expect(keys).toContain('leaveRatioDaysHome')
    })
  })
})
