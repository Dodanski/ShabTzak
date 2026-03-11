import { useState } from 'react'
import { fullName } from '../utils/helpers'
import type { Soldier, Task, TaskAssignment } from '../models'

interface TaskModeCalendarProps {
  soldiers: Soldier[]
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  weekStart: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TaskModeCalendar({ soldiers, tasks, taskAssignments, weekStart }: TaskModeCalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Get dates for the week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Filter tasks that overlap this week
  const weekEnd = weekDates[6]
  const tasksInWeek = tasks.filter(t => {
    const taskDate = t.startTime.split('T')[0]
    return taskDate >= weekStart && taskDate <= weekEnd
  })

  const selectedTask = tasksInWeek.find(t => t.id === selectedTaskId)
  const assignedSoldiers = selectedTask
    ? soldiers.filter(s => taskAssignments.some(a => a.taskId === selectedTask.id && a.soldierId === s.id))
    : []

  // Time range for display: 00:00 to 06:00 (24/7 with day boundary at 06:00)
  // Display shows 00:00-23:59 for current day, then wraps
  const HOUR_HEIGHT = 40 // pixels per hour
  const TOTAL_HOURS = 24

  function timeToPixels(timeStr: string, taskDate: string, dayDate: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    // If task is on the next day after 06:00, shift down by 24 hours for display
    if (taskDate > dayDate && hours >= 0 && hours < 6) {
      return (24 + hours) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
    }
    return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
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
          {weekDates.map((date, idx) => {
            const d = new Date(date)
            return (
              <div key={date} className="flex-1 min-w-[120px] border-l border-gray-200 p-2 text-center">
                <div className="text-xs font-semibold text-olive-700">{DAYS[idx]}</div>
                <div className="text-sm text-gray-600">{d.getDate()}</div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="border-t border-gray-200 text-xs text-gray-500 pr-2 text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(i).padStart(2, '0')}:00
              </div>
            ))}
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
                {tasksInWeek
                  .filter(t => t.startTime.split('T')[0] === date)
                  .map(task => {
                    const startTime = task.startTime.split('T')[1] || '00:00'
                    const taskDate = task.startTime.split('T')[0]
                    const top = timeToPixels(startTime, taskDate, date)
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
