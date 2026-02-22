import { buildAvailabilityMatrix } from '../algorithms/availabilityMatrix'
import type { AvailabilityStatus } from '../algorithms/availabilityMatrix'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

interface ScheduleCalendarProps {
  soldiers: Soldier[]
  dates: string[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
}

const STATUS_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-100',
  'on-leave': 'bg-yellow-200',
  'on-task': 'bg-blue-200',
}

export default function ScheduleCalendar({
  soldiers, dates, tasks, taskAssignments, leaveAssignments,
}: ScheduleCalendarProps) {
  if (soldiers.length === 0) {
    return <p className="text-gray-400 text-sm">No soldiers to display.</p>
  }

  const matrix = buildAvailabilityMatrix(soldiers, tasks, taskAssignments, leaveAssignments, dates)

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-gray-600 font-medium sticky left-0 bg-white">
              Soldier
            </th>
            {dates.map(d => (
              <th key={d} className="px-2 py-1 text-gray-500 font-normal whitespace-nowrap">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {soldiers.map(soldier => (
            <tr key={soldier.id}>
              <td className="px-2 py-1 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">
                {soldier.name}
              </td>
              {dates.map(d => {
                const status = matrix.get(d)?.get(soldier.id) ?? 'available'
                return (
                  <td
                    key={d}
                    title={status}
                    className={`px-3 py-1 border border-gray-100 ${STATUS_CLASSES[status]}`}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-100 border border-gray-200" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-yellow-200 border border-gray-200" /> On leave
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-200 border border-gray-200" /> On task
        </span>
      </div>
    </div>
  )
}
