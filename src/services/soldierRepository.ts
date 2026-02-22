import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseSoldier } from './parsers'
import { serializeSoldier } from './serializers'
import { SHEET_TABS } from '../constants'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput } from '../models'

const RANGE = `${SHEET_TABS.SOLDIERS}!A:L`
const CACHE_KEY = 'soldiers'

function generateId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export class SoldierRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
  }

  private async fetchAll(): Promise<{ headers: string[]; rows: string[][] }> {
    const cached = this.cache.get<{ headers: string[]; rows: string[][] }>(CACHE_KEY)
    if (cached) return cached

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const headers = allRows[0] ?? []
    const rows = allRows.slice(1).filter(r => r.length > 0)
    const result = { headers, rows }
    this.cache.set(CACHE_KEY, result)
    return result
  }

  async list(): Promise<Soldier[]> {
    const { headers, rows } = await this.fetchAll()
    return rows.map(row => parseSoldier(row, headers))
  }

  async getById(id: string): Promise<Soldier | null> {
    const soldiers = await this.list()
    return soldiers.find(s => s.id === id) ?? null
  }

  async create(input: CreateSoldierInput): Promise<Soldier> {
    const soldier: Soldier = {
      id: generateId(),
      name: input.name,
      role: input.role,
      serviceStart: input.serviceStart,
      serviceEnd: input.serviceEnd,
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }

    const row = serializeSoldier(soldier)
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
    this.cache.invalidate(CACHE_KEY)
    return soldier
  }

  async update(input: UpdateSoldierInput): Promise<void> {
    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ID')
    const rowIndex = rows.findIndex(r => r[idIdx] === input.id)

    if (rowIndex === -1) {
      throw new Error(`Soldier with id "${input.id}" not found`)
    }

    const existing = parseSoldier(rows[rowIndex], headers)
    const updated: Soldier = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.serviceStart !== undefined && { serviceStart: input.serviceStart }),
      ...(input.serviceEnd !== undefined && { serviceEnd: input.serviceEnd }),
      ...(input.status !== undefined && { status: input.status }),
    }

    const updatedRow = serializeSoldier(updated)
    // +2 because sheet rows are 1-based and row 1 is the header
    const sheetRow = rowIndex + 2
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${SHEET_TABS.SOLDIERS}!A${sheetRow}:L${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
