import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnitRepository } from './unitRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new UnitRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('UnitRepository', () => {
  it('list() returns empty array when only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']])
    expect(await makeRepo().list()).toEqual([])
  })

  it('list() parses unit rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy'],
      ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
    ])
    const units = await makeRepo().list()
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc' })
  })

  it('create() appends a row and returns the unit', async () => {
    mockSheets.getValues.mockResolvedValue([['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const unit = await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz' }, 'admin@example.com')
    expect(unit.name).toBe('Bravo')
    expect(unit.spreadsheetId).toBe('sheet-xyz')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']]
    )
  })

  it('remove() clears and rewrites without the removed unit', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy'],
      ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['unit-2', 'Bravo', 'sheet-xyz', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    await makeRepo().remove('unit-1')
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining
    expect(writtenRows[1][0]).toBe('unit-2')
  })
})
