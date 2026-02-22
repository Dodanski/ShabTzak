interface VersionConflictBannerProps {
  isStale: boolean
  onReload: () => void
}

export default function VersionConflictBanner({ isStale, onReload }: VersionConflictBannerProps) {
  if (!isStale) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 px-4 py-2 flex items-center justify-between text-sm shadow-md">
      <span>Data has changed since you last loaded. Reload to see the latest.</span>
      <button
        onClick={onReload}
        className="ml-4 px-3 py-1 bg-yellow-700 text-white rounded hover:bg-yellow-800 font-medium"
      >
        Reload
      </button>
    </div>
  )
}
