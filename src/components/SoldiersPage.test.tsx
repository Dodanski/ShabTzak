import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoldiersPage from './SoldiersPage'
import type { Soldier } from '../models'
import React from 'react'

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
