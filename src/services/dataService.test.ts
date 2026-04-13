import { describe, it, expect, vi } from 'vitest'
import { DataService } from './dataService'
import type { Database } from '../types/Database'
import type { useDatabase } from '../contexts/DatabaseContext'

const makeHistory = () => ({
  append: vi.fn(),
  listAll: vi.fn(),
  getRecent: vi.fn(),
} as any)

const makeMockDatabase = (): Database => ({
  version: 1,
  lastModified: new Date().toISOString(),
  soldiers: [],
  tasks: [],
  units: [],
  leaveRequests: [],
  leaveAssignments: [],
  taskAssignments: [],
  config: {
    scheduleStartDate: '2026-01-01',
    scheduleEndDate: '2026-12-31',
    leaveRatioDaysInBase: 10,
    leaveRatioDaysHome: 4,
    longLeaveMaxDays: 14,
    weekendDays: ['Friday', 'Saturday'],
    minBasePresence: 5,
    minBasePresenceByRole: {},
    maxDrivingHours: 12,
    defaultRestPeriod: 8,
    taskTypeRestPeriods: {},
    adminEmails: [],
    leaveBaseExitHour: '16:00',
    leaveBaseReturnHour: '08:00'
  },
  roles: [],
  admins: [],
  commanders: []
})

const makeMockContext = (): ReturnType<typeof useDatabase> => {
  const mockDatabase = makeMockDatabase()
  return {
    database: mockDatabase,
    loading: false,
    error: null,
    reload: vi.fn(),
    getData: () => mockDatabase,
    setData: (db: Database) => {
      Object.assign(mockDatabase, db)
    }
  }
}

describe('DataService', () => {
  it('creates from database context', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service).toBeDefined()
  })

  it('exposes soldiers repository', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.soldiers).toBeDefined()
    expect(service.soldiers.list).toBeDefined()
    expect(service.soldiers.createSoldier).toBeDefined()
  })

  it('exposes leaveRequests repository', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.leaveRequests).toBeDefined()
    expect(service.leaveRequests.updateStatus).toBeDefined()
  })

  it('exposes leaveAssignments repository', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.leaveAssignments).toBeDefined()
    expect(service.leaveAssignments.setLocked).toBeDefined()
  })

  it('exposes taskAssignments repository', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.taskAssignments).toBeDefined()
    expect(service.taskAssignments.listByTask).toBeDefined()
  })

  it('exposes soldierService', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.soldierService).toBeDefined()
    expect(service.soldierService.create).toBeDefined()
    expect(service.soldierService.updateStatus).toBeDefined()
  })

  it('exposes leaveRequestService', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.leaveRequestService).toBeDefined()
    expect(service.leaveRequestService.approve).toBeDefined()
  })

  it('exposes scheduleService', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.scheduleService).toBeDefined()
    expect(service.scheduleService.generateLeaveSchedule).toBeDefined()
    expect(service.scheduleService.generateTaskSchedule).toBeDefined()
  })

  it('exposes fairnessUpdate service', () => {
    const service = new DataService(makeMockContext(), makeHistory())
    expect(service.fairnessUpdate).toBeDefined()
    expect(service.fairnessUpdate.applyTaskAssignment).toBeDefined()
  })

  it('exposes tasks, config repositories', () => {
    const svc = new DataService(makeMockContext(), makeHistory())
    expect(svc.tasks).toBeDefined()
    expect(svc.config).toBeDefined()
  })
})
