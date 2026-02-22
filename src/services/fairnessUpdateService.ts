import { combinedFairnessScore } from '../algorithms/fairness'
import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { LeaveType } from '../models'

/**
 * Updates a soldier's fairness counters and currentFairness score
 * after a task or leave assignment is created.
 */
export class FairnessUpdateService {
  constructor(
    private repo: SoldierRepository,
    private history: HistoryService,
  ) {}

  async applyTaskAssignment(
    soldierId: string,
    durationHours: number,
    changedBy: string,
  ): Promise<void> {
    const soldier = await this.repo.getById(soldierId)
    if (!soldier) throw new Error(`Soldier ${soldierId} not found`)

    const newHoursWorked = soldier.hoursWorked + durationHours
    const updated = { ...soldier, hoursWorked: newHoursWorked }
    const newFairness = combinedFairnessScore(updated)

    await this.repo.update({
      id: soldierId,
      hoursWorked: newHoursWorked,
      currentFairness: newFairness,
    })
    await this.history.append(
      'FAIRNESS_UPDATE', 'Soldier', soldierId, changedBy,
      `Task assignment: +${durationHours}h worked`
    )
  }

  async applyLeaveAssignment(
    soldierId: string,
    leaveType: LeaveType,
    isWeekend: boolean,
    changedBy: string,
  ): Promise<void> {
    const soldier = await this.repo.getById(soldierId)
    if (!soldier) throw new Error(`Soldier ${soldierId} not found`)

    let weekendLeavesCount = soldier.weekendLeavesCount
    let midweekLeavesCount = soldier.midweekLeavesCount
    let afterLeavesCount = soldier.afterLeavesCount

    if (leaveType === 'After') {
      afterLeavesCount++
    } else if (isWeekend) {
      weekendLeavesCount++
    } else {
      midweekLeavesCount++
    }

    const updated = { ...soldier, weekendLeavesCount, midweekLeavesCount, afterLeavesCount }
    const newFairness = combinedFairnessScore(updated)

    await this.repo.update({
      id: soldierId,
      weekendLeavesCount,
      midweekLeavesCount,
      afterLeavesCount,
      currentFairness: newFairness,
    })
    await this.history.append(
      'FAIRNESS_UPDATE', 'Soldier', soldierId, changedBy,
      `Leave assignment: ${leaveType}, weekend=${isWeekend}`
    )
  }

  async applyManualAdjustment(
    soldierId: string,
    delta: number,
    reason: string,
    changedBy: string,
  ): Promise<void> {
    const soldier = await this.repo.getById(soldierId)
    if (!soldier) throw new Error(`Soldier ${soldierId} not found`)

    const newFairness = soldier.currentFairness + delta

    await this.repo.update({ id: soldierId, currentFairness: newFairness })
    await this.history.append(
      'MANUAL_ADJUSTMENT', 'Soldier', soldierId, changedBy,
      `Manual adjustment: delta=${delta}, reason=${reason}`
    )
  }
}
