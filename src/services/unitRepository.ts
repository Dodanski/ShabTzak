import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { MASTER_SHEET_TABS } from '../constants'
import type { Unit, CreateUnitInput } from '../models'

const RANGE = `${MASTER_SHEET_TABS.UNITS}!A:E`
const CACHE_KEY = 'units'

const HEADER_ROW = ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']

export class UnitRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
  }

  async list(): Promise<Unit[]> {
    const cached = this.cache.get<Unit[]>(CACHE_KEY)
    if (cached) return cached

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const dataRows = (allRows ?? []).slice(1).filter(r => r.length > 0)
    const units = dataRows.map(row => ({
      id: row[0],
      name: row[1],
      spreadsheetId: row[2],
      createdAt: row[3],
      createdBy: row[4],
    }))
    this.cache.set(CACHE_KEY, units)
    return units
  }

  async create(input: CreateUnitInput, createdBy: string): Promise<Unit> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if ((allRows ?? [])[0]?.[0] !== 'UnitID') {
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${MASTER_SHEET_TABS.UNITS}!A1:E1`,
        [HEADER_ROW]
      )
    }

    const unit: Unit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      spreadsheetId: input.spreadsheetId,
      createdAt: new Date().toISOString(),
      createdBy: createdBy,
    }
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [
      [unit.id, unit.name, unit.spreadsheetId, unit.createdAt, unit.createdBy]
    ])
    this.cache.invalidate(CACHE_KEY)
    return unit
  }

  async remove(id: string): Promise<void> {
    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const [, ...dataRows] = allRows ?? []
    const remaining = dataRows.filter(r => r[0] !== id)
    await this.sheets.clearValues(this.spreadsheetId, RANGE)
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${MASTER_SHEET_TABS.UNITS}!A1`,
      [HEADER_ROW, ...remaining]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
