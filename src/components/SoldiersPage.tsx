import React, { useState } from 'react'
import { ROLES } from '../constants'
import type { Soldier, CreateSoldierInput, SoldierRole, SoldierStatus, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'
import { formatDisplayDate, parseDisplayDateInput } from '../utils/dateUtils'

interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onUpdateStatus: (soldierId: string, status: SoldierStatus, reason?: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
  onEditId?: (soldierId: string, newId: string) => void
  onAdjustFairness?: (soldierId: string, delta: number, reason: string) => void
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
}

const EMPTY_FORM: CreateSoldierInput = {
  id: '',
  name: '',
  role: 'Driver',
  serviceStart: '',
  serviceEnd: '',
}

export default function SoldiersPage({ soldiers, loading, onUpdateStatus, onAddSoldier, onEditId, onAdjustFairness, configData, leaveAssignments = [] }: SoldiersPageProps) {
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
  const [pendingInactiveId, setPendingInactiveId] = useState<string | null>(null)
  const [pendingReason, setPendingReason] = useState('')
  const [editingIdFor, setEditingIdFor] = useState<string | null>(null)
  const [editIdValue, setEditIdValue] = useState('')

  const startISO = parseDisplayDateInput(form.serviceStart)
  const endISO = parseDisplayDateInput(form.serviceEnd)
  const endBeforeStart = startISO && endISO && endISO <= startISO

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (endBeforeStart) return
    if (!startISO || !endISO) return
    onAddSoldier({ ...form, serviceStart: startISO, serviceEnd: endISO })
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

  function handleCheckboxChange(soldier: Soldier) {
    if (soldier.status === 'Active') {
      setPendingInactiveId(soldier.id)
      setPendingReason('')
    } else {
      onUpdateStatus(soldier.id, 'Active', undefined)
    }
  }

  function handleEditIdOpen(soldier: Soldier) {
    setEditingIdFor(soldier.id)
    setEditIdValue(soldier.id)
  }

  function handleEditIdSave(oldId: string) {
    if (editIdValue.trim() && editIdValue.trim() !== oldId) {
      onEditId?.(oldId, editIdValue.trim())
    }
    setEditingIdFor(null)
    setEditIdValue('')
  }

  function handleConfirmInactive(soldierId: string) {
    onUpdateStatus(soldierId, 'Inactive', pendingReason || undefined)
    setPendingInactiveId(null)
    setPendingReason('')
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
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-olive-200 shadow-sm p-4 space-y-3">
          <div>
            <input
              placeholder="Army ID"
              value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
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
              type="text"
              placeholder="dd/mm/yy"
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
              type="text"
              placeholder="dd/mm/yy"
              value={form.serviceEnd}
              onChange={e => setForm(f => ({ ...f, serviceEnd: e.target.value }))}
              required
              className={`w-full border rounded px-3 py-1.5 text-sm ${endBeforeStart ? 'border-red-400' : ''}`}
            />
            {endBeforeStart && (
              <p className="text-xs text-red-600 mt-1">End date must be after start date</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!!endBeforeStart}
              className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <th className="text-left px-4 py-2">Active</th>
                <th className="text-left px-4 py-2">ID</th>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-600"
                  onClick={() => handleSortClick('name')}
                >
                  Name{sortKey === 'name' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Role</th>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-600"
                  onClick={() => handleSortClick('fairness')}
                >
                  Fairness{sortKey === 'fairness' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Hours</th>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">End</th>
                {configData && <th className="text-left px-4 py-2">Quota</th>}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredSoldiers.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="border-t">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label="active status"
                        checked={s.status === 'Active'}
                        onChange={() => handleCheckboxChange(s)}
                        className="cursor-pointer"
                      />
                      {s.status === 'Inactive' && s.inactiveReason && (
                        <span className="ml-2 text-xs text-gray-500">{s.inactiveReason}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-olive-500 font-mono">{s.id}</td>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-olive-500">{s.role}</td>
                    <td className="px-4 py-2">
                      <FairnessBar score={s.currentFairness} average={avgFairness} />
                    </td>
                    <td className="px-4 py-2 text-olive-500 text-xs">{s.hoursWorked}h</td>
                    <td className="px-4 py-2 text-olive-500 text-xs">{formatDisplayDate(s.serviceStart)}</td>
                    <td className="px-4 py-2 text-olive-500 text-xs">{formatDisplayDate(s.serviceEnd)}</td>
                    {configData && (
                      <td className="px-4 py-2 text-olive-500 text-xs">
                        <span>{calculateLeaveEntitlement(s, configData)}</span>
                        {' '}<span className="text-gray-400">{countUsedLeaveDays(s.id, leaveAssignments)} used</span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right space-x-2">
                      {onEditId && (
                        <button
                          onClick={() => editingIdFor === s.id ? setEditingIdFor(null) : handleEditIdOpen(s)}
                          className="text-xs text-olive-700 hover:text-olive-800"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => setAdjustingId(id => id === s.id ? null : s.id)}
                        className="text-xs text-olive-700 hover:text-olive-800"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>

                  {editingIdFor === s.id && (
                    <tr className="bg-olive-50 border-t">
                      <td colSpan={configData ? 10 : 9} className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-olive-600">ID</label>
                          <input
                            type="text"
                            value={editIdValue}
                            onChange={e => setEditIdValue(e.target.value)}
                            className="w-32 border rounded px-2 py-1 text-xs font-mono"
                            placeholder="Army ID"
                          />
                          <button
                            onClick={() => handleEditIdSave(s.id)}
                            disabled={!editIdValue.trim()}
                            className="px-2 py-1 text-xs bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingIdFor(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {pendingInactiveId === s.id && (
                    <tr className="bg-red-50 border-t">
                      <td colSpan={configData ? 10 : 9} className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-red-700">Reason for deactivation:</span>
                          <input
                            type="text"
                            value={pendingReason}
                            onChange={e => setPendingReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 border rounded px-2 py-1 text-xs min-w-[120px]"
                          />
                          <button
                            onClick={() => handleConfirmInactive(s.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setPendingInactiveId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {adjustingId === s.id && (
                    <tr className="bg-olive-50 border-t">
                      <td colSpan={configData ? 10 : 9} className="px-4 py-2">
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
