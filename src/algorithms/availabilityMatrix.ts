import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

export type AvailabilityStatus = 'available' | 'on-leave' | 'on-task'

export interface CellData {
  status: AvailabilityStatus
  taskName?: string
}

function isOnLeaveOnDate(assignment: LeaveAssignment, dateStr: string): boolean {
  const date = parseDate(dateStr)
  return parseDate(assignment.startDate) <= date && date <= parseDate(assignment.endDate)
}

function taskCoversDate(task: Task, dateStr: string): boolean {
  const date = parseDate(dateStr)

  // Tasks must have full ISO datetimes (with dates) to be scheduled
  // Time-only formats are not supported for scheduling
  if (!task.startTime.includes('T') || !task.endTime.includes('T')) {
    return false
  }

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
): Map<string, Map<string, CellData>> {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const matrix = new Map<string, Map<string, CellData>>()

  for (const dateStr of dates) {
    const dayMap = new Map<string, CellData>()

    for (const soldier of soldiers) {
      // on-leave takes highest priority
      const onLeave = leaveAssignments.some(
        a => a.soldierId === soldier.id && isOnLeaveOnDate(a, dateStr)
      )
      if (onLeave) {
        dayMap.set(soldier.id, { status: 'on-leave' })
        continue
      }

      // on-task
      let taskName: string | undefined
      const onTask = taskAssignments.some(a => {
        if (a.soldierId !== soldier.id) return false
        const task = taskMap.get(a.taskId)
        if (task && taskCoversDate(task, dateStr)) {
          taskName = task.taskType
          return true
        }
        return false
      })

      dayMap.set(soldier.id, onTask ? { status: 'on-task', taskName } : { status: 'available' })
    }

    matrix.set(dateStr, dayMap)
  }

  return matrix
}
