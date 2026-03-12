import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import type { Soldier, LeaveAssignment, AppConfig } from '../models'

/**
 * Generates automatic cyclical leaves based on the 10:4 ratio pattern.
 * Pattern: N days in base, M days at home (configurable via leaveRatioDaysInBase/Home)
 *
 * Exit/return times are partial-day unavailability:
 * - leaveBaseExitHour: soldier unavailable from this time on departure day
 * - leaveBaseReturnHour: soldier unavailable until this time on return day
 *
 * Manual leaves (from leave requests) take priority and lock that soldier out of the cycle for those dates.
 */
export function generateCyclicalLeaves(
  soldiers: Soldier[],
  existingLeaves: LeaveAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
): LeaveAssignment[] {
  const result = [...existingLeaves]
  const startDate = parseDate(scheduleStart)
  const endDate = parseDate(scheduleEnd)
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome

  // Find manually-added leaves (those with requestId) to lock soldiers out of cycle
  const manualLockDates = new Map<string, Set<string>>()
  for (const leave of existingLeaves) {
    if (leave.requestId) {
      if (!manualLockDates.has(leave.soldierId)) {
        manualLockDates.set(leave.soldierId, new Set())
      }
      const dates = getDateRange(parseDate(leave.startDate), parseDate(leave.endDate))
      for (const d of dates) {
        manualLockDates.get(leave.soldierId)!.add(formatDate(d))
      }
    }
  }

  // Generate cyclical leaves for each soldier
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue

    // Determine soldier's service period
    const soldierStart = parseDate(soldier.serviceStart)
    const soldierEnd = parseDate(soldier.serviceEnd)

    // Calculate overlap with schedule period
    const cycleStartDate = soldierStart > startDate ? soldierStart : startDate
    const cycleEndDate = soldierEnd < endDate ? soldierEnd : endDate

    if (cycleStartDate > cycleEndDate) continue // No overlap with schedule

    // Get locked dates for this soldier
    const lockedDates = manualLockDates.get(soldier.id) ?? new Set()

    // Generate cycle starting from the soldier's service start
    let currentDate = new Date(cycleStartDate)
    let positionInCycle = 0 // 0 to cycleLength-1

    while (currentDate <= cycleEndDate) {
      const dateStr = formatDate(currentDate)

      // Check if this date is locked (manual leave)
      if (!lockedDates.has(dateStr)) {
        // Check if soldier is in "home leave" phase of the cycle
        if (positionInCycle >= config.leaveRatioDaysInBase) {
          // Home leave phase
          const homeLeaveStartPos = config.leaveRatioDaysInBase
          const posInHomeLeave = positionInCycle - homeLeaveStartPos

          const isExitDay = posInHomeLeave === 0
          const isReturnDay = posInHomeLeave === config.leaveRatioDaysHome - 1

          if (isExitDay) {
            // Partial day - unavailable from exit time onwards
            const leaveId = `cycle-exit-${soldier.id}-${dateStr}`
            const existingExit = result.some(l => l.id === leaveId)
            if (!existingExit) {
              result.push({
                id: leaveId,
                soldierId: soldier.id,
                startDate: `${dateStr}T${config.leaveBaseExitHour}:00`,
                endDate: `${dateStr}T23:59:59`,
                leaveType: 'After',
                isWeekend: false,
                isLocked: true,
                createdAt: new Date().toISOString(),
              })
            }
          } else if (isReturnDay) {
            // Partial day - unavailable until return time
            const leaveId = `cycle-return-${soldier.id}-${dateStr}`
            const existingReturn = result.some(l => l.id === leaveId)
            if (!existingReturn) {
              result.push({
                id: leaveId,
                soldierId: soldier.id,
                startDate: `${dateStr}T00:00:00`,
                endDate: `${dateStr}T${config.leaveBaseReturnHour}:00`,
                leaveType: 'After',
                isWeekend: false,
                isLocked: true,
                createdAt: new Date().toISOString(),
              })
            }
          } else {
            // Full day home leave
            const leaveId = `cycle-home-${soldier.id}-${dateStr}`
            const existingHome = result.some(l => l.id === leaveId)
            if (!existingHome) {
              result.push({
                id: leaveId,
                soldierId: soldier.id,
                startDate: dateStr,
                endDate: dateStr,
                leaveType: 'After',
                isWeekend: false,
                isLocked: true,
                createdAt: new Date().toISOString(),
              })
            }
          }
        }
        // If in base phase (positionInCycle < leaveRatioDaysInBase), no leave
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      positionInCycle = (positionInCycle + 1) % cycleLength
    }
  }

  return result
}
