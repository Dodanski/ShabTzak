import { parseDate } from '../utils/dateUtils'
import type { Soldier, LeaveAssignment, AppConfig } from '../models'

function isOnLeaveOnDate(assignment: LeaveAssignment, dateStr: string): boolean {
  const date = parseDate(dateStr)
  const start = parseDate(assignment.startDate)
  const end = parseDate(assignment.endDate)
  return date >= start && date <= end
}

/**
 * Returns soldiers who have a leave assignment covering the given date.
 */
export function getSoldiersOnLeave(
  soldiers: Soldier[],
  assignments: LeaveAssignment[],
  date: string
): Soldier[] {
  const onLeaveIds = new Set(
    assignments
      .filter(a => isOnLeaveOnDate(a, date))
      .map(a => a.soldierId)
  )
  return soldiers.filter(s => onLeaveIds.has(s.id))
}

/**
 * Returns the count of active soldiers present at base on the given date.
 */
export function getPresenceCount(
  soldiers: Soldier[],
  assignments: LeaveAssignment[],
  date: string
): number {
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  const onLeave = getSoldiersOnLeave(activeSoldiers, assignments, date)
  return activeSoldiers.length - onLeave.length
}

/**
 * Returns true if the presence percentage meets the configured minimum.
 */
export function meetsMinimumPresence(
  soldiers: Soldier[],
  assignments: LeaveAssignment[],
  date: string,
  config: AppConfig
): boolean {
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  if (activeSoldiers.length === 0) return true

  const present = getPresenceCount(soldiers, assignments, date)
  const percentage = (present / activeSoldiers.length) * 100
  return percentage >= config.minBasePresence
}
