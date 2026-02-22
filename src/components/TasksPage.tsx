import { useState } from 'react'
import type { Task, CreateTaskInput } from '../models'

interface TasksPageProps {
  tasks: Task[]
  onAddTask: (input: CreateTaskInput) => void
  loading?: boolean
}

const EMPTY_FORM: CreateTaskInput = {
  taskType: '',
  startTime: '',
  endTime: '',
  roleRequirements: [],
}

export default function TasksPage({ tasks, onAddTask, loading }: TasksPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateTaskInput>(EMPTY_FORM)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAddTask(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading tasks…</div>
  }

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

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <label htmlFor="task-type" className="block text-xs text-gray-600 mb-1">Task type</label>
            <input
              id="task-type"
              aria-label="Task type"
              value={form.taskType}
              onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="task-start" className="block text-xs text-gray-600 mb-1">Start time</label>
            <input
              id="task-start"
              aria-label="Start time"
              type="datetime-local"
              value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="task-end" className="block text-xs text-gray-600 mb-1">End time</label>
            <input
              id="task-end"
              aria-label="End time"
              type="datetime-local"
              value={form.endTime}
              onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
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
                <th className="text-left px-4 py-2">End</th>
                <th className="text-left px-4 py-2">Duration (h)</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.taskType}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{t.startTime}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{t.endTime}</td>
                  <td className="px-4 py-2 text-gray-500">{t.durationHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
