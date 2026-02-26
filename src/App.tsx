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
import { useToast } from './hooks/useToast'
import { useVersionCheck } from './hooks/useVersionCheck'
import { useScheduleGenerator } from './hooks/useScheduleGenerator'
import VersionConflictBanner from './components/VersionConflictBanner'
import ErrorBanner from './components/ErrorBanner'
import { config } from './config/env'
import { MasterDataService } from './services/masterDataService'
import AccessDeniedPage from './components/AccessDeniedPage'
import LoginPage from './components/LoginPage'
import type { CreateLeaveRequestInput, CreateSoldierInput, CreateTaskInput, Unit } from './models'
import type { SoldierRole } from './constants'

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
  isAdmin: boolean
  unitName: string
  onBackToAdmin?: () => void
}

function UnitApp({ spreadsheetId, isAdmin, unitName, onBackToAdmin }: UnitAppProps) {
  const [section, setSection] = useState<Section>(getHashSection)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const scheduleDates = generateNextDays(30)
  const today = new Date().toISOString().split('T')[0]
  const scheduleEnd = scheduleDates[scheduleDates.length - 1] ?? today

  useEffect(() => {
    const onHashChange = () => setSection(getHashSection())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { ds, soldiers, leaveRequests, tasks, taskAssignments, leaveAssignments, historyEntries, configData, loading, error, reload } =
    useDataService(spreadsheetId)
  const { auth } = useAuth()
  const { toasts, addToast, removeToast } = useToast()
  const { isStale } = useVersionCheck(ds, 'Soldiers')
  const { generate: runSchedule, conflicts } = useScheduleGenerator(ds, today, scheduleEnd)

  async function handleDischarge(soldierId: string) {
    try { await ds?.soldierService.discharge(soldierId, 'user'); reload(); addToast('Soldier discharged', 'success') }
    catch { addToast('Failed to discharge soldier', 'error') }
  }

  async function handleAddSoldier(input: CreateSoldierInput) {
    try { await ds?.soldierService.create(input, 'user'); reload(); addToast('Soldier added', 'success') }
    catch { addToast('Failed to add soldier', 'error') }
  }

  async function handleAdjustFairness(soldierId: string, delta: number, reason: string) {
    try { await ds?.fairnessUpdate.applyManualAdjustment(soldierId, delta, reason, 'user'); reload(); addToast('Fairness adjusted', 'success') }
    catch { addToast('Failed to adjust fairness', 'error') }
  }

  async function handleSubmitLeave(input: CreateLeaveRequestInput) {
    try { await ds?.leaveRequestService.submit(input, 'user'); setShowLeaveForm(false); reload(); addToast('Leave request submitted', 'success') }
    catch { addToast('Failed to submit leave request', 'error') }
  }

  async function handleApprove(id: string) {
    try { await ds?.leaveRequestService.approve(id, 'user'); reload(); addToast('Leave request approved', 'success') }
    catch { addToast('Failed to approve leave request', 'error') }
  }

  async function handleAddTask(input: CreateTaskInput) {
    try { await ds?.taskService.create(input, 'user'); reload(); addToast('Task added', 'success') }
    catch { addToast('Failed to add task', 'error') }
  }

  async function handleDeny(id: string) {
    try { await ds?.leaveRequestService.deny(id, 'user'); reload(); addToast('Leave request denied', 'success') }
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
    if (!ds) return
    try {
      await runSchedule()
      // Update fairness for newly created leave assignments
      const existingIds = new Set(leaveAssignments.map(a => a.id))
      const leaveSchedule = await ds.scheduleService.generateLeaveSchedule(today, scheduleEnd, 'user')
      for (const assignment of leaveSchedule.assignments) {
        if (!existingIds.has(assignment.id)) {
          await ds.fairnessUpdate.applyLeaveAssignment(
            assignment.soldierId, assignment.leaveType, assignment.isWeekend, 'user'
          )
        }
      }
      reload()
      addToast('Schedule generated', 'success')
    } catch { addToast('Failed to generate schedule', 'error') }
  }

  if (loading) {
    return (
      <AppShell isAdmin={isAdmin} unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading…</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell isAdmin={isAdmin} unitName={unitName} onBackToAdmin={onBackToAdmin}>
      <VersionConflictBanner isStale={isStale} onReload={reload} />
      <ErrorBanner error={error} onRetry={reload} />
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
          onDischarge={handleDischarge}
          onAddSoldier={handleAddSoldier}
          onAdjustFairness={handleAdjustFairness}
          configData={configData}
          leaveAssignments={leaveAssignments}
        />
      )}

      {section === 'tasks' && (
        <TasksPage
          tasks={tasks}
          onAddTask={handleAddTask}
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
          dates={scheduleDates}
          tasks={tasks}
          taskAssignments={taskAssignments}
          leaveAssignments={leaveAssignments}
          conflicts={conflicts}
          onGenerate={handleGenerateSchedule}
          onManualAssign={handleManualAssign}
        />
      )}

      {section === 'history' && (
        <HistoryPage entries={historyEntries} loading={loading} />
      )}

    </AppShell>
  )
}

type AppMode = 'loading' | 'admin' | 'unit' | 'denied'

// Placeholder for AdminPanel — will be implemented in Task 8
function AdminPanel(_props: { masterDs: MasterDataService; currentAdminEmail: string; onEnterUnit: (unit: Unit) => void }) {
  return <div>Admin Panel Coming Soon</div>
}

function AppContent() {
  const { auth } = useAuth()
  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [masterDs, setMasterDs] = useState<MasterDataService | null>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)

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
        if (!resolved) { setAppMode('denied'); return }
        if (resolved.role === 'admin') { setAppMode('admin') }
        if (resolved.role === 'commander') {
          setActiveUnit(resolved.unit)
          setAppMode('unit')
        }
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
        onEnterUnit={(unit) => { setActiveUnit(unit); setAppMode('unit') }}
      />
    )
  }

  // Unit view — for both commanders and admins who entered a unit
  const spreadsheetId = activeUnit?.spreadsheetId ?? ''
  const isAdmin = appMode === 'admin'

  return (
    <UnitApp
      spreadsheetId={spreadsheetId}
      isAdmin={isAdmin}
      unitName={activeUnit?.name ?? ''}
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
