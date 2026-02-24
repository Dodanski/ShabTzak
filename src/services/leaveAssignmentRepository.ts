import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseLeaveAssignment } from './parsers'
import { serializeLeaveAssignment } from './serializers'
import { SHEET_TABS } from '../constants'
import type { LeaveAssignment, LeaveType } from '../models'

const RANGE = `${SHEET_TABS.LEAVE_SCHEDULE}!A:I`
const CACHE_KEY = 'leaveAssignments'

const HEADER_ROW = [
  'ID', 'SoldierID', 'StartDate', 'EndDate',
  'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt',
]

function generateId(): string {
  return `assign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
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

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${SHEET_TABS.LEAVE_SCHEDULE}!A1:I1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, RANGE, rescuedRows)
      }
    }

    const row = serializeLeaveAssignment(assignment)
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
    this.cache.invalidate(CACHE_KEY)
    return assignment
  }

  async setLocked(id: string, locked: boolean): Promise<void> {
    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ID')
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
      `${SHEET_TABS.LEAVE_SCHEDULE}!A${sheetRow}:I${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
