import { parseDate } from '../utils/dateUtils'
import type { Soldier, TaskAssignment, LeaveAssignment, AppConfig } from '../models'

/**
 * Calculates how many additional soldiers of each role can take leave on `date`
 * while ensuring minBasePresenceByRole is maintained.
 *
 * Formula per role:
 * capacity = (total_active_of_role - minBasePresence) - already_on_leave_of_role_on_date
 *
 * Returns 0 if capacity would be negative (can't allow more leaves).
 */
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  _taskAssignments: TaskAssignment[],
  config: AppConfig,
  date: string,
  existingLeaves: LeaveAssignment[] = [],
): Record<string, number> {
  const capacity: Record<string, number> = {}
  const checkDate = parseDate(date)

  // Build a set of soldier IDs already on leave on `date`
  const onLeaveToday = new Set<string>()
  for (const leave of existingLeaves) {
    const start = parseDate(leave.startDate.split('T')[0])
    const end = parseDate(leave.endDate.split('T')[0])
    if (start <= checkDate && checkDate <= end) {
      onLeaveToday.add(leave.soldierId)
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
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const alreadyOnLeave = roleSoldiers.filter(s => onLeaveToday.has(s.id)).length
    const availableForLeave = Math.max(0, totalOfRole - minRequired - alreadyOnLeave)
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
): boolean {
  const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date, existingLeaves)
  return (capacity[soldier.role] ?? 0) > 0
}
