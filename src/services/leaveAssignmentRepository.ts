import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseLeaveAssignment } from './parsers'
import { serializeLeaveAssignment } from './serializers'
import { SHEET_TABS } from '../constants'
import { prefixTab } from '../utils/tabPrefix'
import type { LeaveAssignment, LeaveType } from '../models'

const CACHE_KEY = 'leaveAssignments'

const HEADER_ROW = [
  'ID', 'SoldierID', 'StartDate', 'EndDate',
  'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt',
]

function generateId(): string {
  // Generate plain text ID: leave_YYYYMMDD_HHMM_RANDOM
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `leave_${date}_${time}_${random}`
}

interface CreateLeaveAssignmentInput {
  soldierId: string
  startDate: string
  endDate: string
  leaveType: LeaveType
  isWeekend: boolean
  requestId?: string
}

export class LeaveAssignmentRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    this.tabName = prefixTab(tabPrefix, SHEET_TABS.LEAVE_SCHEDULE)
    this.range = `${this.tabName}!A:I`
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

  async list(): Promise<LeaveAssignment[]> {
    const { headers, rows } = await this.fetchAll()
    return rows.map(row => parseLeaveAssignment(row, headers))
  }

  async listBySoldier(soldierId: string): Promise<LeaveAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.soldierId === soldierId)
  }

  async create(input: CreateLeaveAssignmentInput): Promise<LeaveAssignment> {
    const assignment: LeaveAssignment = {
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      isWeekend: input.isWeekend,
      isLocked: false,
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
    }

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:I1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    const row = serializeLeaveAssignment(assignment)
    await this.sheets.appendValues(this.spreadsheetId, this.range, [row])
    this.cache.invalidate(CACHE_KEY)
    return assignment
  }

  async createBatch(inputs: CreateLeaveAssignmentInput[]): Promise<LeaveAssignment[]> {
    const BATCH_SIZE = 50
    const DELAY_MS = 2000

    const assignments = inputs.map(input => ({
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      isWeekend: input.isWeekend,
      isLocked: false,
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
    }))

    // Ensure headers exist
    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:I1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    // Write in batches with delays
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE)
      const rows = batch.map(serializeLeaveAssignment)
      await this.sheets.appendValues(this.spreadsheetId, this.range, rows)

      if (i + BATCH_SIZE < assignments.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    this.cache.invalidate(CACHE_KEY)
    return assignments
  }

  async setLocked(id: string, locked: boolean): Promise<void> {
    const { headers, rows } = await this.fetchAll()

    // Find ID column with case-insensitive + whitespace-tolerant matching
    const idIdx = headers.findIndex(h => h.toLowerCase().trim() === 'id')
    if (idIdx === -1) {
      throw new Error('ID column not found in headers')
    }

    const rowIndex = rows.findIndex(r => r[idIdx] === id)

    if (rowIndex === -1) {
      throw new Error(`Leave assignment with id "${id}" not found`)
    }

    const existing = parseLeaveAssignment(rows[rowIndex], headers)
    const updated: LeaveAssignment = { ...existing, isLocked: locked }
    const updatedRow = serializeLeaveAssignment(updated)
    const sheetRow = rowIndex + 2

    await this.sheets.updateValues(
      this.spreadsheetId,
      `${this.tabName}!A${sheetRow}:I${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
