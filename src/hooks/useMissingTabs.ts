import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleSheetsService } from '../services/googleSheets'
import { SetupService } from '../services/setupService'

export interface UseMissingTabsResult {
  loading: boolean
  error: boolean
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 3000  // 3 seconds between retries

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useMissingTabs(spreadsheetId: string, tabPrefix: string): UseMissingTabsResult {
  const { auth } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!auth.accessToken || !spreadsheetId) {
      setLoading(false)
      return
    }

    const sheets = new GoogleSheetsService(auth.accessToken)
    const setup = new SetupService(sheets, spreadsheetId, tabPrefix)

    // Retry logic for rate limit resilience
    async function initWithRetry() {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await setup.initializeMissingTabs()
          setLoading(false)
          return
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const isRateLimit = message.includes('429')

          if (isRateLimit && attempt < MAX_RETRIES - 1) {
            console.warn(`[useMissingTabs] Rate limited, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
            await sleep(RETRY_DELAY_MS * (attempt + 1))  // Increasing delay
          } else {
            throw err
          }
        }
      }
    }

    initWithRetry().catch(() => {
      setError(true)
      setLoading(false)
    })
  }, [auth.accessToken, spreadsheetId, tabPrefix])

  return { loading, error }
}
