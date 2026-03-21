import { parseDate } from '../utils/dateUtils'
import type { Soldier, TaskAssignment, LeaveAssignment, AppConfig, Task } from '../models'

/**
 * Calculates how many additional soldiers of each role can take leave on `date`
 * while ensuring minBasePresenceByRole is maintained.
 *
 * Formula per role:
 * capacity = (total_active_of_role - minBasePresence) - already_on_leave - assigned_to_tasks_today
 *
 * Returns 0 if capacity would be negative (can't allow more leaves).
 *
 * IMPORTANT: Tasks have priority over leaves. Soldiers assigned to tasks on a given day
 * cannot take leave that day, so they are subtracted from available capacity.
 */
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  date: string,
  existingLeaves: LeaveAssignment[] = [],
  tasks: Task[] = [],  // NEW: tasks array to look up task dates
): Record<string, number> {
  const capacity: Record<string, number> = {}
  const checkDate = parseDate(date)
  const dateStr = date.split('T')[0]

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
  // Subtract both soldiers on leave AND soldiers on tasks (tasks have priority)
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const alreadyOnLeave = roleSoldiers.filter(s => onLeaveToday.has(s.id)).length
    const assignedToTasks = roleSoldiers.filter(s => onTaskToday.has(s.id)).length
    const availableForLeave = Math.max(0, totalOfRole - minRequired - alreadyOnLeave - assignedToTasks)
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
