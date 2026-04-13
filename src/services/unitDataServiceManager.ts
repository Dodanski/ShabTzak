import { DataService } from './dataService'
import type { Unit, TaskAssignment, Soldier } from '../models'
import type { IHistoryService } from './IHistoryService'
import type { useDatabase } from '../contexts/DatabaseContext'

/**
 * Manages DataServices for all units
 * Enables multi-unit assignment distribution
 */
export class UnitDataServiceManager {
  private serviceMap = new Map<string, DataService>()

  constructor(
    private dbContext: ReturnType<typeof useDatabase>,
    private historyService: IHistoryService
  ) {}

  /**
   * Create DataServices for all units
   */
  initializeUnits(units: Unit[]) {
    for (const unit of units) {
      const ds = new DataService(
        this.dbContext,
        this.historyService
      )
      this.serviceMap.set(unit.name, ds)
    }
    console.log('[UnitDataServiceManager] Initialized for units:', Array.from(this.serviceMap.keys()))
  }

  /**
   * Get DataService for a specific unit
   */
  getService(unitName: string): DataService | undefined {
    return this.serviceMap.get(unitName)
  }

  /**
   * Distribute task assignments to all affected units' spreadsheets
   */
  async distributeAssignments(
    assignments: TaskAssignment[],
    allSoldiers: Soldier[],
    changedBy: string
  ): Promise<Map<string, number>> {
    const resultsByUnit = new Map<string, number>()

    // Group assignments by soldier's unit
    const assignmentsByUnit = new Map<string, TaskAssignment[]>()
    for (const assignment of assignments) {
      const soldier = allSoldiers.find(s => s.id === assignment.soldierId)
      const unitName = soldier?.unit || 'Unknown'

      if (!assignmentsByUnit.has(unitName)) {
        assignmentsByUnit.set(unitName, [])
      }
      assignmentsByUnit.get(unitName)!.push(assignment)
    }

    // Save to each unit's spreadsheet
    for (const [unitName, unitAssignments] of assignmentsByUnit) {
      const ds = this.getService(unitName)
      if (!ds) {
        console.warn('[UnitDataServiceManager] No DataService for unit:', unitName)
        resultsByUnit.set(unitName, 0)
        continue
      }

      try {
        // Get existing assignments to avoid duplicates
        const existing = await ds.taskAssignments.list()
        const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}:${a.assignedRole}`))

        // Filter out already-existing assignments
        const toCreate = unitAssignments.filter(a =>
          !existingKeys.has(`${a.taskId}:${a.soldierId}:${a.assignedRole}`)
        )

        if (toCreate.length > 0) {
          await ds.taskAssignments.createBatch(
            toCreate.map(a => ({
              taskId: a.taskId,
              soldierId: a.soldierId,
              assignedRole: a.assignedRole,
              createdBy: changedBy,
            }))
          )
        }

        resultsByUnit.set(unitName, toCreate.length)
        console.log(`[UnitDataServiceManager] Saved ${toCreate.length} assignments to ${unitName}`)
      } catch (e) {
        console.error(`[UnitDataServiceManager] Failed to save assignments to ${unitName}:`, e)
        resultsByUnit.set(unitName, -1)
      }
    }

    return resultsByUnit
  }

  /**
   * Get all units managed by this manager
   */
  getUnits(): string[] {
    return Array.from(this.serviceMap.keys())
  }
}
