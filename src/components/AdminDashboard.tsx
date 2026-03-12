import { useState } from 'react'
import type { Task, Soldier } from '../models'
import AdminWeeklyTaskCalendar from './AdminWeeklyTaskCalendar'
import AdminDashboardPieChart from './AdminDashboardPieChart'

interface AdminDashboardProps {
  tasks: Task[]
  soldiers: Soldier[]
}

export default function AdminDashboard({ tasks, soldiers }: AdminDashboardProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    // Calculate days to subtract to get to Monday (0 = Sunday)
    const daysToMonday = day === 0 ? 6 : day - 1

    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToMonday)

    return monday.toISOString().split('T')[0]
  })

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          <strong>Admin Dashboard:</strong> View all tasks scheduled across units. Soldier statuses are calculated from the last schedule generation.
        </p>
      </div>

      {/* Soldier Status Pie Chart */}
      <AdminDashboardPieChart soldiers={soldiers} />

      {/* Weekly Task Calendar */}
      <AdminWeeklyTaskCalendar
        tasks={tasks}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
      />
    </div>
  )
}
