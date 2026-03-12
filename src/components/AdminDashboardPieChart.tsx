import type { SoldierStatusType } from './AdminDashboard'
import type { Soldier } from '../models'

interface SoldierWithStatus extends Omit<Soldier, 'status'> {
  status: SoldierStatusType
  unitName: string
}

interface AdminDashboardPieChartProps {
  soldierStatuses: SoldierWithStatus[]
  selectedFilter: SoldierStatusType | null
  onFilterChange: (status: SoldierStatusType | null) => void
}

const STATUS_CONFIG: Record<SoldierStatusType, { label: string; color: string; bgColor: string }> = {
  onBase: { label: 'On Base', color: '#3B82F6', bgColor: 'bg-blue-100' },
  onLeave: { label: 'On Leave', color: '#EF4444', bgColor: 'bg-red-100' },
  onTheWayHome: { label: 'On the Way Home', color: '#F97316', bgColor: 'bg-orange-100' },
  onTheWayToBase: { label: 'On the Way to Base', color: '#FBBF24', bgColor: 'bg-yellow-100' },
  inactive: { label: 'Inactive', color: '#9CA3AF', bgColor: 'bg-gray-100' },
}

export default function AdminDashboardPieChart({
  soldierStatuses,
  selectedFilter,
  onFilterChange,
}: AdminDashboardPieChartProps) {
  // Count soldiers by status
  const counts = {
    onBase: soldierStatuses.filter(s => s.status === 'onBase').length,
    onLeave: soldierStatuses.filter(s => s.status === 'onLeave').length,
    onTheWayHome: soldierStatuses.filter(s => s.status === 'onTheWayHome').length,
    onTheWayToBase: soldierStatuses.filter(s => s.status === 'onTheWayToBase').length,
    inactive: soldierStatuses.filter(s => s.status === 'inactive').length,
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  // Pie chart SVG generation
  const getChartData = () => {
    const data: { status: SoldierStatusType; count: number; percentage: number }[] = []

    for (const [status, count] of Object.entries(counts)) {
      const percentage = total > 0 ? (count / total) * 100 : 0
      data.push({ status: status as SoldierStatusType, count, percentage })
    }

    return data
  }

  const data = getChartData()

  const generatePieChart = () => {
    let currentAngle = -90 // Start at top
    const radius = 80
    const cx = 100
    const cy = 100

    return data
      .filter(d => d.count > 0)
      .map((d, i) => {
        const sliceAngle = (d.count / total) * 360
        const startAngle = currentAngle
        const endAngle = currentAngle + sliceAngle
        currentAngle = endAngle

        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180

        const x1 = cx + radius * Math.cos(startRad)
        const y1 = cy + radius * Math.sin(startRad)
        const x2 = cx + radius * Math.cos(endRad)
        const y2 = cy + radius * Math.sin(endRad)

        const largeArc = sliceAngle > 180 ? 1 : 0

        const pathData = [
          `M ${cx} ${cy}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          'Z',
        ].join(' ')

        return (
          <path
            key={i}
            d={pathData}
            fill={STATUS_CONFIG[d.status].color}
            stroke="white"
            strokeWidth="2"
            onClick={() => onFilterChange(d.status)}
            style={{ cursor: 'pointer', opacity: selectedFilter === null || selectedFilter === d.status ? 1 : 0.5 }}
          />
        )
      })
  }

  return (
    <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-6 space-y-6">
      <h2 className="text-xl font-semibold text-olive-800">Soldier Status Summary</h2>

      <div className="grid grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="flex justify-center">
          <svg width="220" height="220" viewBox="0 0 220 220">
            {generatePieChart()}
          </svg>
        </div>

        {/* Legend */}
        <div className="col-span-2 space-y-3">
          {data
            .filter(d => d.count > 0)
            .map(d => (
              <div
                key={d.status}
                onClick={() => {
                  onFilterChange(selectedFilter === d.status ? null : d.status)
                }}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  selectedFilter === null || selectedFilter === d.status
                    ? 'bg-olive-50 border border-olive-200'
                    : 'bg-gray-50 border border-gray-200 opacity-50'
                }`}
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: STATUS_CONFIG[d.status].color }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {STATUS_CONFIG[d.status].label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {d.count} soldiers ({d.percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Expandable Soldier List */}
      {selectedFilter && (
        <div className="mt-6 pt-6 border-t border-olive-200">
          <h3 className="font-semibold text-olive-800 mb-3">
            {STATUS_CONFIG[selectedFilter].label} ({counts[selectedFilter]})
          </h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {soldierStatuses
              .filter(s => s.status === selectedFilter)
              .sort((a, b) => a.firstName.localeCompare(b.firstName))
              .map(soldier => (
                <div key={soldier.id} className={`${STATUS_CONFIG[selectedFilter].bgColor} p-3 rounded-lg`}>
                  <p className="text-sm font-medium text-gray-800">{soldier.firstName} {soldier.lastName}</p>
                  <p className="text-xs text-gray-600">{soldier.unitName}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
