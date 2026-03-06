import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  roles: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  tasks: { list: vi.fn().mockResolvedValue([
    { id: 't1', taskType: 'Guard', startTime: '06:00', endTime: '14:00', durationHours: 8, roleRequirements: [], minRestAfter: 6, isSpecial: false }
  ]) },
  config: { read: vi.fn().mockResolvedValue({ leaveRatioDaysInBase: 10, minRestBetweenShifts: 8, minDaysInBaseBeforeLeave: 30, maxConsecutiveShifts: 3, weekendLeaveWeight: 1.5, afterLeaveWeight: 0.5, longWeekendLeaveWeight: 2, midweekLeaveWeight: 0.8, specialDutyBaseChance: 0.3 }) },
  taskService: { create: vi.fn().mockResolvedValue({}) },
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

  it('renders Tasks and Config tab buttons', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^tasks$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^config$/i })).toBeInTheDocument()
    })
  })
  it('shows task list when Tasks tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^tasks$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }))
    await waitFor(() => expect(screen.getByText('Guard')).toBeInTheDocument())
  })
  it('shows config when Config tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^config$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^config$/i }))
    await waitFor(() => expect(screen.getByText('leaveRatioDaysInBase')).toBeInTheDocument())
  })

  it('shows a Roles tab', () => {
    render(<AdminPanel masterDs={mockMasterDs as any} currentAdminEmail="admin@test.com" onEnterUnit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /roles/i })).toBeInTheDocument()
  })

  it('renders Roles tab with empty state when no roles are configured', async () => {
    render(<AdminPanel masterDs={mockMasterDs as any} currentAdminEmail="admin@test.com" onEnterUnit={vi.fn()} />)
    const rolesTab = screen.getByRole('button', { name: /^roles$/i })
    await userEvent.click(rolesTab)
    expect(screen.getByText(/no roles configured/i)).toBeInTheDocument()
  })

  it('calls masterDs.roles.create when Add Role is submitted', async () => {
    render(<AdminPanel masterDs={mockMasterDs as any} currentAdminEmail="admin@test.com" onEnterUnit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^roles$/i }))
    const input = screen.getByPlaceholderText(/new role name/i)
    await userEvent.type(input, 'Sniper')
    await userEvent.click(screen.getByRole('button', { name: /add role/i }))
    expect(mockMasterDs.roles.create).toHaveBeenCalledWith('Sniper')
  })

  it('calls masterDs.roles.delete when Delete is clicked', async () => {
    const mockDs = {
      ...mockMasterDs,
      roles: {
        list: vi.fn().mockResolvedValue(['Driver']),
        create: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    }
    render(<AdminPanel masterDs={mockDs as any} currentAdminEmail="admin@test.com" onEnterUnit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /^roles$/i }))
    await screen.findByText('Driver')
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(mockDs.roles.delete).toHaveBeenCalledWith('Driver')
  })
})
