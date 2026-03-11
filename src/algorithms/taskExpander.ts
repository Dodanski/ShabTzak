import type { Task } from '../models'

/**
 * Expands recurring tasks into individual task instances for the schedule period.
 *
 * - Regular tasks: Create an instance for each day from task.startTime.date to scheduleEndDate
 * - Pillbox tasks (isSpecial=true): Create instances sequentially, each starting after the previous ends
 */
export function expandRecurringTasks(
  tasks: Task[],
  scheduleEndDate: string, // YYYY-MM-DD
): Task[] {
  const expanded: Task[] = []
  const taskEndDate = new Date(scheduleEndDate)

  for (const task of tasks) {
    if (task.isSpecial && task.specialDurationDays) {
      // Pillbox tasks: recur sequentially, each instance starts where the previous ended
      const pillboxDurationDays = task.specialDurationDays
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
        })

        currentStart = currentEnd // Next instance starts where this one ended
        instanceIndex++
      }
    } else {
      // Regular daily tasks: repeat every day from startTime date to scheduleEndDate
      const taskTimeOfDay = task.startTime.split('T')[1] // HH:MM:SS
      const taskDurationMs = new Date(task.endTime).getTime() - new Date(task.startTime).getTime()

      let currentDate = new Date(task.startTime.split('T')[0])
      let instanceIndex = 0

      while (currentDate <= taskEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const startTime = `${dateStr}T${taskTimeOfDay}`
        const endDate = new Date(new Date(startTime).getTime() + taskDurationMs)
        const endTime = endDate.toISOString()

        expanded.push({
          ...task,
          id: `${task.id}_day${instanceIndex}`, // Unique ID for this instance
          startTime,
          endTime,
        })

        currentDate.setDate(currentDate.getDate() + 1)
        instanceIndex++
      }
    }
  }

  return expanded
}
