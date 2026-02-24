import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import ConfigPage from './ConfigPage'
import type { AppConfig } from '../models'

const MOCK_CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
  adminEmails: [],
}

describe('ConfigPage', () => {
  it('shows loading state', () => {
    render(<ConfigPage config={null} onSave={vi.fn()} loading />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders config field values when loaded', () => {
    render(<ConfigPage config={MOCK_CONFIG} onSave={vi.fn()} loading={false} />)
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('4').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  it('renders all key field labels', () => {
    render(<ConfigPage config={MOCK_CONFIG} onSave={vi.fn()} loading={false} />)
    expect(screen.getByText(/days in base/i)).toBeInTheDocument()
    expect(screen.getByText(/days home/i)).toBeInTheDocument()
    expect(screen.getByText(/min base presence/i)).toBeInTheDocument()
    expect(screen.getByText(/max driving hours/i)).toBeInTheDocument()
  })

  it('calls onSave with updated values on submit', async () => {
    const onSave = vi.fn()
    render(<ConfigPage config={MOCK_CONFIG} onSave={onSave} loading={false} />)

    const baseDaysInput = screen.getByLabelText(/days in base/i)
    await userEvent.clear(baseDaysInput)
    await userEvent.type(baseDaysInput, '12')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ leaveRatioDaysInBase: 12 }))
  })

  it('shows null/empty state when no config and not loading', () => {
    render(<ConfigPage config={null} onSave={vi.fn()} loading={false} />)
    expect(screen.getByText(/no configuration/i)).toBeInTheDocument()
  })
})
