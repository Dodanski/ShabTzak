import { useState } from 'react'
import type { Task, TaskAssignment, Soldier } from '../models'

interface AdminWeeklyTaskCalendarProps {
  tasks: Task[]
  weekStart: string
  onWeekChange: (weekStart: string) => void
  taskAssignments?: TaskAssignment[]
  soldiers?: Soldier[]
  masterDs?: any
  accessToken?: string
  configData?: any
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year.slice(2)}`
}

function getWeekDates(weekStartStr: string): string[] {
  const startDate = new Date(weekStartStr)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export default function AdminWeeklyTaskCalendar({
  tasks,
  weekStart,
  onWeekChange,
  taskAssignments = [],
  soldiers = [],
}: AdminWeeklyTaskCalendarProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  // Create soldier map for quick lookup
  const soldierMap = new Map(soldiers.map(s => [s.id, s]))

  const weekDates = getWeekDates(weekStart)
  const today = new Date().toISOString().split('T')[0]
  const isCurrentWeek = weekDates.includes(today)

  function toggleTask(taskInstanceId: string) {
    const next = new Set(expandedTasks)
    if (next.has(taskInstanceId)) {
      next.delete(taskInstanceId)
    } else {
      next.add(taskInstanceId)
    }
    setExpandedTasks(next)
  }

  function handlePrevWeek() {
    const date = new Date(weekStart)
    date.setDate(date.getDate() - 7)
    onWeekChange(date.toISOString().split('T')[0])
  }

  function handleNextWeek() {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + 7)
    onWeekChange(date.toISOString().split('T')[0])
  }

  return (
    <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-3 sm:p-6 space-y-4">
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-olive-800">Weekly Task Schedule</h2>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
          <button
            onClick={handlePrevWeek}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-olive-700 text-white rounded hover:bg-olive-800 transition"
          >
            ← Prev
          </button>
          <span className="text-xs sm:text-sm font-medium text-olive-600 text-center">
            {formatDate(weekStart)} - {formatDate(weekDates[6])}
          </span>
          <button
            onClick={handleNextWeek}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-olive-700 text-white rounded hover:bg-olive-800 transition"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Mobile: Vertical list of day cards */}
      <div className="md:hidden space-y-3">
        {DAYS.map((day, idx) => {
          const date = weekDates[idx]
          const isToday = date === today && isCurrentWeek
          const dayTasks = tasks.filter(task => {
            if (task.isSpecial) {
              const taskDate = task.startTime.split('T')[0]
              return taskDate === date
            }
            return true
          })

          return (
            <div
              key={day}
              className={`rounded-lg border-2 overflow-hidden ${
                isToday ? 'border-olive-700' : 'border-olive-200'
              }`}
            >
              {/* Day header */}
              <div className={`px-3 py-2 ${isToday ? 'bg-olive-100' : 'bg-olive-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-olive-800">{day}</span>
                  <span className={`text-xs ${isToday ? 'font-bold text-olive-700' : 'text-gray-600'}`}>
                    {formatDate(date)}
                  </span>
                </div>
              </div>
              {/* Tasks */}
              <div className="p-2 space-y-2 bg-white">
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">No tasks</p>
                ) : (
                  dayTasks.map(task => {
                    const taskInstanceId = `${task.id}_${date}`
                    const isExpanded = expandedTasks.has(taskInstanceId)

                    return (
                      <div
                        key={taskInstanceId}
                        className="bg-gray-50 border border-olive-200 rounded p-2"
                      >
                        <button
                          onClick={() => toggleTask(taskInstanceId)}
                          className="w-full text-left text-sm font-medium text-olive-700 hover:text-olive-900 flex items-center gap-1"
                        >
                          <span>{isExpanded ? '▼' : '▶'}</span>
                          {task.taskType}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-olive-100 space-y-2">
                            <p className="text-xs text-gray-500">
                              Roles: {task.roleRequirements.map(r => {
                                const roleKey = 'roles' in r ? 'roles' : 'role'
                                const roleList = roleKey === 'roles' ? r.roles : [r.role]
                                return `${roleList?.join('/')}(${r.count})`
                              }).join(', ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              Duration: {task.durationHours}h | Rest: {task.minRestAfter}h
                            </p>

                            {(() => {
                              const assignedSoldiers = taskAssignments.filter(a => a.taskId === task.id)
                              if (assignedSoldiers.length === 0) {
                                return <p className="text-xs text-red-500 italic">No soldiers assigned</p>
                              }
                              return (
                                <div className="text-xs space-y-0.5 bg-blue-50 p-1.5 rounded border border-blue-100">
                                  <p className="font-medium text-blue-700">Assigned ({assignedSoldiers.length}):</p>
                                  {assignedSoldiers.map(a => {
                                    const soldier = soldierMap.get(a.soldierId)
                                    return (
                                      <p key={a.scheduleId} className="text-blue-600">
                                        {soldier ? `${soldier.firstName} ${soldier.lastName}` : a.soldierId} ({a.assignedRole})
                                      </p>
                                    )
                                  })}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {/* Day headers */}
        {DAYS.map((day, idx) => {
          const date = weekDates[idx]
          const isToday = date === today && isCurrentWeek

          return (
            <div
              key={day}
              className={`p-3 rounded-lg border-2 ${
                isToday ? 'border-olive-700 bg-olive-50' : 'border-olive-200 bg-white'
              }`}
            >
              <p className="text-sm font-semibold text-olive-800">{day}</p>
              <p className={`text-xs ${isToday ? 'font-bold text-olive-700' : 'text-gray-600'}`}>
                {formatDate(date)}
              </p>
            </div>
          )
        })}

        {/* Tasks for each day */}
        {DAYS.map((day, idx) => {
          const date = weekDates[idx]
          const dayTasks = tasks.filter(task => {
            if (task.isSpecial) {
              const taskDate = task.startTime.split('T')[0]
              return taskDate === date
            }
            // Recurring tasks appear on all days
            return true
          })

          return (
            <div key={`tasks-${day}`} className="space-y-2 p-2 bg-gray-50 rounded-lg min-h-32">
              {dayTasks.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No tasks</p>
              ) : (
                dayTasks.map(task => {
                  const taskInstanceId = `${task.id}_${date}`
                  const isExpanded = expandedTasks.has(taskInstanceId)

                  return (
                    <div
                      key={taskInstanceId}
                      className="bg-white border border-olive-200 rounded p-2"
                    >
                      <button
                        onClick={() => toggleTask(taskInstanceId)}
                        className="w-full text-left text-xs font-medium text-olive-700 hover:text-olive-900 flex items-center gap-1"
                      >
                        <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
                        {task.taskType}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-olive-100 space-y-2">
                          <p className="text-xs text-gray-500">
                            Roles: {task.roleRequirements.map(r => {
                              const roleKey = 'roles' in r ? 'roles' : 'role'
                              const roleList = roleKey === 'roles' ? r.roles : [r.role]
                              return `${roleList?.join('/')}(${r.count})`
                            }).join(', ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            Duration: {task.durationHours}h | Rest: {task.minRestAfter}h
                          </p>

                          {/* Show assigned soldiers */}
                          {(() => {
                            const assignedSoldiers = taskAssignments.filter(a => a.taskId === task.id)
                            if (assignedSoldiers.length === 0) {
                              return <p className="text-xs text-red-500 italic">No soldiers assigned</p>
                            }
                            return (
                              <div className="text-xs space-y-0.5 bg-blue-50 p-1.5 rounded border border-blue-100">
                                <p className="font-medium text-blue-700">Assigned ({assignedSoldiers.length}):</p>
                                {assignedSoldiers.map(a => {
                                  const soldier = soldierMap.get(a.soldierId)
                                  return (
                                    <p key={a.scheduleId} className="text-blue-600">
                                      {soldier ? `${soldier.firstName} ${soldier.lastName}` : a.soldierId} ({a.assignedRole})
                                    </p>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
