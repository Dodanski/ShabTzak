import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig } from '../models'

/**
 * Generates cyclical home leaves distributed fairly across soldiers of each role.
 * Respects minBasePresenceByRole: soldiers can only take leave if there's capacity.
 *
 * Pattern per role: soldiers take turns in N-day cycles (e.g., 10:4 ratio)
 */
export function generateCyclicalLeaves(
  soldiers: Soldier[],
  existingLeaves: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
): LeaveAssignment[] {
  const result = [...existingLeaves]
  const startDate = parseDate(scheduleStart)
  const endDate = parseDate(scheduleEnd)
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome

  // Find manually-added leaves (with requestId) to lock out
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

  // Group soldiers by role for cycling
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Generate leaves per role
  for (const [role, roleSoldiers] of soldiersByRole) {
    // Sort soldiers by ID for deterministic cycling
    roleSoldiers.sort((a, b) => a.id.localeCompare(b.id))

    // Track position in cycle for each soldier
    const soldierCyclePos = new Map<string, number>()
    for (const soldier of roleSoldiers) {
      soldierCyclePos.set(soldier.id, 0)
    }

    // Iterate through schedule period
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate)

      // Check capacity for this role on this date
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr)
      const availableSlots = capacity[role] ?? 0

      if (availableSlots > 0) {
        // Assign leave to soldiers in cycle order
        let slotsUsed = 0
        for (const soldier of roleSoldiers) {
          if (slotsUsed >= availableSlots) break

          const isManualLocked =
            manualLockDates.has(soldier.id) && manualLockDates.get(soldier.id)!.has(dateStr)
          if (isManualLocked) continue

          const cyclePos = soldierCyclePos.get(soldier.id) ?? 0
          const isInLeavePhase = cyclePos >= config.leaveRatioDaysInBase

          if (isInLeavePhase) {
            const dayInLeave = cyclePos - config.leaveRatioDaysInBase
            const isExitDay = dayInLeave === 0
            const isReturnDay = dayInLeave === config.leaveRatioDaysHome - 1

            const leaveId = `cycle-${role}-${soldier.id}-${dateStr}`
            const alreadyExists = result.some(l => l.id === leaveId || l.id === `${leaveId}-exit` || l.id === `${leaveId}-return`)

            if (!alreadyExists) {
              if (isExitDay) {
                result.push({
                  id: `${leaveId}-exit`,
                  soldierId: soldier.id,
                  startDate: `${dateStr}T${config.leaveBaseExitHour}:00`,
                  endDate: `${dateStr}T23:59:59`,
                  leaveType: 'After',
                  isWeekend: false,
                  isLocked: true,
                  createdAt: new Date().toISOString(),
                })
              } else if (isReturnDay) {
                result.push({
                  id: `${leaveId}-return`,
                  soldierId: soldier.id,
                  startDate: `${dateStr}T00:00:00`,
                  endDate: `${dateStr}T${config.leaveBaseReturnHour}:00`,
                  leaveType: 'After',
                  isWeekend: false,
                  isLocked: true,
                  createdAt: new Date().toISOString(),
                })
              } else {
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
              slotsUsed++
            }
          }
        }
      }

      // Advance all soldiers' cycle position
      for (const soldier of roleSoldiers) {
        const currentPos = soldierCyclePos.get(soldier.id) ?? 0
        soldierCyclePos.set(soldier.id, (currentPos + 1) % cycleLength)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return result
}
