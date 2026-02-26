import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MasterDataService } from './masterDataService'

// Mock the repositories
vi.mock('./adminRepository')
vi.mock('./unitRepository')
vi.mock('./commanderRepository')
vi.mock('./googleSheets')

import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { GoogleSheetsService } from './googleSheets'

beforeEach(() => { vi.clearAllMocks() })

describe('MasterDataService', () => {
  describe('resolveRole()', () => {
    it('returns { role: "admin" } when email is in admins list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('admin@example.com')
      expect(result).toEqual({ role: 'admin' })
    })

    it('returns { role: "commander", unit } when email is in commanders list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([
        { id: 'c1', email: 'cmd@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }
      ])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([
        { id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc', createdAt: '', createdBy: '' }
      ])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('cmd@example.com')
      expect(result).toEqual({
        role: 'commander',
        unitId: 'unit-1',
        unit: expect.objectContaining({ name: 'Alpha' })
      })
    })

    it('returns null when email is in neither list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('unknown@example.com')
      expect(result).toBeNull()
    })

    it('returns null when commander email has no matching unit', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([
        { id: 'c1', email: 'cmd@example.com', unitId: 'unit-orphan', addedAt: '', addedBy: '' }
      ])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('cmd@example.com')
      expect(result).toBeNull()
    })
  })

  describe('initialize()', () => {
    it('seeds first admin when admins tab is empty', async () => {
      vi.mocked(GoogleSheetsService.prototype.getSheetTitles).mockResolvedValue(['Admins', 'Units', 'Commanders'])
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(AdminRepository.prototype.create).mockResolvedValue({
        id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: ''
      })

      const svc = new MasterDataService('token', 'master-id')
      await svc.initialize('admin@example.com')
      expect(AdminRepository.prototype.create).toHaveBeenCalledWith(
        { email: 'admin@example.com' }, 'system'
      )
    })

    it('does not seed admin when admins already exist', async () => {
      vi.mocked(GoogleSheetsService.prototype.getSheetTitles).mockResolvedValue(['Admins', 'Units', 'Commanders'])
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])

      const svc = new MasterDataService('token', 'master-id')
      await svc.initialize('admin@example.com')
      expect(AdminRepository.prototype.create).not.toHaveBeenCalled()
    })

    it('creates missing tabs when some are absent', async () => {
      vi.mocked(GoogleSheetsService.prototype.getSheetTitles).mockResolvedValue(['Admins'])
      vi.mocked(GoogleSheetsService.prototype.batchUpdate).mockResolvedValue(undefined)
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])

      const svc = new MasterDataService('token', 'master-id')
      await svc.initialize('admin@example.com')
      expect(GoogleSheetsService.prototype.batchUpdate).toHaveBeenCalledWith(
        'master-id',
        expect.arrayContaining([
          { addSheet: { properties: { title: 'Units' } } },
          { addSheet: { properties: { title: 'Commanders' } } },
        ])
      )
    })
  })
})
