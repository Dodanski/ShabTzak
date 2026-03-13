import { scheduleLeave } from '../algorithms/leaveScheduler'
import { scheduleTasks } from '../algorithms/taskScheduler'
import { generateCyclicalLeaves } from '../algorithms/cyclicalLeaveScheduler'
import type { SoldierRepository } from './soldierRepository'
import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import type { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { HistoryService } from './historyService'
import type { LeaveSchedule, TaskSchedule, Task, AppConfig, LeaveAssignment, Soldier } from '../models'

/**
 * Orchestrates leave and task schedule generation:
 * runs the greedy scheduling algorithms, persists new assignments, logs history.
 */
export class ScheduleService {
  constructor(
    private soldiers: SoldierRepository,
    private leaveRequests: LeaveRequestRepository,
    private leaveAssignments: LeaveAssignmentRepository,
    private taskAssignments: TaskAssignmentRepository,
    private history: HistoryService,
  ) {}

  async generateLeaveSchedule(
    config: AppConfig,
    scheduleStart: string,
    scheduleEnd: string,
    changedBy: string,
  ): Promise<LeaveSchedule> {
    // Load data - use Promise.all for parallelism, exponential backoff handles 429s
    const [soldiers, requests, existing, taskAssignments] = await Promise.all([
      this.soldiers.list(),
      this.leaveRequests.list(),
      this.leaveAssignments.list(),
      this.taskAssignments.list(),
    ])

    // NOTE: Multi-unit leave assignments are loaded from current unit only.
    // In multi-unit scheduling, soldiers from other units won't have their leaves pre-loaded.
    // This is acceptable for MVP - their leave data would need to be fetched from their unit's spreadsheet.
    // TODO: Load leaves from all unit spreadsheets for full multi-unit support

    // Generate automatic cyclical leaves based on the rotation pattern, respecting role capacity
    const withCyclicalLeaves = generateCyclicalLeaves(soldiers, existing, taskAssignments, config, scheduleStart, scheduleEnd)

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
    const [soldiers, existing] = await Promise.all([
      this.soldiers.list(),
      this.taskAssignments.list(),
    ])

    // Use allSoldiers if provided and valid (multi-unit scheduling), otherwise use unit soldiers
    const schedulingSoldiers = (allSoldiers && allSoldiers.length > soldiers.length)
      ? allSoldiers
      : soldiers

    if (import.meta.env.DEV) {
      console.log('[scheduleService] Scheduling with', schedulingSoldiers.length, 'soldiers',
        schedulingSoldiers === allSoldiers ? '(multi-unit)' : '(unit-only)')
    }

    // Pass tasks array as allTasksInSystem for rest period validation
    // (tasks array should contain all tasks from spreadsheet, expanded if recurring)
    const schedule = scheduleTasks(tasks, schedulingSoldiers, existing, tasks, leaveAssignments, config)

    // Persist only assignments that aren't already stored
    const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}:${a.assignedRole}`))
    const newAssignments = schedule.assignments.filter(assignment =>
      !existingKeys.has(`${assignment.taskId}:${assignment.soldierId}:${assignment.assignedRole}`)
    )

    // Batch create assignments with progress callback
    if (newAssignments.length > 0) {
      // Group assignments by soldier unit for multi-unit scheduling
      const assignmentsByUnit = new Map<string, typeof newAssignments>()

      newAssignments.forEach(a => {
        const soldier = schedulingSoldiers.find(s => s.id === a.soldierId)
        const unitId = soldier?.unit || 'Unknown'
        if (!assignmentsByUnit.has(unitId)) {
          assignmentsByUnit.set(unitId, [])
        }
        assignmentsByUnit.get(unitId)!.push(a)
      })

      // Log unit distribution for debugging
      if (import.meta.env.DEV) {
        console.log('[scheduleService] Assignment distribution by unit:')
        assignmentsByUnit.forEach((assignments, unit) => {
          console.log(`  ${unit}: ${assignments.length} assignments`)
        })
      }

      // Save all assignments to current unit's sheet
      await this.taskAssignments.createBatch(
        newAssignments.map(a => ({
          taskId: a.taskId,
          soldierId: a.soldierId,
          assignedRole: a.assignedRole,
          createdBy: changedBy,
        })),
        onProgress
      )
    }

    await this.history.append(
      'GENERATE_TASK_SCHEDULE', 'TaskSchedule', '',
      changedBy, `Generated task schedule`
    )

    return schedule
  }
}
