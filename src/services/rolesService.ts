import type { GoogleSheetsService } from './googleSheets'
import { MASTER_SHEET_TABS } from '../constants'

const TAB = MASTER_SHEET_TABS.ROLES
const RANGE = `${TAB}!A:A`
const HEADER = 'RoleName'

export class RolesService {
  constructor(
    private sheets: GoogleSheetsService,
    private spreadsheetId: string,
  ) {}

  async list(): Promise<string[]> {
    const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if (!rows || rows.length === 0) return []
    const data = rows[0]?.[0] === HEADER ? rows.slice(1) : rows
    return data.map(r => r[0]).filter(Boolean)
  }

  async create(name: string): Promise<void> {
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [[name]])
  }

  async delete(name: string): Promise<void> {
    const current = await this.list()
    if (!current.includes(name)) return
    const remaining = current.filter(r => r !== name)
    await this.sheets.clearValues(this.spreadsheetId, RANGE)
    const rows: string[][] = [[HEADER], ...remaining.map(r => [r])]
    await this.sheets.updateValues(this.spreadsheetId, `${TAB}!A1`, rows)
  }
}
