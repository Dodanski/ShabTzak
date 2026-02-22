import { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import AppShell from './components/AppShell'
import Dashboard from './components/Dashboard'
import SoldiersPage from './components/SoldiersPage'
import LeaveRequestForm from './components/LeaveRequestForm'
import LeaveRequestsPage from './components/LeaveRequestsPage'
import SchedulePage from './components/SchedulePage'
import ErrorBoundary from './components/ErrorBoundary'
import { useDataService } from './hooks/useDataService'
import { config } from './config/env'
import type { ScheduleConflict, CreateLeaveRequestInput, CreateSoldierInput } from './models'

type Section = 'dashboard' | 'soldiers' | 'leave' | 'schedule'

function getHashSection(): Section {
  const hash = window.location.hash
  if (hash === '#soldiers') return 'soldiers'
  if (hash === '#leave') return 'leave'
  if (hash === '#schedule') return 'schedule'
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

function AppContent() {
  const [section, setSection] = useState<Section>(getHashSection)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [conflicts] = useState<ScheduleConflict[]>([])
  const scheduleDates = generateNextDays(30)

  useEffect(() => {
    const onHashChange = () => setSection(getHashSection())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { ds, soldiers, leaveRequests, tasks, taskAssignments, leaveAssignments, loading, reload } =
    useDataService(config.spreadsheetId)

  async function handleDischarge(soldierId: string) {
    await ds?.soldierService.discharge(soldierId, 'user')
    reload()
  }

  async function handleAddSoldier(input: CreateSoldierInput) {
    await ds?.soldierService.create(input, 'user')
    reload()
  }

  async function handleSubmitLeave(input: CreateLeaveRequestInput) {
    await ds?.leaveRequestService.submit(input, 'user')
    setShowLeaveForm(false)
    reload()
  }

  async function handleApprove(id: string) {
    await ds?.leaveRequestService.approve(id, 'user')
    reload()
  }

  async function handleDeny(id: string) {
    await ds?.leaveRequestService.deny(id, 'user')
    reload()
  }

  async function handleGenerateSchedule() {
    if (!ds) return
    const today = new Date().toISOString().split('T')[0]
    const days = generateNextDays(30)
    const end = days[days.length - 1] ?? today
    await ds.scheduleService.generateLeaveSchedule(today, end, 'user')
    await ds.scheduleService.generateTaskSchedule('user')
    reload()
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading…</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
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
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        />
      )}
    </AppShell>
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
