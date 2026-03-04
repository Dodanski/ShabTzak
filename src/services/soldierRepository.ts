import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseSoldier } from './parsers'
import { serializeSoldier } from './serializers'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput } from '../models'

const CACHE_KEY = 'soldiers'

const HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]

export class SoldierRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    // Soldiers live in the unit-named tab (e.g. "א'") not a dedicated "Soldiers" tab
    this.tabName = tabPrefix || 'Soldiers'
    this.range = `${this.tabName}!A:M`
  }

  private async fetchAll(): Promise<{ headers: string[]; rows: string[][] }> {
    const cached = this.cache.get<{ headers: string[]; rows: string[][] }>(CACHE_KEY)
    if (cached) return cached

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
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
      id: input.id,
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

    // Self-heal: if the sheet has no proper header row, write it before appending.
    // This can happen when the sheet is empty and appendValues places the first
    // soldier row at A1, leaving no room for column headers.
    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${this.tabName}!A1:M1`,
        [HEADER_ROW]
      )
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    const row = serializeSoldier(soldier)
    await this.sheets.appendValues(this.spreadsheetId, this.range, [row])
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
      ...(input.newId !== undefined && { id: input.newId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.serviceStart !== undefined && { serviceStart: input.serviceStart }),
      ...(input.serviceEnd !== undefined && { serviceEnd: input.serviceEnd }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.hoursWorked !== undefined && { hoursWorked: input.hoursWorked }),
      ...(input.weekendLeavesCount !== undefined && { weekendLeavesCount: input.weekendLeavesCount }),
      ...(input.midweekLeavesCount !== undefined && { midweekLeavesCount: input.midweekLeavesCount }),
      ...(input.afterLeavesCount !== undefined && { afterLeavesCount: input.afterLeavesCount }),
      ...(input.currentFairness !== undefined && { currentFairness: input.currentFairness }),
      ...(input.inactiveReason !== undefined && { inactiveReason: input.inactiveReason }),
    }

    const updatedRow = serializeSoldier(updated)
    // +2 because sheet rows are 1-based and row 1 is the header
    const sheetRow = rowIndex + 2
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${this.tabName}!A${sheetRow}:M${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
