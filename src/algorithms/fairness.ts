import { FAIRNESS_WEIGHTS } from '../constants'
import type { Soldier } from '../models'

/**
 * Task fairness score based on hours worked.
 * Simple linear scale: 1 point per hour worked.
 */
export function calculateTaskFairness(hoursWorked: number): number {
  return hoursWorked
}

/**
 * Leave fairness score: weighted sum of leave types.
 * Weekend leaves count most, after-leaves count least.
 */
export function calculateLeaveFairness(
  weekendLeaves: number,
  midweekLeaves: number,
  afterLeaves: number
): number {
  return (
    weekendLeaves * FAIRNESS_WEIGHTS.WEEKEND_LEAVE +
    midweekLeaves * FAIRNESS_WEIGHTS.MIDWEEK_LEAVE +
    afterLeaves * FAIRNESS_WEIGHTS.AFTER_LEAVE
  )
}

/**
 * Combined fairness score for a soldier.
 * Sum of task fairness and leave fairness.
 */
export function combinedFairnessScore(soldier: Soldier): number {
  return (
    calculateTaskFairness(soldier.hoursWorked) +
    calculateLeaveFairness(
      soldier.weekendLeavesCount,
      soldier.midweekLeavesCount,
      soldier.afterLeavesCount
    )
  )
}

/**
 * Average combined fairness score across all soldiers in the platoon.
 */
export function getPlatoonAverage(soldiers: Soldier[]): number {
  if (soldiers.length === 0) return 0
  const total = soldiers.reduce((sum, s) => sum + combinedFairnessScore(s), 0)
  return total / soldiers.length
}

/**
 * Initialize a new soldier's fairness to the current platoon average,
 * so they start on equal footing.
 */
export function initializeFairness(newSoldier: Soldier, platoon: Soldier[]): Soldier {
  const avg = getPlatoonAverage(platoon)
  return {
    ...newSoldier,
    initialFairness: avg,
    currentFairness: avg,
  }
}
