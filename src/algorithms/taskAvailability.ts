import type { Soldier, Task, TaskAssignment, AppConfig } from '../models'

/**
 * Returns the ISO datetime after which the soldier can work again.
 */
export function getRestPeriodEnd(taskEndTime: string, restHours: number): string {
  const end = new Date(taskEndTime)
  end.setTime(end.getTime() + restHours * 60 * 60 * 1000)
  return end.toISOString()
}

/**
 * Returns true if the soldier has at least one matching role for the task.
 */
export function hasRequiredRole(soldier: Soldier, task: Task): boolean {
  return task.roleRequirements.some(
    req => req.role === 'Any' || req.role === soldier.role
  )
}

/**
 * Returns true if the soldier is available for the given task.
 * Checks: active status, role match, rest period from prior tasks.
 */
export function isTaskAvailable(
  soldier: Soldier,
  task: Task,
  allTasks: Task[],
  existingAssignments: TaskAssignment[]
): boolean {
  if (soldier.status !== 'Active') return false
  if (!hasRequiredRole(soldier, task)) return false

  const taskStart = new Date(task.startTime).getTime()

  // Find assignments for this soldier
  const myAssignments = existingAssignments.filter(a => a.soldierId === soldier.id)

  for (const assignment of myAssignments) {
    const prevTask = allTasks.find(t => t.id === assignment.taskId)
    if (!prevTask) continue

    const restEnd = new Date(getRestPeriodEnd(prevTask.endTime, prevTask.minRestAfter)).getTime()
    if (taskStart < restEnd) return false
  }

  return true
}

/**
 * Returns true if assigning this soldier to the task would not exceed
 * config.maxDrivingHours for Driver-role soldiers on the same calendar day.
 */
export function checkDrivingHoursLimit(
  soldier: Soldier,
  task: Task,
  allTasks: Task[],
  existingAssignments: TaskAssignment[],
  config: AppConfig,
): boolean {
  if (soldier.role !== 'Driver') return true

  const taskDate = task.startTime.split('T')[0]
  const myAssignments = existingAssignments.filter(a => a.soldierId === soldier.id)

  const hoursAlready = myAssignments.reduce((sum, a) => {
    const t = allTasks.find(t => t.id === a.taskId)
    if (!t || t.startTime.split('T')[0] !== taskDate) return sum
    return sum + t.durationHours
  }, 0)

  return hoursAlready + task.durationHours <= config.maxDrivingHours
}
