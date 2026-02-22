import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleService } from './scheduleService'
import type { Soldier, LeaveRequest, Task, AppConfig } from '../models'

const CONFIG: Partial<AppConfig> = {
  minBasePresence: 25,
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
}

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: 's2', name: 'Moshe', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
]

const PENDING_REQUEST: LeaveRequest = {
  id: 'req-1', soldierId: 's1',
  startDate: '2026-03-20', endDate: '2026-03-22',
  leaveType: 'After', constraintType: 'Preference',
  priority: 5, status: 'Pending',
}

const TASK: Task = {
  id: 't1', taskType: 'Guard',
  startTime: '2026-03-20T08:00:00Z', endTime: '2026-03-20T16:00:00Z',
  durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
  minRestAfter: 6, isSpecial: false,
}

const makeRepo = (overrides = {}) => ({
  list: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
  ...overrides,
})

const mockHistory = {
  append: vi.fn().mockResolvedValue(undefined),
}

describe('ScheduleService', () => {
  let mockSoldiers: ReturnType<typeof makeRepo>
  let mockLeaveRequests: ReturnType<typeof makeRepo>
  let mockLeaveAssignments: ReturnType<typeof makeRepo>
  let mockTasks: ReturnType<typeof makeRepo>
  let mockTaskAssignments: ReturnType<typeof makeRepo>
  let mockConfig: { read: ReturnType<typeof vi.fn> }
  let service: ScheduleService

  beforeEach(() => {
    vi.clearAllMocks()
    mockSoldiers = makeRepo({ list: vi.fn().mockResolvedValue(SOLDIERS) })
    mockLeaveRequests = makeRepo({ list: vi.fn().mockResolvedValue([PENDING_REQUEST]) })
    mockLeaveAssignments = makeRepo({ list: vi.fn().mockResolvedValue([]) })
    mockTasks = makeRepo({ list: vi.fn().mockResolvedValue([TASK]) })
    mockTaskAssignments = makeRepo({ list: vi.fn().mockResolvedValue([]) })
    mockConfig = { read: vi.fn().mockResolvedValue(CONFIG) }

    service = new ScheduleService(
      mockSoldiers as any,
      mockLeaveRequests as any,
      mockLeaveAssignments as any,
      mockTasks as any,
      mockTaskAssignments as any,
      mockConfig as any,
      mockHistory as any,
    )
  })

  describe('generateLeaveSchedule()', () => {
    it('runs the scheduler and returns a LeaveSchedule', async () => {
      const result = await service.generateLeaveSchedule('2026-03-01', '2026-03-31', 'admin')

      expect(result.startDate).toBe('2026-03-01')
      expect(result.endDate).toBe('2026-03-31')
      expect(Array.isArray(result.assignments)).toBe(true)
    })

    it('persists new assignments via repository', async () => {
      await service.generateLeaveSchedule('2026-03-01', '2026-03-31', 'admin')
      // The pending request for s1 should have been scheduled → create called
      expect(mockLeaveAssignments.create).toHaveBeenCalledOnce()
    })

    it('does not re-persist existing assignments', async () => {
      const existingAssignment = {
        id: 'existing-1', soldierId: 's1',
        startDate: '2026-03-20', endDate: '2026-03-22',
        leaveType: 'After', isWeekend: false, isLocked: true,
        createdAt: '2026-02-01T00:00:00',
      }
      mockLeaveAssignments.list.mockResolvedValue([existingAssignment])
      mockLeaveRequests.list.mockResolvedValue([]) // no new requests

      await service.generateLeaveSchedule('2026-03-01', '2026-03-31', 'admin')

      expect(mockLeaveAssignments.create).not.toHaveBeenCalled()
    })

    it('logs generation to history', async () => {
      await service.generateLeaveSchedule('2026-03-01', '2026-03-31', 'admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'GENERATE_LEAVE_SCHEDULE', 'LeaveSchedule', '2026-03-01', 'admin', expect.any(String)
      )
    })
  })

  describe('generateTaskSchedule()', () => {
    it('runs the scheduler and returns a TaskSchedule', async () => {
      const result = await service.generateTaskSchedule('admin')

      expect(Array.isArray(result.assignments)).toBe(true)
    })

    it('persists new task assignments via repository', async () => {
      await service.generateTaskSchedule('admin')
      // Task t1 needs 1 Driver; s1 is available → create called once
      expect(mockTaskAssignments.create).toHaveBeenCalledOnce()
    })

    it('logs generation to history', async () => {
      await service.generateTaskSchedule('admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'GENERATE_TASK_SCHEDULE', 'TaskSchedule', '', 'admin', expect.any(String)
      )
    })
  })
})
