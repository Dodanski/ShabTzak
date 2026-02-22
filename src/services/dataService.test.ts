import { describe, it, expect } from 'vitest'
import { DataService } from './dataService'

describe('DataService', () => {
  it('creates from access token and spreadsheet id', () => {
    const service = new DataService('access-token', 'sheet-id')
    expect(service).toBeDefined()
  })

  it('exposes soldiers repository', () => {
    const service = new DataService('token', 'id')
    expect(service.soldiers).toBeDefined()
    expect(service.soldiers.list).toBeDefined()
    expect(service.soldiers.create).toBeDefined()
  })

  it('exposes tasks repository', () => {
    const service = new DataService('token', 'id')
    expect(service.tasks).toBeDefined()
    expect(service.tasks.list).toBeDefined()
  })

  it('exposes leaveRequests repository', () => {
    const service = new DataService('token', 'id')
    expect(service.leaveRequests).toBeDefined()
    expect(service.leaveRequests.updateStatus).toBeDefined()
  })

  it('exposes leaveAssignments repository', () => {
    const service = new DataService('token', 'id')
    expect(service.leaveAssignments).toBeDefined()
    expect(service.leaveAssignments.setLocked).toBeDefined()
  })

  it('exposes taskAssignments repository', () => {
    const service = new DataService('token', 'id')
    expect(service.taskAssignments).toBeDefined()
    expect(service.taskAssignments.listByTask).toBeDefined()
  })

  it('exposes config repository', () => {
    const service = new DataService('token', 'id')
    expect(service.config).toBeDefined()
    expect(service.config.read).toBeDefined()
  })

  it('exposes history service', () => {
    const service = new DataService('token', 'id')
    expect(service.history).toBeDefined()
    expect(service.history.append).toBeDefined()
  })

  it('exposes version service', () => {
    const service = new DataService('token', 'id')
    expect(service.versions).toBeDefined()
    expect(service.versions.isStale).toBeDefined()
  })

  it('exposes invalidateAll to clear all caches', () => {
    const service = new DataService('token', 'id')
    expect(service.invalidateAll).toBeDefined()
    expect(() => service.invalidateAll()).not.toThrow()
  })
})
