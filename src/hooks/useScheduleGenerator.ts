import { useState, useCallback } from 'react'
import type { DataService } from '../services/dataService'
import type { ScheduleConflict } from '../models'

export interface UseScheduleGeneratorResult {
  generate: () => void
  loading: boolean
  conflicts: ScheduleConflict[]
  error: Error | null
}

export function useScheduleGenerator(
  ds: DataService | null,
  startDate: string,
  endDate: string,
): UseScheduleGeneratorResult {
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async () => {
    if (!ds) return
    setLoading(true)
    setError(null)
    try {
      const [leave, task] = await Promise.all([
        ds.scheduleService.generateLeaveSchedule(startDate, endDate, 'user'),
        ds.scheduleService.generateTaskSchedule('user'),
      ])
      setConflicts([...leave.conflicts, ...task.conflicts])
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [ds, startDate, endDate])

  return { generate, loading, conflicts, error }
}
