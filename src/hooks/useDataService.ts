import { useState, useEffect, useMemo } from 'react'
import { DataService } from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import type { Soldier, LeaveRequest, Task, TaskAssignment, LeaveAssignment, AppConfig } from '../models'
import type { HistoryEntry } from '../services/historyService'

export interface UseDataServiceResult {
  ds: DataService | null
  soldiers: Soldier[]
  leaveRequests: LeaveRequest[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  historyEntries: HistoryEntry[]
  configData: AppConfig | null
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useDataService(spreadsheetId: string): UseDataServiceResult {
  const { auth } = useAuth()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([])
  const [leaveAssignments, setLeaveAssignments] = useState<LeaveAssignment[]>([])
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [configData, setConfigData] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const ds = useMemo(() => {
    if (!auth.accessToken || !spreadsheetId) return null
    return new DataService(auth.accessToken, spreadsheetId)
  }, [auth.accessToken, spreadsheetId])

  useEffect(() => {
    if (!ds) return
    setLoading(true)
    setError(null)
    Promise.all([
      ds.soldiers.list(),
      ds.leaveRequests.list(),
      ds.tasks.list(),
      ds.taskAssignments.list(),
      ds.leaveAssignments.list(),
      ds.history.listAll(),
      ds.config.read(),
    ])
      .then(([s, lr, t, ta, la, he, cfg]) => {
        setSoldiers(s)
        setLeaveRequests(lr)
        setTasks(t)
        setTaskAssignments(ta)
        setLeaveAssignments(la)
        setHistoryEntries(he)
        setConfigData(cfg)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
  }, [ds, tick])

  const reload = () => setTick(n => n + 1)

  return { ds, soldiers, leaveRequests, tasks, taskAssignments, leaveAssignments, historyEntries, configData, loading, error, reload }
}
