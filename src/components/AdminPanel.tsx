import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import type { MasterDataService } from '../services/masterDataService'
import type { Admin, Unit, Commander, Task, Soldier, AppConfig, CreateTaskInput, UpdateTaskInput, TaskAssignment } from '../models'
import { deriveTabPrefix } from '../utils/tabPrefix'
import TasksPage from './TasksPage'
import AdminDashboard from './AdminDashboard'
import DiagnosticPage from './DiagnosticPage'
import BottomNav from './BottomNav'
import type { NavItem, MoreMenuItem } from './BottomNav'
import { useIsMobile } from '../hooks/useIsMobile'

type AdminTab = 'dashboard' | 'admins' | 'units' | 'commanders' | 'roles' | 'tasks' | 'config' | 'diagnostic'

interface AdminPanelProps {
  masterDs: MasterDataService
  currentAdminEmail: string
  onEnterUnit: (unit: Unit) => void
}

export default function AdminPanel({ masterDs, currentAdminEmail, onEnterUnit }: AdminPanelProps) {
  const { signOut } = useAuth()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [commanders, setCommanders] = useState<Commander[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [configData, setConfigData] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitSheetId, setNewUnitSheetId] = useState('')
  const [newCmdEmail, setNewCmdEmail] = useState('')
  const [newCmdUnitId, setNewCmdUnitId] = useState('')
  const [editingConfig, setEditingConfig] = useState<Record<string, string | number>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [scheduleGenerating, setScheduleGenerating] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleSuccess, setScheduleSuccess] = useState(false)

  async function handleGenerateScheduleForAllUnits() {
    setScheduleError(null)
    setScheduleSuccess(false)
    setScheduleGenerating(true)

    try {
      if (!configData) {
        throw new Error('Config not loaded')
      }

      const today = new Date().toISOString().split('T')[0]
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + 80)
      const scheduleEnd = endDate.toISOString().split('T')[0]

      // IMPORTANT: Generate TASK schedule FIRST (tasks have priority)
      // Expand recurring tasks
      const expandTasksModule = await import('../algorithms/taskExpander')
      const expandedTasks = expandTasksModule.expandRecurringTasks(tasks, scheduleEnd)

      // Debug: Log data before scheduling
      console.log('[AdminPanel] === SCHEDULE GENERATION DEBUG ===')
      console.log('[AdminPanel] Soldiers:', soldiers.length)
      soldiers.slice(0, 5).forEach(s => {
        console.log(`  - ${s.id}: role="${s.role}" status="${s.status}" service=${s.serviceStart} to ${s.serviceEnd}`)
      })
      console.log('[AdminPanel] Tasks:', tasks.length)
      tasks.slice(0, 3).forEach(t => {
        const roles = t.roleRequirements.map(r => {
          const roleList = r.roles ?? (r.role ? [r.role] : [])
          return `${r.count}x[${roleList.join('|')}]`
        }).join(', ')
        console.log(`  - ${t.id}: ${t.taskType} requires: ${roles || 'EMPTY!'}`)
      })
      console.log('[AdminPanel] Expanded tasks:', expandedTasks.length)

      // Generate task schedule for all soldiers FIRST
      console.log('[AdminPanel] Generating task schedule for all', soldiers.length, 'soldiers...')
      const taskSchedule = await masterDs.scheduleService.generateTaskSchedule(
        expandedTasks,
        currentAdminEmail,
        undefined,
        undefined,  // Don't pass leave assignments yet - tasks take priority
        configData,
        soldiers  // Pass all soldiers from admin sheet
      )

      console.log('[AdminPanel] Generated tasks:', taskSchedule.assignments.length)

      // THEN generate leave schedule, respecting task assignments
      // Pass all soldiers, task assignments, and expanded tasks so leaves are calculated globally
      // and soldiers on tasks are excluded from leave capacity
      console.log('[AdminPanel] Generating leave schedule for all units...')
      const leaveSchedule = await masterDs.scheduleService.generateLeaveSchedule(
        configData,
        today,
        scheduleEnd,
        currentAdminEmail,
        soldiers,  // All soldiers from all units
        taskSchedule.assignments,  // Task assignments to respect (soldiers on tasks can't be on leave)
        expandedTasks  // Expanded tasks for looking up task dates
      )

      console.log('[AdminPanel] Generated leaves:', leaveSchedule.assignments.length)

      console.log('[AdminPanel] Generated tasks:', taskSchedule.assignments.length)
      setScheduleSuccess(true)
      await reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate schedule'
      console.error('[AdminPanel] Error generating schedule:', err)
      setScheduleError(message)
    } finally {
      setScheduleGenerating(false)
    }
  }

  async function reload() {
    setLoading(true)
    const [a, u, c, r, t, cfg, s, ta] = await Promise.all([
      masterDs.admins.list(),
      masterDs.units.list(),
      masterDs.commanders.list(),
      masterDs.roles.list(),
      masterDs.tasks.list(),
      masterDs.config.read(),
      masterDs.soldiers.list(),
      masterDs.taskAssignments.list(),
    ])
    setAdmins(a); setUnits(u); setCommanders(c); setRoles(r); setTasks(t); setConfigData(cfg); setSoldiers(s); setTaskAssignments(ta)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  useEffect(() => {
    if (configData) {
      setEditingConfig({
        leaveRatioDaysInBase: configData.leaveRatioDaysInBase,
        leaveRatioDaysHome: configData.leaveRatioDaysHome,
        longLeaveMaxDays: configData.longLeaveMaxDays,
        minBasePresence: configData.minBasePresence,
        maxDrivingHours: configData.maxDrivingHours,
        defaultRestPeriod: configData.defaultRestPeriod,
        leaveBaseExitHour: configData.leaveBaseExitHour,
        leaveBaseReturnHour: configData.leaveBaseReturnHour,
      })
    }
  }, [configData])

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

  async function handleAddRole() {
    if (!newRoleName.trim()) return
    setError(null)
    try {
      await masterDs.roles.create(newRoleName.trim())
      setNewRoleName('')
      await reload()
    } catch {
      setError('Failed to add role')
    }
  }

  async function handleDeleteRole(name: string) {
    setError(null)
    try {
      await masterDs.roles.delete(name)
      await reload()
    } catch {
      setError('Failed to delete role')
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

  async function handleSaveConfig() {
    if (!configData) return
    setError(null)
    setConfigLoading(true)
    try {
      await masterDs.config.writeConfig(editingConfig)
      await reload()
      setError(null)
    } catch (err) {
      setError('Failed to save config')
    } finally {
      setConfigLoading(false)
    }
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

      <main className="max-w-5xl mx-auto px-4 py-6 pb-20 sm:pb-6 space-y-6">
        {/* Desktop tabs - hidden on mobile */}
        <div className="hidden sm:flex gap-2 flex-wrap">
          <button className={tabClass('dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={tabClass('admins')} onClick={() => setActiveTab('admins')}>Admins</button>
          <button className={tabClass('units')} onClick={() => setActiveTab('units')}>Units</button>
          <button className={tabClass('commanders')} onClick={() => setActiveTab('commanders')}>Commanders</button>
          <button className={tabClass('roles')} onClick={() => setActiveTab('roles')}>Roles</button>
          <button className={tabClass('tasks')} onClick={() => setActiveTab('tasks')}>Tasks</button>
          <button className={tabClass('config')} onClick={() => setActiveTab('config')}>Config</button>
          <button className={tabClass('diagnostic')} onClick={() => setActiveTab('diagnostic')}>Diagnostic</button>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <p className="text-olive-500">Loading…</p>}

        {!loading && activeTab === 'dashboard' && (
          <AdminDashboard
            tasks={tasks}
            soldiers={soldiers}
            taskAssignments={taskAssignments}
            onGenerateSchedule={handleGenerateScheduleForAllUnits}
            isGeneratingSchedule={scheduleGenerating}
            scheduleError={scheduleError}
            scheduleSuccess={scheduleSuccess}
          />
        )}

        {!loading && activeTab === 'admins' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Admins</h2>
            {/* Mobile card view */}
            {isMobile && (
              <div className="space-y-3">
                {admins.map(a => (
                  <div key={a.id} className="border border-olive-100 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-olive-800 text-sm break-all">{a.email}</p>
                        <p className="text-xs text-olive-500">{a.addedAt ? new Date(a.addedAt).toLocaleDateString() : ''}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(a.id)}
                        disabled={a.email === currentAdminEmail}
                        className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-40"
                      >Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Desktop table view */}
            {!isMobile && (
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
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com" className="flex-1 border border-olive-200 rounded px-3 py-2 text-sm" />
              <button onClick={handleAddAdmin} className="px-3 py-2 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Admin</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'units' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Units</h2>
            {/* Mobile card view */}
            {isMobile && (
              <div className="space-y-3">
                {units.map(u => (
                  <div key={u.id} className="border border-olive-100 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-olive-800">{u.name}</h3>
                      <a href={`https://docs.google.com/spreadsheets/d/${u.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                        className="text-olive-600 hover:underline text-xs">Open ↗</a>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onEnterUnit(u)} className="flex-1 py-2 text-sm bg-olive-700 text-white rounded hover:bg-olive-800">Enter Unit</button>
                      <button onClick={() => handleRemoveUnit(u.id)} className="py-2 px-3 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Desktop table view */}
            {!isMobile && (
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
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={newUnitName}
                onChange={e => setNewUnitName(e.target.value)}
                placeholder="Unit name"
                className="border border-olive-200 rounded px-3 py-2 text-sm"
              />
              <input
                value={newUnitSheetId}
                onChange={e => setNewUnitSheetId(e.target.value)}
                placeholder="Google Sheet ID"
                className="border border-olive-200 rounded px-3 py-2 text-sm"
              />
              {newUnitName && (
                <p className="col-span-1 sm:col-span-2 text-xs text-olive-500">
                  Tab prefix: <span className="font-mono font-medium">{derivedPrefix}</span>
                  {' '}— soldiers tab: <span className="font-mono">{derivedPrefix}</span>, scheduling tabs: {derivedPrefix}_TaskSchedule, …
                </p>
              )}
              <button
                onClick={handleAddUnit}
                className="col-span-1 sm:col-span-2 px-3 py-2 bg-olive-700 text-white text-sm rounded hover:bg-olive-800"
              >
                Add Unit
              </button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'commanders' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Commanders</h2>
            {/* Mobile card view */}
            {isMobile && (
              <div className="space-y-3">
                {commanders.map(c => {
                  const unitName = units.find(u => u.id === c.unitId)?.name ?? c.unitId
                  return (
                    <div key={c.id} className="border border-olive-100 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-olive-800 text-sm break-all">{c.email}</p>
                          <p className="text-xs text-olive-500">{unitName}</p>
                        </div>
                        <button onClick={() => handleRemoveCommander(c.id)} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Desktop table view */}
            {!isMobile && (
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
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={newCmdEmail} onChange={e => setNewCmdEmail(e.target.value)}
                placeholder="commander@example.com" className="border border-olive-200 rounded px-3 py-2 text-sm" />
              <select value={newCmdUnitId} onChange={e => setNewCmdUnitId(e.target.value)}
                className="border border-olive-200 rounded px-3 py-2 text-sm">
                <option value="">Select unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={handleAddCommander} className="col-span-1 sm:col-span-2 px-3 py-2 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Commander</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'roles' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Roles</h2>
            {roles.length === 0 && (
              <p className="text-sm text-gray-400">No roles configured. Add one below.</p>
            )}
            {roles.length > 0 && (
              <ul className="space-y-1">
                {roles.map(r => (
                  <li key={r} className="flex items-center justify-between px-3 py-2 bg-white rounded border border-olive-100">
                    <span className="text-sm">{r}</span>
                    <button
                      onClick={() => handleDeleteRole(r)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                placeholder="New role name"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleAddRole}
                disabled={!newRoleName.trim()}
                className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
              >
                Add Role
              </button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4">
            <TasksPage tasks={tasks} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} roles={roles} />
          </div>
        )}

        {!loading && activeTab === 'config' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Configuration</h2>
            {configData && (
              <div className="grid grid-cols-2 gap-4">
                {/* Numeric fields */}
                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Leave Days in Base</label>
                  <input
                    type="number"
                    value={editingConfig.leaveRatioDaysInBase ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, leaveRatioDaysInBase: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Days soldier stays in base per cycle</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Leave Days at Home</label>
                  <input
                    type="number"
                    value={editingConfig.leaveRatioDaysHome ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, leaveRatioDaysHome: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Days soldier stays at home per cycle</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Long Leave Max Days</label>
                  <input
                    type="number"
                    value={editingConfig.longLeaveMaxDays ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, longLeaveMaxDays: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Min Base Presence</label>
                  <input
                    type="number"
                    value={editingConfig.minBasePresence ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, minBasePresence: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum soldiers required on base per role</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Max Driving Hours (per day)</label>
                  <input
                    type="number"
                    value={editingConfig.maxDrivingHours ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, maxDrivingHours: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Default Rest Period (hours)</label>
                  <input
                    type="number"
                    value={editingConfig.defaultRestPeriod ?? 0}
                    onChange={e => setEditingConfig({ ...editingConfig, defaultRestPeriod: parseInt(e.target.value) })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                </div>

                {/* Time fields */}
                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Leave Base Exit Hour (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={editingConfig.leaveBaseExitHour ?? ''}
                    onChange={e => setEditingConfig({ ...editingConfig, leaveBaseExitHour: e.target.value })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Time soldier departs for leave (e.g., 06:00)</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-olive-600 block mb-1">Leave Base Return Hour (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={editingConfig.leaveBaseReturnHour ?? ''}
                    onChange={e => setEditingConfig({ ...editingConfig, leaveBaseReturnHour: e.target.value })}
                    className="w-full border border-olive-200 rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Time soldier returns from leave (e.g., 22:00)</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSaveConfig}
                disabled={configLoading}
                className="px-4 py-2 bg-olive-700 text-white text-sm rounded hover:bg-olive-800 disabled:opacity-50"
              >
                {configLoading ? 'Saving...' : 'Save Config'}
              </button>
              <button
                onClick={() => setEditingConfig({
                  leaveRatioDaysInBase: configData?.leaveRatioDaysInBase ?? 10,
                  leaveRatioDaysHome: configData?.leaveRatioDaysHome ?? 4,
                  longLeaveMaxDays: configData?.longLeaveMaxDays ?? 4,
                  minBasePresence: configData?.minBasePresence ?? 20,
                  maxDrivingHours: configData?.maxDrivingHours ?? 8,
                  defaultRestPeriod: configData?.defaultRestPeriod ?? 6,
                  leaveBaseExitHour: configData?.leaveBaseExitHour ?? '06:00',
                  leaveBaseReturnHour: configData?.leaveBaseReturnHour ?? '22:00',
                })}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'diagnostic' && (
          <DiagnosticPage masterDs={masterDs} />
        )}
      </main>

      {/* Bottom navigation for mobile */}
      <BottomNav
        items={[
          { id: 'dashboard', label: 'Dashboard', icon: '📊', onClick: () => setActiveTab('dashboard') },
          { id: 'units', label: 'Units', icon: '🏢', onClick: () => setActiveTab('units') },
          { id: 'tasks', label: 'Tasks', icon: '📋', onClick: () => setActiveTab('tasks') },
          { id: 'config', label: 'Config', icon: '⚙️', onClick: () => setActiveTab('config') },
        ] as NavItem[]}
        moreItems={[
          { label: 'Admins', onClick: () => setActiveTab('admins') },
          { label: 'Commanders', onClick: () => setActiveTab('commanders') },
          { label: 'Roles', onClick: () => setActiveTab('roles') },
          { label: 'Diagnostic', onClick: () => setActiveTab('diagnostic') },
        ] as MoreMenuItem[]}
        activeId={activeTab}
      />
    </div>
  )
}
