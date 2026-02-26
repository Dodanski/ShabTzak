import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'

interface AppShellProps {
  children?: React.ReactNode
  isAdmin?: boolean
  unitName?: string
  onBackToAdmin?: () => void
}

export default function AppShell({ children, unitName, onBackToAdmin }: AppShellProps) {
  const navLinks = [
    { href: '#', label: 'Dashboard' },
    { href: '#soldiers', label: 'Soldiers' },
    { href: '#tasks', label: 'Tasks' },
    { href: '#leave', label: 'Leave' },
    { href: '#schedule', label: 'Schedule' },
    { href: '#history', label: 'History' },
  ]

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
    <div className="min-h-screen bg-olive-50">
      <header className="bg-white border-b-2 border-olive-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Left: unit logo + optional unit name */}
          <div className="flex items-center gap-3">
            <img
              src="/logo-unit.jpg"
              alt="זאבי הגבעה"
              className="h-8 w-8 object-contain rounded"
            />
            {unitName && (
              <span className="text-sm font-medium text-olive-600 border-l border-olive-200 pl-3">
                {unitName}
              </span>
            )}
          </div>

          {/* Center: nav links */}
          <nav className="flex items-center gap-4 text-sm">
            {navLinks.map(({ href, label }) => {
              const isActive = hash === href || (href === '#' && (hash === '' || hash === '#'))
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    isActive
                      ? 'text-olive-700 font-semibold border-b-2 border-olive-700 pb-0.5'
                      : 'text-olive-500 hover:text-olive-700'
                  }
                >
                  {label}
                </a>
              )
            })}
          </nav>

          {/* Right: back to admin + sign out */}
          <div className="flex items-center gap-3">
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="text-sm text-olive-500 hover:text-olive-700 transition-colors"
              >
                ← Admin Panel
              </button>
            )}
            <button
              onClick={signOut}
              className="text-sm text-olive-400 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
