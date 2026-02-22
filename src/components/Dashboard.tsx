import React from 'react'
import type { Soldier, LeaveRequest, TaskAssignment, ScheduleConflict } from '../models'

interface DashboardProps {
  soldiers: Soldier[]
  leaveRequests: LeaveRequest[]
  taskAssignments: TaskAssignment[]
  conflicts: ScheduleConflict[]
  onGenerateSchedule: () => void
}

export default function Dashboard({
  soldiers, leaveRequests, taskAssignments, conflicts, onGenerateSchedule,
}: DashboardProps) {
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        <button
          onClick={onGenerateSchedule}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Generate Schedule
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active Soldiers</p>
          <p className="text-2xl font-bold text-gray-800">{activeSoldiers.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Pending Leave Requests</p>
          <p className="text-2xl font-bold text-gray-800">{pendingRequests.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Task Assignments</p>
          <p className="text-2xl font-bold text-gray-800">{taskAssignments.length}</p>
        </div>
        <div className={`rounded-lg shadow p-4 ${conflicts.length > 0 ? 'bg-red-50' : 'bg-white'}`}>
          <p className="text-sm text-gray-500">Conflicts</p>
          <p className={`text-2xl font-bold ${conflicts.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {conflicts.length}
          </p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Schedule Conflicts</h3>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-sm text-red-600">{c.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
