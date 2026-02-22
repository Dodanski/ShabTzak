import { useState, useEffect } from 'react'

interface ErrorBannerProps {
  error: Error | null
  onRetry: () => void
}

export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [error])

  if (!error || dismissed) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-sm">
      <span className="text-red-700">{error.message}</span>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onRetry}
          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
        >
          Retry
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
