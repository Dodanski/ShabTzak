import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { parseTask } from './parsers'
import { serializeTask } from './serializers'
import { MASTER_SHEET_TABS } from '../constants'
import { prefixTab } from '../utils/tabPrefix'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../models'

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
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    this.tabName = prefixTab(tabPrefix, MASTER_SHEET_TABS.TASKS)
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
      durationHours: input.durationHours !== undefined ? input.durationHours : calcDurationHours(input.startTime, input.endTime),
      roleRequirements: input.roleRequirements,
      minRestAfter: input.minRestAfter ?? 6,
      isSpecial: input.isSpecial ?? false,
      specialDurationDays: input.specialDurationDays,
    }

    const allRows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (allRows[0]?.[0] !== 'ID') {
      const rescuedRows = allRows.filter(r => r.length > 0)
      await this.sheets.updateValues(this.spreadsheetId, `${this.tabName}!A1:I1`, [HEADER_ROW])
      if (rescuedRows.length > 0) {
        await this.sheets.appendValues(this.spreadsheetId, this.range, rescuedRows)
      }
    }

    const row = serializeTask(task)
    await this.sheets.appendValues(this.spreadsheetId, this.range, [row])
    this.cache.invalidate(CACHE_KEY)
    return task
  }

  async update(input: UpdateTaskInput): Promise<void> {
    const { headers, rows } = await this.fetchAll()
    const idIdx = headers.indexOf('ID')
    const rowIndex = rows.findIndex(r => r[idIdx] === input.id)

    if (rowIndex === -1) {
      throw new Error(`Task with id "${input.id}" not found`)
    }

    const existing = parseTask(rows[rowIndex], headers)
    const updated: Task = {
      ...existing,
      ...(input.taskType !== undefined && { taskType: input.taskType }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.durationHours !== undefined && { durationHours: input.durationHours }),
      ...(input.roleRequirements !== undefined && { roleRequirements: input.roleRequirements }),
      ...(input.minRestAfter !== undefined && { minRestAfter: input.minRestAfter }),
      ...(input.isSpecial !== undefined && { isSpecial: input.isSpecial }),
      ...(input.specialDurationDays !== undefined && { specialDurationDays: input.specialDurationDays }),
    }

    const updatedRow = serializeTask(updated)
    const sheetRow = rowIndex + 2 // +2: 1-based and row 1 is header
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${this.tabName}!A${sheetRow}:I${sheetRow}`,
      [updatedRow]
    )
    this.cache.invalidate(CACHE_KEY)
  }
}
