import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import LeaveRequestsPage from './LeaveRequestsPage'
import type { Soldier, LeaveRequest } from '../models'

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
]

const PENDING: LeaveRequest = {
  id: 'lr1', soldierId: 's1',
  startDate: '2026-03-01', endDate: '2026-03-03',
  leaveType: 'After', constraintType: 'Preference',
  priority: 7, status: 'Pending',
}

const APPROVED: LeaveRequest = { ...PENDING, id: 'lr2', status: 'Approved' }

describe('LeaveRequestsPage', () => {
  it('renders soldier name for a request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
  })

  it('renders date range for a request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('2026-03-01 – 2026-03-03')).toBeInTheDocument()
  })

  it('shows Pending status badge for pending request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows Approve and Deny buttons only for pending requests', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING, APPROVED]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deny/i })).toBeInTheDocument()
  })

  it('calls onApprove with request id when Approve clicked', async () => {
    const onApprove = vi.fn()
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={onApprove} onDeny={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledWith('lr1')
  })

  it('calls onDeny with request id when Deny clicked', async () => {
    const onDeny = vi.fn()
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={onDeny} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).toHaveBeenCalledWith('lr1')
  })

  it('shows empty state when no requests', () => {
    render(<LeaveRequestsPage leaveRequests={[]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText(/no leave requests/i)).toBeInTheDocument()
  })
})
