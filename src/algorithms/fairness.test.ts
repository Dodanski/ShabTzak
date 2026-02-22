import { describe, it, expect } from 'vitest'
import {
  calculateTaskFairness,
  calculateLeaveFairness,
  combinedFairnessScore,
  getPlatoonAverage,
  initializeFairness,
} from './fairness'
import type { Soldier } from '../models'

function makeSoldier(overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: 's1', name: 'Test', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
    ...overrides,
  }
}

describe('Fairness Calculator', () => {
  describe('calculateTaskFairness', () => {
    it('returns 0 for 0 hours worked', () => {
      expect(calculateTaskFairness(0)).toBe(0)
    })

    it('returns proportional score for hours worked', () => {
      expect(calculateTaskFairness(10)).toBeGreaterThan(0)
      expect(calculateTaskFairness(20)).toBeGreaterThan(calculateTaskFairness(10))
    })

    it('is deterministic', () => {
      expect(calculateTaskFairness(16)).toBe(calculateTaskFairness(16))
    })
  })

  describe('calculateLeaveFairness', () => {
    it('returns 0 for no leaves', () => {
      expect(calculateLeaveFairness(0, 0, 0)).toBe(0)
    })

    it('weights weekend leaves more than midweek', () => {
      const weekendOnly = calculateLeaveFairness(1, 0, 0)
      const midweekOnly = calculateLeaveFairness(0, 1, 0)
      expect(weekendOnly).toBeGreaterThan(midweekOnly)
    })

    it('weights midweek leaves more than after leaves', () => {
      const midweekOnly = calculateLeaveFairness(0, 1, 0)
      const afterOnly = calculateLeaveFairness(0, 0, 1)
      expect(midweekOnly).toBeGreaterThan(afterOnly)
    })

    it('adds contributions from all leave types', () => {
      const combined = calculateLeaveFairness(1, 1, 1)
      const weekendOnly = calculateLeaveFairness(1, 0, 0)
      expect(combined).toBeGreaterThan(weekendOnly)
    })
  })

  describe('combinedFairnessScore', () => {
    it('returns 0 for a fresh soldier', () => {
      const soldier = makeSoldier()
      expect(combinedFairnessScore(soldier)).toBe(0)
    })

    it('increases with more hours worked', () => {
      const low = makeSoldier({ hoursWorked: 8 })
      const high = makeSoldier({ hoursWorked: 40 })
      expect(combinedFairnessScore(high)).toBeGreaterThan(combinedFairnessScore(low))
    })

    it('increases with more weekend leaves', () => {
      const noLeave = makeSoldier({ weekendLeavesCount: 0 })
      const withLeave = makeSoldier({ weekendLeavesCount: 2 })
      expect(combinedFairnessScore(withLeave)).toBeGreaterThan(combinedFairnessScore(noLeave))
    })
  })

  describe('getPlatoonAverage', () => {
    it('returns 0 for empty platoon', () => {
      expect(getPlatoonAverage([])).toBe(0)
    })

    it('returns average of combined scores', () => {
      const soldiers = [
        makeSoldier({ id: 's1', hoursWorked: 0 }),
        makeSoldier({ id: 's2', hoursWorked: 20 }),
      ]
      const avg = getPlatoonAverage(soldiers)
      expect(avg).toBeGreaterThan(0)
      expect(avg).toBeLessThan(combinedFairnessScore(soldiers[1]))
    })
  })

  describe('initializeFairness', () => {
    it('sets new soldier fairness to platoon average', () => {
      const existing = [
        makeSoldier({ id: 's1', hoursWorked: 20, weekendLeavesCount: 1 }),
        makeSoldier({ id: 's2', hoursWorked: 16, weekendLeavesCount: 0 }),
      ]
      const newSoldier = makeSoldier({ id: 'new' })
      const initialized = initializeFairness(newSoldier, existing)
      expect(initialized.initialFairness).toBe(getPlatoonAverage(existing))
      expect(initialized.currentFairness).toBe(getPlatoonAverage(existing))
    })

    it('returns 0 fairness for empty platoon', () => {
      const newSoldier = makeSoldier({ id: 'new' })
      const initialized = initializeFairness(newSoldier, [])
      expect(initialized.initialFairness).toBe(0)
    })
  })
})
