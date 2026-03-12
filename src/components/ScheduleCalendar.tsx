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

  // Expand recurring tasks to match the _dayN IDs created by the scheduler
  const expandedTasks = tasks.flatMap(task => {
    if (task.isSpecial) {
      // Pillbox task - don't expand
      return [task]
    }
    // Regular recurring task - create instances for each day in the schedule
    return dates.map((date, idx) => ({
      ...task,
      id: `${task.id}_day${idx}`,
      startTime: `${date}T${task.startTime.split('T')[1]}`,
      endTime: `${date}T${task.endTime.split('T')[1]}`,
    }))
  })

  const matrix = buildAvailabilityMatrix(soldiers, expandedTasks, taskAssignments, leaveAssignments, dates)

  return (
    <>
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
          <table className="text-xs sm:text-sm border-collapse w-full">
            <thead className="bg-olive-700 text-white sticky top-0 z-10">
              <tr>
                <th className="px-1 sm:px-3 py-1 sm:py-2 text-left text-xs sm:text-sm font-medium sticky left-0 bg-olive-700 z-20 min-w-[80px] sm:min-w-[120px] md:min-w-[150px]">
                  Soldier
                </th>
                {dates.map(d => (
                  <th key={d} className="px-0.5 sm:px-2 py-1 sm:py-2 font-normal whitespace-nowrap text-center text-xs min-w-[28px] sm:min-w-[40px]">{formatDisplayDate(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {soldiers.map(soldier => (
                <tr key={soldier.id} className="border-t hover:bg-gray-50">
                  <td className="px-1 sm:px-3 py-1 sm:py-2 font-medium text-olive-800 sticky left-0 bg-white z-10 min-w-[80px] sm:min-w-[120px] md:min-w-[150px] text-xs sm:text-sm">
                    {fullName(soldier)}
                  </td>
                  {dates.map(d => {
                    const cellData = matrix.get(d)?.get(soldier.id) ?? { status: 'available' }
                    const status = cellData.status
                    const title = cellData.taskName ? `${status}: ${cellData.taskName}` : status
                    return (
                      <td
                        key={d}
                        title={title}
                        className={`px-0.5 sm:px-2 py-1 sm:py-2 border border-gray-200 text-center min-w-[28px] sm:min-w-[40px] ${STATUS_CLASSES[status]} text-xs font-medium`}
                      >
                        {cellData.taskName ? cellData.taskName : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-6 mt-3 sm:mt-4 text-xs sm:text-sm text-olive-600">
        <span className="flex items-center gap-1 sm:gap-2">
          <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-gray-300 rounded" /> Available
        </span>
        <span className="flex items-center gap-1 sm:gap-2">
          <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-yellow-200 border border-gray-300 rounded" /> On leave
        </span>
        <span className="flex items-center gap-1 sm:gap-2">
          <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-olive-200 border border-gray-300 rounded" /> On task
        </span>
      </div>
    </>
  )
}
