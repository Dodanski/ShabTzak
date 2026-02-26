import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { MASTER_SHEET_TABS } from '../constants'
import type { Admin, CreateAdminInput } from '../models'

const RANGE = `${MASTER_SHEET_TABS.ADMINS}!A:D`
const CACHE_KEY = 'admins'

const HEADER_ROW = ['AdminID', 'Email', 'AddedAt', 'AddedBy']

export class AdminRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
  }

  async list(): Promise<Admin[]> {
    const cached = this.cache.get<Admin[]>(CACHE_KEY)
    if (cached) return cached

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const dataRows = (allRows ?? []).slice(1).filter(r => r.length > 0)
    const admins = dataRows.map(row => ({
      id: row[0],
      email: row[1],
      addedAt: row[2],
      addedBy: row[3],
    }))
    this.cache.set(CACHE_KEY, admins)
    return admins
  }

  async create(input: CreateAdminInput, createdBy: string): Promise<Admin> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if ((allRows ?? [])[0]?.[0] !== 'AdminID') {
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${MASTER_SHEET_TABS.ADMINS}!A1:D1`,
        [HEADER_ROW]
      )
    }

    const admin: Admin = {
      id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: input.email,
      addedAt: new Date().toISOString(),
      addedBy: createdBy,
    }
    await this.sheets.appendValues(this.spreadsheetId, `${MASTER_SHEET_TABS.ADMINS}!A:D`, [
      [admin.id, admin.email, admin.addedAt, admin.addedBy]
    ])
    this.cache.invalidate(CACHE_KEY)
    return admin
  }

  async remove(id: string): Promise<void> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const [, ...dataRows] = allRows ?? []
    const remaining = dataRows.filter(r => r[0] !== id)
    await this.sheets.clearValues(this.spreadsheetId, RANGE)
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${MASTER_SHEET_TABS.ADMINS}!A1`,
      [HEADER_ROW, ...remaining]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
