import { describe, it, expect } from 'vitest'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput } from './Soldier'

describe('Soldier Model', () => {
  it('has correct type structure', () => {
    const soldier: Soldier = {
      id: '1',
      firstName: 'David',
      lastName: 'Smith',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-08-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }

    expect(soldier.id).toBe('1')
    expect(soldier.role).toBe('Driver')
  })

  it('Soldier has firstName and lastName fields (not name)', () => {
    const soldier: Soldier = {
      id: '1234567',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    expect(soldier.firstName).toBe('John')
    expect(soldier.lastName).toBe('Doe')
    expect((soldier as any).name).toBeUndefined()
  })

  it('CreateSoldierInput requires firstName and lastName', () => {
    const input: CreateSoldierInput = {
      id: '1234567',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
    }
    expect(input.firstName).toBe('John')
    expect(input.lastName).toBe('Doe')
  })

  it('UpdateSoldierInput has optional firstName and lastName', () => {
    const input: UpdateSoldierInput = {
      id: '1234567',
      firstName: 'Jane',
    }
    expect(input.firstName).toBe('Jane')
    expect(input.lastName).toBeUndefined()
  })
})
