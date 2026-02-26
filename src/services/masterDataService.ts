import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { MASTER_SHEET_TABS } from '../constants'
import type { Unit } from '../models'

export type ResolvedRole =
  | { role: 'admin' }
  | { role: 'commander'; unitId: string; unit: Unit }
  | null

export class MasterDataService {
  readonly admins: AdminRepository
  readonly units: UnitRepository
  readonly commanders: CommanderRepository
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(accessToken: string, spreadsheetId: string) {
    this.sheets = new GoogleSheetsService(accessToken)
    this.spreadsheetId = spreadsheetId
    const cache = new SheetCache()
    this.admins = new AdminRepository(this.sheets, spreadsheetId, cache)
    this.units = new UnitRepository(this.sheets, spreadsheetId, cache)
    this.commanders = new CommanderRepository(this.sheets, spreadsheetId, cache)
  }

  /**
   * Creates missing master tabs and seeds the first admin from env.
   * Idempotent — safe to call on every app load.
   */
  async initialize(firstAdminEmail: string): Promise<void> {
    const titles = await this.sheets.getSheetTitles(this.spreadsheetId)
    const needed = Object.values(MASTER_SHEET_TABS)
    const missing = needed.filter(t => !titles.includes(t))

    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } },
      }))
      await this.sheets.batchUpdate(this.spreadsheetId, requests)
    }

    const admins = await this.admins.list()
    if (admins.length === 0 && firstAdminEmail) {
      await this.admins.create({ email: firstAdminEmail }, 'system')
    }
  }

  /**
   * Determines the role of the given email by checking the master spreadsheet.
   * Returns null if the email is not authorized.
   */
  async resolveRole(email: string): Promise<ResolvedRole> {
    const [admins, commanders, units] = await Promise.all([
      this.admins.list(),
      this.commanders.list(),
      this.units.list(),
    ])

    if (admins.some(a => a.email === email)) {
      return { role: 'admin' }
    }

    const cmdEntry = commanders.find(c => c.email === email)
    if (cmdEntry) {
      const unit = units.find(u => u.id === cmdEntry.unitId)
      if (unit) return { role: 'commander', unitId: cmdEntry.unitId, unit }
    }

    return null
  }
}
