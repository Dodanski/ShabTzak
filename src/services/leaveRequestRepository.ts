import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseLeaveRequest } from './parsers'
import { serializeLeaveRequest } from './serializers'
import { SHEET_TABS } from '../constants'
import type { LeaveRequest, CreateLeaveRequestInput, RequestStatus } from '../models'

const RANGE = `${SHEET_TABS.LEAVE_REQUESTS}!A:H`
const CACHE_KEY = 'leaveRequests'

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export class LeaveRequestRepository {
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

  async list(): Promise<LeaveRequest[]> {
    const { headers, rows } = await this.fetchAll()
    return rows.map(row => parseLeaveRequest(row, headers))
  }

  async getById(id: string): Promise<LeaveRequest | null> {
    const requests = await this.list()
    return requests.find(r => r.id === id) ?? null
  }

  async create(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const request: LeaveRequest = {
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: 'After',
      constraintType: input.constraintType,
      priority: input.priority,
      status: 'Pending',
    }

    const row = serializeLeaveRequest(request)
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
    this.cache.invalidate(CACHE_KEY)
    return request
  }

  async updateStatus(id: string, status: RequestStatus): Promise<void> {
    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ID')
    const rowIndex = rows.findIndex(r => r[idIdx] === id)

    if (rowIndex === -1) {
      throw new Error(`Leave request with id "${id}" not found`)
    }

    const existing = parseLeaveRequest(rows[rowIndex], headers)
    const updated: LeaveRequest = { ...existing, status }
    const updatedRow = serializeLeaveRequest(updated)
    const sheetRow = rowIndex + 2

    await this.sheets.updateValues(
      this.spreadsheetId,
      `${SHEET_TABS.LEAVE_REQUESTS}!A${sheetRow}:H${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
