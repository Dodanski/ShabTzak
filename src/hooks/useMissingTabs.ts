import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleSheetsService } from '../services/googleSheets'
import { SetupService } from '../services/setupService'

export interface UseMissingTabsResult {
  missing: string[]
  loading: boolean
  error: boolean
}

export function useMissingTabs(spreadsheetId: string, tabPrefix: string): UseMissingTabsResult {
  const { auth } = useAuth()
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!auth.accessToken || !spreadsheetId) {
      setLoading(false)
      return
    }
    const sheets = new GoogleSheetsService(auth.accessToken)
    const setup = new SetupService(sheets, spreadsheetId, tabPrefix)
    setup.initializeMissingTabs()
      .then(() => {
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [auth.accessToken, spreadsheetId, tabPrefix])

  return { missing, loading, error }
}
