import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AccessDeniedPage from './AccessDeniedPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

describe('AccessDeniedPage', () => {
  it('renders access denied message', () => {
    render(<AccessDeniedPage />)
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(screen.getByText(/contact your admin/i)).toBeInTheDocument()
  })

  it('renders a sign out button', () => {
    render(<AccessDeniedPage />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
