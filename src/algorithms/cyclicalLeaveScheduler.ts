import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig, Task } from '../models'

/**
 * Generates cyclical home leaves distributed fairly across soldiers of each role.
 * Respects minBasePresenceByRole: soldiers can only take leave if there's capacity.
 *
 * Pattern per role: soldiers take turns in N-day cycles (e.g., 10:4 ratio)
 * Each soldier has a randomized phase offset to stagger leave times.
 *
 * IMPORTANT: Tasks have priority over leaves. Soldiers assigned to tasks on a given day
 * cannot take leave that day, and the capacity calculation accounts for this.
 */
export function generateCyclicalLeaves(
  soldiers: Soldier[],
  existingLeaves: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
  tasks: Task[] = [],  // NEW: tasks array to check task assignments by date
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

  // Group soldiers by role and initialize phase offsets (randomized)
  const soldiersByRole = new Map<string, Soldier[]>()
  const soldiersPhaseOffset = new Map<string, number>()

  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    const roleSoldiers = soldiersByRole.get(soldier.role)!
    roleSoldiers.push(soldier)

    // Randomize initial phase offset to stagger leaves
    const phaseOffset = Math.floor(Math.random() * cycleLength)
    soldiersPhaseOffset.set(soldier.id, phaseOffset)
  }

  // Generate leaves per role
  for (const [role, roleSoldiers] of soldiersByRole) {
    // Sort soldiers by ID for deterministic processing
    roleSoldiers.sort((a, b) => a.id.localeCompare(b.id))

    // Track which soldiers already have leave on each date (to not double-assign)
    const assignedToday = new Map<string, Set<string>>()

    // Iterate through schedule period
    let currentDate = new Date(startDate)
    let dayNumber = 0

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate)

      // Check capacity for this role on this date
      // Pass tasks array so capacity calculation accounts for soldiers on tasks
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr, result, tasks)
      let availableSlots = capacity[role] ?? 0

      if (availableSlots > 0) {
        // Assign leave to soldiers based on their individual phase offset
        for (const soldier of roleSoldiers) {
          if (availableSlots <= 0) break

          // Skip if manually locked
          const isManualLocked =
            manualLockDates.has(soldier.id) && manualLockDates.get(soldier.id)!.has(dateStr)
          if (isManualLocked) continue

          // Skip if already assigned on this date
          if (!assignedToday.has(dateStr)) {
            assignedToday.set(dateStr, new Set())
          }
          if (assignedToday.get(dateStr)!.has(soldier.id)) continue

          // Calculate soldier's position in cycle based on their phase offset
          const phaseOffset = soldiersPhaseOffset.get(soldier.id) ?? 0
          const soldierPosition = (dayNumber + phaseOffset) % cycleLength
          const isInLeavePhase = soldierPosition >= config.leaveRatioDaysInBase

          if (isInLeavePhase) {
            const dayInLeave = soldierPosition - config.leaveRatioDaysInBase
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
              availableSlots--
              assignedToday.get(dateStr)!.add(soldier.id)
            }
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
      dayNumber++
    }
  }

  return result
}
