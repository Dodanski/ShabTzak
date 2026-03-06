import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RolesService } from './rolesService'
import type { GoogleSheetsService } from './googleSheets'

describe('RolesService', () => {
  let sheets: GoogleSheetsService
  let service: RolesService

  beforeEach(() => {
    sheets = {
      getValues: vi.fn(),
      appendValues: vi.fn().mockResolvedValue(undefined),
      clearValues: vi.fn().mockResolvedValue(undefined),
      updateValues: vi.fn().mockResolvedValue(undefined),
    } as unknown as GoogleSheetsService
    service = new RolesService(sheets, 'sheet-id')
  })

  it('list() returns empty array when tab has no data rows', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([['RoleName']])
    expect(await service.list()).toEqual([])
  })

  it('list() returns empty array when getValues returns nothing', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([])
    expect(await service.list()).toEqual([])
  })

  it('list() returns role names skipping the header row', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'], ['Medic'],
    ])
    expect(await service.list()).toEqual(['Driver', 'Medic'])
  })

  it('create() appends the role name as a row', async () => {
    const spy = vi.spyOn(sheets, 'appendValues').mockResolvedValue(undefined)
    await service.create('NewRole')
    expect(spy).toHaveBeenCalledWith('sheet-id', 'Roles!A:A', [['NewRole']])
  })

  it('delete() rewrites the column without the deleted role', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'], ['Medic'], ['NewRole'],
    ])
    const clearSpy = vi.spyOn(sheets, 'clearValues').mockResolvedValue(undefined)
    const updateSpy = vi.spyOn(sheets, 'updateValues').mockResolvedValue(undefined)

    await service.delete('Medic')

    expect(clearSpy).toHaveBeenCalledWith('sheet-id', 'Roles!A:A')
    expect(updateSpy).toHaveBeenCalledWith('sheet-id', 'Roles!A1', [
      ['RoleName'], ['Driver'], ['NewRole'],
    ])
  })

  it('delete() is a no-op when role is not found', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'],
    ])
    const clearSpy = vi.spyOn(sheets, 'clearValues').mockResolvedValue(undefined)
    await service.delete('NonExistent')
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
