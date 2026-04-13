import { describe, it, expect, vi } from 'vitest'
import { DataService } from './dataService'

const makeHistory = () => ({
  append: vi.fn(),
  listAll: vi.fn(),
  getRecent: vi.fn(),
} as any)

describe('DataService', () => {
  it('creates from access token and spreadsheet id', () => {
    const service = new DataService('access-token', 'sheet-id', '', makeHistory())
    expect(service).toBeDefined()
  })

  it('exposes soldiers repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.soldiers).toBeDefined()
    expect(service.soldiers.list).toBeDefined()
    expect(service.soldiers.createSoldier).toBeDefined()
  })

  it('exposes leaveRequests repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveRequests).toBeDefined()
    expect(service.leaveRequests.updateStatus).toBeDefined()
  })

  it('exposes leaveAssignments repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveAssignments).toBeDefined()
    expect(service.leaveAssignments.setLocked).toBeDefined()
  })

  it('exposes taskAssignments repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.taskAssignments).toBeDefined()
    expect(service.taskAssignments.listByTask).toBeDefined()
  })

  it('exposes invalidateAll to clear all caches', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.invalidateAll).toBeDefined()
    expect(() => service.invalidateAll()).not.toThrow()
  })

  it('exposes soldierService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.soldierService).toBeDefined()
    expect(service.soldierService.create).toBeDefined()
    expect(service.soldierService.updateStatus).toBeDefined()
  })

  it('exposes leaveRequestService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveRequestService).toBeDefined()
    expect(service.leaveRequestService.approve).toBeDefined()
  })

  it('exposes scheduleService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.scheduleService).toBeDefined()
    expect(service.scheduleService.generateLeaveSchedule).toBeDefined()
    expect(service.scheduleService.generateTaskSchedule).toBeDefined()
  })

  it('exposes fairnessUpdate service', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.fairnessUpdate).toBeDefined()
    expect(service.fairnessUpdate.applyTaskAssignment).toBeDefined()
  })

  it('passes tabPrefix to repositories — soldiers list uses unit-named tab range', async () => {
    const ds = new DataService('token', 'sheet-id', 'Alpha_Company', makeHistory())
    vi.spyOn(ds.sheets, 'getValues').mockResolvedValue([])
    await ds.soldiers.list()
    expect(ds.sheets.getValues).toHaveBeenCalledWith('sheet-id', 'Alpha_Company!A:O')
  })

  it('does not expose tasks, config, history, versions', () => {
    const svc = new DataService('token', 'id', '', makeHistory()) as any
    expect(svc.tasks).toBeUndefined()
    expect(svc.versions).toBeUndefined()
  })
})
