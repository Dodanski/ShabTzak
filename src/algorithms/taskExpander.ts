import type { Task } from '../models'

/**
 * Expands recurring tasks into individual task instances for the schedule period.
 *
 * - Daily tasks: Create an instance for each day in [startDate, recurrenceEndDate or endDate]
 * - Pillbox tasks: Create instances sequentially, each starting after the previous ends
 * - Non-recurring tasks: Return as-is
 */
export function expandRecurringTasks(
  tasks: Task[],
  scheduleStartDate: string, // YYYY-MM-DD
  scheduleEndDate: string, // YYYY-MM-DD
): Task[] {
  const expanded: Task[] = []
  const taskStartDate = new Date(scheduleStartDate)
  const taskEndDate = new Date(scheduleEndDate)

  for (const task of tasks) {
    if (task.recurrence === 'daily') {
      // Generate daily instances from startTime date to recurrenceEndDate (or scheduleEndDate)
      const limitDate = task.recurrenceEndDate
        ? new Date(task.recurrenceEndDate)
        : taskEndDate

      const taskTimeOfDay = task.startTime.split('T')[1] // HH:MM:SS
      const taskDurationMs = new Date(task.endTime).getTime() - new Date(task.startTime).getTime()

      let currentDate = new Date(task.startTime.split('T')[0])
      let instanceIndex = 0

      while (currentDate <= limitDate && currentDate <= taskEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const startTime = `${dateStr}T${taskTimeOfDay}`
        const endDate = new Date(new Date(startTime).getTime() + taskDurationMs)
        const endTime = endDate.toISOString()

        expanded.push({
          ...task,
          id: `${task.id}_day${instanceIndex}`, // Unique ID for this instance
          startTime,
          endTime,
          recurrence: undefined, // Don't recursively expand
        })

        currentDate.setDate(currentDate.getDate() + 1)
        instanceIndex++
      }
    } else if (task.recurrence === 'pillbox') {
      // Pillbox tasks recur sequentially: each instance starts where the previous ended
      const pillboxDurationDays = task.specialDurationDays ?? 1
      const pillboxDurationMs = pillboxDurationDays * 24 * 60 * 60 * 1000

      let currentStart = new Date(task.startTime)
      let instanceIndex = 0

      while (currentStart < taskEndDate) {
        const currentEnd = new Date(currentStart.getTime() + pillboxDurationMs)
        if (currentEnd > taskEndDate) break // Stop if this instance would go past the schedule end

        expanded.push({
          ...task,
          id: `${task.id}_pill${instanceIndex}`, // Unique ID for this instance
          startTime: currentStart.toISOString(),
          endTime: currentEnd.toISOString(),
          durationHours: (pillboxDurationMs / (1000 * 60 * 60)),
          recurrence: undefined, // Don't recursively expand
        })

        currentStart = currentEnd // Next instance starts where this one ended
        instanceIndex++
      }
    } else {
      // Non-recurring task: include as-is
      expanded.push(task)
    }
  }

  return expanded
}
