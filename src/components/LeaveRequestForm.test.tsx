import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaveRequestForm from './LeaveRequestForm'
import type { Soldier } from '../models'
import React from 'react'

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: 's2', name: 'Moshe Levi', role: 'Medic',
    serviceStart: '2026-02-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
]

describe('LeaveRequestForm', () => {
  it('renders soldier selector with all soldiers', () => {
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('renders start date and end date inputs', () => {
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })

  it('renders priority input', () => {
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument()
  })

  it('renders submit button', () => {
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={vi.fn()} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onSubmit with correct data when form is submitted', async () => {
    const onSubmit = vi.fn()
    render(<LeaveRequestForm soldiers={SOLDIERS} onSubmit={onSubmit} />)

    // Select second soldier
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /soldier/i }), 's2')
    await userEvent.type(screen.getByLabelText(/start date/i), '2026-03-20')
    await userEvent.type(screen.getByLabelText(/end date/i), '2026-03-22')
    // Priority defaults to 5; change it
    await userEvent.clear(screen.getByLabelText(/priority/i))
    await userEvent.type(screen.getByLabelText(/priority/i), '7')

    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        soldierId: 's2',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        priority: 7,
      })
    )
  })
})
