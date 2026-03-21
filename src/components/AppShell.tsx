import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'
import BottomNav from './BottomNav'
import type { NavItem, MoreMenuItem } from './BottomNav'

interface AppShellProps {
  children?: React.ReactNode
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
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">

          {/* Left: unit logo + optional unit name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo-unit.jpg`}
              alt="זאבי הגבעה"
              className="h-7 sm:h-8 w-7 sm:w-8 object-contain rounded"
            />
            {unitName && (
              <span className="text-xs sm:text-sm font-medium text-olive-600 border-l border-olive-200 pl-2 sm:pl-3">
                {unitName}
              </span>
            )}
          </div>

          {/* Center: nav links - hidden on mobile */}
          <nav className="hidden md:flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            {navLinks.map(({ href, label }) => {
              const isActive = hash === href || (href === '#' && (hash === '' || hash === '#'))
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    isActive
                      ? 'text-olive-700 font-semibold border-b-2 border-olive-700 pb-0.5 px-1'
                      : 'text-olive-500 hover:text-olive-700 px-1'
                  }
                >
                  {label}
                </a>
              )
            })}
          </nav>

          {/* Right: back to admin + sign out */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="text-olive-500 hover:text-olive-700 transition-colors px-2 py-1"
              >
                ← Admin
              </button>
            )}
            <button
              onClick={signOut}
              className="text-olive-400 hover:text-red-600 transition-colors px-2 py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-2 sm:px-4 py-3 sm:py-6 pb-20 md:pb-6">
        {children}
      </main>

      {/* Bottom navigation for mobile */}
      <BottomNav
        items={[
          { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '#' },
          { id: 'soldiers', label: 'Soldiers', icon: '👥', href: '#soldiers' },
          { id: 'leave', label: 'Leave', icon: '🏠', href: '#leave' },
          { id: 'schedule', label: 'Schedule', icon: '📅', href: '#schedule' },
        ] as NavItem[]}
        moreItems={[
          { label: 'Tasks', href: '#tasks' },
          { label: 'History', href: '#history' },
        ] as MoreMenuItem[]}
        activeId={
          hash === '#soldiers' ? 'soldiers' :
          hash === '#leave' ? 'leave' :
          hash === '#schedule' ? 'schedule' :
          hash === '#tasks' ? 'tasks' :
          hash === '#history' ? 'history' :
          'dashboard'
        }
      />
    </div>
  )
}
