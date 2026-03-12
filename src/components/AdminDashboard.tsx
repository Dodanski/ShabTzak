import { useState, useEffect } from 'react'
import type { MasterDataService } from '../services/masterDataService'
import type { Task, AppConfig, Soldier } from '../models'
import { DataService } from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import AdminDashboardPieChart from './AdminDashboardPieChart'
import AdminWeeklyTaskCalendar from './AdminWeeklyTaskCalendar'

interface AdminDashboardProps {
  masterDs: MasterDataService
  tasks: Task[]
  configData: AppConfig | null
}

export type SoldierStatusType = 'onBase' | 'onLeave' | 'onTheWayHome' | 'onTheWayToBase' | 'inactive'

interface SoldierWithStatus extends Omit<Soldier, 'status'> {
  status: SoldierStatusType
  unitName: string
}

export default function AdminDashboard({ masterDs, tasks, configData }: AdminDashboardProps) {
  const { auth } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [soldierStatuses, setSoldierStatuses] = useState<SoldierWithStatus[]>([])
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - (day === 0 ? 6 : day - 1) // Get Monday
    const monday = new Date(today.setDate(diff))
    return monday.toISOString().split('T')[0]
  })

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<SoldierStatusType | null>(null)

  useEffect(() => {
    if (!auth.accessToken || !configData) {
      setLoading(false)
      return
    }
    loadAllSoldierStatuses()
  }, [auth.accessToken, configData])

  async function loadAllSoldierStatuses() {
    try {
      setLoading(true)
      setError(null)

      const units = await masterDs.units.list()
      const today = new Date().toISOString().split('T')[0]

      const allSoldiers: SoldierWithStatus[] = []

      for (const unit of units) {
        try {
          const ds = new DataService(auth.accessToken!, unit.spreadsheetId, unit.tabPrefix, masterDs.history)
          const [soldiers, leaveAssignments] = await Promise.all([
            ds.soldiers.list(),
            ds.leaveAssignments.list(),
          ])

          for (const soldier of soldiers) {
            const status = calculateSoldierStatus(soldier, leaveAssignments, today, configData)
            allSoldiers.push({
              ...soldier,
              status,
              unitName: unit.name,
            })
          }
        } catch (err) {
          console.warn(`Failed to load soldiers for unit ${unit.name}:`, err)
        }
      }

      setSoldierStatuses(allSoldiers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load soldier statuses')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-olive-500">Loading dashboard…</p>
        </div>
      ) : (
        <>
          {/* Pie Chart Section */}
          <AdminDashboardPieChart
            soldierStatuses={soldierStatuses}
            selectedFilter={selectedStatusFilter}
            onFilterChange={setSelectedStatusFilter}
          />

          {/* Weekly Task Calendar */}
          <AdminWeeklyTaskCalendar
            masterDs={masterDs}
            tasks={tasks}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            accessToken={auth.accessToken!}
            configData={configData}
          />
        </>
      )}
    </div>
  )
}

function calculateSoldierStatus(
  soldier: Soldier,
  leaveAssignments: any[],
  today: string,
  configData: AppConfig | null,
): SoldierStatusType {
  // Inactive soldiers
  if (soldier.status === 'Inactive') {
    return 'inactive'
  }

  if (!configData) return 'onBase'

  // Check if soldier is on leave today
  const leaveAssignment = leaveAssignments.find(
    la => la.soldierId === soldier.id &&
      new Date(la.startDate) <= new Date(today) &&
      new Date(today) <= new Date(la.endDate)
  )

  if (leaveAssignment) {
    return 'onLeave'
  }

  // Check for transition days (on the way home / on the way to base)

  for (const la of leaveAssignments) {
    const leaveStart = new Date(la.startDate)
    const leaveEnd = new Date(la.endDate)
    const todayDate = new Date(today)

    // On the way home: day before leave starts
    const dayBeforeLeave = new Date(leaveStart)
    dayBeforeLeave.setDate(dayBeforeLeave.getDate() - 1)
    if (todayDate.toISOString().split('T')[0] === dayBeforeLeave.toISOString().split('T')[0]) {
      return 'onTheWayHome'
    }

    // On the way to base: day after leave ends
    const dayAfterLeave = new Date(leaveEnd)
    dayAfterLeave.setDate(dayAfterLeave.getDate() + 1)
    if (todayDate.toISOString().split('T')[0] === dayAfterLeave.toISOString().split('T')[0]) {
      return 'onTheWayToBase'
    }
  }

  return 'onBase'
}
