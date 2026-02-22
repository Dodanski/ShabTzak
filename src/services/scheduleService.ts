import { scheduleLeave } from '../algorithms/leaveScheduler'
import { scheduleTasks } from '../algorithms/taskScheduler'
import type { SoldierRepository } from './soldierRepository'
import type { TaskRepository } from './taskRepository'
import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import type { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { ConfigRepository } from './configRepository'
import type { HistoryService } from './historyService'
import type { LeaveSchedule, TaskSchedule } from '../models'

/**
 * Orchestrates leave and task schedule generation:
 * runs the greedy scheduling algorithms, persists new assignments, logs history.
 */
export class ScheduleService {
  constructor(
    private soldiers: SoldierRepository,
    private leaveRequests: LeaveRequestRepository,
    private leaveAssignments: LeaveAssignmentRepository,
    private tasks: TaskRepository,
    private taskAssignments: TaskAssignmentRepository,
    private config: ConfigRepository,
    private history: HistoryService,
  ) {}

  async generateLeaveSchedule(
    scheduleStart: string,
    scheduleEnd: string,
    changedBy: string,
  ): Promise<LeaveSchedule> {
    const [soldiers, requests, existing, config] = await Promise.all([
      this.soldiers.list(),
      this.leaveRequests.list(),
      this.leaveAssignments.list(),
      this.config.read(),
    ])

    const schedule = scheduleLeave(requests, soldiers, existing, config, scheduleStart, scheduleEnd)

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

  async generateTaskSchedule(changedBy: string): Promise<TaskSchedule> {
    const [soldiers, tasks, existing] = await Promise.all([
      this.soldiers.list(),
      this.tasks.list(),
      this.taskAssignments.list(),
    ])

    const schedule = scheduleTasks(tasks, soldiers, existing)

    // Persist only assignments that aren't already stored
    const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}`))
    for (const assignment of schedule.assignments) {
      if (!existingKeys.has(`${assignment.taskId}:${assignment.soldierId}`)) {
        await this.taskAssignments.create({
          taskId: assignment.taskId,
          soldierId: assignment.soldierId,
          assignedRole: assignment.assignedRole,
          createdBy: changedBy,
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
