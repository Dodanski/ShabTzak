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
  adminEmails: [],
}

const SOLDIERS: Soldier[] = [
  {
    id: '1111111', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 2.5, status: 'Active',
    hoursWorked: 24, weekendLeavesCount: 1, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: '2222222', name: 'Moshe Levi', role: 'Medic',
    serviceStart: '2026-02-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 1.0, status: 'Inactive',
    inactiveReason: 'Medical leave',
    hoursWorked: 8, weekendLeavesCount: 0, midweekLeavesCount: 1, afterLeavesCount: 0,
  },
]

describe('SoldiersPage', () => {
  it('renders all soldier names', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows loading indicator when loading', () => {
    render(<SoldiersPage soldiers={[]} loading onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no soldiers', () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/no soldiers/i)).toBeInTheDocument()
  })

  it('shows a checked checkbox for Active soldiers and unchecked for Inactive', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('shows inactiveReason text next to inactive soldiers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('Medical leave')).toBeInTheDocument()
  })

  it('calls onUpdateStatus with Active when unchecked (Inactive) soldier checkbox is clicked', async () => {
    const onUpdateStatus = vi.fn()
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={onUpdateStatus} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[1])
    expect(onUpdateStatus).toHaveBeenCalledWith('2222222', 'Active', undefined)
  })

  it('shows inline reason input when Active soldier checkbox is unchecked', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[0])
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument()
  })

  it('calls onUpdateStatus with Inactive + reason when Confirm is clicked', async () => {
    const onUpdateStatus = vi.fn()
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={onUpdateStatus} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[0])
    await userEvent.type(screen.getByPlaceholderText(/reason/i), 'Sick')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onUpdateStatus).toHaveBeenCalledWith('1111111', 'Inactive', 'Sick')
  })

  it('shows Fairness and Hours column headers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('Fairness')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
  })

  it('shows add form with Army ID field when Add Soldier button is clicked', async () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
    expect(screen.getByPlaceholderText(/army id/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument()
  })

  it('calls onAddSoldier with army id and form data on submit', async () => {
    const onAddSoldier = vi.fn()
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={onAddSoldier} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
    await userEvent.type(screen.getByPlaceholderText(/army id/i), '9876543')
    await userEvent.type(screen.getByPlaceholderText(/name/i), 'Yoni Ben')
    await userEvent.type(screen.getByLabelText(/service start/i), '2026-03-01')
    await userEvent.type(screen.getByLabelText(/service end/i), '2026-12-31')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAddSoldier).toHaveBeenCalledWith(
      expect.objectContaining({ id: '9876543', name: 'Yoni Ben' })
    )
  })

  it('disables Add button and shows error when end date is before start date', async () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
    await userEvent.type(screen.getByLabelText(/service start/i), '2026-12-01')
    await userEvent.type(screen.getByLabelText(/service end/i), '2026-01-01')
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
    expect(screen.getByText(/end date must be after start/i)).toBeInTheDocument()
  })

  it('filters soldiers by status Active', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'Active')
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.queryByText('Moshe Levi')).not.toBeInTheDocument()
  })

  it('filters soldiers by status Inactive', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'Inactive')
    expect(screen.queryByText('David Cohen')).not.toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows Adjust button for each soldier', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /adjust/i })).toHaveLength(2)
  })

  it('calls onAdjustFairness on submit', async () => {
    const onAdjustFairness = vi.fn()
    render(<SoldiersPage soldiers={[SOLDIERS[0]]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={onAdjustFairness} />)
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }))
    await userEvent.type(screen.getByLabelText(/delta/i), '2')
    await userEvent.type(screen.getByLabelText(/reason/i), 'Extra duty')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onAdjustFairness).toHaveBeenCalledWith('1111111', 2, 'Extra duty')
  })

  it('shows Quota column header when configData is provided', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} configData={BASE_CONFIG} leaveAssignments={[]} />)
    expect(screen.getByText('Quota')).toBeInTheDocument()
  })

  it('renders a name filter input', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search soldiers/i)).toBeInTheDocument()
  })

  it('sorts soldiers by name ascending when Name header clicked', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('columnheader', { name: /name/i }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('David Cohen')
    expect(rows[1]).toHaveTextContent('Moshe Levi')
  })
})
