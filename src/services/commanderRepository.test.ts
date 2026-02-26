import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommanderRepository } from './commanderRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new CommanderRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('CommanderRepository', () => {
  it('list() returns empty array when only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']])
    expect(await makeRepo().list()).toEqual([])
  })

  it('list() parses commander rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
    ])
    const commanders = await makeRepo().list()
    expect(commanders).toHaveLength(1)
    expect(commanders[0]).toMatchObject({ id: 'cmd-1', email: 'yossi@example.com', unitId: 'unit-1' })
  })

  it('listByUnit() returns only commanders for the given unitId', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['cmd-2', 'dana@example.com', 'unit-2', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    const repo = makeRepo()
    const result = await repo.listByUnit('unit-1')
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('yossi@example.com')
  })

  it('create() appends a row and returns the commander', async () => {
    mockSheets.getValues.mockResolvedValue([['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const cmd = await makeRepo().create({ email: 'moshe@example.com', unitId: 'unit-1' }, 'admin@example.com')
    expect(cmd.email).toBe('moshe@example.com')
    expect(cmd.unitId).toBe('unit-1')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    await makeRepo().create({ email: 'moshe@example.com', unitId: 'unit-1' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']]
    )
  })

  it('remove() clears and rewrites without the removed commander', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['cmd-2', 'dana@example.com', 'unit-1', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    await makeRepo().remove('cmd-1')
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining
    expect(writtenRows[1][0]).toBe('cmd-2')
  })
})
