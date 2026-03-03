import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../context/AuthContext')
vi.mock('../services/dataService')

import { useAuth } from '../context/AuthContext'
import { DataService } from '../services/dataService'
import { useDataService } from './useDataService'
import type { MasterDataService } from '../services/masterDataService'

function makeMockHistory() {
  return { listAll: vi.fn().mockResolvedValue([]) }
}

function makeMockMasterDs(): MasterDataService {
  return {
    history: makeMockHistory(),
  } as unknown as MasterDataService
}

function makeMockDs(overrides: Record<string, unknown> = {}) {
  return {
    soldiers: { list: vi.fn().mockResolvedValue([]) },
    leaveRequests: { list: vi.fn().mockResolvedValue([]) },
    taskAssignments: { list: vi.fn().mockResolvedValue([]) },
    leaveAssignments: { list: vi.fn().mockResolvedValue([]) },
    ...overrides,
  }
}

function mockNotAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    auth: { isAuthenticated: false, accessToken: null },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })
}

function mockAuthenticated(token = 'tok') {
  vi.mocked(useAuth).mockReturnValue({
    auth: { isAuthenticated: true, accessToken: token },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })
}

describe('useDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(DataService).mockImplementation(function () { return makeMockDs() as any })
    mockNotAuthenticated()
  })

  it('returns null ds and empty arrays when not authenticated', () => {
    const masterDs = makeMockMasterDs()
    const { result } = renderHook(() => useDataService('sheet123', '', masterDs))
    expect(result.current.ds).toBeNull()
    expect(result.current.soldiers).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('returns null ds when masterDs is null', () => {
    mockAuthenticated()
    const { result } = renderHook(() => useDataService('sheet123', '', null))
    expect(result.current.ds).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('creates DataService with token, spreadsheetId, tabPrefix and history when authenticated', () => {
    const masterDs = makeMockMasterDs()
    mockAuthenticated('my-token')
    renderHook(() => useDataService('sheet-xyz', '', masterDs))
    expect(vi.mocked(DataService)).toHaveBeenCalledWith('my-token', 'sheet-xyz', '', masterDs.history)
  })

  it('sets ds when authenticated', () => {
    const masterDs = makeMockMasterDs()
    mockAuthenticated()
    const { result } = renderHook(() => useDataService('sheet123', '', masterDs))
    expect(result.current.ds).not.toBeNull()
  })

  it('loads soldiers when authenticated', async () => {
    const SOLDIERS = [{ id: 's1', name: 'David' }]
    vi.mocked(DataService).mockImplementationOnce(
      function () { return makeMockDs({ soldiers: { list: vi.fn().mockResolvedValue(SOLDIERS) } }) as any }
    )
    const masterDs = makeMockMasterDs()
    mockAuthenticated()
    const { result } = renderHook(() => useDataService('sheet123', '', masterDs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.soldiers).toEqual(SOLDIERS)
  })

  it('sets error when data load fails', async () => {
    vi.mocked(DataService).mockImplementationOnce(
      function () {
        return makeMockDs({
          soldiers: { list: vi.fn().mockRejectedValue(new Error('API error')) },
        }) as any
      }
    )
    const masterDs = makeMockMasterDs()
    mockAuthenticated()
    const { result } = renderHook(() => useDataService('sheet123', '', masterDs))
    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error).toBe('API error')
  })

  it('reload function re-fetches data', async () => {
    const listFn = vi.fn().mockResolvedValue([])
    vi.mocked(DataService).mockImplementation(
      function () { return makeMockDs({ soldiers: { list: listFn } }) as any }
    )
    const masterDs = makeMockMasterDs()
    mockAuthenticated()
    const { result } = renderHook(() => useDataService('sheet123', '', masterDs))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = listFn.mock.calls.length
    result.current.reload()
    await waitFor(() => expect(listFn.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
