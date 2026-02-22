import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FairnessUpdateService } from './fairnessUpdateService'
import type { Soldier } from '../models'

const BASE_SOLDIER: Soldier = {
  id: 's1', name: 'David', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 10, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

const mockRepo = {
  getById: vi.fn(),
  update: vi.fn(),
}

const mockHistory = {
  append: vi.fn(),
}

describe('FairnessUpdateService', () => {
  let service: FairnessUpdateService

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.getById.mockResolvedValue(BASE_SOLDIER)
    mockRepo.update.mockResolvedValue(undefined)
    mockHistory.append.mockResolvedValue(undefined)
    service = new FairnessUpdateService(mockRepo as any, mockHistory as any)
  })

  describe('applyTaskAssignment()', () => {
    it('increments hoursWorked and updates currentFairness', async () => {
      await service.applyTaskAssignment('s1', 8, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', hoursWorked: 18 })
      )
    })

    it('recalculates currentFairness based on new hoursWorked', async () => {
      // soldier has 10 hoursWorked + 0 leaves → fairness = 10
      // after +8h → fairness = 18
      await service.applyTaskAssignment('s1', 8, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentFairness: 18 })
      )
    })

    it('logs to history', async () => {
      await service.applyTaskAssignment('s1', 8, 'admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'FAIRNESS_UPDATE', 'Soldier', 's1', 'admin', expect.stringContaining('8')
      )
    })

    it('throws when soldier not found', async () => {
      mockRepo.getById.mockResolvedValue(null)
      await expect(service.applyTaskAssignment('ghost', 8, 'admin')).rejects.toThrow()
    })
  })

  describe('applyLeaveAssignment()', () => {
    it('increments weekendLeavesCount for weekend Long leave', async () => {
      await service.applyLeaveAssignment('s1', 'Long', true, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', weekendLeavesCount: 1 })
      )
    })

    it('increments midweekLeavesCount for non-weekend Long leave', async () => {
      await service.applyLeaveAssignment('s1', 'Long', false, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', midweekLeavesCount: 1 })
      )
    })

    it('increments afterLeavesCount for After leave', async () => {
      await service.applyLeaveAssignment('s1', 'After', false, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', afterLeavesCount: 1 })
      )
    })

    it('recalculates currentFairness after leave', async () => {
      // soldier has 10 hoursWorked + 0 weekend leaves → fairness = 10
      // after 1 weekend leave → fairness = 10 + 1.5 = 11.5
      await service.applyLeaveAssignment('s1', 'Long', true, 'admin')

      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ currentFairness: 11.5 })
      )
    })
  })

  describe('applyManualAdjustment()', () => {
    it('adds positive delta to currentFairness', async () => {
      mockRepo.getById.mockResolvedValue({ ...BASE_SOLDIER, currentFairness: 5.0 })
      await service.applyManualAdjustment('s1', 2, 'Missed guard duty', 'admin')
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', currentFairness: 7.0 })
      )
    })

    it('subtracts negative delta from currentFairness', async () => {
      mockRepo.getById.mockResolvedValue({ ...BASE_SOLDIER, currentFairness: 5.0 })
      await service.applyManualAdjustment('s1', -3, 'Bonus for extra duty', 'admin')
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', currentFairness: 2.0 })
      )
    })

    it('logs reason to history', async () => {
      await service.applyManualAdjustment('s1', 1, 'Penalty', 'admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'MANUAL_ADJUSTMENT', 'Soldier', 's1', 'admin', expect.stringContaining('Penalty')
      )
    })

    it('throws when soldier not found', async () => {
      mockRepo.getById.mockResolvedValue(null)
      await expect(service.applyManualAdjustment('ghost', 1, 'test', 'admin')).rejects.toThrow()
    })
  })
})
