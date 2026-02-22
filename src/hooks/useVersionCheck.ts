import { useState, useEffect, useRef } from 'react'
import type { DataService } from '../services/dataService'

const POLL_INTERVAL_MS = 60_000

export function useVersionCheck(
  ds: DataService | null,
  tabName: string,
): { isStale: boolean } {
  const [isStale, setIsStale] = useState(false)
  const localVersionRef = useRef(0)

  useEffect(() => {
    if (!ds) {
      setIsStale(false)
      return
    }

    const check = async () => {
      try {
        const stale = await ds.versions.isStale(tabName, localVersionRef.current)
        setIsStale(stale)
      } catch {
        // ignore polling errors silently
      }
    }

    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [ds, tabName])

  return { isStale }
}
