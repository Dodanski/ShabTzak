import { getRestPeriodEnd } from './taskAvailability'
import type { Soldier, Task, TaskSchedule, ScheduleConflict } from '../models'

/**
 * Detects conflicts in a task schedule:
 * - REST_PERIOD_VIOLATION: soldier assigned to tasks with insufficient rest between them
 * - NO_ROLE_AVAILABLE: task role requirement not fully staffed
 */
export function detectTaskConflicts(
  schedule: TaskSchedule,
  tasks: Task[],
  soldiers: Soldier[],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const soldierMap = new Map(soldiers.map(s => [s.id, s]))

  // --- REST_PERIOD_VIOLATION ---
  // Group assignments by soldier
  const bySoldier = new Map<string, typeof schedule.assignments>()
  for (const a of schedule.assignments) {
    if (!bySoldier.has(a.soldierId)) bySoldier.set(a.soldierId, [])
    bySoldier.get(a.soldierId)!.push(a)
  }

  for (const [soldierId, assignments] of bySoldier) {
    // Sort by task start time
    const sorted = assignments
      .map(a => ({ a, task: taskMap.get(a.taskId) }))
      .filter(x => x.task !== undefined)
      .sort((x, y) => new Date(x.task!.startTime).getTime() - new Date(y.task!.startTime).getTime())

    for (let i = 0; i < sorted.length - 1; i++) {
      const currTask = sorted[i].task!
      const nextTask = sorted[i + 1].task!
      const restEnd = new Date(getRestPeriodEnd(currTask.endTime, currTask.minRestAfter)).getTime()
      const nextStart = new Date(nextTask.startTime).getTime()

      if (nextStart < restEnd) {
        const soldier = soldierMap.get(soldierId)
        conflicts.push({
          type: 'REST_PERIOD_VIOLATION',
          message: `${soldier?.name ?? soldierId} lacks rest between tasks ${currTask.id} and ${nextTask.id}`,
          affectedSoldierIds: [soldierId],
          affectedTaskIds: [currTask.id, nextTask.id],
          suggestions: ['Increase time between assignments for this soldier'],
        })
      }
    }
  }

  // --- NO_ROLE_AVAILABLE ---
  for (const task of tasks) {
    for (const requirement of task.roleRequirements) {
      const assigned = schedule.assignments.filter(a => {
        if (a.taskId !== task.id) return false
        if (requirement.role === 'Any') return true
        return a.assignedRole === requirement.role
      })
      if (assigned.length < requirement.count) {
        conflicts.push({
          type: 'NO_ROLE_AVAILABLE',
          message: `Task ${task.id} needs ${requirement.count} ${requirement.role} but has ${assigned.length}`,
          affectedSoldierIds: [],
          affectedTaskIds: [task.id],
          suggestions: ['Add soldiers with the required role', 'Adjust role requirements'],
        })
      }
    }
  }

  return conflicts
}
