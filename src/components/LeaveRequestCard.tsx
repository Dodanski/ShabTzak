import type { Soldier, LeaveRequest } from '../models'
import { formatDisplayDate } from '../utils/dateUtils'
import { fullName } from '../utils/helpers'

interface LeaveRequestCardProps {
  request: LeaveRequest
  soldier?: Soldier
  onApprove?: () => void
  onDeny?: () => void
}

const STATUS_CLASSES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Denied: 'bg-red-100 text-red-600',
}

export default function LeaveRequestCard({ request: req, soldier, onApprove, onDeny }: LeaveRequestCardProps) {
  return (
    <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-3">
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-olive-800">
          {soldier ? fullName(soldier) : req.soldierId}
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[req.status] ?? ''}`}>
          {req.status}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1 text-sm text-olive-600">
        <div className="flex justify-between">
          <span className="text-olive-400">Dates</span>
          <span>{formatDisplayDate(req.startDate)} - {formatDisplayDate(req.endDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-olive-400">Type</span>
          <span>{req.leaveType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-olive-400">Priority</span>
          <span>{req.priority}</span>
        </div>
      </div>

      {/* Actions */}
      {req.status === 'Pending' && (onApprove || onDeny) && (
        <div className="mt-3 pt-2 border-t border-olive-100 flex gap-2">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Approve
            </button>
          )}
          {onDeny && (
            <button
              onClick={() => {
                if (window.confirm('Deny this leave request?')) onDeny()
              }}
              className="flex-1 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Deny
            </button>
          )}
        </div>
      )}
    </div>
  )
}
