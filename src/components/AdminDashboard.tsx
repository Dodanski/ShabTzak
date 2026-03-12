import { useState } from 'react'
import type { MasterDataService } from '../services/masterDataService'
import type { Task, AppConfig } from '../models'
import AdminWeeklyTaskCalendar from './AdminWeeklyTaskCalendar'

interface AdminDashboardProps {
  masterDs: MasterDataService
  tasks: Task[]
  configData: AppConfig | null
}

export default function AdminDashboard({ masterDs, tasks, configData }: AdminDashboardProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - (day === 0 ? 6 : day - 1) // Get Monday
    const monday = new Date(today.setDate(diff))
    return monday.toISOString().split('T')[0]
  })

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          <strong>Admin Dashboard:</strong> View all tasks scheduled across units. Soldier statuses (on leave, on base, etc.) are automatically calculated by the scheduler.
        </p>
      </div>

      {/* Weekly Task Calendar */}
      <AdminWeeklyTaskCalendar
        masterDs={masterDs}
        tasks={tasks}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        accessToken={''}
        configData={configData}
      />
    </div>
  )
}
