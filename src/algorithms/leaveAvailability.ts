import { parseDate } from '../utils/dateUtils'
import type { Soldier, LeaveAssignment, ScheduleConflict } from '../models'

function datesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return parseDate(aStart) <= parseDate(bEnd) && parseDate(aEnd) >= parseDate(bStart)
}

export function isLeaveAvailable(
  soldier: Soldier,
  startDate: string,
  endDate: string,
  existingAssignments: LeaveAssignment[]
): boolean {
  return getLeaveConflicts(soldier, startDate, endDate, existingAssignments).length === 0
}

export function getLeaveConflicts(
  soldier: Soldier,
  startDate: string,
  endDate: string,
  existingAssignments: LeaveAssignment[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  if (soldier.status === 'Discharged' || soldier.status === 'Injured') {
    conflicts.push({
      type: 'NO_ROLE_AVAILABLE',
      message: `Soldier ${soldier.name} is ${soldier.status} and cannot take leave`,
      affectedSoldierIds: [soldier.id],
      suggestions: [],
    })
    return conflicts
  }

  // Check service period bounds
  if (
    !datesOverlap(startDate, endDate, soldier.serviceStart, soldier.serviceEnd)
  ) {
    conflicts.push({
      type: 'NO_ROLE_AVAILABLE',
      message: `Requested dates fall outside ${soldier.name}'s service period`,
      affectedSoldierIds: [soldier.id],
      suggestions: ['Choose dates within the soldier\'s service period'],
    })
  }

  // Check overlapping assignments for the same soldier
  const myAssignments = existingAssignments.filter(a => a.soldierId === soldier.id)
  for (const assignment of myAssignments) {
    if (datesOverlap(startDate, endDate, assignment.startDate, assignment.endDate)) {
      conflicts.push({
        type: 'OVERLAPPING_ASSIGNMENT',
        message: `Leave overlaps with existing assignment from ${assignment.startDate} to ${assignment.endDate}`,
        affectedSoldierIds: [soldier.id],
        affectedRequestIds: [assignment.id],
        suggestions: ['Choose non-overlapping dates'],
      })
    }
  }

  return conflicts
}
