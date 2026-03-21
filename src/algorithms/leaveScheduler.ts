import { combinedFairnessScore } from './fairness'
import { isLeaveAvailable } from './leaveAvailability'
import { meetsMinimumPresence } from './presenceValidator'
import { isWeekend, parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import type { Soldier, LeaveRequest, LeaveAssignment, AppConfig, LeaveSchedule } from '../models'

function meetsMinimumPresenceByRole(
  soldiers: Soldier[],
  assignments: LeaveAssignment[],
  date: string,
  config: AppConfig,
): boolean {
  const checkDate = parseDate(date)
  const onLeaveIds = new Set(
    assignments
      .filter(a => {
        const s = parseDate(a.startDate.split('T')[0])
        const e = parseDate(a.endDate.split('T')[0])
        return s <= checkDate && checkDate <= e
      })
      .map(a => a.soldierId)
  )
  const roleMinima = config.minBasePresenceByRole ?? {}
  for (const [role, minRequired] of Object.entries(roleMinima)) {
    const roleActive = soldiers.filter(s => s.status === 'Active' && s.role === role)
    if (roleActive.length === 0) continue // no soldiers of this role, skip
    const onLeave = roleActive.filter(s => onLeaveIds.has(s.id)).length
    if (roleActive.length - onLeave < minRequired) return false
  }
  return true
}

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

    const dates = getDateRange(parseDate(request.startDate), parseDate(request.endDate))
    const dateSet = new Set(dates.map(d => formatDate(d)))

    // Identify conflicting cyclical (non-manual) leaves for this soldier — manual overrides these
    const conflictingCyclicalIndices: number[] = []
    for (let i = 0; i < result.length; i++) {
      const existing = result[i]
      if (existing.soldierId !== request.soldierId) continue
      if (!existing.isLocked || existing.requestId) continue // only displace cyclical (locked, no requestId)
      const existingDates = getDateRange(
        parseDate(existing.startDate.split('T')[0]),
        parseDate(existing.endDate.split('T')[0]),
      )
      if (existingDates.some(d => dateSet.has(formatDate(d)))) {
        conflictingCyclicalIndices.push(i)
      }
    }

    // Check availability against result minus the cyclical leaves that would be displaced
    const resultWithoutConflicts = result.filter((_, i) => !conflictingCyclicalIndices.includes(i))
    if (!isLeaveAvailable(soldier, request.startDate, request.endDate, resultWithoutConflicts)) continue

    // Check base presence for every day of the proposed leave
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
    const proposedAssignments = [...resultWithoutConflicts, tentative]
    const wouldViolatePresence = dates.some(date => {
      const dateStr = formatDate(date)
      return !meetsMinimumPresence(soldiers, proposedAssignments, dateStr, config)
        || !meetsMinimumPresenceByRole(soldiers, proposedAssignments, dateStr, config)
    })
    if (wouldViolatePresence) continue

    // Remove the displaced cyclical leaves (reverse order to keep indices valid)
    for (let i = conflictingCyclicalIndices.length - 1; i >= 0; i--) {
      result.splice(conflictingCyclicalIndices[i], 1)
    }

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
