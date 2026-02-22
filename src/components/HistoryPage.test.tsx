import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import HistoryPage from './HistoryPage'
import type { HistoryEntry } from '../services/historyService'

const ENTRIES: HistoryEntry[] = [
  {
    timestamp: '2026-03-01T10:00:00Z',
    action: 'create',
    entityType: 'Soldier',
    entityId: 's1',
    changedBy: 'admin',
    details: 'Created soldier David Cohen',
  },
  {
    timestamp: '2026-03-02T14:30:00Z',
    action: 'approve',
    entityType: 'LeaveRequest',
    entityId: 'lr1',
    changedBy: 'officer',
    details: 'Approved leave for Moshe Levi',
  },
]

describe('HistoryPage', () => {
  it('renders page heading', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('renders history entries', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByText('Created soldier David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Approved leave for Moshe Levi')).toBeInTheDocument()
  })

  it('renders changedBy for each entry', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('officer')).toBeInTheDocument()
  })

  it('renders entity type badges', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByText('Soldier')).toBeInTheDocument()
    expect(screen.getByText('LeaveRequest')).toBeInTheDocument()
  })

  it('shows empty state when no entries', () => {
    render(<HistoryPage entries={[]} />)
    expect(screen.getByText(/no history/i)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<HistoryPage entries={[]} loading />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
