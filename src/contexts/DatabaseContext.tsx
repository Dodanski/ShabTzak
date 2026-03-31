import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Database } from '../types/Database'

interface DatabaseContextValue {
  database: Database | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  getData: () => Database
  setData: (db: Database) => void
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [database, setDatabase] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/data/database.json')
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setDatabase(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const getData = () => {
    if (!database) throw new Error('Database not loaded')
    return database
  }

  const setData = (db: Database) => {
    setDatabase(db)
  }

  return (
    <DatabaseContext.Provider value={{ database, loading, error, reload, getData, setData }}>
      {children}
    </DatabaseContext.Provider>
  )
}

export function useDatabase() {
  const context = useContext(DatabaseContext)
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider')
  }
  return context
}
