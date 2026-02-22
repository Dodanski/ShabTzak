import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskRepository } from './taskRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours',
  'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays',
]

const TASK_ROW_1 = [
  'task-1', 'Guard', '2026-03-20T08:00:00', '2026-03-20T16:00:00', '8',
  '[{"role":"Driver","count":1}]', '6', 'false', '',
]

const TASK_ROW_2 = [
  'task-2', 'Pillbox', '2026-03-21T00:00:00', '2026-03-25T00:00:00', '96',
  '[{"role":"Any","count":2}]', '8', 'true', '4',
]

describe('TaskRepository', () => {
  let mockSheets: GoogleSheetsService
  let cache: SheetCache
  let repo: TaskRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    cache = new SheetCache()
    repo = new TaskRepository(mockSheets, SHEET_ID, cache)
  })

  describe('list()', () => {
    it('returns all tasks', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, TASK_ROW_1, TASK_ROW_2])
      const tasks = await repo.list()
      expect(tasks).toHaveLength(2)
      expect(tasks[0].taskType).toBe('Guard')
      expect(tasks[1].isSpecial).toBe(true)
      expect(tasks[1].specialDurationDays).toBe(4)
    })

    it('returns empty array when only header exists', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.list()).toHaveLength(0)
    })

    it('uses cache on second call', async () => {
      const spy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, TASK_ROW_1])
      await repo.list()
      await repo.list()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('getById()', () => {
    it('returns task by id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, TASK_ROW_1, TASK_ROW_2])
      const task = await repo.getById('task-2')
      expect(task).not.toBeNull()
      expect(task!.taskType).toBe('Pillbox')
    })

    it('returns null for unknown id', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.getById('missing')).toBeNull()
    })
  })

  describe('create()', () => {
    it('appends a new task row and returns the task', async () => {
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const task = await repo.create({
        taskType: 'Patrol',
        startTime: '2026-04-01T06:00:00',
        endTime: '2026-04-01T12:00:00',
        roleRequirements: [{ role: 'Driver', count: 1 }, { role: 'Medic', count: 1 }],
        minRestAfter: 6,
        isSpecial: false,
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(task.taskType).toBe('Patrol')
      expect(task.roleRequirements).toHaveLength(2)
      expect(task.durationHours).toBe(6)
      expect(task.id).toBeTruthy()
    })

    it('calculates durationHours from start and end times', async () => {
      vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const task = await repo.create({
        taskType: 'Guard',
        startTime: '2026-04-01T08:00:00',
        endTime: '2026-04-01T20:00:00',
        roleRequirements: [{ role: 'Any', count: 1 }],
      })

      expect(task.durationHours).toBe(12)
    })
  })
})
