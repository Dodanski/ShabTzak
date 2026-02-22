import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HistoryService } from './historyService'
import { GoogleSheetsService } from './googleSheets'

const SHEET_ID = 'test-sheet-id'

describe('HistoryService', () => {
  let mockSheets: GoogleSheetsService
  let service: HistoryService

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    service = new HistoryService(mockSheets, SHEET_ID)
  })

  it('initializes correctly', () => {
    expect(service).toBeDefined()
  })

  it('appends a history entry with correct columns', async () => {
    const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

    await service.append('CREATE', 'Soldier', 'soldier-1', 'user@example.com', 'Created David Cohen')

    expect(appendSpy).toHaveBeenCalledOnce()
    const rows: string[][] = appendSpy.mock.calls[0][2]
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row[1]).toBe('CREATE')
    expect(row[2]).toBe('Soldier')
    expect(row[3]).toBe('soldier-1')
    expect(row[4]).toBe('user@example.com')
    expect(row[5]).toBe('Created David Cohen')
    // Timestamp is row[0] — just check it's an ISO string
    expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('appends to the History sheet tab', async () => {
    const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)

    await service.append('UPDATE', 'LeaveRequest', 'req-1', 'admin', 'Status changed to Approved')

    const range: string = appendSpy.mock.calls[0][1]
    expect(range).toContain('History')
  })

  it('listAll returns all history entries', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details'],
      ['2026-02-22T10:00:00', 'CREATE', 'Soldier', 'soldier-1', 'admin', 'Created'],
      ['2026-02-22T11:00:00', 'UPDATE', 'Task', 'task-1', 'admin', 'Updated task'],
    ])

    const entries = await service.listAll()
    expect(entries).toHaveLength(2)
    expect(entries[0].entityType).toBe('Soldier')
    expect(entries[1].entityType).toBe('Task')
  })

  it('getRecent returns history rows for an entity', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details'],
      ['2026-02-22T10:00:00', 'CREATE', 'Soldier', 'soldier-1', 'admin', 'Created'],
      ['2026-02-22T11:00:00', 'UPDATE', 'Soldier', 'soldier-1', 'admin', 'Updated role'],
      ['2026-02-22T12:00:00', 'CREATE', 'Task', 'task-1', 'admin', 'Task added'],
    ])

    const entries = await service.getRecent('Soldier', 'soldier-1')
    expect(entries).toHaveLength(2)
    expect(entries[0].action).toBe('CREATE')
    expect(entries[1].action).toBe('UPDATE')
  })
})
