import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskService } from './taskService'
import type { Task } from '../models'

const MOCK_TASK: Task = {
  id: 't1', taskType: 'Guard',
  startTime: '2026-03-20T08:00:00Z', endTime: '2026-03-20T16:00:00Z',
  durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
  minRestAfter: 6, isSpecial: false,
}

const mockRepo = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
}

const mockHistory = {
  append: vi.fn(),
  getRecent: vi.fn(),
}

describe('TaskService', () => {
  let service: TaskService

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.create.mockResolvedValue(MOCK_TASK)
    mockRepo.list.mockResolvedValue([MOCK_TASK])
    mockHistory.append.mockResolvedValue(undefined)
    service = new TaskService(mockRepo as any, mockHistory as any)
  })

  describe('create()', () => {
    it('creates a task via repository and logs to history', async () => {
      const input = {
        taskType: 'Guard',
        startTime: '2026-03-20T08:00:00Z',
        endTime: '2026-03-20T16:00:00Z',
        roleRequirements: [{ role: 'Driver' as const, count: 1 }],
      }
      const result = await service.create(input, 'admin')

      expect(mockRepo.create).toHaveBeenCalledWith(input)
      expect(mockHistory.append).toHaveBeenCalledWith(
        'CREATE', 'Task', MOCK_TASK.id, 'admin', expect.any(String)
      )
      expect(result).toEqual(MOCK_TASK)
    })
  })

  describe('list()', () => {
    it('delegates to repository', async () => {
      const tasks = await service.list()

      expect(mockRepo.list).toHaveBeenCalledOnce()
      expect(tasks).toEqual([MOCK_TASK])
    })
  })
})
