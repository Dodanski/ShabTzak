import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SHEET_TABS } from '../constants'
import type { TaskAssignment, SoldierRole } from '../models'

const RANGE = `${SHEET_TABS.TASK_SCHEDULE}!A:G`
const CACHE_KEY = 'taskAssignments'

function generateId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
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

    const row = serializeAssignment(assignment)
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
    this.cache.invalidate(CACHE_KEY)
    return assignment
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
      `${SHEET_TABS.TASK_SCHEDULE}!A${sheetRow}:G${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
