import { combinedFairnessScore } from './fairness'
import { isTaskAvailable } from './taskAvailability'
import type { Soldier, Task, TaskAssignment, TaskSchedule } from '../models'

/**
 * Greedy task scheduler: processes tasks by start time, assigns soldiers to each
 * role requirement sorted by fairness score (lowest first).
 */
export function scheduleTasks(
  tasks: Task[],
  soldiers: Soldier[],
  existingAssignments: TaskAssignment[],
): TaskSchedule {
  const result: TaskAssignment[] = [...existingAssignments]

  // Process tasks in chronological order
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  for (const task of sortedTasks) {
    for (const requirement of task.roleRequirements) {
      // Count already-assigned soldiers for this requirement on this task
      const alreadyAssigned = result.filter(a => {
        if (a.taskId !== task.id) return false
        if (requirement.role === 'Any') return true
        return a.assignedRole === requirement.role
      }).length

      const remaining = requirement.count - alreadyAssigned
      if (remaining <= 0) continue

      // Find eligible soldiers: role match + available (rest period, status)
      const eligible = soldiers.filter(s => {
        if (requirement.role !== 'Any' && s.role !== requirement.role) return false
        return isTaskAvailable(s, task, tasks, result)
      })

      // Sort by combined fairness ascending (lower = more deserving)
      const ranked = [...eligible].sort(
        (a, b) => combinedFairnessScore(a) - combinedFairnessScore(b)
      )

      // Assign up to `remaining` soldiers
      for (let i = 0; i < Math.min(remaining, ranked.length); i++) {
        const soldier = ranked[i]
        result.push({
          scheduleId: `sched-${task.id}`,
          taskId: task.id,
          soldierId: soldier.id,
          assignedRole: requirement.role === 'Any' ? soldier.role : requirement.role,
          isLocked: false,
          createdAt: new Date().toISOString(),
          createdBy: 'scheduler',
        })
      }
    }
  }

  // Derive date range from all tasks
  const startDate = tasks.length > 0
    ? tasks.reduce((min, t) => t.startTime < min ? t.startTime : min, tasks[0].startTime).split('T')[0]
    : ''
  const endDate = tasks.length > 0
    ? tasks.reduce((max, t) => t.endTime > max ? t.endTime : max, tasks[0].endTime).split('T')[0]
    : ''

  return {
    startDate,
    endDate,
    assignments: result,
    conflicts: [],
  }
}
