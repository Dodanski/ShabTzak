import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

export type AvailabilityStatus = 'available' | 'on-leave' | 'on-task' | 'on-way-home' | 'on-way-to-base'

export interface CellData {
  status: AvailabilityStatus
  taskName?: string
  transitionType?: 'exit' | 'return'
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
 * Priority: on-leave > transition > on-task > available
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

  // Build a map of leave date ranges for quick lookup
  const soldierLeaveMap = new Map<string, { startDate: Date; endDate: Date; type: string }[]>()
  for (const leave of leaveAssignments) {
    if (!soldierLeaveMap.has(leave.soldierId)) {
      soldierLeaveMap.set(leave.soldierId, [])
    }
    // Parse the date, handling both full datetime and date-only formats
    const startDateStr = leave.startDate.split('T')[0]
    const endDateStr = leave.endDate.split('T')[0]
    soldierLeaveMap.get(leave.soldierId)!.push({
      startDate: parseDate(startDateStr),
      endDate: parseDate(endDateStr),
      type: leave.leaveType,
    })
  }

  for (const dateStr of dates) {
    const dayMap = new Map<string, CellData>()
    const currentDate = parseDate(dateStr)

    for (const soldier of soldiers) {
      // Check for on-leave (takes highest priority)
      const onLeave = leaveAssignments.some(
        a => a.soldierId === soldier.id && isOnLeaveOnDate(a, dateStr)
      )
      if (onLeave) {
        dayMap.set(soldier.id, { status: 'on-leave' })
        continue
      }

      // Check for transition days (day before/after leave)
      const soldiersLeaves = soldierLeaveMap.get(soldier.id) ?? []
      let transitionStatus: CellData | null = null

      for (const leave of soldiersLeaves) {
        // Day before leave (exit day)
        const dayBefore = new Date(leave.startDate)
        dayBefore.setDate(dayBefore.getDate() - 1)
        if (currentDate.getTime() === dayBefore.getTime()) {
          transitionStatus = {
            status: 'on-way-home',
            transitionType: 'exit'
          }
          break
        }

        // Day after leave (return day)
        const dayAfter = new Date(leave.endDate)
        dayAfter.setDate(dayAfter.getDate() + 1)
        if (currentDate.getTime() === dayAfter.getTime()) {
          transitionStatus = {
            status: 'on-way-to-base',
            transitionType: 'return'
          }
          break
        }
      }

      if (transitionStatus) {
        dayMap.set(soldier.id, transitionStatus)
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
