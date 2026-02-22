import { combinedFairnessScore } from './fairness'
import { isLeaveAvailable } from './leaveAvailability'
import { meetsMinimumPresence } from './presenceValidator'
import { isWeekend, parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import type { Soldier, LeaveRequest, LeaveAssignment, AppConfig, LeaveSchedule } from '../models'

/**
 * Greedy leave scheduler: sorts pending requests by priority (descending) then
 * fairness score (ascending), assigns each request if it satisfies all constraints.
 */
export function scheduleLeave(
  requests: LeaveRequest[],
  soldiers: Soldier[],
  existingAssignments: LeaveAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string
): LeaveSchedule {
  const result: LeaveAssignment[] = [...existingAssignments]
  const soldierMap = new Map(soldiers.map(s => [s.id, s]))

  // Only process pending requests
  const pending = requests.filter(r => r.status === 'Pending')

  // Sort: priority descending, then fairness ascending (lower = more deserving)
  const sorted = [...pending].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    const soldierA = soldierMap.get(a.soldierId)
    const soldierB = soldierMap.get(b.soldierId)
    const fa = soldierA ? combinedFairnessScore(soldierA) : 0
    const fb = soldierB ? combinedFairnessScore(soldierB) : 0
    return fa - fb
  })

  for (const request of sorted) {
    const soldier = soldierMap.get(request.soldierId)
    if (!soldier) continue

    // Check availability: no overlap, valid service period, active status
    if (!isLeaveAvailable(soldier, request.startDate, request.endDate, result)) continue

    // Check base presence for every day of the proposed leave
    const dates = getDateRange(parseDate(request.startDate), parseDate(request.endDate))
    const tentative: LeaveAssignment = {
      id: `tentative-${request.id}`,
      soldierId: request.soldierId,
      startDate: request.startDate,
      endDate: request.endDate,
      leaveType: request.leaveType,
      isWeekend: false,
      isLocked: false,
      createdAt: new Date().toISOString(),
    }
    const wouldViolatePresence = dates.some(date =>
      !meetsMinimumPresence(soldiers, [...result, tentative], formatDate(date), config)
    )
    if (wouldViolatePresence) continue

    // Approve: create the leave assignment
    result.push({
      id: `assign-${request.id}`,
      soldierId: request.soldierId,
      startDate: request.startDate,
      endDate: request.endDate,
      leaveType: request.leaveType,
      isWeekend: dates.some(d => isWeekend(d)),
      isLocked: false,
      requestId: request.id,
      createdAt: new Date().toISOString(),
    })
  }

  return {
    startDate: scheduleStart,
    endDate: scheduleEnd,
    assignments: result,
    conflicts: [],
  }
}
