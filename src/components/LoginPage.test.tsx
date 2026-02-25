import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, AuthContextValue } from '../context/AuthContext'
import LoginPage from './LoginPage'
import React from 'react'

function renderWithMockAuth(signIn = vi.fn(), error: string | null = null) {
  const value: AuthContextValue = {
    auth: { isAuthenticated: false, accessToken: null, error },
    signIn,
    signOut: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={value}>
      <LoginPage />
    </AuthContext.Provider>
  )
}

describe('LoginPage', () => {
  it('renders the app name', () => {
    renderWithMockAuth()
    expect(screen.getByText(/ShabTzak/i)).toBeInTheDocument()
  })

  it('renders IDF logo', () => {
    renderWithMockAuth()
    expect(screen.getByAltText('IDF')).toBeInTheDocument()
  })

  it('renders unit logo', () => {
    renderWithMockAuth()
    expect(screen.getByAltText('זאבי הגבעה')).toBeInTheDocument()
  })

  it('renders a sign-in button', () => {
    renderWithMockAuth()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls signIn when sign-in button is clicked', async () => {
    const signIn = vi.fn()
    renderWithMockAuth(signIn)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(signIn).toHaveBeenCalledOnce()
  })

  it('does not show error message when error is null', () => {
    renderWithMockAuth(vi.fn(), null)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error message when auth error is set', () => {
    renderWithMockAuth(vi.fn(), 'access_denied')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
  })
})
