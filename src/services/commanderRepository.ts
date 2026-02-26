import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { MASTER_SHEET_TABS } from '../constants'
import type { Commander, CreateCommanderInput } from '../models'

const RANGE = `${MASTER_SHEET_TABS.COMMANDERS}!A:E`
const CACHE_KEY = 'commanders'

const HEADER_ROW = ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']

export class CommanderRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
  }

  async list(): Promise<Commander[]> {
    const cached = this.cache.get<Commander[]>(CACHE_KEY)
    if (cached) return cached

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const dataRows = (allRows ?? []).slice(1).filter(r => r.length > 0)
    const commanders = dataRows.map(row => ({
      id: row[0],
      email: row[1],
      unitId: row[2],
      addedAt: row[3],
      addedBy: row[4],
    }))
    this.cache.set(CACHE_KEY, commanders)
    return commanders
  }

  async listByUnit(unitId: string): Promise<Commander[]> {
    const all = await this.list()
    return all.filter(c => c.unitId === unitId)
  }

  async create(input: CreateCommanderInput, createdBy: string): Promise<Commander> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if ((allRows ?? [])[0]?.[0] !== 'CommanderID') {
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${MASTER_SHEET_TABS.COMMANDERS}!A1:E1`,
        [HEADER_ROW]
      )
    }

    const commander: Commander = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: input.email,
      unitId: input.unitId,
      addedAt: new Date().toISOString(),
      addedBy: createdBy,
    }
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [
      [commander.id, commander.email, commander.unitId, commander.addedAt, commander.addedBy]
    ])
    this.cache.invalidate(CACHE_KEY)
    return commander
  }

  async remove(id: string): Promise<void> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const [, ...dataRows] = allRows ?? []
    const remaining = dataRows.filter(r => r[0] !== id)
    await this.sheets.clearValues(this.spreadsheetId, RANGE)
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${MASTER_SHEET_TABS.COMMANDERS}!A1`,
      [HEADER_ROW, ...remaining]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
