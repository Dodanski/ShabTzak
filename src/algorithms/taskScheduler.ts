import { combinedFairnessScore } from './fairness'
import { isTaskAvailable } from './taskAvailability'
import type { Soldier, Task, TaskAssignment, TaskSchedule } from '../models'

/**
 * Greedy task scheduler: processes tasks by start time, assigns soldiers to each
 * role requirement sorted by fairness score (lowest first).
 *
 * @param tasks - Tasks to assign soldiers to
 * @param soldiers - Available soldiers
 * @param existingAssignments - Existing assignments (used for fairness and rest period checking)
 * @param allTasksInSystem - All tasks in the system (needed for rest period validation against prior tasks)
 */
export function scheduleTasks(
  tasks: Task[],
  soldiers: Soldier[],
  existingAssignments: TaskAssignment[],
  allTasksInSystem?: Task[],
): TaskSchedule {
  const result: TaskAssignment[] = [...existingAssignments]
  // Use all tasks in system for rest period checking, fallback to just scheduled tasks
  const tasksForValidation = allTasksInSystem || tasks


  // Group tasks by date for visibility
  const tasksByDate: Record<string, number> = {}
  for (const task of tasks) {
    const date = task.startTime.split('T')[0]
    tasksByDate[date] = (tasksByDate[date] ?? 0) + 1
  }

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
        return isTaskAvailable(s, task, tasksForValidation, result)
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

  // Group assignments by date
  const assignmentsByDate: Record<string, number> = {}
  for (const assignment of result) {
    const task = tasks.find(t => t.id === assignment.taskId)
    if (task) {
      const date = task.startTime.split('T')[0]
      assignmentsByDate[date] = (assignmentsByDate[date] ?? 0) + 1
    }
  }

  return {
    startDate,
    endDate,
    assignments: result,
    conflicts: [],
  }
}
