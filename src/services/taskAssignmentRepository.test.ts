import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'

const SHEET_ID = 'test-sheet-id'

const HEADER_ROW = [
  'ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole',
  'IsLocked', 'CreatedAt', 'CreatedBy',
]

const ASSIGN_ROW_1 = ['sched-1', 'task-1', 's1', 'Driver', 'false', '2026-02-01T10:00:00', 'admin']
const ASSIGN_ROW_2 = ['sched-2', 'task-1', 's2', 'Medic',  'true',  '2026-02-01T10:00:00', 'admin']
const ASSIGN_ROW_3 = ['sched-3', 'task-2', 's3', 'Any',    'false', '2026-02-01T11:00:00', 'admin']

describe('TaskAssignmentRepository', () => {
  let mockSheets: GoogleSheetsService
  let cache: SheetCache
  let repo: TaskAssignmentRepository

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    cache = new SheetCache()
    repo = new TaskAssignmentRepository(mockSheets, SHEET_ID, cache)
  })

  describe('list()', () => {
    it('returns all task assignments', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1, ASSIGN_ROW_2, ASSIGN_ROW_3])
      const assignments = await repo.list()
      expect(assignments).toHaveLength(3)
      expect(assignments[0].scheduleId).toBe('sched-1')
      expect(assignments[1].isLocked).toBe(true)
    })

    it('returns empty array when only header exists', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      expect(await repo.list()).toHaveLength(0)
    })

    it('uses cache on second call', async () => {
      const spy = vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1])
      await repo.list()
      await repo.list()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('listByTask()', () => {
    it('returns only assignments for a given task', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1, ASSIGN_ROW_2, ASSIGN_ROW_3])
      const assignments = await repo.listByTask('task-1')
      expect(assignments).toHaveLength(2)
      expect(assignments.every(a => a.taskId === 'task-1')).toBe(true)
    })
  })

  describe('create()', () => {
    it('appends assignment and returns it', async () => {
      const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

      const assignment = await repo.create({
        taskId: 'task-3',
        soldierId: 's4',
        assignedRole: 'Medic',
        createdBy: 'commander',
      })

      expect(appendSpy).toHaveBeenCalledOnce()
      expect(assignment.taskId).toBe('task-3')
      expect(assignment.assignedRole).toBe('Medic')
      expect(assignment.isLocked).toBe(false)
      expect(assignment.scheduleId).toBeTruthy()
    })
  })

  describe('setLocked()', () => {
    it('locks an assignment', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, ASSIGN_ROW_1])
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      await repo.setLocked('sched-1', true)

      expect(updateSpy).toHaveBeenCalledOnce()
      const writtenRow: string[][] = updateSpy.mock.calls[0][2]
      expect(writtenRow[0][4]).toBe('true')
    })

    it('throws if assignment not found', async () => {
      vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
      await expect(repo.setLocked('ghost', true)).rejects.toThrow()
    })
  })
})
