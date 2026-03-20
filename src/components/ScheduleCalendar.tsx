import { useState } from 'react'
import { buildAvailabilityMatrix } from '../algorithms/availabilityMatrix'
import type { AvailabilityStatus } from '../algorithms/availabilityMatrix'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'
import { formatDisplayDate, parseDate } from '../utils/dateUtils'
import { fullName } from '../utils/helpers'
import { useIsMobile } from '../hooks/useIsMobile'

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
  'on-way-home': 'bg-orange-200',
  'on-way-to-base': 'bg-orange-300',
}

export default function ScheduleCalendar({
  soldiers, dates, tasks, taskAssignments, leaveAssignments,
}: ScheduleCalendarProps) {
  const isMobile = useIsMobile()
  const [selectedSoldierId, setSelectedSoldierId] = useState<string | null>(null)

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

  // Mobile view: soldier selector + horizontal scroll day view
  if (isMobile) {
    const selectedSoldier = soldiers.find(s => s.id === selectedSoldierId) ?? soldiers[0]

    return (
      <>
        {/* Soldier selector */}
        <div className="mb-3">
          <select
            value={selectedSoldier?.id ?? ''}
            onChange={e => setSelectedSoldierId(e.target.value)}
            className="w-full border border-olive-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {soldiers.map(s => (
              <option key={s.id} value={s.id}>{fullName(s)}</option>
            ))}
          </select>
        </div>

        {/* Day-by-day schedule for selected soldier */}
        {selectedSoldier && (
          <div className="space-y-2">
            {dates.map(d => {
              const currentDate = parseDate(d)
              const serviceStart = parseDate(selectedSoldier.serviceStart)
              const serviceEnd = parseDate(selectedSoldier.serviceEnd)
              const isInServicePeriod = serviceStart <= currentDate && currentDate <= serviceEnd

              const cellData = matrix.get(d)?.get(selectedSoldier.id) ?? { status: 'available' as const }
              const status: AvailabilityStatus = isInServicePeriod ? cellData.status : 'available'

              let displayText = ''
              if (!isInServicePeriod) {
                displayText = 'Not in service'
              } else if (cellData.taskName) {
                displayText = cellData.taskName
              } else if (cellData.transitionType === 'exit') {
                displayText = 'Leaving base'
              } else if (cellData.transitionType === 'return') {
                displayText = 'Returning to base'
              } else {
                displayText = status === 'on-leave' ? 'On leave' : status === 'on-task' ? 'On task' : 'Available'
              }

              const bgColor = !isInServicePeriod ? 'bg-gray-200' : STATUS_CLASSES[status]

              return (
                <div key={d} className={`rounded-lg p-3 ${bgColor}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{formatDisplayDate(d)}</span>
                    <span className="text-sm text-olive-600">{displayText}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-olive-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-green-100 border border-gray-300 rounded" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-yellow-200 border border-gray-300 rounded" /> On leave
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-olive-200 border border-gray-300 rounded" /> On task
          </span>
        </div>
      </>
    )
  }

  // Desktop view: full matrix
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
                    const currentDate = parseDate(d)
                    const serviceStart = parseDate(soldier.serviceStart)
                    const serviceEnd = parseDate(soldier.serviceEnd)
                    const isInServicePeriod = serviceStart <= currentDate && currentDate <= serviceEnd

                    const cellData = matrix.get(d)?.get(soldier.id) ?? { status: 'available' as const }
                    const status: AvailabilityStatus = isInServicePeriod ? cellData.status : 'available'

                    let displayText = ''
                    if (!isInServicePeriod) {
                      displayText = '-'
                    } else if (cellData.taskName) {
                      displayText = cellData.taskName
                    } else if (cellData.transitionType === 'exit') {
                      displayText = '← Out'
                    } else if (cellData.transitionType === 'return') {
                      displayText = 'In →'
                    }

                    const title = displayText ? `${status}: ${displayText}` : status
                    const bgColor = !isInServicePeriod ? 'bg-gray-300' : STATUS_CLASSES[status]

                    return (
                      <td
                        key={d}
                        title={title}
                        className={`px-0.5 sm:px-2 py-1 sm:py-2 border border-gray-200 text-center min-w-[28px] sm:min-w-[40px] ${bgColor} text-xs font-medium`}
                      >
                        {displayText}
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
