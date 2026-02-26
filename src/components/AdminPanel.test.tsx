import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminPanel from './AdminPanel'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { email: 'admin@example.com' }, signOut: vi.fn() }),
}))

const mockMasterDs = {
  admins: {
    list: vi.fn().mockResolvedValue([
      { id: 'a1', email: 'admin@example.com', addedAt: '2026-01-01T00:00:00.000Z', addedBy: 'system' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'a2', email: 'new@example.com', addedAt: '', addedBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  units: {
    list: vi.fn().mockResolvedValue([
      { id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc', createdAt: '', createdBy: '' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'unit-2', name: 'Bravo', spreadsheetId: 'sheet-xyz', createdAt: '', createdBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  commanders: {
    list: vi.fn().mockResolvedValue([
      { id: 'cmd-1', email: 'cmd@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'cmd-2', email: 'cmd2@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}

const BASE_PROPS = {
  masterDs: mockMasterDs as any,
  currentAdminEmail: 'admin@example.com',
  onEnterUnit: vi.fn(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminPanel', () => {
  it('renders three tabs: Admins, Units, Commanders', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^admins$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^units$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^commanders$/i })).toBeInTheDocument()
    })
  })

  it('shows admin list by default', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })
  })

  it('shows units list when Units tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^units$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^units$/i }))
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('calls onEnterUnit when Enter Unit is clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^units$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^units$/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter unit/i }))
    fireEvent.click(screen.getByRole('button', { name: /enter unit/i }))
    expect(BASE_PROPS.onEnterUnit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alpha' })
    )
  })

  it('shows commanders list when Commanders tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^commanders$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^commanders$/i }))
    await waitFor(() => {
      expect(screen.getByText('cmd@example.com')).toBeInTheDocument()
    })
  })
})
