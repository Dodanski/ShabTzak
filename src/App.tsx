import React, { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import AppShell from './components/AppShell'
import Dashboard from './components/Dashboard'
import SoldiersPage from './components/SoldiersPage'
import LeaveRequestForm from './components/LeaveRequestForm'
import ScheduleCalendar from './components/ScheduleCalendar'
import type { Soldier, LeaveRequest, Task, TaskAssignment, LeaveAssignment, ScheduleConflict } from './models'

type Section = 'dashboard' | 'soldiers' | 'leave' | 'schedule'

function getHashSection(): Section {
  const hash = window.location.hash
  if (hash === '#soldiers') return 'soldiers'
  if (hash === '#leave') return 'leave'
  if (hash === '#schedule') return 'schedule'
  return 'dashboard'
}

function AppContent() {
  const [section, setSection] = useState<Section>(getHashSection)

  useEffect(() => {
    const onHashChange = () => setSection(getHashSection())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const [soldiers] = useState<Soldier[]>([])
  const [leaveRequests] = useState<LeaveRequest[]>([])
  const [tasks] = useState<Task[]>([])
  const [taskAssignments] = useState<TaskAssignment[]>([])
  const [leaveAssignments] = useState<LeaveAssignment[]>([])
  const [conflicts] = useState<ScheduleConflict[]>([])

  return (
    <AppShell>
      {section === 'dashboard' && (
        <Dashboard
          soldiers={soldiers}
          leaveRequests={leaveRequests}
          taskAssignments={taskAssignments}
          conflicts={conflicts}
          onGenerateSchedule={() => {}}
        />
      )}
      {section === 'soldiers' && (
        <SoldiersPage
          soldiers={soldiers}
          onDischarge={() => {}}
          onAddSoldier={() => {}}
        />
      )}
      {section === 'leave' && (
        <LeaveRequestForm
          soldiers={soldiers}
          onSubmit={() => {}}
          onCancel={() => setSection('dashboard')}
        />
      )}
      {section === 'schedule' && (
        <ScheduleCalendar
          soldiers={soldiers}
          dates={[]}
          tasks={tasks}
          taskAssignments={taskAssignments}
          leaveAssignments={leaveAssignments}
        />
      )}
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
