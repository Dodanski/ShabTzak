import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GoogleSheetsService } from './googleSheets'

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService

  beforeEach(() => {
    service = new GoogleSheetsService('test-access-token')
  })

  it('initializes with access token', () => {
    expect(service).toBeDefined()
  })

  it('has getSpreadsheet method', () => {
    expect(service.getSpreadsheet).toBeDefined()
  })

  it('has getValues method', () => {
    expect(service.getValues).toBeDefined()
  })

  it('has updateValues method', () => {
    expect(service.updateValues).toBeDefined()
  })

  it('has appendValues method', () => {
    expect(service.appendValues).toBeDefined()
  })

  it('has createSpreadsheet method', () => {
    expect(service.createSpreadsheet).toBeDefined()
  })

  it('throws on failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    }))

    await expect(service.getSpreadsheet('fake-id')).rejects.toThrow('Failed to fetch spreadsheet')

    vi.unstubAllGlobals()
  })

  it('returns values from getValues', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ values: [['Name', 'Role'], ['David', 'Driver']] }),
    }))

    const result = await service.getValues('sheet-id', 'Soldiers!A:Z')
    expect(result).toEqual([['Name', 'Role'], ['David', 'Driver']])

    vi.unstubAllGlobals()
  })

  it('returns empty array when no values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))

    const result = await service.getValues('sheet-id', 'Soldiers!A:Z')
    expect(result).toEqual([])

    vi.unstubAllGlobals()
  })
})
