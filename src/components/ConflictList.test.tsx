import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import ConflictList from './ConflictList'
import type { ScheduleConflict } from '../models'

const CONFLICTS: ScheduleConflict[] = [
  {
    type: 'NO_ROLE_AVAILABLE',
    message: 'Not enough drivers for night shift',
    affectedSoldierIds: ['s1'],
    suggestions: ['Assign an additional driver', 'Reschedule the task'],
  },
  {
    type: 'REST_PERIOD_VIOLATION',
    message: 'Moshe has insufficient rest',
    affectedSoldierIds: ['s2'],
    suggestions: [],
  },
]

describe('ConflictList', () => {
  it('renders conflict messages', () => {
    render(<ConflictList conflicts={CONFLICTS} />)
    expect(screen.getByText('Not enough drivers for night shift')).toBeInTheDocument()
    expect(screen.getByText('Moshe has insufficient rest')).toBeInTheDocument()
  })

  it('renders conflict type badges', () => {
    render(<ConflictList conflicts={CONFLICTS} />)
    expect(screen.getByText('NO_ROLE_AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('REST_PERIOD_VIOLATION')).toBeInTheDocument()
  })

  it('renders suggestions when present', () => {
    render(<ConflictList conflicts={CONFLICTS} />)
    expect(screen.getByText('Assign an additional driver')).toBeInTheDocument()
    expect(screen.getByText('Reschedule the task')).toBeInTheDocument()
  })

  it('shows empty state when no conflicts', () => {
    render(<ConflictList conflicts={[]} />)
    expect(screen.getByText(/no conflicts/i)).toBeInTheDocument()
  })

  it('shows correct conflict count in heading', () => {
    render(<ConflictList conflicts={CONFLICTS} />)
    expect(screen.getByText(/2 conflict/i)).toBeInTheDocument()
  })
})
