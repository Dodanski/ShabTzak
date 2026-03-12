import { useState, useCallback } from 'react'
import { expandRecurringTasks } from '../algorithms/taskExpander'
import type { DataService } from '../services/dataService'
import type { ScheduleConflict, Task, AppConfig, Soldier } from '../models'

export interface UseScheduleGeneratorResult {
  generate: (onComplete?: () => void) => Promise<void>
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

  const generate = useCallback(async (onComplete?: () => void) => {
    if (!ds || !config) return
    setLoading(true)
    setError(null)
    setProgress(null)
    try {
      // Expand recurring tasks to individual instances for the schedule period
      const expandedTasks = expandRecurringTasks(tasks, endDate)

      // Generate leave schedule first
      const leave = await ds.scheduleService.generateLeaveSchedule(config, startDate, endDate, 'user')

      // Then generate task schedule with leave assignments included
      const task = await ds.scheduleService.generateTaskSchedule(expandedTasks, 'user', (completed, total) => {
        setProgress({ completed, total })
      }, leave.assignments, config, allSoldiers)

      setConflicts([...leave.conflicts, ...task.conflicts])

      // Call onComplete callback when done (for data reload)
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [ds, tasks, config, startDate, endDate, allSoldiers])

  return { generate, loading, conflicts, error, progress }
}
