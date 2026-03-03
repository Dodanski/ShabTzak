import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import type { MasterDataService } from '../services/masterDataService'
import type { Admin, Unit, Commander, Task, AppConfig, CreateTaskInput, UpdateTaskInput } from '../models'
import { deriveTabPrefix } from '../utils/tabPrefix'
import TasksPage from './TasksPage'

type AdminTab = 'admins' | 'units' | 'commanders' | 'tasks' | 'config'

interface AdminPanelProps {
  masterDs: MasterDataService
  currentAdminEmail: string
  onEnterUnit: (unit: Unit) => void
}

export default function AdminPanel({ masterDs, currentAdminEmail, onEnterUnit }: AdminPanelProps) {
  const { signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('admins')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [commanders, setCommanders] = useState<Commander[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [configData, setConfigData] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitSheetId, setNewUnitSheetId] = useState('')
  const [newCmdEmail, setNewCmdEmail] = useState('')
  const [newCmdUnitId, setNewCmdUnitId] = useState('')

  async function reload() {
    setLoading(true)
    const [a, u, c, t, cfg] = await Promise.all([
      masterDs.admins.list(),
      masterDs.units.list(),
      masterDs.commanders.list(),
      masterDs.tasks.list(),
      masterDs.config.read(),
    ])
    setAdmins(a); setUnits(u); setCommanders(c); setTasks(t); setConfigData(cfg)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function handleAddAdmin() {
    if (!newAdminEmail) return
    setError(null)
    try {
      await masterDs.admins.create({ email: newAdminEmail }, currentAdminEmail)
      setNewAdminEmail('')
      await reload()
    } catch {
      setError('Failed to add admin')
    }
  }

  async function handleRemoveAdmin(id: string) {
    setError(null)
    try {
      await masterDs.admins.remove(id)
      await reload()
    } catch {
      setError('Failed to remove admin')
    }
  }

  async function handleAddUnit() {
    if (!newUnitName || !newUnitSheetId) return
    setError(null)
    try {
      await masterDs.units.create({ name: newUnitName, spreadsheetId: newUnitSheetId, tabPrefix: deriveTabPrefix(newUnitName) }, currentAdminEmail)
      setNewUnitName(''); setNewUnitSheetId('')
      await reload()
    } catch {
      setError('Failed to add unit')
    }
  }

  async function handleRemoveUnit(id: string) {
    setError(null)
    try {
      await masterDs.units.remove(id)
      await reload()
    } catch {
      setError('Failed to remove unit')
    }
  }

  async function handleAddCommander() {
    if (!newCmdEmail || !newCmdUnitId) return
    setError(null)
    try {
      await masterDs.commanders.create({ email: newCmdEmail, unitId: newCmdUnitId }, currentAdminEmail)
      setNewCmdEmail(''); setNewCmdUnitId('')
      await reload()
    } catch {
      setError('Failed to add commander')
    }
  }

  async function handleRemoveCommander(id: string) {
    setError(null)
    try {
      await masterDs.commanders.remove(id)
      await reload()
    } catch {
      setError('Failed to remove commander')
    }
  }

  async function handleAddTask(input: CreateTaskInput) {
    try { await masterDs.taskService.create(input, currentAdminEmail); await reload() }
    catch { /* ignore */ }
  }

  async function handleUpdateTask(input: UpdateTaskInput) {
    try { await masterDs.taskService.update(input, currentAdminEmail); await reload() }
    catch { /* ignore */ }
  }

  const derivedPrefix = deriveTabPrefix(newUnitName)

  const tabClass = (tab: AdminTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-olive-700 text-white'
        : 'text-olive-600 hover:bg-olive-100'
    }`

  return (
    <div className="min-h-screen bg-olive-50">
      <header className="bg-white border-b-2 border-olive-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo-unit.jpg`} alt="זאבי הגבעה" className="h-8 w-8 object-contain rounded" />
            <span className="text-xl font-bold text-olive-800">ShabTzak</span>
            <span className="text-sm text-olive-500 border-l border-olive-200 pl-3">Admin Panel</span>
          </div>
          <button onClick={signOut} className="text-sm text-olive-500 hover:text-red-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2">
          <button className={tabClass('admins')} onClick={() => setActiveTab('admins')}>Admins</button>
          <button className={tabClass('units')} onClick={() => setActiveTab('units')}>Units</button>
          <button className={tabClass('commanders')} onClick={() => setActiveTab('commanders')}>Commanders</button>
          <button className={tabClass('tasks')} onClick={() => setActiveTab('tasks')}>Tasks</button>
          <button className={tabClass('config')} onClick={() => setActiveTab('config')}>Config</button>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <p className="text-olive-500">Loading…</p>}

        {!loading && activeTab === 'admins' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Admins</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Email</th><th className="text-left p-2">Added At</th><th className="text-left p-2 rounded-tr">Action</th></tr></thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} className="border-b border-olive-100">
                    <td className="p-2">{a.email}</td>
                    <td className="p-2 text-olive-500">{a.addedAt ? new Date(a.addedAt).toLocaleDateString() : ''}</td>
                    <td className="p-2">
                      <button
                        onClick={() => handleRemoveAdmin(a.id)}
                        disabled={a.email === currentAdminEmail}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com" className="flex-1 border border-olive-200 rounded px-2 py-1 text-sm" />
              <button onClick={handleAddAdmin} className="px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Admin</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'units' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Units</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Name</th><th className="text-left p-2">Spreadsheet</th><th className="text-left p-2 rounded-tr">Actions</th></tr></thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id} className="border-b border-olive-100">
                    <td className="p-2 font-medium">{u.name}</td>
                    <td className="p-2">
                      <a href={`https://docs.google.com/spreadsheets/d/${u.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                        className="text-olive-600 hover:underline text-xs">Open ↗</a>
                    </td>
                    <td className="p-2 flex gap-2">
                      <button onClick={() => onEnterUnit(u)} className="text-xs px-2 py-1 bg-olive-700 text-white rounded hover:bg-olive-800">Enter Unit</button>
                      <button onClick={() => handleRemoveUnit(u.id)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                placeholder="Unit name"
                className="border border-olive-200 rounded px-2 py-1 text-sm"
              />
              <input
                value={newUnitSheetId}
                onChange={e => setNewUnitSheetId(e.target.value)}
                placeholder="Google Sheet ID"
                className="border border-olive-200 rounded px-2 py-1 text-sm"
              />
              {newUnitName && (
                <p className="col-span-2 text-xs text-olive-500">
                  Tab prefix: <span className="font-mono font-medium">{derivedPrefix}</span>
                  {' '}— soldiers tab: <span className="font-mono">{derivedPrefix}</span>, scheduling tabs: {derivedPrefix}_TaskSchedule, …
                </p>
              )}
              <button
                onClick={handleAddUnit}
                className="col-span-2 px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800"
              >
                Add Unit
              </button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'commanders' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Commanders</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Email</th><th className="text-left p-2">Unit</th><th className="text-left p-2 rounded-tr">Action</th></tr></thead>
              <tbody>
                {commanders.map(c => {
                  const unitName = units.find(u => u.id === c.unitId)?.name ?? c.unitId
                  return (
                    <tr key={c.id} className="border-b border-olive-100">
                      <td className="p-2">{c.email}</td>
                      <td className="p-2 text-olive-500">{unitName}</td>
                      <td className="p-2">
                        <button onClick={() => handleRemoveCommander(c.id)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-2">
              <input value={newCmdEmail} onChange={e => setNewCmdEmail(e.target.value)}
                placeholder="commander@example.com" className="border border-olive-200 rounded px-2 py-1 text-sm" />
              <select value={newCmdUnitId} onChange={e => setNewCmdUnitId(e.target.value)}
                className="border border-olive-200 rounded px-2 py-1 text-sm">
                <option value="">Select unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={handleAddCommander} className="col-span-2 px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Commander</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4">
            <TasksPage tasks={tasks} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} />
          </div>
        )}

        {!loading && activeTab === 'config' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Config</h2>
            <table className="w-full text-sm">
              <tbody>
                {configData && Object.entries(configData)
                  .filter(([, v]) => typeof v !== 'object')
                  .map(([k, v]) => <tr key={k}><td className="p-2 font-mono text-olive-700">{k}</td><td className="p-2">{String(v)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
