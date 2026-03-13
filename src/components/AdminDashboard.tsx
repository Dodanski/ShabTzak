import { useState } from 'react'
import type { Task, Soldier, TaskAssignment } from '../models'
import AdminWeeklyTaskCalendar from './AdminWeeklyTaskCalendar'
import AdminDashboardPieChart from './AdminDashboardPieChart'

interface AdminDashboardProps {
  tasks: Task[]
  soldiers: Soldier[]
  taskAssignments?: TaskAssignment[]
  onGenerateSchedule?: () => Promise<void>
  isGeneratingSchedule?: boolean
  scheduleError?: string | null
  scheduleSuccess?: boolean
}

export default function AdminDashboard({
  tasks,
  soldiers,
  taskAssignments = [],
  onGenerateSchedule,
  isGeneratingSchedule = false,
  scheduleError = null,
  scheduleSuccess = false,
}: AdminDashboardProps) {
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

      {/* Schedule Generation Section */}
      <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-olive-800">Generate Schedule for All Units</h3>
        <p className="text-sm text-olive-600">
          Generate leave and task schedules for all {soldiers.length} soldiers across all units. The shared master schedule will be created in the admin spreadsheet.
        </p>

        {scheduleError && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
            {scheduleError}
          </div>
        )}

        {scheduleSuccess && (
          <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-700">
            ✓ Schedule generated successfully! Check the TaskSchedule and LeaveSchedule tabs in the admin spreadsheet.
          </div>
        )}

        <button
          onClick={onGenerateSchedule}
          disabled={isGeneratingSchedule || soldiers.length === 0}
          className="px-4 py-2 bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingSchedule ? 'Generating…' : 'Generate Schedule for All Units'}
        </button>
      </div>

      {/* Soldier Status Pie Chart */}
      <AdminDashboardPieChart soldiers={soldiers} />

      {/* Weekly Task Calendar */}
      <AdminWeeklyTaskCalendar
        tasks={tasks}
        soldiers={soldiers}
        taskAssignments={taskAssignments}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
      />
    </div>
  )
}
