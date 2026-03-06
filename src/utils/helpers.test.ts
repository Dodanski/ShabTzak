import { describe, it, expect } from 'vitest'
import { fullName } from './helpers'
import type { Soldier } from '../models'

describe('helpers', () => {
  describe('fullName', () => {
    it('fullName returns firstName and lastName combined', () => {
      const soldier: Soldier = {
        id: '1',
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
      expect(fullName(soldier)).toBe('John Doe')
    })

    it('fullName returns only lastName when firstName is empty', () => {
      const soldier: Soldier = {
        id: '1',
        firstName: '',
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
      expect(fullName(soldier)).toBe('Doe')
    })

    it('fullName returns only firstName when lastName is empty', () => {
      const soldier: Soldier = {
        id: '1',
        firstName: 'John',
        lastName: '',
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
      expect(fullName(soldier)).toBe('John')
    })

    it('fullName returns empty string when both names are empty', () => {
      const soldier: Soldier = {
        id: '1',
        firstName: '',
        lastName: '',
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
      expect(fullName(soldier)).toBe('')
    })
  })
})
