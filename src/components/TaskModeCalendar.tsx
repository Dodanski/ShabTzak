import { useState } from 'react'
import { fullName } from '../utils/helpers'
import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

interface TaskModeCalendarProps {
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

export default function TaskModeCalendar({ soldiers, tasks, taskAssignments, leaveAssignments, weekStart }: TaskModeCalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Convert weekStart (which is currently Monday) to Sunday of that week
  const startDate = new Date(weekStart)
  const dayOfWeek = startDate.getDay()
  const diff = startDate.getDate() - dayOfWeek // Get Sunday
  const sunday = new Date(startDate.setDate(diff))

  // Get dates for the week (Sun-Sat)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Expand recurring tasks to show in the week view
  // Regular tasks repeat daily, pillbox tasks show as-is
  const expandedTasks = tasks.flatMap(task => {
    if (task.isSpecial) {
      // Pillbox task - show only on its original date
      return [task]
    }
    // Regular recurring task - create instances for each day of the week
    return weekDates.map((date, idx) => ({
      ...task,
      id: `${task.id}_day${idx}`,
      startTime: `${date}T${task.startTime.split('T')[1]}`,
      endTime: `${date}T${task.endTime.split('T')[1]}`,
    }))
  })

  // Filter tasks that are in this week
  const weekEnd = weekDates[6]
  const tasksInWeek = expandedTasks.filter(t => {
    const taskDate = t.startTime.split('T')[0]
    return taskDate >= weekStart && taskDate <= weekEnd
  })

  const selectedTask = tasksInWeek.find(t => t.id === selectedTaskId)
  const assignedSoldiers = selectedTask
    ? soldiers.filter(s => taskAssignments.some(a => a.taskId === selectedTask.id && a.soldierId === s.id))
    : []

  // Time range for display: 06:00 to 05:59 (next day)
  // Day boundary at 06:00 - display order: 06-23 (current day), then 00-05 (end of day)
  const HOUR_HEIGHT = 40 // pixels per hour
  const TOTAL_HOURS = 24

  function timeToPixels(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    // Map hours to display position: 06-23 → 0-17, 00-05 → 18-23
    let displayHour: number
    if (hours >= 6) {
      displayHour = hours - 6 // 06:00 → 0, 07:00 → 1, ..., 23:00 → 17
    } else {
      displayHour = hours + 18 // 00:00 → 18, 01:00 → 19, ..., 05:00 → 23
    }
    return displayHour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
  }

  function durationToPixels(durationHours: number): number {
    return durationHours * HOUR_HEIGHT
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Main calendar */}
      <div className="flex-1 overflow-auto">
        {/* Header with day names and dates */}
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

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              // Display hours in order: 06-23 (first 18 hours), then 00-05 (last 6 hours)
              const displayHour = i < 18 ? i + 6 : i - 18
              const isBoundary = i === 18 // Mark the 00:00 boundary
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

          {/* Days columns */}
          <div className="flex flex-1">
            {weekDates.map(date => (
              <div
                key={date}
                className="flex-1 min-w-[120px] border-l border-gray-200 relative"
                style={{
                  height: TOTAL_HOURS * HOUR_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(
                    to bottom,
                    transparent 0,
                    transparent ${HOUR_HEIGHT - 1}px,
                    #f0f0f0 ${HOUR_HEIGHT - 1}px,
                    #f0f0f0 ${HOUR_HEIGHT}px
                  )`,
                }}
              >
                {/* Show leaves as full-day overlay */}
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

      {/* Detail panel */}
      {selectedTask && (
        <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-olive-800 text-sm">{selectedTask.taskType}</h3>
            <button
              onClick={() => setSelectedTaskId(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-xs">
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
                <ul className="space-y-1">
                  {assignedSoldiers.map(s => (
                    <li key={s.id} className="bg-gray-50 rounded p-2">
                      {fullName(s)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No soldiers assigned</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
