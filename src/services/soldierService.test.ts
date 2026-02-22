import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SoldierService } from './soldierService'
import type { Soldier } from '../models'

const MOCK_SOLDIER: Soldier = {
  id: 's1', name: 'David Cohen', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

const mockRepo = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

const mockHistory = {
  append: vi.fn(),
  getRecent: vi.fn(),
}

describe('SoldierService', () => {
  let service: SoldierService

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.create.mockResolvedValue(MOCK_SOLDIER)
    mockRepo.update.mockResolvedValue(undefined)
    mockHistory.append.mockResolvedValue(undefined)
    service = new SoldierService(mockRepo as any, mockHistory as any)
  })

  describe('create()', () => {
    it('creates a soldier via repository and logs to history', async () => {
      const input = { name: 'David Cohen', role: 'Driver' as const, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
      const result = await service.create(input, 'admin')

      expect(mockRepo.create).toHaveBeenCalledWith(input)
      expect(mockHistory.append).toHaveBeenCalledWith(
        'CREATE', 'Soldier', MOCK_SOLDIER.id, 'admin', expect.any(String)
      )
      expect(result).toEqual(MOCK_SOLDIER)
    })
  })

  describe('updateStatus()', () => {
    it('updates soldier status and logs to history', async () => {
      await service.updateStatus('s1', 'Injured', 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith({ id: 's1', status: 'Injured' })
      expect(mockHistory.append).toHaveBeenCalledWith(
        'UPDATE_STATUS', 'Soldier', 's1', 'admin', expect.stringContaining('Injured')
      )
    })
  })

  describe('discharge()', () => {
    it('sets status to Discharged and logs to history', async () => {
      await service.discharge('s1', 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith({ id: 's1', status: 'Discharged' })
      expect(mockHistory.append).toHaveBeenCalledWith(
        'DISCHARGE', 'Soldier', 's1', 'admin', expect.any(String)
      )
    })
  })
})
