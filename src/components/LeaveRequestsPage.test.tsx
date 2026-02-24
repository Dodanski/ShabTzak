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
const DENIED: LeaveRequest = { ...PENDING, id: 'lr3', status: 'Denied' }

describe('LeaveRequestsPage', () => {
  it('renders soldier name for a request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
  })

  it('renders date range for a request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('01/03 – 03/03')).toBeInTheDocument()
  })

  it('shows Pending status badge for pending request', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('Pending', { selector: 'span' })).toBeInTheDocument()
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDeny = vi.fn()
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={onDeny} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).toHaveBeenCalledWith('lr1')
    vi.restoreAllMocks()
  })

  it('shows window.confirm before denying', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(confirmSpy).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })

  it('does not call onDeny when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDeny = vi.fn()
    render(<LeaveRequestsPage leaveRequests={[PENDING]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={onDeny} />)
    await userEvent.click(screen.getByRole('button', { name: /deny/i }))
    expect(onDeny).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('shows empty state when no requests', () => {
    render(<LeaveRequestsPage leaveRequests={[]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText(/no leave requests/i)).toBeInTheDocument()
  })

  it('renders status filter dropdown', () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING, APPROVED, DENIED]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument()
  })

  it('filters to show only pending when Pending selected', async () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING, APPROVED, DENIED]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'Pending')
    // lr1 (Pending) visible; lr2 (Approved) and lr3 (Denied) rows not visible
    expect(screen.getAllByText('David Cohen')).toHaveLength(1)
    expect(screen.queryByText('Approved', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('shows all requests when All selected after filter', async () => {
    render(<LeaveRequestsPage leaveRequests={[PENDING, APPROVED]} soldiers={SOLDIERS} onApprove={vi.fn()} onDeny={vi.fn()} />)
    const select = screen.getByRole('combobox', { name: /filter by status/i })
    await userEvent.selectOptions(select, 'Pending')
    await userEvent.selectOptions(select, 'All')
    expect(screen.getAllByText('David Cohen')).toHaveLength(2)
  })
})
