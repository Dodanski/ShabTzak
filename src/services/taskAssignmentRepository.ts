import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SHEET_TABS } from '../constants'
import { prefixTab } from '../utils/tabPrefix'
import type { TaskAssignment, SoldierRole } from '../models'

const CACHE_KEY = 'taskAssignments'

const HEADER_ROW = [
  'ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole',
  'IsLocked', 'CreatedAt', 'CreatedBy',
]

function generateId(): string {
  // Generate plain text ID: sched_YYYYMMDD_HHMM_RANDOM
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `sched_${date}_${time}_${random}`
}

interface CreateTaskAssignmentInput {
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  createdBy: string
}

function parseAssignment(row: string[], headers: string[]): TaskAssignment {
  const get = (name: string) => row[headers.indexOf(name)] ?? ''
  return {
    scheduleId: get('ScheduleID'),
    taskId: get('TaskID'),
    soldierId: get('SoldierID'),
    assignedRole: get('AssignedRole') as SoldierRole,
    isLocked: get('IsLocked').toLowerCase() === 'true',
    createdAt: get('CreatedAt'),
    createdBy: get('CreatedBy'),
  }
}

function serializeAssignment(a: TaskAssignment): string[] {
  return [
    a.scheduleId,
    a.taskId,
    a.soldierId,
    a.assignedRole,
    String(a.isLocked),
    a.createdAt,
    a.createdBy,
  ]
}

export class TaskAssignmentRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    this.tabName = prefixTab(tabPrefix, SHEET_TABS.TASK_SCHEDULE)
    this.range = `${this.tabName}!A:G`
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

  async list(): Promise<TaskAssignment[]> {
    const { headers, rows } = await this.fetchAll()
    return rows.map(row => parseAssignment(row, headers))
  }

  async listByTask(taskId: string): Promise<TaskAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.taskId === taskId)
  }

  async create(input: CreateTaskAssignmentInput): Promise<TaskAssignment> {
    const assignment: TaskAssignment = {
      scheduleId: generateId(),
      taskId: input.taskId,
      soldierId: input.soldierId,
      assignedRole: input.assignedRole,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ScheduleID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:G1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    const row = serializeAssignment(assignment)
    await this.sheets.appendValues(this.spreadsheetId, this.range, [row])
    this.cache.invalidate(CACHE_KEY)
    return assignment
  }

  /**
   * Batch create task assignments (more efficient than individual creates)
   * Appends multiple rows in one API call with delay between batches
   */
  async createBatch(inputs: CreateTaskAssignmentInput[], onProgress?: (completed: number, total: number) => void): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = inputs.map(input => ({
      scheduleId: generateId(),
      taskId: input.taskId,
      soldierId: input.soldierId,
      assignedRole: input.assignedRole,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }))

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ScheduleID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:G1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    // Batch in groups of 20 with 1-second delay between batches to avoid rate limiting
    const BATCH_SIZE = 20
    const DELAY_MS = 1000
    const PROGRESS_UPDATE_FREQUENCY = 3 // Update progress every 3 batches to reduce flashing

    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE)
      const rows = batch.map(serializeAssignment)
      await this.sheets.appendValues(this.spreadsheetId, this.range, rows)

      const completed = Math.min(i + BATCH_SIZE, assignments.length)
      const batchNumber = Math.floor(i / BATCH_SIZE)

      // Only call onProgress every N batches to reduce UI flashing
      if (batchNumber % PROGRESS_UPDATE_FREQUENCY === 0 || completed === assignments.length) {
        onProgress?.(completed, assignments.length)
      }

      // Delay between batches except after the last one
      if (completed < assignments.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    this.cache.invalidate(CACHE_KEY)
    return assignments
  }

  async setLocked(scheduleId: string, locked: boolean): Promise<void> {
    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ScheduleID')
    const rowIndex = rows.findIndex(r => r[idIdx] === scheduleId)

    if (rowIndex === -1) {
      throw new Error(`Task assignment with scheduleId "${scheduleId}" not found`)
    }

    const existing = parseAssignment(rows[rowIndex], headers)
    const updated: TaskAssignment = { ...existing, isLocked: locked }
    const updatedRow = serializeAssignment(updated)
    const sheetRow = rowIndex + 2

    await this.sheets.updateValues(
      this.spreadsheetId,
      `${this.tabName}!A${sheetRow}:G${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
