import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, AuthContextValue } from '../context/AuthContext'
import LoginPage from './LoginPage'
import React from 'react'

function renderWithMockAuth(signIn = vi.fn()) {
  const value: AuthContextValue = {
    auth: { isAuthenticated: false, accessToken: null },
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
})
