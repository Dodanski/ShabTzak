import React, { useState } from 'react'
import { ROLES } from '../constants'
import type { Soldier, CreateSoldierInput, SoldierRole, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'

interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onDischarge: (soldierId: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
  onAdjustFairness?: (soldierId: string, delta: number, reason: string) => void
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
}

const EMPTY_FORM: CreateSoldierInput = {
  name: '',
  role: 'Driver',
  serviceStart: '',
  serviceEnd: '',
}

export default function SoldiersPage({ soldiers, loading, onDischarge, onAddSoldier, onAdjustFairness, configData, leaveAssignments = [] }: SoldiersPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateSoldierInput>(EMPTY_FORM)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'fairness' | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAddSoldier(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleAdjustSubmit(soldierId: string) {
    const delta = parseFloat(adjustDelta)
    if (!isNaN(delta) && adjustReason.trim()) {
      onAdjustFairness?.(soldierId, delta, adjustReason.trim())
      setAdjustingId(null)
      setAdjustDelta('')
      setAdjustReason('')
    }
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading soldiers…</div>
  }

  function handleSortClick(key: 'name' | 'fairness') {
    if (sortKey === key) {
      setSortAsc(a => !a)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const filteredSoldiers = soldiers
    .filter(s => {
      const nameMatch = nameFilter === '' || s.name.toLowerCase().includes(nameFilter.toLowerCase())
      const roleMatch = roleFilter === '' || s.role === roleFilter
      const statusMatch = statusFilter === '' || s.status === statusFilter
      return nameMatch && roleMatch && statusMatch
    })
    .sort((a, b) => {
      if (!sortKey) return 0
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      if (sortKey === 'fairness') cmp = a.currentFairness - b.currentFairness
      return sortAsc ? cmp : -cmp
    })

  const avgFairness = soldiers.length
    ? soldiers.reduce((sum, s) => sum + s.currentFairness, 0) / soldiers.length
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-olive-800">Soldiers</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
        >
          Add Soldier
        </button>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Search soldiers"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Injured">Injured</option>
          <option value="Discharged">Discharged</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-olive-200 shadow-sm p-4 space-y-3">
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
            <label className="block text-xs text-olive-600 mb-1" htmlFor="svc-start">Service start</label>
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
            <label className="block text-xs text-olive-600 mb-1" htmlFor="svc-end">Service end</label>
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
              className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-olive-600 hover:text-gray-900"
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
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-olive-700 text-white">
              <tr>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-100"
                  onClick={() => handleSortClick('name')}
                >
                  Name{sortKey === 'name' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Status</th>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-100"
                  onClick={() => handleSortClick('fairness')}
                >
                  Fairness{sortKey === 'fairness' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Hours</th>
                {configData && <th className="text-left px-4 py-2">Quota</th>}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredSoldiers.map(s => (
                <React.Fragment key={s.id}>
                <tr className="border-t">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-olive-500">{s.role}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'Active' ? 'bg-green-100 text-green-700' :
                      s.status === 'Injured' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-olive-100 text-olive-500'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <FairnessBar score={s.currentFairness} average={avgFairness} />
                  </td>
                  <td className="px-4 py-2 text-olive-500 text-xs">
                    {s.hoursWorked}h
                  </td>
                  {configData && (
                    <td className="px-4 py-2 text-olive-500 text-xs">
                      <span>{calculateLeaveEntitlement(s, configData)}</span>
                      {' '}<span className="text-gray-400">{countUsedLeaveDays(s.id, leaveAssignments)} used</span>
                    </td>
                  )}
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      onClick={() => setAdjustingId(id => id === s.id ? null : s.id)}
                      className="text-xs text-olive-700 hover:text-olive-800"
                    >
                      Adjust
                    </button>
                    {s.status === 'Active' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Discharge ${s.name}?`)) onDischarge(s.id)
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Discharge
                      </button>
                    )}
                  </td>
                </tr>
                  {adjustingId === s.id && (
                    <tr className="bg-olive-50 border-t">
                      <td colSpan={configData ? 7 : 6} className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-olive-600" htmlFor={`delta-${s.id}`}>Delta</label>
                          <input
                            id={`delta-${s.id}`}
                            type="number"
                            step="0.5"
                            value={adjustDelta}
                            onChange={e => setAdjustDelta(e.target.value)}
                            className="w-20 border rounded px-2 py-1 text-xs"
                            placeholder="e.g. 2 or -1"
                          />
                          <label className="text-xs text-olive-600" htmlFor={`reason-${s.id}`}>Reason</label>
                          <input
                            id={`reason-${s.id}`}
                            type="text"
                            value={adjustReason}
                            onChange={e => setAdjustReason(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-xs min-w-[120px]"
                            placeholder="Reason for adjustment"
                          />
                          <button
                            onClick={() => handleAdjustSubmit(s.id)}
                            className="px-2 py-1 text-xs bg-olive-700 text-white rounded hover:bg-olive-800"
                          >
                            Apply
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
