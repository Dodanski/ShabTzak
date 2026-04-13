import { combinedFairnessScore } from './fairness'
import { isTaskAvailable, checkDrivingHoursLimit } from './taskAvailability'
import type { Soldier, Task, TaskAssignment, TaskSchedule, LeaveAssignment, AppConfig, ScheduleConflict } from '../models'

/**
 * Get the base task type from a task ID (e.g., "Tour 2_day5" -> "Tour 2")
 */
function getBaseTaskType(taskId: string): string {
  // Remove _dayN or _pillN suffix to get base task type
  return taskId.replace(/_day\d+$/, '').replace(/_pill\d+$/, '')
}

/**
 * Greedy task scheduler with rotation: processes tasks by start time, assigns soldiers
 * to each role requirement. Uses dynamic fairness tracking to ensure rotation -
 * soldiers who have been assigned more tasks during this scheduling run are deprioritized.
 *
 * @param tasks - Tasks to assign soldiers to
 * @param soldiers - Available soldiers
 * @param existingAssignments - Existing assignments (used for fairness and rest period checking)
 * @param allTasksInSystem - All tasks in the system (needed for rest period validation against prior tasks)
 * @param leaveAssignments - Leave assignments to check for soldier availability
 * @param config - App config with exit/return hours for transition days
 */
export function scheduleTasks(
  tasks: Task[],
  soldiers: Soldier[],
  existingAssignments: TaskAssignment[],
  allTasksInSystem?: Task[],
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig,
): TaskSchedule {
  console.log('[taskScheduler] START:', {
    tasksCount: tasks.length,
    soldiersCount: soldiers.length,
    existingAssignmentsCount: existingAssignments.length,
    leaveAssignmentsCount: leaveAssignments?.length ?? 0,
  })
  // Always log soldier info for debugging (can be disabled later)
  console.log('[taskScheduler] Soldiers:', soldiers.map(s => ({ id: s.id, role: s.role, status: s.status })))

  const result: TaskAssignment[] = [...existingAssignments]
  const conflicts: ScheduleConflict[] = []
  // Use all tasks in system for rest period checking, fallback to just scheduled tasks
  const tasksForValidation = allTasksInSystem || tasks

  // Track capacity shortages by role
  const capacityShortages: Map<string, { needed: number; available: number; unfilledTasks: string[] }> = new Map()

  // === ROTATION TRACKING ===
  // Track assignments made during THIS scheduling run for fair rotation
  // Key: soldierId, Value: { totalHours, taskTypeCount: Map<taskType, count> }
  const sessionAssignments = new Map<string, {
    totalHours: number
    taskTypeCount: Map<string, number>
    consecutiveDaysOnSameTask: Map<string, number>  // taskType -> consecutive days
    lastTaskDate: Map<string, string>  // taskType -> last date assigned
  }>()

  // Initialize tracking for all soldiers
  for (const soldier of soldiers) {
    sessionAssignments.set(soldier.id, {
      totalHours: 0,
      taskTypeCount: new Map(),
      consecutiveDaysOnSameTask: new Map(),
      lastTaskDate: new Map(),
    })
  }

  // Initialize from existing assignments
  for (const assignment of existingAssignments) {
    const task = tasksForValidation.find(t => t.id === assignment.taskId)
    if (!task) continue
    const tracking = sessionAssignments.get(assignment.soldierId)
    if (!tracking) continue

    const baseType = getBaseTaskType(task.id)
    tracking.totalHours += task.durationHours
    tracking.taskTypeCount.set(baseType, (tracking.taskTypeCount.get(baseType) ?? 0) + 1)
  }


  // Group tasks by date for visibility
  const tasksByDate: Record<string, number> = {}
  for (const task of tasks) {
    const date = task.startTime.split('T')[0]
    tasksByDate[date] = (tasksByDate[date] ?? 0) + 1
  }

  // Process tasks in chronological order
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  for (const task of sortedTasks) {
    for (const requirement of task.roleRequirements) {
      // Get acceptable roles for this requirement (handle both old and new formats)
      const rolesAccepted = requirement.roles ?? (requirement.role ? [requirement.role] : [])

      // Validate role requirement is not empty
      if (!rolesAccepted || rolesAccepted.length === 0) {
        console.warn(`[taskScheduler] Task ${task.id} role requirement has no roles specified, skipping`)
        continue
      }

      // Count already-assigned soldiers for this requirement on this task
      const alreadyAssigned = result.filter(a => {
        if (a.taskId !== task.id) return false
        if (rolesAccepted.includes('Any')) return true
        return rolesAccepted.includes(a.assignedRole)
      }).length

      const remaining = requirement.count - alreadyAssigned
      if (remaining <= 0) continue

      // Find eligible soldiers: role match + available (rest period, status, leave) + driving hours
      const eligible = soldiers.filter(s => {
        // Check if soldier's role matches ANY of the acceptable roles
        const matchesRole = rolesAccepted.includes('Any') || rolesAccepted.includes(s.role)
        if (!matchesRole) {
          if (import.meta.env.DEV) console.log(`    - ${s.id}: role mismatch (${s.role} not in ${rolesAccepted})`)
          return false
        }
        const available = isTaskAvailable(s, task, tasksForValidation, result, leaveAssignments, config)
        if (!available) {
          if (import.meta.env.DEV) console.log(`    - ${s.id}: not available`)
          return false
        }
        // Check driving hours limit for Driver role soldiers
        if (config && !checkDrivingHoursLimit(s, task, tasksForValidation, result, config)) {
          if (import.meta.env.DEV) console.log(`    - ${s.id}: would exceed driving hours limit`)
          return false
        }
        return true
      })

      // Always log eligibility for debugging
      console.log(`[taskScheduler] Task ${task.id}, requirement roles=${rolesAccepted}:`, {
        remaining,
        eligibleCount: eligible.length,
        eligibleIds: eligible.map(s => s.id),
        alreadyAssigned: alreadyAssigned,
      })

      // Determine task's unit based on majority of already-assigned soldiers
      const getTaskUnit = () => {
        const assignedUnits = result
          .filter(a => a.taskId === task.id)
          .map(a => soldiers.find(s => s.id === a.soldierId)?.unit)
          .filter(Boolean)

        if (assignedUnits.length === 0) return null
        const unitCounts = new Map<string, number>()
        for (const unit of assignedUnits) {
          unitCounts.set(unit!, (unitCounts.get(unit!) ?? 0) + 1)
        }
        return Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      }

      const taskUnit = getTaskUnit()
      const baseTaskType = getBaseTaskType(task.id)
      const taskDate = task.startTime.split('T')[0]

      // Calculate dynamic fairness score that includes session assignments
      const getDynamicFairness = (soldier: Soldier): number => {
        const tracking = sessionAssignments.get(soldier.id)
        if (!tracking) return combinedFairnessScore(soldier)

        // Base fairness from soldier stats
        let score = combinedFairnessScore(soldier)

        // Add penalty for hours assigned during this session (encourages rotation)
        score += tracking.totalHours * 2

        // Add penalty for being assigned to this same task type before (encourages task variety)
        const taskTypeCount = tracking.taskTypeCount.get(baseTaskType) ?? 0
        score += taskTypeCount * 10

        // Heavy penalty for consecutive days on the same task type (forces rotation)
        const consecutiveDays = tracking.consecutiveDaysOnSameTask.get(baseTaskType) ?? 0
        if (consecutiveDays > 0) {
          // Exponential penalty for consecutive days
          score += Math.pow(consecutiveDays, 2) * 20
        }

        return score
      }

      // Sort by unit affinity (prefer same unit), then dynamic fairness
      const ranked = [...eligible].sort((a, b) => {
        if (taskUnit) {
          const aUnit = a.unit === taskUnit ? 0 : 1
          const bUnit = b.unit === taskUnit ? 0 : 1
          if (aUnit !== bUnit) return aUnit - bUnit
        }
        return getDynamicFairness(a) - getDynamicFairness(b)
      })

      // Assign up to `remaining` soldiers
      for (let i = 0; i < Math.min(remaining, ranked.length); i++) {
        const soldier = ranked[i]
        result.push({
          scheduleId: `sched-${task.id}`,
          taskId: task.id,
          soldierId: soldier.id,
          assignedRole: soldier.role,  // Always assign soldier's actual role
          assignedUnitId: soldier.unit,  // NEW: capture soldier's unit
          isLocked: false,
          createdAt: new Date().toISOString(),
          createdBy: 'scheduler',
        })

        // === UPDATE SESSION TRACKING ===
        const tracking = sessionAssignments.get(soldier.id)
        if (tracking) {
          tracking.totalHours += task.durationHours
          tracking.taskTypeCount.set(baseTaskType, (tracking.taskTypeCount.get(baseTaskType) ?? 0) + 1)

          // Update consecutive days tracking
          const lastDate = tracking.lastTaskDate.get(baseTaskType)
          if (lastDate) {
            // Check if this is the next day
            const lastDateObj = new Date(lastDate)
            const taskDateObj = new Date(taskDate)
            const diffDays = Math.round((taskDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays === 1) {
              // Consecutive day - increment counter
              tracking.consecutiveDaysOnSameTask.set(
                baseTaskType,
                (tracking.consecutiveDaysOnSameTask.get(baseTaskType) ?? 0) + 1
              )
            } else if (diffDays > 1) {
              // Gap in days - reset counter
              tracking.consecutiveDaysOnSameTask.set(baseTaskType, 1)
            }
            // Same day (diffDays === 0) - don't change counter
          } else {
            // First assignment to this task type
            tracking.consecutiveDaysOnSameTask.set(baseTaskType, 1)
          }
          tracking.lastTaskDate.set(baseTaskType, taskDate)
        }
      }

      // Track unfilled positions (capacity shortage)
      const unfilled = remaining - ranked.length
      if (unfilled > 0) {
        const roleKey = rolesAccepted.join('|')
        const existing = capacityShortages.get(roleKey) || { needed: 0, available: 0, unfilledTasks: [] }
        existing.needed += unfilled
        existing.unfilledTasks.push(task.id)
        // Count soldiers with this role for reference
        if (existing.available === 0) {
          existing.available = soldiers.filter(s =>
            rolesAccepted.includes('Any') || rolesAccepted.includes(s.role)
          ).length
        }
        capacityShortages.set(roleKey, existing)
      }
    }
  }

  // Derive date range from all tasks
  const startDate = tasks.length > 0
    ? tasks.reduce((min, t) => t.startTime < min ? t.startTime : min, tasks[0].startTime).split('T')[0]
    : ''
  const endDate = tasks.length > 0
    ? tasks.reduce((max, t) => t.endTime > max ? t.endTime : max, tasks[0].endTime).split('T')[0]
    : ''

  // Group assignments by date
  const assignmentsByDate: Record<string, number> = {}
  for (const assignment of result) {
    const task = tasks.find(t => t.id === assignment.taskId)
    if (task) {
      const date = task.startTime.split('T')[0]
      assignmentsByDate[date] = (assignmentsByDate[date] ?? 0) + 1
    }
  }

  const newAssignmentsCount = result.length - existingAssignments.length

  // Generate capacity shortage conflicts
  for (const [roleKey, shortage] of capacityShortages) {
    const uniqueTasks = [...new Set(shortage.unfilledTasks)]
    conflicts.push({
      type: 'CAPACITY_SHORTAGE',
      message: `Missing ${shortage.needed} soldiers with role "${roleKey}" to fill ${uniqueTasks.length} tasks. Currently have ${shortage.available} soldiers with this role.`,
      affectedSoldierIds: [],
      affectedTaskIds: uniqueTasks.slice(0, 10), // Limit to first 10 for display
      suggestions: [
        `Add ${Math.ceil(shortage.needed / 30)} more soldiers with role "${roleKey}"`,
        `Consider splitting "${roleKey}" tasks across multiple shifts`,
      ],
    })
  }

  console.log('[taskScheduler] END:', {
    totalAssignments: result.length,
    newAssignments: newAssignmentsCount,
    capacityShortages: capacityShortages.size > 0 ? Object.fromEntries(capacityShortages) : 'none',
  })

  return {
    startDate,
    endDate,
    assignments: result,
    conflicts,
  }
}
