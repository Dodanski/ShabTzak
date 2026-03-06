import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SoldierService } from './soldierService'
import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { Soldier } from '../models'

const MOCK_SOLDIER: Soldier = {
  id: '1234567', firstName: 'Yoni', lastName: 'Ben', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

describe('SoldierService', () => {
  let repo: SoldierRepository
  let history: HistoryService
  let service: SoldierService

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(MOCK_SOLDIER),
      update: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    } as unknown as SoldierRepository
    history = { append: vi.fn().mockResolvedValue(undefined) } as unknown as HistoryService
    service = new SoldierService(repo, history)
  })

  it('create() calls repo.create and logs history', async () => {
    const input = { id: '1234567', firstName: 'Yoni', lastName: 'Ben', role: 'Driver' as const, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
    await service.create(input, 'admin@test.com')
    expect(repo.create).toHaveBeenCalledWith(input)
    expect(history.append).toHaveBeenCalledWith('CREATE', 'Soldier', '1234567', 'admin@test.com', expect.stringContaining('Yoni Ben'))
  })

  it('updateStatus() sets Active status', async () => {
    await service.updateStatus('1234567', 'Active', 'admin@test.com')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', status: 'Active', inactiveReason: '' })
  })

  it('updateStatus() sets Inactive status with reason', async () => {
    await service.updateStatus('1234567', 'Inactive', 'admin@test.com', 'Medical leave')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', status: 'Inactive', inactiveReason: 'Medical leave' })
  })

  it('updateFields() calls repo.update and logs history', async () => {
    await service.updateFields('1234567', { firstName: 'New', lastName: 'Name', role: 'Medic' as const }, 'admin@test.com')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', firstName: 'New', lastName: 'Name', role: 'Medic' })
    expect(history.append).toHaveBeenCalledWith('UPDATE_FIELDS', 'Soldier', '1234567', 'admin@test.com', expect.any(String))
  })

  it('updateFields() uses newId for history entity when ID is changed', async () => {
    await service.updateFields('1234567', { newId: '9999999' }, 'admin@test.com')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', newId: '9999999' })
    expect(history.append).toHaveBeenCalledWith('UPDATE_FIELDS', 'Soldier', '9999999', 'admin@test.com', expect.any(String))
  })
})
