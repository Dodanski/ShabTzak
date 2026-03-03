import { useState, useEffect, useMemo } from 'react'
import { DataService } from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import type { Soldier, LeaveRequest, TaskAssignment, LeaveAssignment } from '../models'
import type { MasterDataService } from '../services/masterDataService'

export interface UseDataServiceResult {
  ds: DataService | null
  soldiers: Soldier[]
  leaveRequests: LeaveRequest[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useDataService(spreadsheetId: string, tabPrefix = '', masterDs: MasterDataService | null): UseDataServiceResult {
  const { auth } = useAuth()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([])
  const [leaveAssignments, setLeaveAssignments] = useState<LeaveAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const ds = useMemo(() => {
    if (!auth.accessToken || !spreadsheetId || !masterDs) return null
    return new DataService(auth.accessToken, spreadsheetId, tabPrefix, masterDs.history)
  }, [auth.accessToken, spreadsheetId, tabPrefix, masterDs])

  useEffect(() => {
    if (!ds) return
    setLoading(true)
    setError(null)
    Promise.all([
      ds.soldiers.list(),
      ds.leaveRequests.list(),
      ds.taskAssignments.list(),
      ds.leaveAssignments.list(),
    ])
      .then(([s, lr, ta, la]) => {
        setSoldiers(s)
        setLeaveRequests(lr)
        setTaskAssignments(ta)
        setLeaveAssignments(la)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [ds, tick])

  const reload = () => setTick(n => n + 1)

  return { ds, soldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload }
}
