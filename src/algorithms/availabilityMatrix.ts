import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

export type AvailabilityStatus = 'available' | 'on-leave' | 'on-task'

function isOnLeaveOnDate(assignment: LeaveAssignment, dateStr: string): boolean {
  const date = parseDate(dateStr)
  return parseDate(assignment.startDate) <= date && date <= parseDate(assignment.endDate)
}

function taskCoversDate(task: Task, dateStr: string): boolean {
  const date = parseDate(dateStr)
  const taskStartDate = parseDate(task.startTime.split('T')[0])
  const taskEndDate = parseDate(task.endTime.split('T')[0])
  return taskStartDate <= date && date <= taskEndDate
}

/**
 * Builds a per-day per-soldier availability matrix.
 * Priority: on-leave > on-task > available
 */
export function buildAvailabilityMatrix(
  soldiers: Soldier[],
  tasks: Task[],
  taskAssignments: TaskAssignment[],
  leaveAssignments: LeaveAssignment[],
  dates: string[],
): Map<string, Map<string, AvailabilityStatus>> {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const matrix = new Map<string, Map<string, AvailabilityStatus>>()

  for (const dateStr of dates) {
    const dayMap = new Map<string, AvailabilityStatus>()

    for (const soldier of soldiers) {
      // on-leave takes highest priority
      const onLeave = leaveAssignments.some(
        a => a.soldierId === soldier.id && isOnLeaveOnDate(a, dateStr)
      )
      if (onLeave) {
        dayMap.set(soldier.id, 'on-leave')
        continue
      }

      // on-task
      const onTask = taskAssignments.some(a => {
        if (a.soldierId !== soldier.id) return false
        const task = taskMap.get(a.taskId)
        return task ? taskCoversDate(task, dateStr) : false
      })

      dayMap.set(soldier.id, onTask ? 'on-task' : 'available')
    }

    matrix.set(dateStr, dayMap)
  }

  return matrix
}
