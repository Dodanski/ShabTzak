import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import Dashboard from './Dashboard'
import type { Soldier, LeaveRequest, TaskAssignment, ScheduleConflict } from '../models'

const ACTIVE: Soldier = {
  id: 's1', name: 'David', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

const DISCHARGED: Soldier = { ...ACTIVE, id: 's2', status: 'Discharged' }

const PENDING_REQUEST: LeaveRequest = {
  id: 'lr1', soldierId: 's1',
  startDate: '2026-03-01', endDate: '2026-03-03',
  leaveType: 'After', constraintType: 'Personal',
  priority: 5, status: 'Pending',
}

const TASK_ASSIGNMENT: TaskAssignment = {
  scheduleId: 'sc1', taskId: 't1', soldierId: 's1', assignedRole: 'Driver',
  isLocked: false, createdAt: '2026-02-01T00:00:00Z', createdBy: 'system',
}

const CONFLICT: ScheduleConflict = {
  type: 'NO_ROLE_AVAILABLE',
  message: 'Not enough drivers for Guard duty',
  affectedSoldierIds: [],
  suggestions: [],
}

describe('Dashboard', () => {
  it('shows active soldier count', () => {
    render(<Dashboard soldiers={[ACTIVE, DISCHARGED]} leaveRequests={[]} taskAssignments={[]} conflicts={[]} onGenerateSchedule={vi.fn()} />)
    expect(screen.getByText('Active Soldiers')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows pending leave request count', () => {
    render(<Dashboard soldiers={[ACTIVE]} leaveRequests={[PENDING_REQUEST]} taskAssignments={[]} conflicts={[]} onGenerateSchedule={vi.fn()} />)
    expect(screen.getByText(/pending leave/i)).toBeInTheDocument()
  })

  it('shows task assignment count', () => {
    render(<Dashboard soldiers={[ACTIVE]} leaveRequests={[]} taskAssignments={[TASK_ASSIGNMENT]} conflicts={[]} onGenerateSchedule={vi.fn()} />)
    expect(screen.getByText('Task Assignments')).toBeInTheDocument()
  })

  it('shows conflict count and conflict messages when conflicts exist', () => {
    render(<Dashboard soldiers={[ACTIVE]} leaveRequests={[]} taskAssignments={[]} conflicts={[CONFLICT]} onGenerateSchedule={vi.fn()} />)
    expect(screen.getAllByText(/conflict/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Not enough drivers for Guard duty')).toBeInTheDocument()
  })

  it('shows fairness summary section when soldiers have fairness data', () => {
    const s1 = { ...ACTIVE, id: 's1', currentFairness: 3.0 }
    const s2 = { ...ACTIVE, id: 's2', currentFairness: 1.0 }
    render(<Dashboard soldiers={[s1, s2]} leaveRequests={[]} taskAssignments={[]} conflicts={[]} onGenerateSchedule={vi.fn()} />)
    expect(screen.getByText(/fairness/i)).toBeInTheDocument()
    expect(screen.getByText(/avg/i)).toBeInTheDocument()
  })

  it('shows correct avg, min and max fairness values', () => {
    const s1 = { ...ACTIVE, id: 's1', currentFairness: 6.0 }
    const s2 = { ...ACTIVE, id: 's2', currentFairness: 2.0 }
    render(<Dashboard soldiers={[s1, s2]} leaveRequests={[]} taskAssignments={[]} conflicts={[]} onGenerateSchedule={vi.fn()} />)
    // avg = 4.0, min = 2.0, max = 6.0
    expect(screen.getByText('4.0')).toBeInTheDocument()
    expect(screen.getByText('2.0')).toBeInTheDocument()
    expect(screen.getByText('6.0')).toBeInTheDocument()
  })

  it('calls onGenerateSchedule when Generate Schedule button clicked', async () => {
    const onGenerateSchedule = vi.fn()
    render(<Dashboard soldiers={[ACTIVE]} leaveRequests={[]} taskAssignments={[]} conflicts={[]} onGenerateSchedule={onGenerateSchedule} />)
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    expect(onGenerateSchedule).toHaveBeenCalledOnce()
  })
})
