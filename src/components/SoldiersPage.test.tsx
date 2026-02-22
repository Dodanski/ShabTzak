import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoldiersPage from './SoldiersPage'
import type { Soldier, AppConfig, LeaveAssignment } from '../models'
import React from 'react'

const BASE_CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
}

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 2.5, status: 'Active',
    hoursWorked: 24, weekendLeavesCount: 1, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: 's2', name: 'Moshe Levi', role: 'Medic',
    serviceStart: '2026-02-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 1.0, status: 'Injured',
    hoursWorked: 8, weekendLeavesCount: 0, midweekLeavesCount: 1, afterLeavesCount: 0,
  },
]

describe('SoldiersPage', () => {
  it('renders all soldier names', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows loading indicator when loading', () => {
    render(<SoldiersPage soldiers={[]} loading onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no soldiers', () => {
    render(<SoldiersPage soldiers={[]} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/no soldiers/i)).toBeInTheDocument()
  })

  it('shows discharge button only for active soldiers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    // s1 is Active → has discharge button; s2 is Injured → no discharge button
    const dischargeButtons = screen.getAllByRole('button', { name: /discharge/i })
    expect(dischargeButtons).toHaveLength(1)
  })

  it('calls onDischarge with soldier id when discharge is clicked', async () => {
    const onDischarge = vi.fn()
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={onDischarge} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /discharge/i }))
    expect(onDischarge).toHaveBeenCalledWith('s1')
  })

  it('shows Fairness and Hours column headers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('Fairness')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
  })

  it('displays fairness score via FairnessBar and hours worked for each soldier', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('24h')).toBeInTheDocument()
    expect(screen.getByText('1.0')).toBeInTheDocument()
    expect(screen.getByText('8h')).toBeInTheDocument()
    // FairnessBar fill elements should render
    const fills = document.querySelectorAll('[data-testid="fairness-fill"]')
    expect(fills.length).toBe(2)
  })

  it('shows add form when Add Soldier button is clicked', async () => {
    render(<SoldiersPage soldiers={[]} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument()
  })

  it('shows Adjust button for each soldier', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={vi.fn()} />)
    const adjustBtns = screen.getAllByRole('button', { name: /adjust/i })
    expect(adjustBtns).toHaveLength(2)
  })

  it('calls onAdjustFairness with soldierId, delta and reason on submit', async () => {
    const onAdjustFairness = vi.fn()
    render(<SoldiersPage soldiers={[SOLDIERS[0]]} onDischarge={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={onAdjustFairness} />)
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }))
    const deltaInput = screen.getByLabelText(/delta/i)
    const reasonInput = screen.getByLabelText(/reason/i)
    await userEvent.type(deltaInput, '2')
    await userEvent.type(reasonInput, 'Extra duty')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onAdjustFairness).toHaveBeenCalledWith('s1', 2, 'Extra duty')
  })

  it('shows Quota column header when configData is provided', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} configData={BASE_CONFIG} leaveAssignments={[]} />)
    expect(screen.getByText('Quota')).toBeInTheDocument()
  })

  it('does not show Quota column when configData is null', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.queryByText('Quota')).not.toBeInTheDocument()
  })

  it('shows entitlement and used days in quota column', () => {
    const la: LeaveAssignment = {
      id: 'la1', soldierId: 's1', startDate: '2026-03-01', endDate: '2026-03-03',
      leaveType: 'Long', isWeekend: false, isLocked: false, createdAt: '',
    }
    render(<SoldiersPage soldiers={[SOLDIERS[0]]} onDischarge={vi.fn()} onAddSoldier={vi.fn()} configData={BASE_CONFIG} leaveAssignments={[la]} />)
    // s1: 365 days / 14 cycle * 4 = floor(104.28) = 104 entitlement; 2 days used
    expect(screen.getByText(/104/)).toBeInTheDocument()
    expect(screen.getByText(/2\s*used/i)).toBeInTheDocument()
  })

  it('renders a name filter input', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search soldiers/i)).toBeInTheDocument()
  })

  it('filters soldiers by name', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/search soldiers/i), 'David')
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.queryByText('Moshe Levi')).not.toBeInTheDocument()
  })

  it('filters soldiers by role', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    const roleFilter = screen.getByRole('combobox', { name: /filter by role/i })
    await userEvent.selectOptions(roleFilter, 'Medic')
    expect(screen.queryByText('David Cohen')).not.toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows all soldiers when filter is cleared', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onDischarge={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText(/search soldiers/i), 'David')
    await userEvent.clear(screen.getByPlaceholderText(/search soldiers/i))
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('calls onAddSoldier with form data when add form is submitted', async () => {
    const onAddSoldier = vi.fn()
    render(<SoldiersPage soldiers={[]} onDischarge={vi.fn()} onAddSoldier={onAddSoldier} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))

    await userEvent.type(screen.getByPlaceholderText(/name/i), 'Yoni Ben')
    await userEvent.type(screen.getByLabelText(/service start/i), '2026-03-01')
    await userEvent.type(screen.getByLabelText(/service end/i), '2026-12-31')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(onAddSoldier).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Yoni Ben', serviceStart: '2026-03-01', serviceEnd: '2026-12-31' })
    )
  })
})
