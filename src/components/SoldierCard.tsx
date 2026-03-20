import type { Soldier, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'
import { formatDisplayDate } from '../utils/dateUtils'

interface SoldierCardProps {
  soldier: Soldier
  avgFairness: number
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
  onCheckboxChange: () => void
  onEditClick?: () => void
  onAdjustClick: () => void
  isExpanded?: boolean
  expandedContent?: React.ReactNode
}

export default function SoldierCard({
  soldier: s,
  avgFairness,
  configData,
  leaveAssignments = [],
  onCheckboxChange,
  onEditClick,
  onAdjustClick,
  isExpanded,
  expandedContent,
}: SoldierCardProps) {
  const fullName = `${s.firstName} ${s.lastName}`

  return (
    <div className="bg-white rounded-lg border border-olive-200 shadow-sm overflow-hidden">
      <div className="p-3">
        {/* Header: Checkbox + Name + Status */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            aria-label="active status"
            checked={s.status === 'Active'}
            onChange={onCheckboxChange}
            className="cursor-pointer mt-1 w-5 h-5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-olive-800 truncate">{fullName}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                s.status === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {s.status}
              </span>
            </div>
            <p className="text-xs text-olive-500">{s.role}</p>
            {s.status === 'Inactive' && s.inactiveReason && (
              <p className="text-xs text-red-500 mt-0.5">{s.inactiveReason}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-olive-400 block">ID</span>
            <span className="font-mono text-olive-600">{s.id}</span>
          </div>
          <div>
            <span className="text-olive-400 block">Hours</span>
            <span className="text-olive-600">{s.hoursWorked}h</span>
          </div>
          {configData && (
            <div>
              <span className="text-olive-400 block">Quota</span>
              <span className="text-olive-600">
                {calculateLeaveEntitlement(s, configData)} / {countUsedLeaveDays(s.id, leaveAssignments)} used
              </span>
            </div>
          )}
        </div>

        {/* Fairness */}
        <div className="mt-3">
          <span className="text-xs text-olive-400 block mb-1">Fairness</span>
          <FairnessBar score={s.currentFairness} average={avgFairness} />
        </div>

        {/* Service dates */}
        <div className="mt-3 flex gap-4 text-xs text-olive-500">
          <span>Start: {formatDisplayDate(s.serviceStart)}</span>
          <span>End: {formatDisplayDate(s.serviceEnd)}</span>
        </div>

        {/* Actions */}
        <div className="mt-3 pt-2 border-t border-olive-100 flex gap-3">
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="flex-1 py-2 text-sm text-olive-700 hover:bg-olive-50 rounded"
            >
              Edit
            </button>
          )}
          <button
            onClick={onAdjustClick}
            className="flex-1 py-2 text-sm text-olive-700 hover:bg-olive-50 rounded"
          >
            Adjust
          </button>
        </div>
      </div>

      {/* Expanded content (edit form, adjust form, etc.) */}
      {isExpanded && expandedContent && (
        <div className="border-t border-olive-200 bg-olive-50 p-3">
          {expandedContent}
        </div>
      )}
    </div>
  )
}
