import type { Soldier, Task, TaskAssignment, AppConfig, LeaveAssignment } from '../models'

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
  return task.roleRequirements.some(req => {
    const roles = req.roles ?? (req.role ? [req.role] : [])
    return roles.includes('Any') || roles.includes(soldier.role)
  })
}

/**
 * Check if soldier is on leave during the task date.
 * Note: leaveAssignments may have ISO datetime strings (e.g., "2026-03-20T00:00:00")
 * while taskDate is just a date string (e.g., "2026-03-20"). We normalize both to date-only.
 */
function isOnLeaveOnDate(soldier: Soldier, taskDate: string, leaveAssignments: LeaveAssignment[]): boolean {
  return leaveAssignments.some(la => {
    if (la.soldierId !== soldier.id) return false
    // Normalize to date-only strings for comparison
    const leaveStart = la.startDate.split('T')[0]
    const leaveEnd = la.endDate.split('T')[0]
    return leaveStart <= taskDate && taskDate <= leaveEnd
  })
}

/**
 * Check if soldier is on transition day (on the way home or to base)
 * Returns 'toBase', 'fromBase', or null
 */
function getTransitionDayType(
  soldier: Soldier,
  taskDate: string,
  leaveAssignments: LeaveAssignment[]
): 'toBase' | 'fromBase' | null {
  for (const la of leaveAssignments) {
    if (la.soldierId !== soldier.id) continue

    // Normalize to date-only strings to avoid timezone issues
    const leaveStartDate = la.startDate.split('T')[0]
    const leaveEndDate = la.endDate.split('T')[0]

    // Check if task date is day before leave (on the way home)
    const dayBeforeLeave = new Date(leaveStartDate + 'T12:00:00Z') // Use noon UTC to avoid timezone edge cases
    dayBeforeLeave.setDate(dayBeforeLeave.getDate() - 1)
    if (taskDate === dayBeforeLeave.toISOString().split('T')[0]) {
      return 'fromBase'
    }

    // Check if task date is day after leave (on the way to base)
    const dayAfterLeave = new Date(leaveEndDate + 'T12:00:00Z')
    dayAfterLeave.setDate(dayAfterLeave.getDate() + 1)
    if (taskDate === dayAfterLeave.toISOString().split('T')[0]) {
      return 'toBase'
    }
  }
  return null
}


/**
 * Returns true if the soldier is available for the given task.
 * Checks: active status, role match, rest period from prior tasks, leave assignments, and transition days.
 */
export function isTaskAvailable(
  soldier: Soldier,
  task: Task,
  allTasks: Task[],
  existingAssignments: TaskAssignment[],
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig
): boolean {
  const debug = import.meta.env.DEV && true // ENABLED for debugging

  if (soldier.status !== 'Active') {
    if (debug) console.log(`[taskAvailability] ${soldier.id} filtered: not active (status=${soldier.status})`)
    return false
  }
  if (!hasRequiredRole(soldier, task)) {
    if (debug) console.log(`[taskAvailability] ${soldier.id} filtered: no required role (soldier=${soldier.role}, task requires=${task.roleRequirements.map(r => r.role).join(',')})`)
    return false
  }

  const taskDate = task.startTime.split('T')[0]
  const taskStart = new Date(task.startTime)

  // Check if soldier is within their service dates
  // Compare dates as strings to avoid timezone issues
  if (taskDate < soldier.serviceStart || taskDate > soldier.serviceEnd) {
    if (debug) console.log(`[taskAvailability] ${soldier.id} filtered: outside service dates (taskDate=${taskDate}, serviceStart=${soldier.serviceStart}, serviceEnd=${soldier.serviceEnd})`)
    return false
  }

  // Check if this soldier is already assigned to this specific task
  const alreadyOnThisTask = existingAssignments.some(a =>
    a.soldierId === soldier.id && a.taskId === task.id
  )
  if (alreadyOnThisTask) return false

  // Check leave assignments if provided
  if (leaveAssignments && leaveAssignments.length > 0) {
    // Check if on leave during task
    if (isOnLeaveOnDate(soldier, taskDate, leaveAssignments)) return false

    // Check transition days
    if (config) {
      const transitionType = getTransitionDayType(soldier, taskDate, leaveAssignments)
      if (transitionType === 'fromBase') {
        // On the way home: can't do tasks that START before exit time (including minutes)
        // Compare as HH:MM strings for proper ordering
        const exitTime = config.leaveBaseExitHour.substring(0, 5) // "06:00" -> "06:00"
        const taskStartTime = task.startTime.split('T')[1].substring(0, 5) // "08:30:00" -> "08:30"
        if (taskStartTime < exitTime) return false
      } else if (transitionType === 'toBase') {
        // On the way to base: can't do tasks that END after return time (including minutes)
        const returnTime = config.leaveBaseReturnHour.substring(0, 5)
        const taskEndTime = task.endTime.split('T')[1].substring(0, 5)
        if (taskEndTime > returnTime) return false
      }
    }
  }

  // Check rest period from prior tasks
  const taskStartMs = taskStart.getTime()
  const myAssignments = existingAssignments.filter(a => a.soldierId === soldier.id)

  for (const assignment of myAssignments) {
    const prevTask = allTasks.find(t => t.id === assignment.taskId)
    if (!prevTask) continue

    const restEnd = new Date(getRestPeriodEnd(prevTask.endTime, prevTask.minRestAfter)).getTime()
    if (taskStartMs < restEnd) return false
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
