import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import ScheduleCalendar from './ScheduleCalendar'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

const SOLDIER: Soldier = {
  id: 's1', name: 'David Cohen', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

const DATES = ['2026-03-01', '2026-03-02']

describe('ScheduleCalendar', () => {
  it('renders soldier name', () => {
    render(<ScheduleCalendar soldiers={[SOLDIER]} dates={DATES} tasks={[]} taskAssignments={[]} leaveAssignments={[]} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
  })

  it('renders date column headers', () => {
    render(<ScheduleCalendar soldiers={[SOLDIER]} dates={DATES} tasks={[]} taskAssignments={[]} leaveAssignments={[]} />)
    expect(screen.getByText('2026-03-01')).toBeInTheDocument()
    expect(screen.getByText('2026-03-02')).toBeInTheDocument()
  })

  it('shows available cells when no assignments', () => {
    render(<ScheduleCalendar soldiers={[SOLDIER]} dates={DATES} tasks={[]} taskAssignments={[]} leaveAssignments={[]} />)
    const cells = screen.getAllByTitle('available')
    expect(cells).toHaveLength(2)
  })

  it('shows on-leave cell when soldier has leave assignment', () => {
    const leaveAssignments: LeaveAssignment[] = [{
      id: 'la1', soldierId: 's1',
      startDate: '2026-03-01', endDate: '2026-03-01',
      leaveType: 'After', isWeekend: false, isLocked: false,
      createdAt: '2026-02-01T00:00:00Z',
    }]
    render(<ScheduleCalendar soldiers={[SOLDIER]} dates={DATES} tasks={[]} taskAssignments={[]} leaveAssignments={leaveAssignments} />)
    expect(screen.getByTitle('on-leave')).toBeInTheDocument()
    expect(screen.getByTitle('available')).toBeInTheDocument()
  })

  it('shows on-task cell when soldier has task assignment', () => {
    const tasks: Task[] = [{
      id: 't1', taskType: 'Guard',
      startTime: '2026-03-02T06:00:00Z', endTime: '2026-03-02T14:00:00Z',
      durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
      minRestAfter: 8, isSpecial: false,
    }]
    const taskAssignments: TaskAssignment[] = [{
      scheduleId: 'sc1', taskId: 't1', soldierId: 's1', assignedRole: 'Driver',
      isLocked: false, createdAt: '2026-02-01T00:00:00Z', createdBy: 'system',
    }]
    render(<ScheduleCalendar soldiers={[SOLDIER]} dates={DATES} tasks={tasks} taskAssignments={taskAssignments} leaveAssignments={[]} />)
    expect(screen.getByTitle('on-task')).toBeInTheDocument()
  })

  it('renders empty state when no soldiers', () => {
    render(<ScheduleCalendar soldiers={[]} dates={DATES} tasks={[]} taskAssignments={[]} leaveAssignments={[]} />)
    expect(screen.getByText(/no soldiers/i)).toBeInTheDocument()
  })
})
