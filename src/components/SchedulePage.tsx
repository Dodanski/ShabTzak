import { useState, useEffect } from 'react'
import ScheduleCalendar from './ScheduleCalendar'
import TaskModeCalendar from './TaskModeCalendar'
import { formatScheduleAsText, exportToPdf, exportToCsv, downloadCsv } from '../utils/exportUtils'
import { fullName } from '../utils/helpers'
import type { Soldier, Task, TaskAssignment, LeaveAssignment, ScheduleConflict } from '../models'

interface SchedulePageProps {
  soldiers: Soldier[]
  dates: string[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  conflicts: ScheduleConflict[]
  roles: string[]
  onGenerate: () => void
  onManualAssign: (soldierId: string, taskId: string, role: string) => void
  onReload?: () => void
  progress?: { completed: number; total: number } | null
}

export default function SchedulePage({
  soldiers, dates, tasks, taskAssignments, leaveAssignments, conflicts, roles, onGenerate, onManualAssign, onReload, progress,
}: SchedulePageProps) {
  const assignmentRoles: string[] = [...roles, 'Any']
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualSoldierId, setManualSoldierId] = useState('')
  const [manualTaskId, setManualTaskId] = useState('')
  const [manualRole, setManualRole] = useState<string>(roles[0] ?? '')
  const [mode, setMode] = useState<'soldier' | 'task'>('soldier')
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    return monday.toISOString().split('T')[0]
  })
  const [lastReloadProgress, setLastReloadProgress] = useState(0)

  // Auto-reload data every 14 days worth of assignments to avoid frequent refreshes
  useEffect(() => {
    if (!progress || !onReload) return

    const assignmentsPerTwoWeeks = 42 // Reload every 2 weeks of assignments
    const currentMilestone = Math.floor(progress.completed / assignmentsPerTwoWeeks)
    const previousMilestone = Math.floor(lastReloadProgress / assignmentsPerTwoWeeks)

    if (currentMilestone > previousMilestone) {
      // New 14-day milestone reached, reload data
      onReload()
      setLastReloadProgress(progress.completed)
    }
  }, [progress, onReload, lastReloadProgress])

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
    setManualRole(roles[0] ?? '')
  }

  function goToPreviousWeek() {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() - 7)
    setWeekStartDate(d.toISOString().split('T')[0])
  }

  function goToNextWeek() {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + 7)
    setWeekStartDate(d.toISOString().split('T')[0])
  }

  function goToToday() {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    setWeekStartDate(monday.toISOString().split('T')[0])
  }

  function handleWeekPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const date = new Date(e.target.value)
    const dayOfWeek = date.getDay()
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(date.setDate(diff))
    setWeekStartDate(monday.toISOString().split('T')[0])
  }

  return (
    <div className="space-y-3 sm:space-y-6 h-full flex flex-col">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <h2 className="text-lg sm:text-xl font-semibold text-olive-800 mr-auto">Schedule</h2>

        {mode === 'task' && (
          <>
            <button
              onClick={goToPreviousWeek}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Week
            </button>
            <input
              type="date"
              value={weekStartDate}
              onChange={handleWeekPickerChange}
              className="px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg"
            />
            <button
              onClick={goToNextWeek}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Week →
            </button>
            <button
              onClick={goToToday}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Today
            </button>
          </>
        )}

        <button
          onClick={handleCopyWhatsApp}
          className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleExportCsv}
          className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          CSV
        </button>
        <button
          onClick={exportToPdf}
          className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Print
        </button>
        <button
          onClick={() => setMode(mode === 'soldier' ? 'task' : 'soldier')}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg font-medium ${
            mode === 'soldier'
              ? 'bg-olive-100 text-olive-700 border border-olive-300'
              : 'bg-blue-100 text-blue-700 border border-blue-300'
          }`}
        >
          {mode === 'soldier' ? 'Task' : 'Soldier'} Mode
        </button>
        <button
          onClick={onGenerate}
          className="px-3 sm:px-4 py-1 sm:py-2 bg-olive-700 text-white text-xs sm:text-sm rounded-lg hover:bg-olive-800"
        >
          Generate
        </button>
        {!progress && (
          <button
            onClick={onReload}
            className="px-3 sm:px-4 py-1 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700"
            title="Refresh schedule data"
          >
            Reload
          </button>
        )}
      </div>

      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-800">Generating Schedule...</h3>
            <span className="text-sm text-blue-600">{progress.completed} / {progress.total} assignments</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 mt-2">Data will update as it's processed. This may take a few minutes...</p>
        </div>
      )}

      {mode === 'soldier' ? (
        <ScheduleCalendar
          soldiers={soldiers}
          dates={dates}
          tasks={tasks}
          taskAssignments={taskAssignments}
          leaveAssignments={leaveAssignments}
        />
      ) : (
        <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <TaskModeCalendar
            soldiers={soldiers}
            tasks={tasks}
            taskAssignments={taskAssignments}
            weekStart={weekStartDate}
          />
        </div>
      )}

      {mode === 'soldier' && (
        <div>
          <button
            onClick={() => setShowManual(s => !s)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Add manual assignment
          </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="mt-3 bg-white rounded-lg border border-olive-200 shadow-sm p-4 space-y-3">
            <div>
              <label htmlFor="manual-soldier" className="block text-xs text-olive-600 mb-1">Soldier</label>
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
                  <option key={s.id} value={s.id}>{fullName(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="manual-task" className="block text-xs text-olive-600 mb-1">Task</label>
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
              <label htmlFor="manual-role" className="block text-xs text-olive-600 mb-1">Role</label>
              <select
                id="manual-role"
                aria-label="Role"
                value={manualRole}
                onChange={e => setManualRole(e.target.value)}
                className="w-full border rounded px-3 py-1.5 text-sm"
              >
                {assignmentRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
            >
              Assign
            </button>
          </form>
        )}
        </div>
      )}

      {mode === 'soldier' && (
        <div>
          <h3 className="text-sm font-semibold text-olive-700 mb-2">Conflicts</h3>
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
      )}
    </div>
  )
}
