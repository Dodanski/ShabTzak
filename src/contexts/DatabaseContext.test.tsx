import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DatabaseProvider, useDatabase } from './DatabaseContext'

function TestComponent() {
  const { database, loading, error } = useDatabase()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!database) return <div>No data</div>

  return <div>Soldiers: {database.soldiers.length}</div>
}

describe('DatabaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads database from /data/database.json', async () => {
    const mockData = {
      version: 1,
      lastModified: '2026-03-31T10:00:00.000Z',
      soldiers: [
        { id: 's1', firstName: 'David', lastName: 'Cohen', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 }
      ],
      tasks: [],
      units: [],
      leaveRequests: [],
      leaveAssignments: [],
      taskAssignments: [],
      config: {
        scheduleStartDate: '2026-01-01',
        scheduleEndDate: '2026-12-31',
        leaveRatioDaysInBase: 10,
        leaveRatioDaysHome: 4,
        longLeaveMaxDays: 14,
        weekendDays: ['Friday', 'Saturday'],
        minBasePresence: 5,
        minBasePresenceByRole: { Driver: 2, Medic: 1, Commander: 1 },
        maxDrivingHours: 12,
        defaultRestPeriod: 8,
        taskTypeRestPeriods: {},
        adminEmails: [],
        leaveBaseExitHour: '16:00',
        leaveBaseReturnHour: '08:00'
      },
      roles: ['Driver', 'Medic', 'Commander'],
      admins: [],
      commanders: []
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    })

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Soldiers: 1')).toBeInTheDocument()
    })
  })

  it('shows error when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
    })
  })
})
