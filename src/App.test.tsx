import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Partial mock: keep AuthProvider + AuthContext working, only mock useAuth
vi.mock('./context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, useAuth: vi.fn() }
})
vi.mock('./hooks/useDataService')

import { useAuth } from './context/AuthContext'
import { useDataService } from './hooks/useDataService'
import App from './App'

const EMPTY_DS_RESULT = {
  ds: null, soldiers: [], leaveRequests: [], tasks: [],
  taskAssignments: [], leaveAssignments: [], historyEntries: [], configData: null,
  loading: false, error: null, reload: vi.fn(),
}

function mockUnauthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    auth: { isAuthenticated: false, accessToken: null },
    signIn: vi.fn(), signOut: vi.fn(),
  })
  vi.mocked(useDataService).mockReturnValue(EMPTY_DS_RESULT)
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnauthenticated()
  })

  it('renders ShabTzak title', () => {
    render(<App />)
    expect(screen.getByText('ShabTzak')).toBeInTheDocument()
  })

  it('renders login page with sign-in button when not authenticated', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows conflicts on Dashboard after schedule generation', async () => {
    const reload = vi.fn()
    const mockDs = {
      scheduleService: {
        generateLeaveSchedule: vi.fn().mockResolvedValue({
          assignments: [],
          conflicts: [{ type: 'INSUFFICIENT_BASE_PRESENCE', message: 'Not enough soldiers', affectedSoldierIds: [], suggestions: [] }],
        }),
        generateTaskSchedule: vi.fn().mockResolvedValue({ assignments: [], conflicts: [] }),
      },
      fairnessUpdate: { applyLeaveAssignment: vi.fn().mockResolvedValue(undefined) },
    }
    vi.mocked(useAuth).mockReturnValue({
      auth: { isAuthenticated: true, accessToken: 'tok' },
      signIn: vi.fn(), signOut: vi.fn(),
    })
    vi.mocked(useDataService).mockReturnValue({ ...EMPTY_DS_RESULT, ds: mockDs as any, reload })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(screen.getByText('Not enough soldiers')).toBeInTheDocument())
  })

  it('calls fairnessUpdate.applyLeaveAssignment for new leave assignments after generate', async () => {
    const applyLeaveAssignment = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()
    const mockDs = {
      scheduleService: {
        generateLeaveSchedule: vi.fn().mockResolvedValue({
          assignments: [
            { id: 'la1', soldierId: 's1', leaveType: 'Long', isWeekend: true },
          ],
          conflicts: [],
        }),
        generateTaskSchedule: vi.fn().mockResolvedValue({ assignments: [], conflicts: [] }),
      },
      fairnessUpdate: { applyLeaveAssignment },
    }
    vi.mocked(useAuth).mockReturnValue({
      auth: { isAuthenticated: true, accessToken: 'tok' },
      signIn: vi.fn(), signOut: vi.fn(),
    })
    vi.mocked(useDataService).mockReturnValue({
      ...EMPTY_DS_RESULT,
      ds: mockDs as any,
      reload,
    })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))

    await waitFor(() => expect(applyLeaveAssignment).toHaveBeenCalledWith('s1', 'Long', true, 'user'))
  })
})
