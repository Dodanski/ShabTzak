import { useState } from 'react'
import type { Task, CreateTaskInput, UpdateTaskInput, RoleRequirement } from '../models'

interface TaskFormState {
  taskType: string
  isPillbox: boolean
  pillboxDate: string
  startTime: string
  durationHours: number
  roleRequirements: RoleRequirement[]
  pendingRole: string
  pendingCount: number
  recurrence: 'daily' | 'pillbox' | 'none'
  recurrenceEndDate: string
}

const EMPTY_FORM: TaskFormState = {
  taskType: '',
  isPillbox: false,
  pillboxDate: '',
  startTime: '',
  durationHours: 1,
  roleRequirements: [],
  pendingRole: 'Any',
  pendingCount: 1,
  recurrence: 'daily',
  recurrenceEndDate: '',
}

interface TasksPageProps {
  tasks: Task[]
  roles?: string[]
  onAddTask?: (input: CreateTaskInput) => void
  onUpdateTask?: (input: UpdateTaskInput) => void
  loading?: boolean
}

function getDisplayTime(startTime: string): string {
  if (startTime.includes('T')) {
    return startTime.split('T')[1].slice(0, 5)
  }
  return startTime.slice(0, 5)
}

function taskToFormState(task: Task): TaskFormState {
  const isPillbox = task.isSpecial ?? false
  const startTime = task.startTime.includes('T')
    ? task.startTime.split('T')[1].slice(0, 5)
    : task.startTime.slice(0, 5)
  const pillboxDate = isPillbox && task.startTime.includes('T')
    ? task.startTime.split('T')[0]
    : ''
  return {
    taskType: task.taskType,
    isPillbox,
    pillboxDate,
    startTime,
    durationHours: task.durationHours,
    roleRequirements: task.roleRequirements,
    pendingRole: 'Any',
    pendingCount: 1,
    recurrence: (task.recurrence as 'daily' | 'pillbox' | 'none') ?? 'daily',
    recurrenceEndDate: task.recurrenceEndDate ?? '',
  }
}

export default function TasksPage({ tasks, roles = [], onAddTask, onUpdateTask, loading }: TasksPageProps) {
  const formRoles: string[] = [...roles, 'Any']
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState<TaskFormState>(EMPTY_FORM)
  const [typeFilter, setTypeFilter] = useState('')

  function handleAddRole(isEdit: boolean) {
    if (isEdit) {
      const count = editForm.pendingCount
      if (count < 1) return
      const exists = editForm.roleRequirements.findIndex(r => r.role === editForm.pendingRole)
      if (exists >= 0) {
        setEditForm(f => ({ ...f, roleRequirements: f.roleRequirements.map((r, i) => i === exists ? { ...r, count: r.count + count } : r) }))
      } else {
        setEditForm(f => ({ ...f, roleRequirements: [...f.roleRequirements, { role: f.pendingRole, count }] }))
      }
    } else {
      const count = form.pendingCount
      if (count < 1) return
      const exists = form.roleRequirements.findIndex(r => r.role === form.pendingRole)
      if (exists >= 0) {
        setForm(f => ({ ...f, roleRequirements: f.roleRequirements.map((r, i) => i === exists ? { ...r, count: r.count + count } : r) }))
      } else {
        setForm(f => ({ ...f, roleRequirements: [...f.roleRequirements, { role: f.pendingRole, count }] }))
      }
    }
  }

  function handleRemoveRole(index: number, isEdit: boolean) {
    if (isEdit) {
      setEditForm(f => ({ ...f, roleRequirements: f.roleRequirements.filter((_, i) => i !== index) }))
    } else {
      setForm(f => ({ ...f, roleRequirements: f.roleRequirements.filter((_, i) => i !== index) }))
    }
  }

  function buildInput(f: TaskFormState): CreateTaskInput {
    const n = f.durationHours
    if (f.isPillbox) {
      const combinedStart = `${f.pillboxDate}T${f.startTime}`
      const startMs = new Date(combinedStart).getTime()
      const endMs = startMs + n * 60 * 60 * 1000
      const endTime = new Date(endMs).toISOString().replace('.000Z', '')
      return {
        taskType: f.taskType,
        startTime: combinedStart,
        endTime,
        durationHours: n,
        roleRequirements: f.roleRequirements,
        isSpecial: true,
        specialDurationDays: Math.ceil(n / 24),
        recurrence: f.recurrence !== 'none' ? f.recurrence : undefined,
        recurrenceEndDate: f.recurrenceEndDate || undefined,
      }
    }

    // For regular tasks: combine today's date with the time
    const today = new Date().toISOString().split('T')[0]
    const combinedStart = `${today}T${f.startTime}:00`
    const startMs = new Date(combinedStart).getTime()
    const endMs = startMs + n * 60 * 60 * 1000
    const endTime = new Date(endMs).toISOString().split('T')[0] + 'T' + new Date(endMs).toISOString().split('T')[1].slice(0, 5) + ':00'

    return {
      taskType: f.taskType,
      startTime: combinedStart,
      endTime,
      durationHours: n,
      roleRequirements: f.roleRequirements,
      isSpecial: false,
      recurrence: f.recurrence !== 'none' ? f.recurrence : undefined,
      recurrenceEndDate: f.recurrenceEndDate || undefined,
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAddTask?.(buildInput(form))
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTask) return
    const input: UpdateTaskInput = { id: editingTask.id, ...buildInput(editForm) }
    onUpdateTask?.(input)
    setEditingTask(null)
  }

  function handleStartEdit(task: Task) {
    setEditingTask(task)
    setEditForm(taskToFormState(task))
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading tasks…</div>
  }

  const filteredTasks = typeFilter
    ? tasks.filter(t => t.taskType.toLowerCase().includes(typeFilter.toLowerCase()))
    : tasks

  function renderRoleFields(f: TaskFormState, setF: React.Dispatch<React.SetStateAction<TaskFormState>>, isEdit: boolean) {
    return (
      <div>
        <label className="block text-xs text-olive-600 mb-1">Role requirements</label>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            aria-label="Role"
            value={f.pendingRole}
            onChange={e => setF(prev => ({ ...prev, pendingRole: e.target.value }))}
            className="border rounded px-2 py-1.5 text-sm"
          >
            {formRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            aria-label="Role count"
            type="number"
            min="1"
            value={f.pendingCount}
            onChange={e => setF(prev => ({ ...prev, pendingCount: Number(e.target.value) }))}
            className="border rounded px-2 py-1.5 text-sm w-16"
          />
          <button
            type="button"
            onClick={() => handleAddRole(isEdit)}
            className="px-3 py-1.5 text-sm bg-olive-100 hover:bg-gray-200 rounded"
          >
            Add role
          </button>
        </div>
        {f.roleRequirements.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {f.roleRequirements.map((r, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-olive-50 text-olive-700 text-xs rounded">
                {r.role} ×{r.count}
                <button
                  type="button"
                  onClick={() => handleRemoveRole(i, isEdit)}
                  className="ml-1 text-olive-600 hover:text-olive-700"
                  aria-label={`Remove ${r.role}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderForm(
    f: TaskFormState,
    setF: React.Dispatch<React.SetStateAction<TaskFormState>>,
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void,
    isEdit: boolean,
  ) {
    return (
      <form onSubmit={onSubmit} className="bg-white rounded-lg border border-olive-200 shadow-sm p-4 space-y-3">
        <div>
          <label htmlFor={isEdit ? 'edit-task-type' : 'task-type'} className="block text-xs text-olive-600 mb-1">Description</label>
          <input
            id={isEdit ? 'edit-task-type' : 'task-type'}
            aria-label="Task type"
            value={f.taskType}
            onChange={e => setF(prev => ({ ...prev, taskType: e.target.value }))}
            required
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id={isEdit ? 'edit-task-is-pillbox' : 'task-is-pillbox'}
            type="checkbox"
            checked={f.isPillbox}
            onChange={e => setF(prev => ({ ...prev, isPillbox: e.target.checked, pillboxDate: '' }))}
            className="rounded"
          />
          <label htmlFor={isEdit ? 'edit-task-is-pillbox' : 'task-is-pillbox'} className="text-sm text-olive-700">Is Pillbox</label>
        </div>

        {f.isPillbox && (
          <div>
            <label htmlFor={isEdit ? 'edit-task-pillbox-date' : 'task-pillbox-date'} className="block text-xs text-olive-600 mb-1">Date</label>
            <input
              id={isEdit ? 'edit-task-pillbox-date' : 'task-pillbox-date'}
              type="date"
              value={f.pillboxDate}
              onChange={e => setF(prev => ({ ...prev, pillboxDate: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        )}

        <div>
          <label htmlFor={isEdit ? 'edit-task-start' : 'task-start'} className="block text-xs text-olive-600 mb-1">Start time</label>
          <input
            id={isEdit ? 'edit-task-start' : 'task-start'}
            aria-label="Start time"
            type="time"
            value={f.startTime}
            onChange={e => setF(prev => ({ ...prev, startTime: e.target.value }))}
            required
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={isEdit ? 'edit-task-duration' : 'task-duration'} className="block text-xs text-olive-600 mb-1">Duration (hours)</label>
          <input
            id={isEdit ? 'edit-task-duration' : 'task-duration'}
            aria-label="Duration hours"
            type="number"
            min="1"
            value={f.durationHours}
            onChange={e => setF(prev => ({ ...prev, durationHours: Number(e.target.value) }))}
            required
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor={isEdit ? 'edit-task-recurrence' : 'task-recurrence'} className="block text-xs text-olive-600 mb-1">Recurrence</label>
          <select
            id={isEdit ? 'edit-task-recurrence' : 'task-recurrence'}
            aria-label="Task recurrence"
            value={f.recurrence}
            onChange={e => setF(prev => ({ ...prev, recurrence: e.target.value as 'daily' | 'pillbox' | 'none' }))}
            className="w-full border rounded px-3 py-1.5 text-sm"
          >
            <option value="daily">Daily (repeat every day)</option>
            <option value="pillbox">Pillbox (multi-day, recur sequentially)</option>
            <option value="none">One-time (no recurrence)</option>
          </select>
        </div>

        {(f.recurrence === 'daily' || f.recurrence === 'pillbox') && (
          <div>
            <label htmlFor={isEdit ? 'edit-task-recurrence-end' : 'task-recurrence-end'} className="block text-xs text-olive-600 mb-1">
              Recurrence end date (leave blank to use schedule end)
            </label>
            <input
              id={isEdit ? 'edit-task-recurrence-end' : 'task-recurrence-end'}
              aria-label="Recurrence end date"
              type="date"
              value={f.recurrenceEndDate}
              onChange={e => setF(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        )}

        {renderRoleFields(f, setF, isEdit)}

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
          >
            {isEdit ? 'Save' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-olive-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-olive-800">Tasks</h2>
        {onAddTask && (
          <button
            onClick={() => { setShowForm(s => !s); setEditingTask(null) }}
            className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
          >
            Add Task
          </button>
        )}
      </div>

      <input
        placeholder="Filter by type"
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
        className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
      />

      {onAddTask && showForm && renderForm(form, setForm, handleSubmit, () => setShowForm(false), false)}

      {editingTask && onUpdateTask && renderForm(editForm, setEditForm, handleEditSubmit, () => setEditingTask(null), true)}

      {tasks.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">No tasks found.</p>
      )}

      {tasks.length > 0 && (
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-olive-700 text-white">
              <tr>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">Duration</th>
                <th className="text-left px-4 py-2">Roles</th>
                {onUpdateTask && <th className="text-left px-4 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.taskType}</td>
                  <td className="px-4 py-2 text-olive-500 text-xs">{getDisplayTime(t.startTime)}</td>
                  <td className="px-4 py-2 text-olive-500">{t.durationHours}h</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.roleRequirements.map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-olive-50 text-olive-700 text-xs rounded">
                          {r.role} ×{r.count}
                        </span>
                      ))}
                    </div>
                  </td>
                  {onUpdateTask && (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleStartEdit(t)}
                        className="text-xs px-2 py-1 bg-olive-100 text-olive-700 rounded hover:bg-olive-200"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
