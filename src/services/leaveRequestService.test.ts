import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaveRequestService } from './leaveRequestService'
import type { LeaveRequest } from '../models'

const MOCK_REQUEST: LeaveRequest = {
  id: 'req-1', soldierId: 's1',
  startDate: '2026-03-20', endDate: '2026-03-22',
  leaveType: 'After', constraintType: 'Preference',
  priority: 5, status: 'Pending',
}

const mockRepo = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
}

const mockHistory = {
  append: vi.fn(),
  getRecent: vi.fn(),
}

describe('LeaveRequestService', () => {
  let service: LeaveRequestService

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.create.mockResolvedValue(MOCK_REQUEST)
    mockRepo.updateStatus.mockResolvedValue(undefined)
    mockHistory.append.mockResolvedValue(undefined)
    service = new LeaveRequestService(mockRepo as any, mockHistory as any)
  })

  describe('submit()', () => {
    it('creates a leave request and logs to history', async () => {
      const input = {
        soldierId: 's1', startDate: '2026-03-20', endDate: '2026-03-22',
        constraintType: 'Preference' as const, priority: 5,
      }
      const result = await service.submit(input, 'admin')

      expect(mockRepo.create).toHaveBeenCalledWith(input)
      expect(mockHistory.append).toHaveBeenCalledWith(
        'SUBMIT', 'LeaveRequest', MOCK_REQUEST.id, 'admin', expect.any(String)
      )
      expect(result).toEqual(MOCK_REQUEST)
    })
  })

  describe('approve()', () => {
    it('sets status to Approved and logs to history', async () => {
      await service.approve('req-1', 'admin')

      expect(mockRepo.updateStatus).toHaveBeenCalledWith('req-1', 'Approved')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'APPROVE', 'LeaveRequest', 'req-1', 'admin', expect.any(String)
      )
    })
  })

  describe('deny()', () => {
    it('sets status to Denied and logs to history', async () => {
      await service.deny('req-1', 'admin')

      expect(mockRepo.updateStatus).toHaveBeenCalledWith('req-1', 'Denied')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'DENY', 'LeaveRequest', 'req-1', 'admin', expect.any(String)
      )
    })
  })
})
