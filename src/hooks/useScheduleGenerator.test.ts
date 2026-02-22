import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../context/AuthContext')
vi.mock('../services/dataService')

import { useAuth } from '../context/AuthContext'
import { DataService } from '../services/dataService'
import { useScheduleGenerator } from './useScheduleGenerator'

const MOCK_LEAVE_SCHEDULE = {
  startDate: '2026-03-01', endDate: '2026-03-30',
  assignments: [], conflicts: [],
}

const MOCK_TASK_SCHEDULE = {
  startDate: '2026-03-01', endDate: '2026-03-30',
  assignments: [], conflicts: [{ type: 'NO_ROLE_AVAILABLE', message: 'Not enough drivers', affectedSoldierIds: [], suggestions: [] }],
}

function makeMockDs() {
  return {
    scheduleService: {
      generateLeaveSchedule: vi.fn().mockResolvedValue(MOCK_LEAVE_SCHEDULE),
      generateTaskSchedule: vi.fn().mockResolvedValue(MOCK_TASK_SCHEDULE),
    },
  }
}

describe('useScheduleGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(DataService).mockImplementation(function () { return makeMockDs() as any })
    vi.mocked(useAuth).mockReturnValue({
      auth: { isAuthenticated: true, accessToken: 'tok' },
      signIn: vi.fn(), signOut: vi.fn(),
    })
  })

  it('starts with loading=false and no conflicts', () => {
    const ds = makeMockDs() as any
    const { result } = renderHook(() => useScheduleGenerator(ds, '2026-03-01', '2026-03-30'))
    expect(result.current.loading).toBe(false)
    expect(result.current.conflicts).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sets loading=true while generating', async () => {
    const ds = makeMockDs() as any
    let resolveLeave!: (v: any) => void
    ds.scheduleService.generateLeaveSchedule.mockReturnValue(new Promise(r => { resolveLeave = r }))

    const { result } = renderHook(() => useScheduleGenerator(ds, '2026-03-01', '2026-03-30'))
    act(() => { result.current.generate() })
    expect(result.current.loading).toBe(true)
    resolveLeave(MOCK_LEAVE_SCHEDULE)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('returns combined conflicts from leave and task schedules', async () => {
    const ds = makeMockDs() as any
    const { result } = renderHook(() => useScheduleGenerator(ds, '2026-03-01', '2026-03-30'))
    await act(async () => { result.current.generate() })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.conflicts).toHaveLength(1)
    expect(result.current.conflicts[0].type).toBe('NO_ROLE_AVAILABLE')
  })

  it('sets error when generation fails', async () => {
    const ds = makeMockDs() as any
    ds.scheduleService.generateLeaveSchedule.mockRejectedValue(new Error('Sheet error'))
    const { result } = renderHook(() => useScheduleGenerator(ds, '2026-03-01', '2026-03-30'))
    await act(async () => { result.current.generate() })
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error?.message).toBe('Sheet error')
  })
})
