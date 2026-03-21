import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { MASTER_SHEET_TABS } from '../constants'
import type { TaskAssignment, SoldierRole } from '../models'

const CACHE_KEY = 'masterTaskAssignments'

const HEADER_ROW = [
  'ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole',
  'AssignedUnitID', 'IsLocked', 'CreatedAt', 'CreatedBy',
]

function generateId(): string {
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
  assignedUnitId?: string
  createdBy: string
}

function parseAssignment(row: string[], headers: string[]): TaskAssignment {
  const get = (name: string) => row[headers.indexOf(name)] ?? ''
  return {
    scheduleId: get('ScheduleID'),
    taskId: get('TaskID'),
    soldierId: get('SoldierID'),
    assignedRole: get('AssignedRole') as SoldierRole,
    assignedUnitId: get('AssignedUnitID'),
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
    a.assignedUnitId || '',
    String(a.isLocked),
    a.createdAt,
    a.createdBy,
  ]
}

/**
 * Repository for shared task assignments in master/admin sheet
 * Used by all units - ONE schedule shared across organization
 */
export class MasterTaskAssignmentRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    this.tabName = MASTER_SHEET_TABS.TASK_SCHEDULE
    this.range = `${this.tabName}!A:H`
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
      assignedUnitId: input.assignedUnitId,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ScheduleID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:H1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    const row = serializeAssignment(assignment)
    await this.sheets.appendValues(this.spreadsheetId, this.range, [row])
    this.cache.invalidate(CACHE_KEY)
    return assignment
  }

  async createBatch(inputs: CreateTaskAssignmentInput[], onProgress?: (completed: number, total: number) => void): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = inputs.map(input => ({
      scheduleId: generateId(),
      taskId: input.taskId,
      soldierId: input.soldierId,
      assignedRole: input.assignedRole,
      assignedUnitId: input.assignedUnitId,
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    }))

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ScheduleID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:H1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    // Batch in groups with delay between batches to avoid rate limiting
    const BATCH_SIZE = 15  // Reduced from 20 to lower API pressure
    const DELAY_MS = 1500  // Increased from 300ms to 1.5s between batches
    const PROGRESS_UPDATE_FREQUENCY = 3

    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE)
      const rows = batch.map(serializeAssignment)
      await this.sheets.appendValues(this.spreadsheetId, this.range, rows)

      const completed = Math.min(i + BATCH_SIZE, assignments.length)
      const batchNumber = Math.floor(i / BATCH_SIZE)

      if (batchNumber % PROGRESS_UPDATE_FREQUENCY === 0 || completed === assignments.length) {
        onProgress?.(completed, assignments.length)
      }

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
      `${this.tabName}!A${sheetRow}:H${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
