import type { HistoryEntry } from '../services/historyService'

interface HistoryPageProps {
  entries: HistoryEntry[]
  loading?: boolean
}

export default function HistoryPage({ entries, loading }: HistoryPageProps) {
  if (loading) {
    return <div className="p-4 text-gray-500">Loading history…</div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">History</h2>

      {entries.length === 0 && (
        <p className="text-gray-400 text-sm">No history entries found.</p>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Details</th>
                <th className="text-left px-4 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">{e.timestamp}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      {e.entityType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.action}</td>
                  <td className="px-4 py-2 text-gray-700">{e.details}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.changedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
