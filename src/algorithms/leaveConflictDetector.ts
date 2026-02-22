import { getDateRange, parseDate, formatDate, calculateNights } from '../utils/dateUtils'
import { meetsMinimumPresence } from './presenceValidator'
import type { Soldier, LeaveSchedule, AppConfig, ScheduleConflict } from '../models'

/**
 * Detects conflicts in a leave schedule:
 * - INSUFFICIENT_BASE_PRESENCE: presence drops below config minimum on any day
 * - OVER_QUOTA: a soldier has more leave days than their earned quota
 */
export function detectLeaveConflicts(
  schedule: LeaveSchedule,
  soldiers: Soldier[],
  config: AppConfig,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  // --- INSUFFICIENT_BASE_PRESENCE ---
  const dates = getDateRange(parseDate(schedule.startDate), parseDate(schedule.endDate))
  const violationDates: string[] = []

  for (const date of dates) {
    if (!meetsMinimumPresence(soldiers, schedule.assignments, formatDate(date), config)) {
      violationDates.push(formatDate(date))
    }
  }

  if (violationDates.length > 0) {
    const affectedIds = new Set<string>()
    for (const dateStr of violationDates) {
      for (const a of schedule.assignments) {
        if (parseDate(a.startDate) <= parseDate(dateStr) && parseDate(dateStr) <= parseDate(a.endDate)) {
          affectedIds.add(a.soldierId)
        }
      }
    }
    conflicts.push({
      type: 'INSUFFICIENT_BASE_PRESENCE',
      message: `Base presence below minimum (${config.minBasePresence}%) on: ${violationDates.join(', ')}`,
      affectedSoldierIds: [...affectedIds],
      suggestions: ['Reduce simultaneous leaves', 'Adjust minimum presence threshold'],
    })
  }

  // --- OVER_QUOTA ---
  const scheduleLength = calculateNights(parseDate(schedule.startDate), parseDate(schedule.endDate)) + 1
  const quotaDays = (scheduleLength / config.leaveRatioDaysInBase) * config.leaveRatioDaysHome

  for (const soldier of soldiers) {
    const leaves = schedule.assignments.filter(a => a.soldierId === soldier.id)
    const totalDays = leaves.reduce((sum, a) =>
      sum + calculateNights(parseDate(a.startDate), parseDate(a.endDate)) + 1, 0
    )
    if (totalDays > quotaDays) {
      conflicts.push({
        type: 'OVER_QUOTA',
        message: `${soldier.name} has ${totalDays} leave days, exceeding quota of ${quotaDays.toFixed(1)}`,
        affectedSoldierIds: [soldier.id],
        affectedRequestIds: leaves.map(a => a.id),
        suggestions: ['Remove some leave assignments for this soldier'],
      })
    }
  }

  return conflicts
}
