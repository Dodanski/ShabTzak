import React, { useState } from 'react'
import { CONSTRAINT_TYPES, PRIORITY_MIN, PRIORITY_MAX } from '../constants'
import type { Soldier, CreateLeaveRequestInput, ConstraintType } from '../models'

interface LeaveRequestFormProps {
  soldiers: Soldier[]
  onSubmit: (input: CreateLeaveRequestInput) => void
  onCancel?: () => void
}

export default function LeaveRequestForm({ soldiers, onSubmit, onCancel }: LeaveRequestFormProps) {
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')

  const [soldierId, setSoldierId] = useState(activeSoldiers[0]?.id ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [constraintType, setConstraintType] = useState<ConstraintType>(CONSTRAINT_TYPES[0])
  const [priority, setPriority] = useState(5)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ soldierId, startDate, endDate, constraintType, priority })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-olive-200 shadow-sm p-6 space-y-4 max-w-md">
      <h3 className="text-lg font-semibold text-olive-800">Submit Leave Request</h3>

      <div>
        <label htmlFor="leave-soldier" className="block text-sm text-olive-600 mb-1">Soldier</label>
        <select
          id="leave-soldier"
          aria-label="Soldier"
          value={soldierId}
          onChange={e => setSoldierId(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm"
          required
        >
          {activeSoldiers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="leave-start" className="block text-sm text-olive-600 mb-1">Start date</label>
        <input
          id="leave-start"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="leave-end" className="block text-sm text-olive-600 mb-1">End date</label>
        <input
          id="leave-end"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="leave-constraint" className="block text-sm text-olive-600 mb-1">Reason</label>
        <select
          id="leave-constraint"
          value={constraintType}
          onChange={e => setConstraintType(e.target.value as ConstraintType)}
          className="w-full border rounded px-3 py-1.5 text-sm"
        >
          {CONSTRAINT_TYPES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="leave-priority" className="block text-sm text-olive-600 mb-1">Priority</label>
        <input
          id="leave-priority"
          type="number"
          min={PRIORITY_MIN}
          max={PRIORITY_MAX}
          value={priority}
          onChange={e => setPriority(Number(e.target.value))}
          className="w-full border rounded px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-4 py-2 bg-olive-700 text-white text-sm rounded-lg hover:bg-olive-800"
        >
          Submit
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-olive-600 hover:text-gray-900"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
