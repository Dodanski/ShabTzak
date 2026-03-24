import { parseDate } from '../utils/dateUtils'
import type { Soldier, TaskAssignment, LeaveAssignment, AppConfig, Task } from '../models'

/**
 * Calculates how many additional soldiers of each role can take leave on `date`
 * while respecting:
 * 1. The leave ratio (e.g., 10:4 means max ~28.5% of soldiers on leave at once)
 * 2. minBasePresenceByRole (minimum soldiers that MUST be in base)
 * 3. Task assignments (soldiers on tasks cannot be on leave)
 *
 * Formula per role:
 * maxOnLeaveByRatio = floor(totalOfRole * leaveRatioDaysHome / cycleLength)
 * maxOnLeaveByMinPresence = totalOfRole - minBasePresence - assignedToTasks
 * maxOnLeave = min(maxOnLeaveByRatio, maxOnLeaveByMinPresence)
 * capacity = max(0, maxOnLeave - alreadyOnLeave)
 *
 * Returns 0 if capacity would be negative (can't allow more leaves).
 */
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  date: string,
  existingLeaves: LeaveAssignment[] = [],
  tasks: Task[] = [],
): Record<string, number> {
  const capacity: Record<string, number> = {}
  const checkDate = parseDate(date)
  const dateStr = date.split('T')[0]

  // Calculate cycle parameters for leave ratio enforcement
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
  const leaveRatio = config.leaveRatioDaysHome / cycleLength  // e.g., 4/14 ≈ 0.286

  // Build a set of soldier IDs already on leave on `date`
  const onLeaveToday = new Set<string>()
  for (const leave of existingLeaves) {
    const start = parseDate(leave.startDate.split('T')[0])
    const end = parseDate(leave.endDate.split('T')[0])
    if (start <= checkDate && checkDate <= end) {
      onLeaveToday.add(leave.soldierId)
    }
  }

  // Build a set of soldier IDs assigned to tasks on `date`
  // Tasks have priority - soldiers on tasks cannot take leave
  const onTaskToday = new Set<string>()
  if (tasks.length > 0) {
    // Build task ID -> date map for quick lookup
    const taskDateMap = new Map<string, string>()
    for (const task of tasks) {
      const taskDate = task.startTime.split('T')[0]
      taskDateMap.set(task.id, taskDate)
    }

    for (const assignment of taskAssignments) {
      const taskDate = taskDateMap.get(assignment.taskId)
      if (taskDate === dateStr) {
        onTaskToday.add(assignment.soldierId)
      }
    }
  }

  // Calculate overall presence constraint from minBasePresence percentage
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  const totalActive = activeSoldiers.length
  const totalAlreadyOnLeave = activeSoldiers.filter(s => onLeaveToday.has(s.id)).length

  // minBasePresence is a percentage (e.g., 66 means 66% must stay)
  // So max on leave = totalActive * (100 - minBasePresence) / 100
  const maxOnLeaveByOverallPresence = Math.floor(totalActive * (100 - config.minBasePresence) / 100)
  const overallRemainingCapacity = Math.max(0, maxOnLeaveByOverallPresence - totalAlreadyOnLeave)

  // Group soldiers by role
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Calculate remaining capacity for each role
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const alreadyOnLeave = roleSoldiers.filter(s => onLeaveToday.has(s.id)).length
    const assignedToTasks = roleSoldiers.filter(s => onTaskToday.has(s.id)).length

    // Three constraints on max soldiers on leave:
    // 1. Leave ratio: at most ~28.5% (for 10:4) of role can be on leave at once
    const maxOnLeaveByRatio = Math.floor(totalOfRole * leaveRatio)

    // 2. Min presence per role: must keep minRequired in base, minus those on tasks
    const availableAfterTasksAndMinPresence = totalOfRole - minRequired - assignedToTasks
    const maxOnLeaveByMinPresence = Math.max(0, availableAfterTasksAndMinPresence)

    // 3. Overall presence: respect the global minBasePresence percentage
    // This role can only use its fair share of the remaining overall capacity
    const roleShare = totalOfRole / totalActive
    const maxOnLeaveByOverall = Math.floor(overallRemainingCapacity * roleShare) + alreadyOnLeave

    // Take the most restrictive constraint
    const maxOnLeave = Math.min(maxOnLeaveByRatio, maxOnLeaveByMinPresence, maxOnLeaveByOverall)

    // Capacity is how many MORE can go on leave (at least 0)
    const availableForLeave = Math.max(0, maxOnLeave - alreadyOnLeave)
    capacity[role] = availableForLeave
  }

  return capacity
}

/**
 * Checks if a specific soldier can take leave on a date without violating constraints
 */
export function canSoldierTakeLeave(
  soldier: Soldier,
  date: string,
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  existingLeaves: LeaveAssignment[] = [],
  tasks: Task[] = [],
): boolean {
  const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date, existingLeaves, tasks)
  return (capacity[soldier.role] ?? 0) > 0
}
