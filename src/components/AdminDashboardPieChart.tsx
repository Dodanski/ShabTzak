import { useMemo } from 'react'
import type { Soldier } from '../models'

interface AdminDashboardPieChartProps {
  soldiers: Soldier[]
}

export default function AdminDashboardPieChart({ soldiers }: AdminDashboardPieChartProps) {
  const statusCounts = useMemo(() => {
    const counts = {
      'On Base': 0,
      'On Leave': 0,
      'On Way Home': 0,
      'On Way to Base': 0,
      'Inactive': 0,
    }

    // For now, just count active vs inactive
    // Full status calculation would require live task/leave data
    for (const soldier of soldiers) {
      if (soldier.status !== 'Active') {
        counts['Inactive']++
      } else {
        counts['On Base']++
      }
    }

    return counts
  }, [soldiers])

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  if (total === 0) return <p className="text-gray-400">No soldiers</p>

  const colors = {
    'On Base': 'bg-green-500',
    'On Leave': 'bg-yellow-500',
    'On Way Home': 'bg-orange-500',
    'On Way to Base': 'bg-blue-500',
    'Inactive': 'bg-gray-500',
  }

  return (
    <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-olive-800">Soldier Status Distribution</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Color legend and counts */}
        <div className="flex flex-col gap-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (count === 0) return null

            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors[status as keyof typeof colors]}`} />
                <span className="text-sm text-gray-700">
                  {status}: <span className="font-semibold">{count}</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (count === 0) return null
            const percentage = (count / total) * 100

            return (
              <div key={status} className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded h-3">
                  <div
                    className={`${colors[status as keyof typeof colors]} h-3 rounded transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-10 text-right">
                  {Math.round(percentage)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500 italic pt-2">
        Note: Status counts are static from the last schedule generation. Full status requires live schedule data.
      </p>
    </div>
  )
}
