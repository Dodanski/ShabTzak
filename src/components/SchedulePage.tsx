import { useState } from 'react'
import ScheduleCalendar from './ScheduleCalendar'
import { formatScheduleAsText, exportToPdf, exportToCsv, downloadCsv } from '../utils/exportUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment, ScheduleConflict } from '../models'
import type { SoldierRole } from '../constants'
import { ROLES } from '../constants'

const ASSIGNMENT_ROLES: Array<SoldierRole | 'Any'> = [...ROLES, 'Any'] as Array<SoldierRole | 'Any'>

interface SchedulePageProps {
  soldiers: Soldier[]
  dates: string[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  conflicts: ScheduleConflict[]
  onGenerate: () => void
  onManualAssign: (soldierId: string, taskId: string, role: SoldierRole) => void
}

export default function SchedulePage({
  soldiers, dates, tasks, taskAssignments, leaveAssignments, conflicts, onGenerate, onManualAssign,
}: SchedulePageProps) {
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualSoldierId, setManualSoldierId] = useState('')
  const [manualTaskId, setManualTaskId] = useState('')
  const [manualRole, setManualRole] = useState<SoldierRole>(ROLES[0])

  function handleCopyWhatsApp() {
    const text = formatScheduleAsText(leaveAssignments, soldiers)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleExportCsv() {
    const csv = exportToCsv(soldiers, leaveAssignments)
    downloadCsv('schedule.csv', csv)
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualSoldierId || !manualTaskId) return
    onManualAssign(manualSoldierId, manualTaskId, manualRole)
    setManualSoldierId('')
    setManualTaskId('')
    setManualRole(ROLES[0])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-800 mr-auto">Schedule</h2>
        <button
          onClick={handleCopyWhatsApp}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {copied ? 'Copied!' : 'Copy for WhatsApp'}
        </button>
        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Export CSV
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
        <button
          onClick={() => setShowManual(s => !s)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Add manual assignment
        </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="mt-3 bg-white rounded-lg shadow p-4 space-y-3">
            <div>
              <label htmlFor="manual-soldier" className="block text-xs text-gray-600 mb-1">Soldier</label>
              <select
                id="manual-soldier"
                aria-label="Soldier"
                value={manualSoldierId}
                onChange={e => setManualSoldierId(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="">Select soldier…</option>
                {soldiers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-task" className="block text-xs text-gray-600 mb-1">Task</label>
              <select
                id="manual-task"
                aria-label="Task"
                value={manualTaskId}
                onChange={e => setManualTaskId(e.target.value)}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                <option value="">Select task…</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.taskType}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-role" className="block text-xs text-gray-600 mb-1">Role</label>
              <select
                id="manual-role"
                aria-label="Role"
                value={manualRole}
                onChange={e => setManualRole(e.target.value as SoldierRole)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                {ASSIGNMENT_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Assign
            </button>
          </form>
        )}
      </div>

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
