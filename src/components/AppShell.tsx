import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'

interface AppShellProps {
  children?: React.ReactNode
}

const NAV_LINKS = [
  { href: '#soldiers', label: 'Soldiers' },
  { href: '#tasks', label: 'Tasks' },
  { href: '#leave', label: 'Leave' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#history', label: 'History' },
  { href: '#config', label: 'Config' },
]

export default function AppShell({ children }: AppShellProps) {
  const { auth, signOut } = useAuth()
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (!auth.isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">ShabTzak</span>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = hash === href
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'text-blue-600 font-medium' : 'hover:text-blue-600'}
                >
                  {label}
                </a>
              )
            })}
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
