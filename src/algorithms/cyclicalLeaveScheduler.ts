import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig, Task } from '../models'

/**
 * Generates a deterministic phase offset for a soldier based on their ID.
 * This ensures the same soldier always gets the same phase offset across runs,
 * while still distributing offsets fairly across the cycle.
 */
function getPhaseOffsetForSoldier(soldierId: string, cycleLength: number): number {
  // Simple hash of soldier ID to get a deterministic number
  let hash = 0
  for (let i = 0; i < soldierId.length; i++) {
    const char = soldierId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Ensure positive and within cycle
  return Math.abs(hash) % cycleLength
}

/**
 * Generates cyclical home leaves distributed fairly across soldiers of each role.
 *
 * KEY PRINCIPLES:
 * 1. Fair leave ratio: All soldiers should get approximately the same leave ratio
 *    (e.g., 4 days home per 14-day cycle = ~28.5%)
 * 2. Task priority: Soldiers on tasks cannot take leave that day, but they should
 *    get compensating leave on other days
 * 3. Max consecutive leave: Leave cannot exceed leaveRatioDaysHome consecutive days
 * 4. Capacity limits: respects minBasePresenceByRole
 *
 * ALGORITHM:
 * - Track each soldier's "leave debt" (expected leave days - actual leave days)
 * - On each day, prioritize soldiers with highest debt who aren't on tasks
 * - This ensures soldiers who miss leave due to tasks get compensating leave later
 */
export function generateCyclicalLeaves(
  soldiers: Soldier[],
  existingLeaves: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
  tasks: Task[] = [],
): LeaveAssignment[] {
  const result = [...existingLeaves]
  const startDate = parseDate(scheduleStart)
  const endDate = parseDate(scheduleEnd)
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
  const leaveRatio = config.leaveRatioDaysHome / cycleLength  // Target ratio (e.g., 4/14 ≈ 0.286)
  const maxConsecutiveLeaveDays = config.leaveRatioDaysHome  // Max consecutive leave days

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

  // Group soldiers by role
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Build task ID -> date map
  const taskDateMap = new Map<string, string>()
  for (const task of tasks) {
    taskDateMap.set(task.id, task.startTime.split('T')[0])
  }

  // Build soldier ID -> dates on task map
  const soldierTaskDates = new Map<string, Set<string>>()
  for (const assignment of taskAssignments) {
    const taskDate = taskDateMap.get(assignment.taskId)
    if (taskDate) {
      if (!soldierTaskDates.has(assignment.soldierId)) {
        soldierTaskDates.set(assignment.soldierId, new Set())
      }
      soldierTaskDates.get(assignment.soldierId)!.add(taskDate)
    }
  }

  // === LEAVE TRACKING PER SOLDIER ===
  // Track: leave days assigned, consecutive leave days, expected leave by ratio
  interface SoldierLeaveTracking {
    leaveDaysAssigned: number
    consecutiveLeaveDays: number
    lastLeaveDate: string | null
    phaseOffset: number  // For staggering start of leave periods
  }

  const leaveTracking = new Map<string, SoldierLeaveTracking>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    leaveTracking.set(soldier.id, {
      leaveDaysAssigned: 0,
      consecutiveLeaveDays: 0,
      lastLeaveDate: null,
      phaseOffset: getPhaseOffsetForSoldier(soldier.id, cycleLength),
    })
  }

  // Count existing leaves for each soldier
  for (const leave of existingLeaves) {
    const tracking = leaveTracking.get(leave.soldierId)
    if (tracking) {
      tracking.leaveDaysAssigned++
    }
  }

  // Track which soldiers have leave on each date
  const assignedToday = new Map<string, Set<string>>()

  // Process each day
  let currentDate = new Date(startDate)
  let dayNumber = 0

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate)
    assignedToday.set(dateStr, new Set())

    // Process each role separately
    for (const [role, roleSoldiers] of soldiersByRole) {
      // Get capacity for this role today
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr, result, tasks)
      let availableSlots = capacity[role] ?? 0

      if (availableSlots <= 0) {
        // No capacity for this role today, skip to next role (not next day)
        continue
      }

      // Calculate leave priority for each soldier
      // Priority = leave debt (expected - actual) + phase bonus for staggering
      const getPriority = (soldier: Soldier): number => {
        const tracking = leaveTracking.get(soldier.id)
        if (!tracking) return -Infinity

        // Expected leave days by this point based on ratio
        const expectedLeaveDays = (dayNumber + 1) * leaveRatio

        // Leave debt: how many days behind are they?
        const leaveDebt = expectedLeaveDays - tracking.leaveDaysAssigned

        // Phase bonus: stagger soldiers so they don't all want leave on the same days
        // Soldiers whose phase says "should be on leave now" get a small bonus
        const soldierPosition = (dayNumber + tracking.phaseOffset) % cycleLength
        const isInPhaseLeave = soldierPosition >= config.leaveRatioDaysInBase
        const phaseBonus = isInPhaseLeave ? 0.5 : 0

        // Penalty if at max consecutive leave days
        const consecutivePenalty = tracking.consecutiveLeaveDays >= maxConsecutiveLeaveDays ? -1000 : 0

        return leaveDebt + phaseBonus + consecutivePenalty
      }

      // Filter soldiers eligible for leave today
      const eligibleSoldiers = roleSoldiers.filter(soldier => {
        const tracking = leaveTracking.get(soldier.id)
        if (!tracking) return false

        // Skip if on task today
        const soldierTasks = soldierTaskDates.get(soldier.id)
        if (soldierTasks && soldierTasks.has(dateStr)) return false

        // Skip if manually locked
        if (manualLockDates.has(soldier.id) && manualLockDates.get(soldier.id)!.has(dateStr)) return false

        // Skip if already assigned today
        if (assignedToday.get(dateStr)!.has(soldier.id)) return false

        // Skip if at max consecutive leave days
        if (tracking.consecutiveLeaveDays >= maxConsecutiveLeaveDays) return false

        return true
      })

      // Sort by priority (highest first)
      eligibleSoldiers.sort((a, b) => getPriority(b) - getPriority(a))

      // Assign leave to top priority soldiers up to capacity
      for (const soldier of eligibleSoldiers) {
        if (availableSlots <= 0) break

        const tracking = leaveTracking.get(soldier.id)!

        // Determine if this is exit day, return day, or full day
        const isStartOfLeavePeriod = tracking.consecutiveLeaveDays === 0
        const willBeLastDay = tracking.consecutiveLeaveDays === maxConsecutiveLeaveDays - 1

        const leaveId = `cycle-${role}-${soldier.id}-${dateStr}`
        const alreadyExists = result.some(l =>
          l.id === leaveId || l.id === `${leaveId}-exit` || l.id === `${leaveId}-return`
        )

        if (!alreadyExists) {
          if (isStartOfLeavePeriod) {
            // Exit day - leaving base
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
          } else if (willBeLastDay) {
            // Return day - coming back to base
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
            // Full day at home
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

          // Update tracking
          tracking.leaveDaysAssigned++
          tracking.consecutiveLeaveDays++
          tracking.lastLeaveDate = dateStr

          availableSlots--
          assignedToday.get(dateStr)!.add(soldier.id)
        }
      }

      // Reset consecutive days for soldiers who didn't get leave today
      for (const soldier of roleSoldiers) {
        if (!assignedToday.get(dateStr)!.has(soldier.id)) {
          const tracking = leaveTracking.get(soldier.id)
          if (tracking) {
            tracking.consecutiveLeaveDays = 0
          }
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
    dayNumber++
  }

  return result
}
