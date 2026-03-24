import { scheduleLeave } from '../algorithms/leaveScheduler'
import { scheduleTasks } from '../algorithms/taskScheduler'
import { generateCyclicalLeaves } from '../algorithms/cyclicalLeaveScheduler'
import type { SoldierRepository } from './soldierRepository'
import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { MasterLeaveAssignmentRepository } from './masterLeaveAssignmentRepository'
import type { MasterTaskAssignmentRepository } from './masterTaskAssignmentRepository'
import type { HistoryService } from './historyService'
import type { LeaveSchedule, TaskSchedule, Task, AppConfig, LeaveAssignment, Soldier, TaskAssignment } from '../models'
// Task type is used for looking up task dates when calculating leave capacity

/**
 * Orchestrates leave and task schedule generation:
 * runs the greedy scheduling algorithms, persists new assignments to shared master sheet, logs history.
 * Uses master repositories to ensure all units share the same schedule.
 */
export class ScheduleService {
  constructor(
    private soldiers: SoldierRepository,
    private leaveRequests: LeaveRequestRepository,
    private leaveAssignments: MasterLeaveAssignmentRepository,
    private taskAssignments: MasterTaskAssignmentRepository,
    private history: HistoryService,
  ) {}

  async generateLeaveSchedule(
    config: AppConfig,
    scheduleStart: string,
    scheduleEnd: string,
    changedBy: string,
    allSoldiers?: Soldier[],  // NEW: all soldiers from all units for global scheduling
    generatedTaskAssignments?: TaskAssignment[],  // NEW: task assignments from prior task scheduling
    expandedTasks?: Task[],  // NEW: expanded tasks array for looking up task dates
  ): Promise<LeaveSchedule> {
    // Load data - use Promise.all for parallelism, exponential backoff handles 429s
    let [unitSoldiers, requests, existing, storedTaskAssignments] = await Promise.all([
      this.soldiers.list(),
      this.leaveRequests.list(),
      this.leaveAssignments.list(),
      this.taskAssignments.list(),
    ])

    // Use allSoldiers if provided (multi-unit scheduling), otherwise fall back to unit soldiers
    const soldiers = (allSoldiers && allSoldiers.length > 0) ? allSoldiers : unitSoldiers

    // Merge stored task assignments with newly generated ones (if provided)
    const taskAssignments = generatedTaskAssignments
      ? [...storedTaskAssignments, ...generatedTaskAssignments]
      : storedTaskAssignments

    if (import.meta.env.DEV) {
      console.log('[scheduleService] Leave scheduling with', soldiers.length, 'soldiers',
        allSoldiers && allSoldiers.length > 0 ? '(multi-unit)' : '(unit-only)')
      console.log('[scheduleService] Task assignments to respect:', taskAssignments.length)
    }

    // Clear only future leave assignments, preserving past assignments
    // This prevents regenerating history while allowing fresh future schedules
    if (existing.length > 0) {
      console.log(`[scheduleService] Clearing future leave assignments, preserving past`)
      existing = await this.leaveAssignments.clearFutureAssignments()
    }

    // Generate automatic cyclical leaves based on the rotation pattern, respecting role capacity
    // Now uses ALL soldiers globally and respects task assignments
    // Pass expanded tasks so capacity calculation can check which soldiers are on tasks each day
    const withCyclicalLeaves = generateCyclicalLeaves(soldiers, existing, taskAssignments, config, scheduleStart, scheduleEnd, expandedTasks ?? [])

    // Process manual leave requests (which override cyclical leaves)
    const schedule = scheduleLeave(requests, soldiers, withCyclicalLeaves, config, scheduleStart, scheduleEnd)

    // Persist only assignments that aren't already stored
    const existingIds = new Set(existing.map(a => a.id))
    const toCreate = schedule.assignments.filter(a => !existingIds.has(a.id))

    if (toCreate.length > 0) {
      await this.leaveAssignments.createBatch(
        toCreate.map(a => ({
          soldierId: a.soldierId,
          startDate: a.startDate,
          endDate: a.endDate,
          leaveType: a.leaveType,
          isWeekend: a.isWeekend,
          requestId: a.requestId,
        }))
      )
    }

    await this.history.append(
      'GENERATE_LEAVE_SCHEDULE', 'LeaveSchedule', scheduleStart,
      changedBy, `Generated for ${scheduleStart} to ${scheduleEnd}`
    )

    return schedule
  }

  async generateTaskSchedule(
    tasks: Task[],
    changedBy: string,
    onProgress?: (completed: number, total: number) => void,
    leaveAssignments?: LeaveAssignment[],
    config?: AppConfig,
    allSoldiers?: Soldier[]  // NEW: optional all soldiers from all units
  ): Promise<TaskSchedule> {
    // Load data - use Promise.all for parallelism, exponential backoff handles 429s
    const [soldiers, allExisting] = await Promise.all([
      this.soldiers.list(),
      this.taskAssignments.list(),
    ])

    // Clear only future assignments, preserving past assignments
    // This prevents regenerating history while allowing fresh future schedules
    let existing: TaskAssignment[] = []
    if (allExisting.length > 0) {
      console.log(`[scheduleService] Clearing future task assignments, preserving past`)
      existing = await this.taskAssignments.clearFutureAssignments(tasks)
    }

    // Use allSoldiers if provided (multi-unit scheduling), otherwise use unit soldiers
    // Note: We use allSoldiers if it exists and has any soldiers, regardless of count comparison
    // This fixes a bug where allSoldiers.length === soldiers.length would fall back incorrectly
    const schedulingSoldiers = (allSoldiers && allSoldiers.length > 0)
      ? allSoldiers
      : soldiers

    if (import.meta.env.DEV) {
      console.log('[scheduleService] Scheduling with', schedulingSoldiers.length, 'soldiers',
        schedulingSoldiers === allSoldiers ? '(multi-unit)' : '(unit-only)')
      console.log('[scheduleService] Tasks to schedule:', tasks.length)
      console.log('[scheduleService] Leave assignments available:', leaveAssignments?.length ?? 0)
      console.log('[scheduleService] Existing task assignments:', existing.length)
    }

    // Pass tasks array as allTasksInSystem for rest period validation
    // (tasks array should contain all tasks from spreadsheet, expanded if recurring)
    const schedule = scheduleTasks(tasks, schedulingSoldiers, existing, tasks, leaveAssignments, config)

    if (import.meta.env.DEV) {
      console.log('[scheduleService] Task scheduling result:', schedule.assignments.length, 'assignments,', schedule.conflicts.length, 'conflicts')
    }

    // Persist only assignments that aren't already stored
    const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}:${a.assignedRole}`))
    const newAssignments = schedule.assignments.filter(assignment =>
      !existingKeys.has(`${assignment.taskId}:${assignment.soldierId}:${assignment.assignedRole}`)
    )

    // Batch create assignments with progress callback
    if (newAssignments.length > 0) {
      // Save to shared master schedule
      await this.taskAssignments.createBatch(
        newAssignments.map(a => {
          // Find soldier's unit for assignment tracking in master schedule
          const soldier = allSoldiers?.find(s => s.id === a.soldierId)
          return {
            taskId: a.taskId,
            soldierId: a.soldierId,
            assignedRole: a.assignedRole,
            assignedUnitId: soldier?.unit,
            createdBy: changedBy,
          }
        }),
        onProgress
      )

      if (import.meta.env.DEV && allSoldiers && allSoldiers.length > 0) {
        const assignmentsByUnit = new Map<string, typeof newAssignments>()
        newAssignments.forEach(a => {
          const soldier = allSoldiers.find(s => s.id === a.soldierId)
          const unitId = soldier?.unit || 'Unknown'
          if (!assignmentsByUnit.has(unitId)) {
            assignmentsByUnit.set(unitId, [])
          }
          assignmentsByUnit.get(unitId)!.push(a)
        })
        console.log('[scheduleService] Multi-unit assignments created:')
        assignmentsByUnit.forEach((assignments, unit) => {
          console.log(`  ${unit}: ${assignments.length} assignments`)
        })
      }
    }

    await this.history.append(
      'GENERATE_TASK_SCHEDULE', 'TaskSchedule', '',
      changedBy, `Generated task schedule`
    )

    return schedule
  }
}
