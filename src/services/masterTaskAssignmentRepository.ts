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
    // Filter out empty rows (rows with no ScheduleID or all empty values)
    const rows = allRows.slice(1).filter(r => r.length > 0 && r[0] && r[0].trim() !== '')
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
    const BATCH_SIZE = 35  // Higher throughput (aggressive)
    const DELAY_MS = 600   // Faster but monitor for 429 errors
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

  /**
   * Clear all task assignments (keeps header row).
   * Use this before generating a fresh schedule to prevent empty row accumulation.
   */
  async clearAll(): Promise<void> {
    console.log('[masterTaskAssignmentRepository] Clearing all task assignments')
    // Clear everything except row 1 (header)
    await this.sheets.clearValues(this.spreadsheetId, `${this.tabName}!A2:H`)
    this.cache.invalidate(CACHE_KEY)
  }

  /**
   * Clear only future task assignments (from today onwards), preserving past assignments.
   * Uses the expanded tasks list to determine which assignments are for future dates.
   * @param expandedTasks - The expanded tasks array with actual dates in startTime
   * @returns The assignments that were kept (past assignments)
   */
  async clearFutureAssignments(expandedTasks: { id: string; startTime: string }[]): Promise<TaskAssignment[]> {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Build a map of taskId -> date for quick lookup
    const taskDateMap = new Map<string, string>()
    for (const task of expandedTasks) {
      const taskDate = task.startTime.split('T')[0]
      taskDateMap.set(task.id, taskDate)
    }

    const { headers, rows } = await this.fetchAll()
    const allAssignments = rows.map(row => parseAssignment(row, headers))

    // Separate past and future assignments
    const pastAssignments: TaskAssignment[] = []
    const futureScheduleIds: string[] = []

    for (const assignment of allAssignments) {
      const taskDate = taskDateMap.get(assignment.taskId)

      // If we can't find the task date, check if the taskId contains date info
      // or default to treating it as future (safer to regenerate)
      if (taskDate) {
        if (taskDate < today) {
          pastAssignments.push(assignment)
        } else {
          futureScheduleIds.push(assignment.scheduleId)
        }
      } else {
        // Task not found in expanded tasks - likely outdated, treat as future
        futureScheduleIds.push(assignment.scheduleId)
      }
    }

    console.log(`[masterTaskAssignmentRepository] Clearing ${futureScheduleIds.length} future assignments, keeping ${pastAssignments.length} past assignments`)

    if (futureScheduleIds.length > 0) {
      await this.deleteByScheduleIds(futureScheduleIds)
    }

    return pastAssignments
  }

  /**
   * Delete task assignments by their schedule IDs.
   * Uses batchClear API to clear multiple rows in a single request.
   */
  async deleteByScheduleIds(scheduleIds: string[]): Promise<void> {
    if (scheduleIds.length === 0) return

    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ScheduleID')
    if (idIdx === -1) return

    const idsToDelete = new Set(scheduleIds)
    const rowIndicesToClear: number[] = []

    for (let i = 0; i < rows.length; i++) {
      if (idsToDelete.has(rows[i][idIdx])) {
        rowIndicesToClear.push(i + 2) // +2 for header row and 1-based index
      }
    }

    if (rowIndicesToClear.length === 0) return

    console.log(`[masterTaskAssignmentRepository] Deleting ${rowIndicesToClear.length} task assignments`)

    // Use batchClear to clear multiple rows in fewer API calls
    // Each batch clears up to 150 ranges in a single API call
    const BATCH_SIZE = 150  // batchClear can handle more ranges
    const DELAY_MS = 800    // Slightly reduced

    for (let i = 0; i < rowIndicesToClear.length; i += BATCH_SIZE) {
      const batch = rowIndicesToClear.slice(i, i + BATCH_SIZE)
      // Create array of range strings for batchClear
      const ranges = batch.map(rowNum => `${this.tabName}!A${rowNum}:H${rowNum}`)

      await this.sheets.batchClearRanges(this.spreadsheetId, ranges)

      if (i + BATCH_SIZE < rowIndicesToClear.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    this.cache.invalidate(CACHE_KEY)
  }
}
