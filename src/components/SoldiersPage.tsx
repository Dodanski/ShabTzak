import React, { useState } from 'react'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput, SoldierRole, SoldierStatus, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'
import { formatDisplayDate, parseDisplayDateInput } from '../utils/dateUtils'

interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onUpdateStatus: (soldierId: string, status: SoldierStatus, reason?: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
  onUpdateSoldier?: (input: UpdateSoldierInput) => void
  onAdjustFairness?: (soldierId: string, delta: number, reason: string) => void
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
  roles?: string[]
}

const EMPTY_FORM: CreateSoldierInput = {
  id: '',
  firstName: '',
  lastName: '',
  role: '',
  serviceStart: '',
  serviceEnd: '',
}

export default function SoldiersPage({ soldiers, loading, onUpdateStatus, onAddSoldier, onUpdateSoldier, onAdjustFairness, configData, leaveAssignments = [], roles = [] }: SoldiersPageProps) {
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
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    newId: '', firstName: '', lastName: '', role: '' as SoldierRole,
    serviceStart: '', serviceEnd: '', hoursWorked: '',
  })

  const startISO = parseDisplayDateInput(form.serviceStart)
  const endISO = parseDisplayDateInput(form.serviceEnd)
  const endBeforeStart = startISO && endISO && endISO <= startISO

  const editStartISO = parseDisplayDateInput(editForm.serviceStart)
  const editEndISO = parseDisplayDateInput(editForm.serviceEnd)
  const editEndBeforeStart = editStartISO && editEndISO && editEndISO <= editStartISO
  const editDatesInvalid = !editStartISO || !editEndISO

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

  function handleEditOpen(s: Soldier) {
    setEditingFor(s.id)
    setEditForm({
      newId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      serviceStart: formatDisplayDate(s.serviceStart),
      serviceEnd: formatDisplayDate(s.serviceEnd),
      hoursWorked: String(s.hoursWorked),
    })
  }

  function handleEditSave(originalId: string) {
    if (editEndBeforeStart) return
    const startISO = parseDisplayDateInput(editForm.serviceStart)
    const endISO = parseDisplayDateInput(editForm.serviceEnd)
    if (!startISO || !endISO) return
    onUpdateSoldier?.({
      id: originalId,
      ...(editForm.newId !== originalId && { newId: editForm.newId }),
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      role: editForm.role,
      serviceStart: startISO,
      serviceEnd: endISO,
      hoursWorked: Math.max(0, parseInt(editForm.hoursWorked) || 0),
    })
    setEditingFor(null)
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
      const fullNameStr = `${s.firstName} ${s.lastName}`.toLowerCase()
      const nameMatch = nameFilter === '' || fullNameStr.includes(nameFilter.toLowerCase())
      const roleMatch = roleFilter === '' || s.role === roleFilter
      const statusMatch = statusFilter === '' || s.status === statusFilter
      return nameMatch && roleMatch && statusMatch
    })
    .sort((a, b) => {
      if (!sortKey) return 0
      let cmp = 0
      if (sortKey === 'name') {
        const aName = `${a.firstName} ${a.lastName}`
        const bName = `${b.firstName} ${b.lastName}`
        cmp = aName.localeCompare(bName)
      }
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
          onClick={() => { setForm(f => ({ ...f, role: roles[0] ?? '' })); setShowForm(s => !s) }}
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
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
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
              placeholder="First Name"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <input
              placeholder="Last Name"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
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
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
            <thead className="bg-olive-700 text-white">
              <tr>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2">Active</th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">ID</th>
                <th
                  className="text-left px-2 sm:px-4 py-1 sm:py-2 cursor-pointer select-none hover:bg-olive-600 text-xs sm:text-sm"
                  onClick={() => handleSortClick('name')}
                >
                  Name{sortKey === 'name' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">First Name</th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">Last Name</th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">Role</th>
                <th
                  className="text-left px-2 sm:px-4 py-1 sm:py-2 cursor-pointer select-none hover:bg-olive-600 text-xs sm:text-sm"
                  onClick={() => handleSortClick('fairness')}
                >
                  Fairness{sortKey === 'fairness' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">Hours</th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">Start</th>
                <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">End</th>
                {configData && <th className="text-left px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">Quota</th>}
                <th className="px-2 sm:px-4 py-1 sm:py-2" />
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
                    <td className="px-4 py-2">{`${s.firstName} ${s.lastName}`}</td>
                    <td className="px-4 py-2">{s.firstName}</td>
                    <td className="px-4 py-2">{s.lastName}</td>
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
                      {onUpdateSoldier && (
                        <button
                          onClick={() => editingFor === s.id ? setEditingFor(null) : handleEditOpen(s)}
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

                  {editingFor === s.id && (
                    <tr className="bg-olive-50 border-t">
                      <td colSpan={configData ? 12 : 11} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Army ID</label>
                            <input
                              type="text"
                              value={editForm.newId}
                              onChange={e => setEditForm(f => ({ ...f, newId: e.target.value }))}
                              className="w-full border rounded px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">First Name</label>
                            <input
                              type="text"
                              value={editForm.firstName}
                              onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Last Name</label>
                            <input
                              type="text"
                              value={editForm.lastName}
                              onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Role</label>
                            <select
                              value={editForm.role}
                              onChange={e => setEditForm(f => ({ ...f, role: e.target.value as SoldierRole }))}
                              className="w-full border rounded px-2 py-1 text-xs"
                              aria-label="Role"
                            >
                              {roles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Service start (dd/mm/yy)</label>
                            <input
                              type="text"
                              placeholder="dd/mm/yy"
                              value={editForm.serviceStart}
                              onChange={e => setEditForm(f => ({ ...f, serviceStart: e.target.value }))}
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Service end (dd/mm/yy)</label>
                            <input
                              type="text"
                              placeholder="dd/mm/yy"
                              value={editForm.serviceEnd}
                              onChange={e => setEditForm(f => ({ ...f, serviceEnd: e.target.value }))}
                              className={`w-full border rounded px-2 py-1 text-xs ${editEndBeforeStart ? 'border-red-400' : ''}`}
                            />
                            {editEndBeforeStart && <p className="text-xs text-red-600 mt-1">End must be after start</p>}
                          </div>
                          <div>
                            <label className="block text-xs text-olive-600 mb-1">Hours worked</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.hoursWorked}
                              onChange={e => setEditForm(f => ({ ...f, hoursWorked: e.target.value }))}
                              className="w-full border rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEditSave(s.id)}
                            disabled={!!editEndBeforeStart || editDatesInvalid}
                            className="px-2 py-1 text-xs bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingFor(null)}
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
                      <td colSpan={configData ? 12 : 11} className="px-4 py-2">
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
                      <td colSpan={configData ? 12 : 11} className="px-4 py-2">
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
        </div>
      )}
    </div>
  )
}
