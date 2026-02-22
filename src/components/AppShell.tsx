import React from 'react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'

interface AppShellProps {
  children?: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { auth, signOut } = useAuth()

  if (!auth.isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">ShabTzak</span>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            <a href="#soldiers" className="hover:text-blue-600">Soldiers</a>
            <a href="#tasks" className="hover:text-blue-600">Tasks</a>
            <a href="#leave" className="hover:text-blue-600">Leave</a>
            <a href="#schedule" className="hover:text-blue-600">Schedule</a>
            <a href="#history" className="hover:text-blue-600">History</a>
          </nav>
          <button
            onClick={signOut}
            className="text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
