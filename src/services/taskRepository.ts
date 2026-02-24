import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseTask } from './parsers'
import { serializeTask } from './serializers'
import { SHEET_TABS } from '../constants'
import type { Task, CreateTaskInput } from '../models'

const RANGE = `${SHEET_TABS.TASKS}!A:I`
const CACHE_KEY = 'tasks'

const HEADER_ROW = [
  'ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours',
  'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays',
]

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function calcDurationHours(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / (1000 * 60 * 60))
}

export class TaskRepository {
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

  async list(): Promise<Task[]> {
    const { headers, rows } = await this.fetchAll()
    return rows.map(row => parseTask(row, headers))
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = await this.list()
    return tasks.find(t => t.id === id) ?? null
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: generateId(),
      taskType: input.taskType,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: calcDurationHours(input.startTime, input.endTime),
      roleRequirements: input.roleRequirements,
      minRestAfter: input.minRestAfter ?? 6,
      isSpecial: input.isSpecial ?? false,
      specialDurationDays: input.specialDurationDays,
    }

    const allRows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${SHEET_TABS.TASKS}!A1:I1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, RANGE, rescuedRows)
      }
    }

    const row = serializeTask(task)
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
    this.cache.invalidate(CACHE_KEY)
    return task
  }
}
