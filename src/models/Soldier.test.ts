import { describe, it, expect } from 'vitest'
import type { Soldier } from './Soldier'

describe('Soldier Model', () => {
  it('has correct type structure', () => {
    const soldier: Soldier = {
      id: '1',
      name: 'David',
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
})
