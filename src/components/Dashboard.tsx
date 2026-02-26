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

  const fairnessValues = soldiers.map(s => s.currentFairness)
  const avgFairness = fairnessValues.length
    ? fairnessValues.reduce((a, b) => a + b, 0) / fairnessValues.length
    : 0
  const minFairness = fairnessValues.length ? Math.min(...fairnessValues) : 0
  const maxFairness = fairnessValues.length ? Math.max(...fairnessValues) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-olive-800">Dashboard</h2>
        <button
          onClick={onGenerateSchedule}
          className="px-4 py-2 bg-olive-700 text-white text-sm rounded-lg hover:bg-olive-800"
        >
          Generate Schedule
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
          <p className="text-sm text-olive-500">Active Soldiers</p>
          <p className="text-2xl font-bold text-olive-800">{activeSoldiers.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
          <p className="text-sm text-olive-500">Pending Leave Requests</p>
          <p className="text-2xl font-bold text-olive-800">{pendingRequests.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
          <p className="text-sm text-olive-500">Task Assignments</p>
          <p className="text-2xl font-bold text-olive-800">{taskAssignments.length}</p>
        </div>
        <div className={`rounded-lg border border-olive-200 shadow-sm p-4 ${conflicts.length > 0 ? 'bg-red-50' : 'bg-white'}`}>
          <p className="text-sm text-olive-500">Conflicts</p>
          <p className={`text-2xl font-bold ${conflicts.length > 0 ? 'text-red-600' : 'text-olive-800'}`}>
            {conflicts.length}
          </p>
        </div>
      </div>

      {soldiers.length > 0 && (
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-olive-700 mb-2">Fairness Summary</h3>
          <div className="flex gap-6 text-sm text-olive-600">
            <span>Avg: <span className="font-mono font-semibold text-olive-800">{avgFairness.toFixed(1)}</span></span>
            <span>Min: <span className="font-mono font-semibold text-green-700">{minFairness.toFixed(1)}</span></span>
            <span>Max: <span className="font-mono font-semibold text-red-700">{maxFairness.toFixed(1)}</span></span>
          </div>
        </div>
      )}

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
