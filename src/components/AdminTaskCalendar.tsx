import { useState } from 'react'
import { fullName } from '../utils/helpers'
import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

interface AdminTaskCalendarProps {
  soldiers: Soldier[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  weekStart: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year.slice(2)}`
}

function isOnLeaveOnDate(assignment: LeaveAssignment, dateStr: string): boolean {
  const date = parseDate(dateStr)
  return parseDate(assignment.startDate) <= date && date <= parseDate(assignment.endDate)
}

export default function AdminTaskCalendar({
  soldiers,
  tasks,
  taskAssignments,
  leaveAssignments,
  weekStart,
}: AdminTaskCalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Convert weekStart (Monday) to Sunday
  const startDate = new Date(weekStart)
  const dayOfWeek = startDate.getDay()
  const diff = startDate.getDate() - dayOfWeek
  const sunday = new Date(startDate.setDate(diff))

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const expandedTasks = tasks.flatMap(task => {
    if (task.isSpecial) return [task]
    return weekDates.map((date, idx) => ({
      ...task,
      id: `${task.id}_day${idx}`,
      startTime: `${date}T${task.startTime.split('T')[1]}`,
      endTime: `${date}T${task.endTime.split('T')[1]}`,
    }))
  })

  const weekEnd = weekDates[6]
  const tasksInWeek = expandedTasks.filter(t => {
    const taskDate = t.startTime.split('T')[0]
    return taskDate >= weekStart && taskDate <= weekEnd
  })

  const selectedTask = tasksInWeek.find(t => t.id === selectedTaskId)
  const assignedSoldiers = selectedTask
    ? soldiers.filter(s => taskAssignments.some(a => a.taskId === selectedTask.id && a.soldierId === s.id))
    : []

  const HOUR_HEIGHT = 40
  const TOTAL_HOURS = 24

  function timeToPixels(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    let displayHour: number
    if (hours >= 6) {
      displayHour = hours - 6
    } else {
      displayHour = hours + 18
    }
    return displayHour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
  }

  function durationToPixels(durationHours: number): number {
    return durationHours * HOUR_HEIGHT
  }

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-auto">
        <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="w-20 flex-shrink-0"></div>
          {weekDates.map((date) => {
            const d = new Date(date)
            const dayIndex = d.getDay()
            return (
              <div key={date} className="flex-1 min-w-[120px] border-l border-gray-200 p-2 text-center">
                <div className="text-xs font-semibold text-olive-700">{DAYS[dayIndex]}</div>
                <div className="text-sm text-gray-600">{formatDateShort(date)}</div>
              </div>
            )
          })}
        </div>

        <div className="flex">
          <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const displayHour = i < 18 ? i + 6 : i - 18
              const isBoundary = i === 18
              return (
                <div
                  key={i}
                  className={`border-t text-xs pr-2 text-right ${
                    isBoundary ? 'border-t-2 border-olive-300 bg-olive-50 text-olive-600 font-medium' : 'border-gray-200 text-gray-500'
                  }`}
                  style={{ height: HOUR_HEIGHT }}
                >
                  {String(displayHour).padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          <div className="flex flex-1">
            {weekDates.map(date => (
              <div
                key={date}
                className="flex-1 min-w-[120px] border-l border-gray-200 relative"
                style={{
                  height: TOTAL_HOURS * HOUR_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, #f0f0f0 ${HOUR_HEIGHT - 1}px, #f0f0f0 ${HOUR_HEIGHT}px)`,
                }}
              >
                {leaveAssignments.some(l => isOnLeaveOnDate(l, date)) && (
                  <div className="absolute inset-0 bg-yellow-100 opacity-40 pointer-events-none border-l-4 border-yellow-500"></div>
                )}

                {tasksInWeek
                  .filter(t => t.startTime.split('T')[0] === date)
                  .map(task => {
                    const startTime = task.startTime.split('T')[1] || '00:00'
                    const top = timeToPixels(startTime)
                    const height = durationToPixels(task.durationHours)

                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`absolute left-1 right-1 rounded px-2 py-1 text-xs font-medium cursor-pointer transition-all ${
                          selectedTaskId === task.id
                            ? 'bg-olive-600 text-white ring-2 ring-olive-400'
                            : 'bg-olive-200 text-olive-900 hover:bg-olive-300'
                        }`}
                        style={{ top, height: Math.max(height, 30) }}
                        title={task.taskType}
                      >
                        <div className="truncate">{task.taskType}</div>
                        {height >= 40 && <div className="text-xs truncate">{startTime}</div>}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTask && (
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-olive-800 text-sm">{selectedTask.taskType}</h3>
            <button onClick={() => setSelectedTaskId(null)} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <p className="text-gray-600">Date</p>
              <p className="font-medium">{selectedTask.startTime.split('T')[0]}</p>
            </div>
            <div>
              <p className="text-gray-600">Time</p>
              <p className="font-medium">
                {selectedTask.startTime.split('T')[1]?.slice(0, 5)} - {selectedTask.endTime.split('T')[1]?.slice(0, 5)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Duration</p>
              <p className="font-medium">{selectedTask.durationHours}h</p>
            </div>

            <div>
              <p className="text-gray-600 mb-2">Assigned Soldiers ({assignedSoldiers.length})</p>
              {assignedSoldiers.length > 0 ? (
                <ul className="space-y-2">
                  {assignedSoldiers.map(s => (
                    <li key={s.id} className="bg-gray-50 rounded p-2 border-l-2 border-blue-500">
                      <div className="font-medium">{fullName(s)}</div>
                      <div className="text-gray-500">{s.unit || 'No unit'}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No soldiers assigned</p>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-gray-600 mb-2">Available Soldiers</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {soldiers
                  .filter(s => s.status === 'Active' && !assignedSoldiers.find(a => a.id === s.id))
                  .sort((a, b) => (a.unit || '').localeCompare(b.unit || ''))
                  .map(s => (
                    <div key={s.id} className="bg-blue-50 rounded p-2 text-xs">
                      <div className="font-medium">{fullName(s)}</div>
                      <div className="text-gray-600">
                        {s.role} • {s.unit || 'No unit'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
