import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, AuthContextValue } from '../context/AuthContext'
import AppShell from './AppShell'
import React from 'react'

function renderWithAuth(isAuthenticated: boolean, signOut = vi.fn()) {
  const value: AuthContextValue = {
    auth: { isAuthenticated, accessToken: isAuthenticated ? 'tok' : null },
    signIn: vi.fn(),
    signOut,
  }
  return render(
    <AuthContext.Provider value={value}>
      <AppShell>
        <p>Dashboard content</p>
      </AppShell>
    </AuthContext.Provider>
  )
}

describe('AppShell', () => {
  it('shows LoginPage (sign-in button) when not authenticated', () => {
    renderWithAuth(false)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('shows children when authenticated', () => {
    renderWithAuth(true)
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('shows navigation header when authenticated', () => {
    renderWithAuth(true)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByText(/ShabTzak/i)).toBeInTheDocument()
  })

  it('shows a sign-out button when authenticated', () => {
    renderWithAuth(true)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows Config nav link when authenticated', () => {
    renderWithAuth(true)
    expect(screen.getByRole('link', { name: /config/i })).toBeInTheDocument()
  })

  it('calls signOut when sign-out button is clicked', async () => {
    const signOut = vi.fn()
    renderWithAuth(true, signOut)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalledOnce()
  })
})
