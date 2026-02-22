import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VersionService } from './versionService'
import { GoogleSheetsService } from './googleSheets'

const SHEET_ID = 'test-sheet-id'

describe('VersionService', () => {
  let mockSheets: GoogleSheetsService
  let service: VersionService

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    service = new VersionService(mockSheets, SHEET_ID)
  })

  it('initializes with service and spreadsheet id', () => {
    expect(service).toBeDefined()
  })

  it('reads version info for a tab', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['TabName', 'Version', 'LastModified', 'LastModifiedBy'],
      ['Soldiers', '3', '2026-02-22T10:00:00', 'user@example.com'],
      ['Tasks', '1', '2026-02-20T08:00:00', 'user@example.com'],
    ])

    const version = await service.getVersion('Soldiers')
    expect(version).not.toBeNull()
    expect(version!.tabName).toBe('Soldiers')
    expect(version!.version).toBe(3)
    expect(version!.lastModifiedBy).toBe('user@example.com')
  })

  it('returns null for unknown tab', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['TabName', 'Version', 'LastModified', 'LastModifiedBy'],
    ])

    const version = await service.getVersion('UnknownTab')
    expect(version).toBeNull()
  })

  it('increments version for a tab', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['TabName', 'Version', 'LastModified', 'LastModifiedBy'],
      ['Soldiers', '2', '2026-02-20T08:00:00', 'old@example.com'],
    ])
    const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

    await service.incrementVersion('Soldiers', 'new@example.com')

    expect(updateSpy).toHaveBeenCalled()
    const writtenRow: string[][] = updateSpy.mock.calls[0][2]
    expect(writtenRow[0][0]).toBe('Soldiers')
    expect(writtenRow[0][1]).toBe('3')
    expect(writtenRow[0][3]).toBe('new@example.com')
  })

  it('detects stale data when local version is behind', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['TabName', 'Version', 'LastModified', 'LastModifiedBy'],
      ['Soldiers', '5', '2026-02-22T10:00:00', 'user@example.com'],
    ])

    const isStale = await service.isStale('Soldiers', 3)
    expect(isStale).toBe(true)
  })

  it('detects up-to-date data when versions match', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['TabName', 'Version', 'LastModified', 'LastModifiedBy'],
      ['Soldiers', '3', '2026-02-22T10:00:00', 'user@example.com'],
    ])

    const isStale = await service.isStale('Soldiers', 3)
    expect(isStale).toBe(false)
  })
})
