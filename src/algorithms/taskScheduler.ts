import { combinedFairnessScore } from './fairness'
import { isTaskAvailable, checkDrivingHoursLimit } from './taskAvailability'
import type { Soldier, Task, TaskAssignment, TaskSchedule, LeaveAssignment, AppConfig } from '../models'

/**
 * Greedy task scheduler: processes tasks by start time, assigns soldiers to each
 * role requirement sorted by fairness score (lowest first).
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
  // Use all tasks in system for rest period checking, fallback to just scheduled tasks
  const tasksForValidation = allTasksInSystem || tasks


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
      const rolesAccepted = requirement.roles ?? (requirement.role ? [requirement.role] : []) as (typeof requirement.roles)

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

      // Sort by unit affinity (prefer same unit), then fairness
      const ranked = [...eligible].sort((a, b) => {
        if (taskUnit) {
          const aUnit = a.unit === taskUnit ? 0 : 1
          const bUnit = b.unit === taskUnit ? 0 : 1
          if (aUnit !== bUnit) return aUnit - bUnit
        }
        return combinedFairnessScore(a) - combinedFairnessScore(b)
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
  console.log('[taskScheduler] END:', {
    totalAssignments: result.length,
    newAssignments: newAssignmentsCount,
  })

  return {
    startDate,
    endDate,
    assignments: result,
    conflicts: [],
  }
}
