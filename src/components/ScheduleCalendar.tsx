import { buildAvailabilityMatrix } from '../algorithms/availabilityMatrix'
import type { AvailabilityStatus } from '../algorithms/availabilityMatrix'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'
import { formatDisplayDate } from '../utils/dateUtils'
import { fullName } from '../utils/helpers'

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
  'on-task': 'bg-olive-200',
}

export default function ScheduleCalendar({
  soldiers, dates, tasks, taskAssignments, leaveAssignments,
}: ScheduleCalendarProps) {
  if (soldiers.length === 0) {
    return <p className="text-gray-400 text-sm">No soldiers to display.</p>
  }

  const matrix = buildAvailabilityMatrix(soldiers, tasks, taskAssignments, leaveAssignments, dates)

  return (
    <>
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="text-xs border-collapse w-full">
            <thead className="bg-olive-700 text-white sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-olive-700 z-20 min-w-[150px]">
                  Soldier
                </th>
                {dates.map(d => (
                  <th key={d} className="px-2 py-2 font-normal whitespace-nowrap text-center min-w-[40px]">{formatDisplayDate(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {soldiers.map(soldier => (
                <tr key={soldier.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-olive-800 sticky left-0 bg-white z-10 min-w-[150px]">
                    {fullName(soldier)}
                  </td>
                  {dates.map(d => {
                    const status = matrix.get(d)?.get(soldier.id) ?? 'available'
                    return (
                      <td
                        key={d}
                        title={status}
                        className={`px-2 py-2 border border-gray-200 text-center min-w-[40px] ${STATUS_CLASSES[status]}`}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-6 mt-4 text-xs text-olive-600">
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 bg-green-100 border border-gray-300 rounded" /> Available
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 bg-yellow-200 border border-gray-300 rounded" /> On leave
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 bg-olive-200 border border-gray-300 rounded" /> On task
        </span>
      </div>
    </>
  )
}
