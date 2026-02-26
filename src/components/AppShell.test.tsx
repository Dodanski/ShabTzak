import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppShell from './AppShell'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { isAuthenticated: true, email: 'user@example.com' }, signOut: vi.fn() }),
}))

describe('AppShell', () => {
  it('renders unit logo in nav bar', () => {
    render(<AppShell>content</AppShell>)
    expect(screen.getByAltText('זאבי הגבעה')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<AppShell>content</AppShell>)
    expect(screen.getByRole('link', { name: /soldiers/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<AppShell><div>hello world</div></AppShell>)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('shows unit name when unitName prop is provided', () => {
    render(<AppShell unitName="Platoon Alpha">content</AppShell>)
    expect(screen.getByText('Platoon Alpha')).toBeInTheDocument()
  })

  it('shows Back to Admin Panel button when onBackToAdmin provided', () => {
    render(<AppShell onBackToAdmin={vi.fn()}>content</AppShell>)
    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument()
  })
})
