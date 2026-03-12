import type { Soldier, TaskAssignment, AppConfig } from '../models'

/**
 * Calculates how many soldiers of each role can take leave
 * while ensuring minBasePresenceByRole is maintained.
 *
 * Formula per role:
 * capacity = total_soldiers_of_role - minBasePresence
 *
 * Returns 0 if capacity would be negative (can't allow leaves).
 */
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  _taskAssignments: TaskAssignment[],
  config: AppConfig,
  _date: string,
): Record<string, number> {
  const capacity: Record<string, number> = {}

  // Group soldiers by role
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Calculate capacity for each role
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const availableForLeave = Math.max(0, totalOfRole - minRequired)
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
): boolean {
  const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date)
  return (capacity[soldier.role] ?? 0) > 0
}
