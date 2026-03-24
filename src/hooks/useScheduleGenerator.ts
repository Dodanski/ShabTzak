import { useState, useCallback } from 'react'
import { expandRecurringTasks } from '../algorithms/taskExpander'
import type { DataService } from '../services/dataService'
import type { ScheduleConflict, Task, TaskAssignment, AppConfig, Soldier } from '../models'

export interface UseScheduleGeneratorResult {
  generate: (onComplete?: () => void) => Promise<{ taskAssignments: TaskAssignment[] } | void>
  loading: boolean
  conflicts: ScheduleConflict[]
  error: Error | null
  progress: { completed: number; total: number } | null
}

export function useScheduleGenerator(
  ds: DataService | null,
  tasks: Task[],
  config: AppConfig | null,
  startDate: string,
  endDate: string,
  allSoldiers?: Soldier[]  // NEW: optional all soldiers for multi-unit scheduling
): UseScheduleGeneratorResult {
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)

  const generate = useCallback(async (onComplete?: () => void): Promise<{ taskAssignments: TaskAssignment[] } | void> => {
    if (!ds || !config) return
    setLoading(true)
    setError(null)
    setProgress(null)
    try {
      // Expand recurring tasks to individual instances for the schedule period
      const expandedTasks = expandRecurringTasks(tasks, endDate)

      // IMPORTANT: Generate TASK schedule FIRST (tasks have priority)
      // Tasks should be assigned to soldiers based on available roles
      const task = await ds.scheduleService.generateTaskSchedule(expandedTasks, 'user', (completed, total) => {
        setProgress({ completed, total })
      }, undefined, config, allSoldiers)  // Don't pass leave assignments yet

      // THEN generate leave schedule, respecting task assignments
      // Soldiers assigned to critical tasks should not be able to take leave
      const leave = await ds.scheduleService.generateLeaveSchedule(config, startDate, endDate, 'user')

      setConflicts([...task.conflicts, ...leave.conflicts])

      // Call onComplete callback when done (for data reload)
      onComplete?.()

      // Return task assignments so caller can update fairness
      return { taskAssignments: task.assignments }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [ds, tasks, config, startDate, endDate, allSoldiers])

  return { generate, loading, conflicts, error, progress }
}
