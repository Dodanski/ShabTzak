import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import TasksPage from './TasksPage'
import type { Task, CreateTaskInput } from '../models'

const TASKS: Task[] = [
  {
    id: 't1', taskType: 'Guard',
    startTime: '2026-03-01T06:00:00Z', endTime: '2026-03-01T14:00:00Z',
    durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
    minRestAfter: 8, isSpecial: false,
  },
  {
    id: 't2', taskType: 'Patrol',
    startTime: '2026-03-02T08:00:00Z', endTime: '2026-03-02T16:00:00Z',
    durationHours: 8, roleRequirements: [{ role: 'Medic', count: 2 }],
    minRestAfter: 6, isSpecial: false,
  },
]

describe('TasksPage', () => {
  it('renders page heading', () => {
    render(<TasksPage tasks={TASKS} onAddTask={vi.fn()} />)
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('renders task types', () => {
    render(<TasksPage tasks={TASKS} onAddTask={vi.fn()} />)
    expect(screen.getByText('Guard')).toBeInTheDocument()
    expect(screen.getByText('Patrol')).toBeInTheDocument()
  })

  it('renders start times', () => {
    render(<TasksPage tasks={TASKS} onAddTask={vi.fn()} />)
    expect(screen.getByText('2026-03-01T06:00:00Z')).toBeInTheDocument()
  })

  it('shows empty state when no tasks', () => {
    render(<TasksPage tasks={[]} onAddTask={vi.fn()} />)
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
  })

  it('shows Add Task button', () => {
    render(<TasksPage tasks={[]} onAddTask={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument()
  })

  it('shows form when Add Task clicked', async () => {
    render(<TasksPage tasks={[]} onAddTask={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add task/i }))
    expect(screen.getByLabelText(/task type/i)).toBeInTheDocument()
  })

  it('calls onAddTask when form submitted', async () => {
    const onAddTask = vi.fn()
    render(<TasksPage tasks={[]} onAddTask={onAddTask} />)
    await userEvent.click(screen.getByRole('button', { name: /add task/i }))
    await userEvent.type(screen.getByLabelText(/task type/i), 'Convoy')
    await userEvent.type(screen.getByLabelText(/start time/i), '2026-03-10T08:00')
    await userEvent.type(screen.getByLabelText(/end time/i), '2026-03-10T16:00')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAddTask).toHaveBeenCalledOnce()
  })

  it('shows loading state', () => {
    render(<TasksPage tasks={[]} onAddTask={vi.fn()} loading />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows Roles column header when tasks have role requirements', () => {
    render(<TasksPage tasks={TASKS} onAddTask={vi.fn()} />)
    expect(screen.getByText('Roles')).toBeInTheDocument()
  })

  it('renders role requirements as text badges', () => {
    render(<TasksPage tasks={TASKS} onAddTask={vi.fn()} />)
    expect(screen.getByText(/driver.*1/i)).toBeInTheDocument()
    expect(screen.getByText(/medic.*2/i)).toBeInTheDocument()
  })
})
