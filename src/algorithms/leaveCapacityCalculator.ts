import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import type { Soldier, TaskAssignment, LeaveAssignment, AppConfig, Task } from '../models'

/**
 * Pre-computed base capacity data for a date range.
 * This allows efficient capacity lookups without recalculating on every check.
 */
export interface BaseCapacityData {
  /** Max soldiers on leave per role (based on ratio + min presence) */
  maxOnLeaveByRole: Record<string, number>
  /** Soldiers assigned to tasks on this date (by role) */
  onTaskByRole: Record<string, Set<string>>
  /** Overall max on leave (global minBasePresence constraint) */
  maxOnLeaveOverall: number
  /** Total active soldiers */
  totalActive: number
  /** Soldiers by role for quick lookup */
  soldierIdsByRole: Record<string, string[]>
}

/**
 * Pre-computes base leave capacity for all dates in a range.
 * This is called ONCE at the start of schedule generation, avoiding
 * repeated O(n) calculations in nested loops.
 *
 * @returns Map of date string -> BaseCapacityData
 */
export function calculateBaseLeaveCapacity(
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  tasks: Task[],
  startDate: string,
  endDate: string,
): Map<string, BaseCapacityData> {
  const capacityByDate = new Map<string, BaseCapacityData>()

  // Pre-compute static data (doesn't change per date)
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  const totalActive = activeSoldiers.length
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
  const leaveRatio = config.leaveRatioDaysHome / cycleLength

  // Group soldiers by role (static)
  const soldiersByRole = new Map<string, Soldier[]>()
  const soldierIdsByRole: Record<string, string[]> = {}
  for (const soldier of activeSoldiers) {
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
      soldierIdsByRole[soldier.role] = []
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
    soldierIdsByRole[soldier.role].push(soldier.id)
  }

  // Pre-compute max on leave by role (static - based on ratio and min presence)
  const maxOnLeaveByRole: Record<string, number> = {}
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0

    // Leave ratio constraint
    const maxOnLeaveByRatio = Math.floor(totalOfRole * leaveRatio)

    // Min presence constraint (without task deduction - that's per-date)
    const maxOnLeaveByMinPresence = Math.max(0, totalOfRole - minRequired)

    // Take the more restrictive of ratio and min presence
    maxOnLeaveByRole[role] = Math.min(maxOnLeaveByRatio, maxOnLeaveByMinPresence)
  }

  // Overall max on leave (global constraint)
  const maxOnLeaveOverall = Math.floor(totalActive * (100 - config.minBasePresence) / 100)

  // Build task date index: date -> taskId -> true
  const tasksByDate = new Map<string, Set<string>>()
  for (const task of tasks) {
    const taskDate = task.startTime.split('T')[0]
    if (!tasksByDate.has(taskDate)) {
      tasksByDate.set(taskDate, new Set())
    }
    tasksByDate.get(taskDate)!.add(task.id)
  }

  // Build assignment index: taskId -> soldier IDs
  const assignmentsByTask = new Map<string, string[]>()
  for (const assignment of taskAssignments) {
    if (!assignmentsByTask.has(assignment.taskId)) {
      assignmentsByTask.set(assignment.taskId, [])
    }
    assignmentsByTask.get(assignment.taskId)!.push(assignment.soldierId)
  }

  // Build soldier -> role index
  const soldierRoleMap = new Map<string, string>()
  for (const soldier of activeSoldiers) {
    soldierRoleMap.set(soldier.id, soldier.role)
  }

  // Generate capacity data for each date
  const dates = getDateRange(parseDate(startDate), parseDate(endDate))
  for (const date of dates) {
    const dateStr = formatDate(date)

    // Find soldiers on tasks this date, grouped by role
    const onTaskByRole: Record<string, Set<string>> = {}
    for (const role of soldiersByRole.keys()) {
      onTaskByRole[role] = new Set()
    }

    const taskIdsToday = tasksByDate.get(dateStr)
    if (taskIdsToday) {
      for (const taskId of taskIdsToday) {
        const soldierIds = assignmentsByTask.get(taskId) ?? []
        for (const soldierId of soldierIds) {
          const role = soldierRoleMap.get(soldierId)
          if (role && onTaskByRole[role]) {
            onTaskByRole[role].add(soldierId)
          }
        }
      }
    }

    capacityByDate.set(dateStr, {
      maxOnLeaveByRole,
      onTaskByRole,
      maxOnLeaveOverall,
      totalActive,
      soldierIdsByRole,
    })
  }

  return capacityByDate
}

/**
 * Calculates remaining leave capacity for a specific date given current leave assignments.
 * Uses pre-computed base capacity and dynamic leave tracking for efficiency.
 */
export function getRemainingCapacity(
  baseCapacity: BaseCapacityData,
  onLeaveByRole: Record<string, number>,
  totalOnLeave: number,
  config: { minBasePresenceByRole: Record<string, number>; leaveRatioDaysInBase: number; leaveRatioDaysHome: number },
): Record<string, number> {
  const capacity: Record<string, number> = {}

  const overallRemainingCapacity = Math.max(0, baseCapacity.maxOnLeaveOverall - totalOnLeave)
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
  const leaveRatio = config.leaveRatioDaysHome / cycleLength

  for (const role of Object.keys(baseCapacity.maxOnLeaveByRole)) {
    const onTaskCount = baseCapacity.onTaskByRole[role]?.size ?? 0
    const alreadyOnLeave = onLeaveByRole[role] ?? 0
    const roleCount = baseCapacity.soldierIdsByRole[role]?.length ?? 0
    const minRequired = config.minBasePresenceByRole[role] ?? 0

    // Three constraints on max soldiers on leave (matching original logic):
    // 1. Leave ratio constraint
    const maxOnLeaveByRatio = Math.floor(roleCount * leaveRatio)

    // 2. Min presence per role: must keep minRequired in base, minus those on tasks
    const availableAfterTasksAndMinPresence = roleCount - minRequired - onTaskCount
    const maxOnLeaveByMinPresence = Math.max(0, availableAfterTasksAndMinPresence)

    // 3. Overall presence: respect the global minBasePresence percentage
    const roleShare = roleCount / baseCapacity.totalActive
    const maxByOverall = Math.floor(overallRemainingCapacity * roleShare) + alreadyOnLeave

    // Take most restrictive
    const maxOnLeave = Math.min(maxOnLeaveByRatio, maxOnLeaveByMinPresence, maxByOverall)

    capacity[role] = Math.max(0, maxOnLeave - alreadyOnLeave)
  }

  return capacity
}

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
 *
 * NOTE: For bulk operations, prefer calculateBaseLeaveCapacity() + getRemainingCapacity()
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
