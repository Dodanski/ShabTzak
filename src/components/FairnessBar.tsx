interface FairnessBarProps {
  score: number
  average: number
}

export default function FairnessBar({ score, average }: FairnessBarProps) {
  const max = Math.max(average * 2, score, 1)
  const widthPct = Math.min(100, Math.round((score / max) * 100))
  const isAboveAverage = score > average
  const fillClass = isAboveAverage ? 'bg-red-400' : 'bg-green-400'

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
        <div
          data-testid="fairness-fill"
          className={`h-full rounded ${fillClass}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-600 w-8 text-right">
        {score.toFixed(1)}
      </span>
    </div>
  )
}
