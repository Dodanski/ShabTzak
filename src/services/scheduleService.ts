import { scheduleLeave } from '../algorithms/leaveScheduler'
import { scheduleTasks } from '../algorithms/taskScheduler'
import { generateCyclicalLeaves } from '../algorithms/cyclicalLeaveScheduler'
import type { SoldierRepository } from './soldierRepository'
import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import type { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { HistoryService } from './historyService'
import type { LeaveSchedule, TaskSchedule, Task, AppConfig } from '../models'

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
    const [soldiers, requests, existing] = await Promise.all([
      this.soldiers.list(),
      this.leaveRequests.list(),
      this.leaveAssignments.list(),
    ])

    // First, generate automatic cyclical leaves based on the rotation pattern
    const withCyclicalLeaves = generateCyclicalLeaves(soldiers, existing, config, scheduleStart, scheduleEnd)

    // Then, process manual leave requests (which take precedence over cyclical leaves)
    const schedule = scheduleLeave(requests, soldiers, withCyclicalLeaves, config, scheduleStart, scheduleEnd)

    // Persist only assignments that aren't already stored
    const existingIds = new Set(existing.map(a => a.id))
    for (const assignment of schedule.assignments) {
      if (!existingIds.has(assignment.id)) {
        await this.leaveAssignments.create({
          soldierId: assignment.soldierId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          leaveType: assignment.leaveType,
          isWeekend: assignment.isWeekend,
          requestId: assignment.requestId,
        })
      }
    }

    await this.history.append(
      'GENERATE_LEAVE_SCHEDULE', 'LeaveSchedule', scheduleStart,
      changedBy, `Generated for ${scheduleStart} to ${scheduleEnd}`
    )

    return schedule
  }

  async generateTaskSchedule(tasks: Task[], changedBy: string, onProgress?: (completed: number, total: number) => void): Promise<TaskSchedule> {
    const [soldiers, existing] = await Promise.all([
      this.soldiers.list(),
      this.taskAssignments.list(),
    ])

    // Pass tasks array as allTasksInSystem for rest period validation
    // (tasks array should contain all tasks from spreadsheet, expanded if recurring)
    const schedule = scheduleTasks(tasks, soldiers, existing, tasks)

    // Persist only assignments that aren't already stored
    const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}:${a.assignedRole}`))
    const newAssignments = schedule.assignments.filter(assignment =>
      !existingKeys.has(`${assignment.taskId}:${assignment.soldierId}:${assignment.assignedRole}`)
    )

    // Batch create assignments with progress callback
    if (newAssignments.length > 0) {
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
