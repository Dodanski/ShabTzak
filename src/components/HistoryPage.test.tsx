import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('renders a search input', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('filters entries by search text in details', async () => {
    render(<HistoryPage entries={ENTRIES} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'David')
    expect(screen.getByText('Created soldier David Cohen')).toBeInTheDocument()
    expect(screen.queryByText('Approved leave for Moshe Levi')).not.toBeInTheDocument()
  })

  it('filters entries by search text in action', async () => {
    render(<HistoryPage entries={ENTRIES} />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'approve')
    expect(screen.queryByText('Created soldier David Cohen')).not.toBeInTheDocument()
    expect(screen.getByText('Approved leave for Moshe Levi')).toBeInTheDocument()
  })

  it('shows all entries when search cleared', async () => {
    render(<HistoryPage entries={ENTRIES} />)
    const input = screen.getByPlaceholderText(/search/i)
    await userEvent.type(input, 'David')
    await userEvent.clear(input)
    expect(screen.getByText('Created soldier David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Approved leave for Moshe Levi')).toBeInTheDocument()
  })

  it('renders an action type filter dropdown', () => {
    render(<HistoryPage entries={ENTRIES} />)
    expect(screen.getByRole('combobox', { name: /filter by action/i })).toBeInTheDocument()
  })

  it('populates dropdown with unique action types from entries', () => {
    render(<HistoryPage entries={ENTRIES} />)
    const select = screen.getByRole('combobox', { name: /filter by action/i })
    expect(select).toContainElement(screen.getByRole('option', { name: 'create' }))
    expect(select).toContainElement(screen.getByRole('option', { name: 'approve' }))
  })

  it('filters entries by selected action type', async () => {
    render(<HistoryPage entries={ENTRIES} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by action/i }), 'create')
    expect(screen.getByText('Created soldier David Cohen')).toBeInTheDocument()
    expect(screen.queryByText('Approved leave for Moshe Levi')).not.toBeInTheDocument()
  })
})
