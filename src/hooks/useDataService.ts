import { useState, useEffect, useMemo } from 'react'
import { DataService } from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import type { Soldier, LeaveRequest, Task, TaskAssignment, LeaveAssignment } from '../models'

export interface UseDataServiceResult {
  ds: DataService | null
  soldiers: Soldier[]
  leaveRequests: LeaveRequest[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
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
    ])
      .then(([s, lr, t, ta, la]) => {
        setSoldiers(s)
        setLeaveRequests(lr)
        setTasks(t)
        setTaskAssignments(ta)
        setLeaveAssignments(la)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
  }, [ds, tick])

  const reload = () => setTick(n => n + 1)

  return { ds, soldiers, leaveRequests, tasks, taskAssignments, leaveAssignments, loading, error, reload }
}
