import { useState, useEffect } from 'react'
import type { MasterDataService } from '../services/masterDataService'
import type { Task, AppConfig } from '../models'
import { DataService } from '../services/dataService'
import { fullName } from '../utils/helpers'

interface AdminWeeklyTaskCalendarProps {
  masterDs: MasterDataService
  tasks: Task[]
  weekStart: string
  onWeekChange: (weekStart: string) => void
  accessToken: string
  configData: AppConfig | null
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

interface AssignmentData {
  taskInstanceId: string
  soldiers: string[]
}

export default function AdminWeeklyTaskCalendar({
  masterDs,
  tasks,
  weekStart,
  onWeekChange,
  accessToken,
}: AdminWeeklyTaskCalendarProps) {
  const [loading, setLoading] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [assignmentsByDate, setAssignmentsByDate] = useState<Record<string, AssignmentData[]>>({})

  const weekDates = getWeekDates(weekStart)
  const today = new Date().toISOString().split('T')[0]
  const isCurrentWeek = weekDates.includes(today)

  // Load all task assignments for this week
  useEffect(() => {
    loadWeeklyAssignments()
  }, [weekStart])

  async function loadWeeklyAssignments() {
    try {
      setLoading(true)
      const units = await masterDs.units.list()
      const allAssignments: Record<string, AssignmentData[]> = {}

      // Initialize all dates
      for (const date of weekDates) {
        allAssignments[date] = []
      }

      // Load assignments from each unit
      for (const unit of units) {
        try {
          const ds = new DataService(accessToken, unit.spreadsheetId, unit.tabPrefix, masterDs.history)
          const assignments = await ds.taskAssignments.list()

          // Group by date and task
          for (const assignment of assignments) {
            // Find the task to get the date
            const taskId = assignment.taskId
            const task = tasks.find(t => t.id === taskId)

            if (!task) continue

            // Calculate date for this assignment
            const assignmentDate = getAssignmentDate(task, taskId, weekDates)
            if (!assignmentDate || !weekDates.includes(assignmentDate)) continue

            const instanceId = `${taskId}_${assignmentDate}`
            const soldier = await ds.soldiers.getById(assignment.soldierId)

            if (!soldier) continue

            const soldierName = fullName(soldier)

            // Find or create the assignment data
            let assignmentData = allAssignments[assignmentDate].find(a => a.taskInstanceId === instanceId)
            if (!assignmentData) {
              assignmentData = { taskInstanceId: instanceId, soldiers: [] }
              allAssignments[assignmentDate].push(assignmentData)
            }

            if (!assignmentData.soldiers.includes(soldierName)) {
              assignmentData.soldiers.push(soldierName)
            }
          }
        } catch (err) {
          console.warn(`Failed to load assignments for unit:`, err)
        }
      }

      setAssignmentsByDate(allAssignments)
    } catch (err) {
      console.error('Failed to load weekly assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  function getAssignmentDate(task: Task, _taskId: string, weekDates: string[]): string | null {
    if (task.isSpecial) {
      // Pillbox task - extract date from startTime
      const date = task.startTime.split('T')[0]
      return weekDates.includes(date) ? date : null
    }

    // Recurring task - task can be on any day in the week
    // We need to find which date this assignment refers to by looking at all possible dates
    // For now, we'll assume the assignment is for the earliest matching date in the week
    return weekDates[0] ?? null
  }

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
    <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-6 space-y-4">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-olive-800">Weekly Task Schedule</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevWeek}
            className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded hover:bg-olive-800 transition"
          >
            ← Previous
          </button>
          <span className="text-sm font-medium text-olive-600 min-w-48 text-center">
            Week: {formatDate(weekStart)} - {formatDate(weekDates[6])}
          </span>
          <button
            onClick={handleNextWeek}
            className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded hover:bg-olive-800 transition"
          >
            Next →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-olive-500">Loading assignments…</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
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
                    const assignments = assignmentsByDate[date] || []
                    const taskAssignments = assignments.find(
                      a => a.taskInstanceId === taskInstanceId
                    )

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
                          <div className="mt-2 pt-2 border-t border-olive-100 space-y-1">
                            {!taskAssignments || taskAssignments.soldiers.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No soldiers assigned</p>
                            ) : (
                              taskAssignments.soldiers
                                .sort()
                                .map(soldierName => (
                                  <p key={soldierName} className="text-xs text-gray-700">
                                    • {soldierName}
                                  </p>
                                ))
                            )}
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
      )}
    </div>
  )
}
