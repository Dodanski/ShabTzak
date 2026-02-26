import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminRepository } from './adminRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new AdminRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminRepository', () => {
  it('list() returns empty array when sheet has only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['AdminID', 'Email', 'AddedAt', 'AddedBy']])
    const repo = makeRepo()
    expect(await repo.list()).toEqual([])
  })

  it('list() parses admin rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['AdminID', 'Email', 'AddedAt', 'AddedBy'],
      ['admin-1', 'alice@example.com', '2026-01-01T00:00:00.000Z', 'system'],
    ])
    const repo = makeRepo()
    const admins = await repo.list()
    expect(admins).toHaveLength(1)
    expect(admins[0]).toMatchObject({ id: 'admin-1', email: 'alice@example.com', addedBy: 'system' })
  })

  it('create() appends a row and returns the admin', async () => {
    mockSheets.getValues.mockResolvedValue([['AdminID', 'Email', 'AddedAt', 'AddedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    const admin = await repo.create({ email: 'bob@example.com' }, 'alice@example.com')
    expect(admin.email).toBe('bob@example.com')
    expect(admin.addedBy).toBe('alice@example.com')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header row on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    await repo.create({ email: 'bob@example.com' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['AdminID', 'Email', 'AddedAt', 'AddedBy']]
    )
  })

  it('remove() clears and rewrites without the removed admin', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['AdminID', 'Email', 'AddedAt', 'AddedBy'],
      ['admin-1', 'alice@example.com', '2026-01-01T00:00:00.000Z', 'system'],
      ['admin-2', 'bob@example.com', '2026-01-02T00:00:00.000Z', 'system'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    await repo.remove('admin-1')
    expect(mockSheets.clearValues).toHaveBeenCalledOnce()
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining admin
    expect(writtenRows[1][0]).toBe('admin-2')
  })
})
