import type { ScheduleConflict } from '../models'

interface ConflictListProps {
  conflicts: ScheduleConflict[]
}

export default function ConflictList({ conflicts }: ConflictListProps) {
  if (conflicts.length === 0) {
    return <p className="text-sm text-green-600">No conflicts detected.</p>
  }

  // Separate capacity shortages from other conflicts for better visibility
  const capacityShortages = conflicts.filter(c => c.type === 'CAPACITY_SHORTAGE')
  const otherConflicts = conflicts.filter(c => c.type !== 'CAPACITY_SHORTAGE')

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-red-700">{conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found</p>

      {/* Capacity shortages - shown in orange/warning style */}
      {capacityShortages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-orange-800 uppercase">Capacity Shortages</p>
          {capacityShortages.map((c, i) => (
            <div key={`capacity-${i}`} className="bg-orange-50 border border-orange-300 rounded-lg p-3">
              <span className="inline-block px-2 py-0.5 text-xs font-mono bg-orange-100 text-orange-700 rounded mb-1">
                {c.type}
              </span>
              <p className="text-sm text-orange-800 font-medium">{c.message}</p>
              {c.suggestions.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-xs text-orange-600 space-y-0.5">
                  {c.suggestions.map((s, j) => <li key={j}>{s}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Other conflicts - shown in red/error style */}
      {otherConflicts.map((c, i) => (
        <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
          <span className="inline-block px-2 py-0.5 text-xs font-mono bg-red-100 text-red-700 rounded mb-1">
            {c.type}
          </span>
          <p className="text-sm text-red-700">{c.message}</p>
          {c.suggestions.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-red-500 space-y-0.5">
              {c.suggestions.map((s, j) => <li key={j}>{s}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
