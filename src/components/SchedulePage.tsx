import ScheduleCalendar from './ScheduleCalendar'
import { formatScheduleAsText, exportToPdf } from '../utils/exportUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment, ScheduleConflict } from '../models'

interface SchedulePageProps {
  soldiers: Soldier[]
  dates: string[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  conflicts: ScheduleConflict[]
  onGenerate: () => void
}

export default function SchedulePage({
  soldiers, dates, tasks, taskAssignments, leaveAssignments, conflicts, onGenerate,
}: SchedulePageProps) {
  function handleCopyWhatsApp() {
    const text = formatScheduleAsText(leaveAssignments, soldiers)
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-800 mr-auto">Schedule</h2>
        <button
          onClick={handleCopyWhatsApp}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Copy for WhatsApp
        </button>
        <button
          onClick={exportToPdf}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Print
        </button>
        <button
          onClick={onGenerate}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Generate Schedule
        </button>
      </div>

      <ScheduleCalendar
        soldiers={soldiers}
        dates={dates}
        tasks={tasks}
        taskAssignments={taskAssignments}
        leaveAssignments={leaveAssignments}
      />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Conflicts</h3>
        {conflicts.length === 0 ? (
          <p className="text-sm text-green-600">No conflicts detected.</p>
        ) : (
          <ul className="space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-medium text-red-700">{c.type}</p>
                <p className="text-sm text-red-600">{c.message}</p>
                {c.suggestions.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-xs text-red-500">
                    {c.suggestions.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
