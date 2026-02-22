import React, { useState } from 'react'
import { ROLES } from '../constants'
import type { Soldier, CreateSoldierInput, SoldierRole } from '../models'

interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onDischarge: (soldierId: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
}

const EMPTY_FORM: CreateSoldierInput = {
  name: '',
  role: 'Driver',
  serviceStart: '',
  serviceEnd: '',
}

export default function SoldiersPage({ soldiers, loading, onDischarge, onAddSoldier }: SoldiersPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateSoldierInput>(EMPTY_FORM)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAddSoldier(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading soldiers…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Soldiers</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Soldier
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <input
              placeholder="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as SoldierRole }))}
              className="w-full border rounded px-3 py-1.5 text-sm"
              aria-label="Role"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor="svc-start">Service start</label>
            <input
              id="svc-start"
              type="date"
              value={form.serviceStart}
              onChange={e => setForm(f => ({ ...f, serviceStart: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1" htmlFor="svc-end">Service end</label>
            <input
              id="svc-end"
              type="date"
              value={form.serviceEnd}
              onChange={e => setForm(f => ({ ...f, serviceEnd: e.target.value }))}
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

      {soldiers.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">No soldiers found.</p>
      )}

      {soldiers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {soldiers.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-gray-500">{s.role}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'Active' ? 'bg-green-100 text-green-700' :
                      s.status === 'Injured' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.status === 'Active' && (
                      <button
                        onClick={() => onDischarge(s.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Discharge
                      </button>
                    )}
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
