import { useState } from 'react'
import type { Soldier, LeaveRequest } from '../models'
import { formatDisplayDate } from '../utils/dateUtils'

interface LeaveRequestsPageProps {
  leaveRequests: LeaveRequest[]
  soldiers: Soldier[]
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}

const STATUS_CLASSES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Denied: 'bg-red-100 text-red-600',
}

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Denied'

export default function LeaveRequestsPage({ leaveRequests, soldiers, onApprove, onDeny }: LeaveRequestsPageProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const soldierMap = new Map(soldiers.map(s => [s.id, s]))
  const filtered = statusFilter === 'All' ? leaveRequests : leaveRequests.filter(r => r.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-800">Leave Requests</h2>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="All">All</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Denied">Denied</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-400 text-sm">No leave requests found.</p>
      )}

      {filtered.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Soldier</th>
                <th className="text-left px-4 py-2">Dates</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Priority</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => {
                const soldier = soldierMap.get(req.soldierId)
                return (
                  <tr key={req.id} className="border-t">
                    <td className="px-4 py-2">{soldier?.name ?? req.soldierId}</td>
                    <td className="px-4 py-2 text-gray-600">{formatDisplayDate(req.startDate)} – {formatDisplayDate(req.endDate)}</td>
                    <td className="px-4 py-2 text-gray-500">{req.leaveType}</td>
                    <td className="px-4 py-2 text-gray-500">{req.priority}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[req.status] ?? ''}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {req.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => onApprove(req.id)}
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Deny this leave request?')) onDeny(req.id)
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Deny
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
