import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SheetTemplateGenerator } from './sheetTemplate'
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

describe('SheetTemplateGenerator', () => {
  let mockService: GoogleSheetsService
  let generator: SheetTemplateGenerator

  beforeEach(() => {
    mockService = new GoogleSheetsService('test-token')
    generator = new SheetTemplateGenerator(mockService)
  })

  it('initializes with a GoogleSheetsService', () => {
    expect(generator).toBeDefined()
  })

  it('has createTemplate method', () => {
    expect(generator.createTemplate).toBeDefined()
  })

  it('creates spreadsheet with all required tabs', async () => {
    const mockSpreadsheetId = 'new-sheet-id'

    vi.spyOn(mockService, 'createSpreadsheet').mockResolvedValue({
      spreadsheetId: mockSpreadsheetId,
    })
    vi.spyOn(mockService, 'updateValues').mockResolvedValue(undefined)
    vi.spyOn(mockService, 'appendValues').mockResolvedValue(undefined)

    const result = await generator.createTemplate('Test Unit ShabTzak')

    expect(mockService.createSpreadsheet).toHaveBeenCalledWith('Test Unit ShabTzak')
    expect(result).toBe(mockSpreadsheetId)
  })

  it('writes headers for all tabs', async () => {
    vi.spyOn(mockService, 'createSpreadsheet').mockResolvedValue({
      spreadsheetId: 'sheet-id',
    })
    const updateSpy = vi.spyOn(mockService, 'updateValues').mockResolvedValue(undefined)
    vi.spyOn(mockService, 'appendValues').mockResolvedValue(undefined)

    await generator.createTemplate('Test Unit')

    const calledRanges = updateSpy.mock.calls.map(call => call[1])
    expect(calledRanges).toContain(`${SHEET_TABS.SOLDIERS}!A1`)
    expect(calledRanges).toContain(`${SHEET_TABS.LEAVE_REQUESTS}!A1`)
    expect(calledRanges).toContain(`${SHEET_TABS.CONFIG}!A1`)
  })
})
