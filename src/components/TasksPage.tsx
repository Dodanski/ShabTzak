import { useState } from 'react'
import type { Task, CreateTaskInput, RoleRequirement } from '../models'
import type { SoldierRole } from '../constants'

const FORM_ROLES: Array<SoldierRole | 'Any'> = [
  'Driver',
  'Radio Operator',
  'Medic',
  'Squad Leader',
  'Operations Room',
  'Weapons Specialist',
  'Any',
]

interface TaskFormState {
  taskType: string
  isPillbox: boolean
  pillboxDate: string
  startTime: string
  durationHours: number
  roleRequirements: RoleRequirement[]
  pendingRole: SoldierRole | 'Any'
  pendingCount: number
}

const EMPTY_FORM: TaskFormState = {
  taskType: '',
  isPillbox: false,
  pillboxDate: '',
  startTime: '',
  durationHours: 1,
  roleRequirements: [],
  pendingRole: 'Driver',
  pendingCount: 1,
}

interface TasksPageProps {
  tasks: Task[]
  onAddTask: (input: CreateTaskInput) => void
  loading?: boolean
}

function getDisplayTime(startTime: string): string {
  if (startTime.includes('T')) {
    return startTime.split('T')[1].slice(0, 5)
  }
  return startTime.slice(0, 5)
}

export default function TasksPage({ tasks, onAddTask, loading }: TasksPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)
  const [typeFilter, setTypeFilter] = useState('')

  function handleAddRole() {
    if (form.pendingCount < 1) return
    const exists = form.roleRequirements.findIndex(r => r.role === form.pendingRole)
    if (exists >= 0) {
      const updated = form.roleRequirements.map((r, i) =>
        i === exists ? { ...r, count: r.count + form.pendingCount } : r
      )
      setForm(f => ({ ...f, roleRequirements: updated }))
    } else {
      setForm(f => ({
        ...f,
        roleRequirements: [...f.roleRequirements, { role: f.pendingRole, count: f.pendingCount }],
      }))
    }
  }

  function handleRemoveRole(index: number) {
    setForm(f => ({ ...f, roleRequirements: f.roleRequirements.filter((_, i) => i !== index) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = form.durationHours
    let input: CreateTaskInput
    if (form.isPillbox) {
      const combinedStart = `${form.pillboxDate}T${form.startTime}`
      const startMs = new Date(combinedStart).getTime()
      const endMs = startMs + n * 60 * 60 * 1000
      const endTime = new Date(endMs).toISOString().replace('.000Z', '')
      input = {
        taskType: form.taskType,
        startTime: combinedStart,
        endTime,
        durationHours: n,
        roleRequirements: form.roleRequirements,
        isSpecial: true,
        specialDurationDays: Math.ceil(n / 24),
      }
    } else {
      input = {
        taskType: form.taskType,
        startTime: form.startTime,
        endTime: '',
        durationHours: n,
        roleRequirements: form.roleRequirements,
        isSpecial: false,
      }
    }
    onAddTask(input)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading tasks…</div>
  }

  const filteredTasks = typeFilter
    ? tasks.filter(t => t.taskType.toLowerCase().includes(typeFilter.toLowerCase()))
    : tasks

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Tasks</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      <input
        placeholder="Filter by type"
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
        className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <label htmlFor="task-type" className="block text-xs text-gray-600 mb-1">Description</label>
            <input
              id="task-type"
              aria-label="Task type"
              value={form.taskType}
              onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="task-is-pillbox"
              type="checkbox"
              checked={form.isPillbox}
              onChange={e => setForm(f => ({ ...f, isPillbox: e.target.checked, pillboxDate: '' }))}
              className="rounded"
            />
            <label htmlFor="task-is-pillbox" className="text-sm text-gray-700">Is Pillbox</label>
          </div>

          {form.isPillbox && (
            <div>
              <label htmlFor="task-pillbox-date" className="block text-xs text-gray-600 mb-1">Date</label>
              <input
                id="task-pillbox-date"
                type="date"
                value={form.pillboxDate}
                onChange={e => setForm(f => ({ ...f, pillboxDate: e.target.value }))}
                required
                className="w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="task-start" className="block text-xs text-gray-600 mb-1">Start time</label>
            <input
              id="task-start"
              aria-label="Start time"
              type="time"
              value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="task-duration" className="block text-xs text-gray-600 mb-1">Duration (hours)</label>
            <input
              id="task-duration"
              aria-label="Duration hours"
              type="number"
              min="1"
              value={form.durationHours}
              onChange={e => setForm(f => ({ ...f, durationHours: Number(e.target.value) }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Role requirements</label>
            <div className="flex gap-2 items-center flex-wrap">
              <select
                aria-label="Role"
                value={form.pendingRole}
                onChange={e => setForm(f => ({ ...f, pendingRole: e.target.value as SoldierRole | 'Any' }))}
                className="border rounded px-2 py-1.5 text-sm"
              >
                {FORM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input
                aria-label="Role count"
                type="number"
                min="1"
                value={form.pendingCount}
                onChange={e => setForm(f => ({ ...f, pendingCount: Number(e.target.value) }))}
                className="border rounded px-2 py-1.5 text-sm w-16"
              />
              <button
                type="button"
                onClick={handleAddRole}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                Add role
              </button>
            </div>
            {form.roleRequirements.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.roleRequirements.map((r, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                    {r.role} ×{r.count}
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(i)}
                      className="ml-1 text-blue-400 hover:text-blue-700"
                      aria-label={`Remove ${r.role}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {tasks.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">No tasks found.</p>
      )}

      {tasks.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Roles</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.taskType}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{getDisplayTime(t.startTime)}</td>
                  <td className="px-4 py-2 text-gray-500">{t.durationHours}h</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.roleRequirements.map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                          {r.role} ×{r.count}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
