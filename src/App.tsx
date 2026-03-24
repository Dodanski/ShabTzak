import { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Dashboard from './components/Dashboard'
import SoldiersPage from './components/SoldiersPage'
import LeaveRequestForm from './components/LeaveRequestForm'
import LeaveRequestsPage from './components/LeaveRequestsPage'
import SchedulePage from './components/SchedulePage'
import TasksPage from './components/TasksPage'
import HistoryPage from './components/HistoryPage'
import ToastList from './components/ToastList'
import ErrorBoundary from './components/ErrorBoundary'
import { useDataService } from './hooks/useDataService'
import { useMissingTabs } from './hooks/useMissingTabs'
import { useToast } from './hooks/useToast'
import { useScheduleGenerator } from './hooks/useScheduleGenerator'
import ErrorBanner from './components/ErrorBanner'
import { config } from './config/env'
import { MasterDataService } from './services/masterDataService'
import AccessDeniedPage from './components/AccessDeniedPage'
import LoginPage from './components/LoginPage'
import AdminPanel from './components/AdminPanel'
import type { HistoryEntry } from './services/historyService'
import type { CreateLeaveRequestInput, CreateSoldierInput, UpdateSoldierInput, CreateTaskInput, Unit, Task, AppConfig } from './models'
import type { SoldierRole, SoldierStatus } from './constants'

type Section = 'dashboard' | 'soldiers' | 'tasks' | 'leave' | 'schedule' | 'history'

function getHashSection(): Section {
  const hash = window.location.hash
  if (hash === '#soldiers') return 'soldiers'
  if (hash === '#tasks') return 'tasks'
  if (hash === '#leave') return 'leave'
  if (hash === '#schedule') return 'schedule'
  if (hash === '#history') return 'history'
  return 'dashboard'
}

function generateNextDays(n: number): string[] {
  const today = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

interface UnitAppProps {
  spreadsheetId: string
  tabPrefix: string
  unitName: string
  masterDs: MasterDataService | null
  tasks: Task[]
  configData: AppConfig | null
  roles: string[]
  onBackToAdmin?: () => void
}

function UnitApp({ spreadsheetId, tabPrefix, unitName, masterDs, tasks, configData, roles, onBackToAdmin }: UnitAppProps) {
  const [section, setSection] = useState<Section>(getHashSection)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const scheduleDates = generateNextDays(80)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const onHashChange = () => setSection(getHashSection())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (section !== 'history' || !masterDs) return
    setHistoryLoading(true)
    masterDs.history.listAll()
      .then(entries => setHistoryEntries(entries))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false))
  }, [section, masterDs])

  const { loading: tabsLoading, error: tabsError } = useMissingTabs(spreadsheetId, tabPrefix)

  const { ds, soldiers, allSoldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload } =
    useDataService(spreadsheetId, tabPrefix, masterDs, true)  // true = load all soldiers
  const { auth } = useAuth()
  const { toasts, addToast, removeToast } = useToast()

  // Calculate schedule period - uses config dates if set, otherwise falls back to soldier service dates
  const getSchedulePeriod = () => {
    // Priority 1: Use config dates if they are set
    if (configData?.scheduleStartDate && configData?.scheduleEndDate) {
      return {
        start: configData.scheduleStartDate,
        end: configData.scheduleEndDate
      }
    }

    // Priority 2: Calculate from soldier service dates
    // Use allSoldiers if available (multi-unit), otherwise use unit soldiers
    const soldiersForPeriod = (allSoldiers && allSoldiers.length > 0) ? allSoldiers : soldiers

    if (soldiersForPeriod.length === 0) {
      // No soldiers: use default 80 days from today
      return { start: today, end: scheduleDates[scheduleDates.length - 1] ?? today }
    }
    // Find earliest serviceStart and latest serviceEnd from soldiers
    const serviceDates = soldiersForPeriod
      .filter(s => s.serviceStart && s.serviceEnd)
      .map(s => ({ start: new Date(s.serviceStart), end: new Date(s.serviceEnd) }))

    if (serviceDates.length === 0) {
      return { start: today, end: scheduleDates[scheduleDates.length - 1] ?? today }
    }

    const minStart = serviceDates.reduce((min, d) => d.start < min ? d.start : min, serviceDates[0].start)
    const maxEnd = serviceDates.reduce((max, d) => d.end > max ? d.end : max, serviceDates[0].end)

    return {
      start: minStart.toISOString().split('T')[0],
      end: maxEnd.toISOString().split('T')[0]
    }
  }

  const { start: scheduleStart, end: scheduleEnd } = getSchedulePeriod()

  // Generate dates for the actual schedule period
  const getScheduleDatesForPeriod = () => {
    const dates = []
    const currentDate = new Date(scheduleStart)
    const endDate = new Date(scheduleEnd)

    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }
    return dates
  }

  const actualScheduleDates = getScheduleDatesForPeriod()

  const { generate: runSchedule, conflicts, progress } = useScheduleGenerator(ds, tasks, configData, scheduleStart, scheduleEnd, allSoldiers)

  async function handleUpdateStatus(soldierId: string, status: SoldierStatus, reason?: string) {
    try {
      await ds?.soldierService.updateStatus(soldierId, status, auth.email ?? 'user', reason)
      reload()
      addToast(status === 'Active' ? 'Soldier reactivated' : 'Soldier deactivated', 'success')
    } catch {
      addToast('Failed to update soldier status', 'error')
    }
  }

  async function handleUpdateSoldier(input: UpdateSoldierInput) {
    try {
      const { id, ...fields } = input
      await ds?.soldierService.updateFields(id, fields, auth.email ?? 'user')
      reload()
      addToast('Soldier updated', 'success')
    } catch {
      addToast('Failed to update soldier', 'error')
    }
  }

  async function handleAddSoldier(input: CreateSoldierInput) {
    try { await ds?.soldierService.create(input, auth.email ?? 'user'); reload(); addToast('Soldier added', 'success') }
    catch { addToast('Failed to add soldier', 'error') }
  }

  async function handleAdjustFairness(soldierId: string, delta: number, reason: string) {
    try { await ds?.fairnessUpdate.applyManualAdjustment(soldierId, delta, reason, auth.email ?? 'user'); reload(); addToast('Fairness adjusted', 'success') }
    catch { addToast('Failed to adjust fairness', 'error') }
  }

  async function handleSubmitLeave(input: CreateLeaveRequestInput) {
    try { await ds?.leaveRequestService.submit(input, auth.email ?? 'user'); setShowLeaveForm(false); reload(); addToast('Leave request submitted', 'success') }
    catch { addToast('Failed to submit leave request', 'error') }
  }

  async function handleApprove(id: string) {
    try { await ds?.leaveRequestService.approve(id, auth.email ?? 'user'); reload(); addToast('Leave request approved', 'success') }
    catch { addToast('Failed to approve leave request', 'error') }
  }

  async function handleAddTask(input: CreateTaskInput) {
    try { await masterDs?.taskService.create(input, auth.email ?? 'user'); reload(); addToast('Task added', 'success') }
    catch { addToast('Failed to add task', 'error') }
  }

  async function handleDeny(id: string) {
    try { await ds?.leaveRequestService.deny(id, auth.email ?? 'user'); reload(); addToast('Leave request denied', 'success') }
    catch { addToast('Failed to deny leave request', 'error') }
  }

  async function handleManualAssign(soldierId: string, taskId: string, role: SoldierRole) {
    try {
      await ds?.taskAssignments.create({ taskId, soldierId, assignedRole: role, createdBy: auth.email ?? 'user' })
      reload()
      addToast('Assignment created', 'success')
    } catch { addToast('Failed to create assignment', 'error') }
  }

  async function handleGenerateSchedule() {
    if (!ds || !configData) return
    try {
      const result = await runSchedule(() => {
        // Reload data after schedule generation completes
        reload()
      })

      // All units now automatically see the shared master schedule.
      // No need to distribute - scheduleService saves to master sheet which all units read from.

      // Update fairness for newly created TASK assignments
      if (result?.taskAssignments) {
        const existingTaskIds = new Set(taskAssignments.map(a => a.scheduleId))
        const newTaskAssignments = result.taskAssignments.filter(a => !existingTaskIds.has(a.scheduleId))

        // Build a map from taskId to durationHours for quick lookup
        const taskDurationMap = new Map<string, number>()
        for (const task of tasks) {
          taskDurationMap.set(task.id, task.durationHours)
          // Also map expanded task IDs (e.g., "Tour 1_day0", "Tour 1_day1", etc.)
          // The expanded tasks share the same durationHours as the base task
        }

        console.log(`[App] Updating fairness for ${newTaskAssignments.length} new task assignments`)

        for (let i = 0; i < newTaskAssignments.length; i++) {
          const assignment = newTaskAssignments[i]
          // Extract base task ID (e.g., "Tour 1_day5" -> "Tour 1")
          const baseTaskId = assignment.taskId.replace(/_day\d+$/, '').replace(/_pill\d+$/, '')
          const durationHours = taskDurationMap.get(baseTaskId) ?? taskDurationMap.get(assignment.taskId) ?? 8

          try {
            await ds.fairnessUpdate.applyTaskAssignment(
              assignment.soldierId, durationHours, auth.email ?? 'user'
            )
          } catch (e) {
            console.warn('[App] Failed to update task fairness for soldier', assignment.soldierId, ':', e)
          }
          // Delay between updates to avoid API rate limiting
          if (i < newTaskAssignments.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }

      // Update fairness for newly created LEAVE assignments
      const existingLeaveIds = new Set(leaveAssignments.map(a => a.id))
      const leaveSchedule = await ds.scheduleService.generateLeaveSchedule(configData, today, scheduleEnd, auth.email ?? 'user')
      const newLeaveAssignments = leaveSchedule.assignments.filter(a => !existingLeaveIds.has(a.id))

      // Process fairness updates with delays to avoid API rate limiting
      // Rate: 1 update per second on average (more conservative for safety)
      for (let i = 0; i < newLeaveAssignments.length; i++) {
        const assignment = newLeaveAssignments[i]
        try {
          await ds.fairnessUpdate.applyLeaveAssignment(
            assignment.soldierId, assignment.leaveType, assignment.isWeekend, auth.email ?? 'user'
          )
        } catch (e) {
          console.warn('[App] Failed to update fairness for soldier', assignment.soldierId, ':', e)
          // Continue with next soldier even if one fails
        }
        // Consistent 1-second delay between updates for stable rate limiting
        if (i < newLeaveAssignments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      reload()
      addToast('Schedule generated and distributed', 'success')
    } catch (e) {
      console.error('[App] Schedule generation failed:', e)
      addToast('Failed to generate schedule', 'error')
    }
  }

  if (tabsLoading) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Checking spreadsheet…</p>
        </div>
      </AppShell>
    )
  }

  if (tabsError) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="max-w-xl mx-auto py-16 space-y-4">
          <h2 className="text-lg font-semibold text-red-700">Could not verify spreadsheet tabs</h2>
          <p className="text-sm text-gray-600">
            Failed to connect to the spreadsheet. Check your internet connection and reload the page.
          </p>
        </div>
      </AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading…</p>
        </div>
      </AppShell>
    )
  }

  const errorObj = error ? new Error(error) : null

  return (
    <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
      <ErrorBanner error={errorObj} onRetry={reload} />
      <ToastList toasts={toasts} onRemove={removeToast} />
      {section === 'dashboard' && (
        <Dashboard
          soldiers={soldiers}
          leaveRequests={leaveRequests}
          taskAssignments={taskAssignments}
          conflicts={conflicts}
          onGenerateSchedule={handleGenerateSchedule}
        />
      )}

      {section === 'soldiers' && (
        <SoldiersPage
          soldiers={soldiers}
          onUpdateStatus={handleUpdateStatus}
          onUpdateSoldier={handleUpdateSoldier}
          onAddSoldier={handleAddSoldier}
          onAdjustFairness={handleAdjustFairness}
          leaveAssignments={leaveAssignments}
          roles={roles}
        />
      )}

      {section === 'tasks' && (
        <TasksPage
          tasks={tasks}
          onAddTask={handleAddTask}
          roles={roles}
        />
      )}

      {section === 'leave' && (
        showLeaveForm ? (
          <LeaveRequestForm
            soldiers={soldiers}
            onSubmit={handleSubmitLeave}
            onCancel={() => setShowLeaveForm(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowLeaveForm(true)}
                className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
              >
                New Request
              </button>
            </div>
            <LeaveRequestsPage
              leaveRequests={leaveRequests}
              soldiers={soldiers}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          </div>
        )
      )}

      {section === 'schedule' && (
        <SchedulePage
          soldiers={soldiers}
          allSoldiers={allSoldiers}
          dates={actualScheduleDates}
          tasks={tasks}
          taskAssignments={taskAssignments.filter(a => {
            // Filter to show only assignments for soldiers in this unit
            // Use assignedUnitId to handle duplicate soldier IDs across units
            if (a.assignedUnitId) {
              return a.assignedUnitId === unitName
            }
            // Fallback: check if soldier is in current unit's soldier list
            return soldiers.some(s => s.id === a.soldierId)
          })}
          leaveAssignments={leaveAssignments}
          conflicts={conflicts}
          onGenerate={handleGenerateSchedule}
          onManualAssign={handleManualAssign}
          onReload={reload}
          roles={roles}
          progress={progress}
          scheduleStart={scheduleStart}
          scheduleEnd={scheduleEnd}
        />
      )}

      {section === 'history' && (
        <HistoryPage entries={historyEntries} loading={historyLoading} />
      )}

    </AppShell>
  )
}

type AppMode = 'loading' | 'admin' | 'unit' | 'denied'

function AppContent() {
  const { auth } = useAuth()
  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [masterDs, setMasterDs] = useState<MasterDataService | null>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [configData, setConfigData] = useState<AppConfig | null>(null)
  const [roles, setRoles] = useState<string[]>([])

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.email || !auth.accessToken) {
      setAppMode('loading')
      return
    }
    const master = new MasterDataService(auth.accessToken, config.spreadsheetId)
    setMasterDs(master)
    master.initialize(config.adminEmail)
      .then(() => master.resolveRole(auth.email!))
      .then(resolved => {
        if (!resolved) { setAppMode('denied'); return null }
        if (resolved.role === 'admin') { setAppMode('admin') }
        if (resolved.role === 'commander') {
          setActiveUnit(resolved.unit)
          setAppMode('unit')
        }
        return Promise.all([master.tasks.list(), master.config.read(), master.roles.list()])
      })
      .then(result => {
        if (!result) return
        const [loadedTasks, loadedConfig, loadedRoles] = result
        setTasks(loadedTasks ?? [])
        setConfigData(loadedConfig)
        setRoles(loadedRoles ?? [])
      })
      .catch(() => setAppMode('denied'))
  }, [auth.isAuthenticated, auth.email, auth.accessToken])

  if (!auth.isAuthenticated) return <LoginPage />
  if (appMode === 'loading') return (
    <div className="min-h-screen bg-olive-50 flex items-center justify-center">
      <p className="text-olive-500">Loading…</p>
    </div>
  )
  if (appMode === 'denied') return <AccessDeniedPage />
  if (appMode === 'admin' && !activeUnit) {
    return (
      <AdminPanel
        masterDs={masterDs!}
        currentAdminEmail={auth.email!}
        onEnterUnit={(unit) => { setActiveUnit(unit) }}
      />
    )
  }

  // Unit view — for both commanders and admins who entered a unit
  const isAdmin = appMode === 'admin'

  return (
    <UnitApp
      spreadsheetId={activeUnit?.spreadsheetId ?? ''}
      tabPrefix={activeUnit?.tabPrefix || activeUnit?.name || ''}
      unitName={activeUnit?.name ?? ''}
      masterDs={masterDs}
      tasks={tasks}
      configData={configData}
      roles={roles}
      onBackToAdmin={isAdmin ? () => { setActiveUnit(null); setAppMode('admin') } : undefined}
    />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
