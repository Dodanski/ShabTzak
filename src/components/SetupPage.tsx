import { useState } from 'react'
import { SetupService } from '../services/setupService'
import { GoogleSheetsService } from '../services/googleSheets'
import type { DataService } from '../services/dataService'
import type { AppConfig } from '../models'
import type { TabStatus } from '../services/setupService'

interface Props {
  ds: DataService | null
  isAdmin: boolean
  configData: AppConfig | null
  spreadsheetId: string
  onReload: () => void
}

export default function SetupPage({ ds, isAdmin, configData, spreadsheetId, onReload }: Props) {
  const [tabStatuses, setTabStatuses] = useState<TabStatus[]>([])
  const [initializing, setInitializing] = useState(false)
  const [initDone, setInitDone] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-red-600 text-lg font-medium">Access Denied</p>
        <p className="text-gray-500 mt-2">This page is only accessible to admins.</p>
      </div>
    )
  }

  function getSetupService(): SetupService | null {
    if (!ds) return null
    const sheets: GoogleSheetsService = (ds as any).soldiers.sheets
    return new SetupService(sheets, spreadsheetId)
  }

  async function handleCheckTabs() {
    const setup = getSetupService()
    if (!setup) return
    const results = await setup.checkTabs()
    setTabStatuses(results)
  }

  async function handleInitialize() {
    const setup = getSetupService()
    if (!setup) return
    setInitializing(true)
    setInitError(null)
    try {
      const results = await setup.initializeMissingTabs()
      setTabStatuses(results)
      setInitDone(true)
      onReload()
    } catch (e) {
      setInitError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setInitializing(false)
    }
  }

  async function handleAddAdmin() {
    const email = newAdminEmail.trim()
    if (!email || !ds) return
    setAdminSaving(true)
    try {
      const current = configData?.adminEmails ?? []
      if (!current.includes(email)) {
        await ds.config.writeAdminEmails([...current, email])
        onReload()
        setNewAdminEmail('')
      }
    } finally {
      setAdminSaving(false)
    }
  }

  async function handleRemoveAdmin(email: string) {
    if (!ds) return
    const current = configData?.adminEmails ?? []
    await ds.config.writeAdminEmails(current.filter(e => e !== email))
    onReload()
  }

  const extraAdmins = configData?.adminEmails ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Setup</h1>

      {/* Tab Health */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Spreadsheet Tabs</h2>
        <p className="text-sm text-gray-500">
          The app requires 8 tabs in your Google Sheet. Create any that are missing.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleCheckTabs}
            disabled={!ds}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Check Tabs
          </button>
          <button
            onClick={handleInitialize}
            disabled={!ds || initializing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {initializing ? 'Initializing…' : 'Initialize Missing Tabs'}
          </button>
        </div>

        {initError && <p className="text-sm text-red-600">{initError}</p>}
        {initDone && <p className="text-sm text-green-600">Done! All tabs are ready.</p>}

        {tabStatuses.length > 0 && (
          <ul className="space-y-1 mt-2">
            {tabStatuses.map(s => (
              <li key={s.tab} className="flex items-center gap-2 text-sm">
                <span>{s.exists ? '✅' : '❌'}</span>
                <span className="font-mono">{s.tab}</span>
                {s.created && <span className="text-green-600 text-xs">(created)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Admin Management */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Admin Users</h2>
        <p className="text-sm text-gray-500">Extra admins (in addition to the primary admin):</p>

        {extraAdmins.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No extra admins configured.</p>
        ) : (
          <ul className="space-y-1">
            {extraAdmins.map(email => (
              <li key={email} className="flex items-center justify-between text-sm">
                <span>{email}</span>
                <button
                  onClick={() => handleRemoveAdmin(email)}
                  className="text-red-500 hover:text-red-700 text-xs ml-4"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            value={newAdminEmail}
            onChange={e => setNewAdminEmail(e.target.value)}
            placeholder="new-admin@example.com"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddAdmin}
            disabled={!newAdminEmail.trim() || adminSaving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add Admin
          </button>
        </div>
      </section>
    </div>
  )
}
