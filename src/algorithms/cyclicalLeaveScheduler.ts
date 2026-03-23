import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig, Task } from '../models'

/**
 * Generates a deterministic phase offset for a soldier based on their ID.
 * This ensures the same soldier always gets the same phase offset across runs,
 * while still distributing offsets fairly across the cycle.
 */
function getPhaseOffsetForSoldier(soldierId: string, cycleLength: number): number {
  let hash = 0
  for (let i = 0; i < soldierId.length; i++) {
    const char = soldierId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash) % cycleLength
}

/**
 * Generates cyclical home leaves distributed fairly across soldiers of each role.
 *
 * KEY PRINCIPLES:
 * 1. Leave is assigned as CONTINUOUS BLOCKS (not day-by-day)
 * 2. Each leave block has: Exit day (← Out) → Full days at home → Return day (In →)
 * 3. All soldiers should get leave proportional to the configured ratio
 * 4. Soldiers on tasks are skipped for that day but get compensating leave later
 * 5. Capacity limits (minBasePresenceByRole) are respected
 *
 * ALGORITHM:
 * 1. Calculate when each soldier should START their next leave (based on phase offset + cycle)
 * 2. When a soldier's leave start date arrives, assign a complete leave block
 * 3. If soldier is on task during their leave window, defer their leave to next available slot
 * 4. Track leave debt to ensure fairness over time
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
  const leaveDuration = config.leaveRatioDaysHome  // How many days each leave block lasts

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

  // Build soldier ID -> dates on task map
  const soldierTaskDates = new Map<string, Set<string>>()
  for (const task of tasks) {
    const taskDate = task.startTime.split('T')[0]
    for (const assignment of taskAssignments) {
      if (assignment.taskId === task.id) {
        if (!soldierTaskDates.has(assignment.soldierId)) {
          soldierTaskDates.set(assignment.soldierId, new Set())
        }
        soldierTaskDates.get(assignment.soldierId)!.add(taskDate)
      }
    }
  }

  // === LEAVE TRACKING PER SOLDIER ===
  interface SoldierLeaveTracking {
    nextLeaveStartDay: number  // Day number when next leave should start
    leavesCompleted: number    // Number of complete leave blocks taken
    phaseOffset: number        // Stagger start times
    currentlyOnLeave: boolean  // Is soldier in middle of a leave block?
    leaveBlockDaysRemaining: number  // Days left in current leave block
    leaveBlockStartDate: string | null  // Start date of current block
  }

  const leaveTracking = new Map<string, SoldierLeaveTracking>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    const phaseOffset = getPhaseOffsetForSoldier(soldier.id, cycleLength)
    leaveTracking.set(soldier.id, {
      // First leave starts at phase offset (staggered)
      nextLeaveStartDay: phaseOffset >= config.leaveRatioDaysInBase
        ? 0  // Start immediately if phase says should be on leave
        : config.leaveRatioDaysInBase - phaseOffset,  // Wait until "in base" phase ends
      leavesCompleted: 0,
      phaseOffset,
      currentlyOnLeave: false,
      leaveBlockDaysRemaining: 0,
      leaveBlockStartDate: null,
    })
  }

  // Track leave assignments by soldier and date for quick lookup
  const soldierLeaveDates = new Map<string, Set<string>>()

  // Helper: Check if a date range is free of tasks for a soldier
  const canTakeLeaveBlock = (soldierId: string, startDateStr: string, numDays: number): boolean => {
    const soldierTasks = soldierTaskDates.get(soldierId)
    if (!soldierTasks) return true

    let checkDate = new Date(startDateStr)
    for (let i = 0; i < numDays; i++) {
      const dateStr = formatDate(checkDate)
      if (soldierTasks.has(dateStr)) return false
      // Also check manual locks
      if (manualLockDates.has(soldierId) && manualLockDates.get(soldierId)!.has(dateStr)) return false
      checkDate.setDate(checkDate.getDate() + 1)
    }
    return true
  }

  // Helper: Assign a complete leave block
  const assignLeaveBlock = (soldier: Soldier, startDateStr: string, role: string): void => {
    let currentDate = new Date(startDateStr)

    for (let dayInBlock = 0; dayInBlock < leaveDuration; dayInBlock++) {
      const dateStr = formatDate(currentDate)

      // Skip if past end date
      if (currentDate > endDate) break

      const leaveId = `cycle-${role}-${soldier.id}-${dateStr}`
      const alreadyExists = result.some(l =>
        l.id === leaveId || l.id === `${leaveId}-exit` || l.id === `${leaveId}-return`
      )

      if (!alreadyExists) {
        if (dayInBlock === 0) {
          // First day: Exit day (← Out) - soldier leaves base
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
        } else if (dayInBlock === leaveDuration - 1) {
          // Last day: Return day (In →) - soldier returns to base
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
          // Middle days: Full day at home
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

        // Track this date
        if (!soldierLeaveDates.has(soldier.id)) {
          soldierLeaveDates.set(soldier.id, new Set())
        }
        soldierLeaveDates.get(soldier.id)!.add(dateStr)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Process each day and assign leave blocks
  let currentDate = new Date(startDate)
  let dayNumber = 0

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate)

    // Process each role
    for (const [role, roleSoldiers] of soldiersByRole) {
      // Check capacity for this role today
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr, result, tasks)
      const maxOnLeaveToday = capacity[role] ?? 0

      // Count how many of this role are already on leave today
      const onLeaveToday = roleSoldiers.filter(s =>
        soldierLeaveDates.has(s.id) && soldierLeaveDates.get(s.id)!.has(dateStr)
      ).length

      let availableSlots = Math.max(0, maxOnLeaveToday - onLeaveToday)

      // Find soldiers who should start leave today (sorted by priority)
      const soldiersReadyForLeave = roleSoldiers
        .filter(soldier => {
          const tracking = leaveTracking.get(soldier.id)
          if (!tracking) return false

          // Skip if already on leave
          if (soldierLeaveDates.has(soldier.id) && soldierLeaveDates.get(soldier.id)!.has(dateStr)) {
            return false
          }

          // Check if it's time for this soldier's leave
          return dayNumber >= tracking.nextLeaveStartDay
        })
        .sort((a, b) => {
          const trackingA = leaveTracking.get(a.id)!
          const trackingB = leaveTracking.get(b.id)!
          // Prioritize soldiers who are more overdue for leave
          const overdueA = dayNumber - trackingA.nextLeaveStartDay
          const overdueB = dayNumber - trackingB.nextLeaveStartDay
          return overdueB - overdueA  // Higher overdue = higher priority
        })

      // Assign leave blocks
      for (const soldier of soldiersReadyForLeave) {
        if (availableSlots <= 0) break

        // Check if soldier can take a full leave block starting today
        if (!canTakeLeaveBlock(soldier.id, dateStr, leaveDuration)) {
          // Can't take leave now (task conflict), will try again tomorrow
          continue
        }

        // Check capacity for all days of the leave block
        let canFitBlock = true
        let checkDate = new Date(dateStr)
        for (let i = 0; i < leaveDuration && canFitBlock; i++) {
          const checkDateStr = formatDate(checkDate)
          if (checkDate > endDate) {
            canFitBlock = false
            break
          }
          const dayCapacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, checkDateStr, result, tasks)
          const dayOnLeave = roleSoldiers.filter(s =>
            soldierLeaveDates.has(s.id) && soldierLeaveDates.get(s.id)!.has(checkDateStr)
          ).length
          if (dayOnLeave >= (dayCapacity[role] ?? 0)) {
            canFitBlock = false
          }
          checkDate.setDate(checkDate.getDate() + 1)
        }

        if (!canFitBlock) {
          // Not enough capacity for full block, defer to later
          continue
        }

        // Assign the leave block
        assignLeaveBlock(soldier, dateStr, role)

        // Update tracking
        const tracking = leaveTracking.get(soldier.id)!
        tracking.leavesCompleted++
        tracking.nextLeaveStartDay = dayNumber + cycleLength  // Next leave after full cycle

        availableSlots--
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
    dayNumber++
  }

  // === SECOND PASS: Ensure all soldiers get at least one leave block ===
  // For soldiers who never got leave (due to task conflicts or timing), find any available window
  for (const [role, roleSoldiers] of soldiersByRole) {
    for (const soldier of roleSoldiers) {
      // Skip if already has leave
      if (soldierLeaveDates.has(soldier.id) && soldierLeaveDates.get(soldier.id)!.size > 0) {
        continue
      }

      // Try to find any window in the schedule period
      let tryDate = new Date(startDate)
      let foundSlot = false
      while (tryDate <= endDate && !foundSlot) {
        const tryDateStr = formatDate(tryDate)

        // Check if soldier can take a leave block starting this day
        if (canTakeLeaveBlock(soldier.id, tryDateStr, leaveDuration)) {
          // Check capacity for all days
          let canFitBlock = true
          let checkDate = new Date(tryDateStr)
          for (let i = 0; i < leaveDuration && canFitBlock; i++) {
            const checkDateStr = formatDate(checkDate)
            if (checkDate > endDate) {
              canFitBlock = false
              break
            }
            const dayCapacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, checkDateStr, result, tasks)
            const dayOnLeave = roleSoldiers.filter(s =>
              soldierLeaveDates.has(s.id) && soldierLeaveDates.get(s.id)!.has(checkDateStr)
            ).length
            if (dayOnLeave >= (dayCapacity[role] ?? 0)) {
              canFitBlock = false
            }
            checkDate.setDate(checkDate.getDate() + 1)
          }

          if (canFitBlock) {
            assignLeaveBlock(soldier, tryDateStr, role)
            foundSlot = true
          }
        }

        tryDate.setDate(tryDate.getDate() + 1)
      }
    }
  }

  return result
}
