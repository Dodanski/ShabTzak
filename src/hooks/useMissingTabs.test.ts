import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMissingTabs } from './useMissingTabs'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { accessToken: 'test-token' } }),
}))

vi.mock('../services/googleSheets', () => ({
  GoogleSheetsService: vi.fn().mockImplementation(function () { return {} }),
}))

vi.mock('../services/setupService', () => ({
  SetupService: vi.fn().mockImplementation(function () {
    return {
      checkTabs: vi.fn().mockResolvedValue([
        { tab: 'Alpha_Company_Soldiers', exists: false, created: false },
        { tab: 'Alpha_Company_Tasks', exists: true, created: false },
      ]),
    }
  }),
}))

describe('useMissingTabs', () => {
  it('returns missing tab names', async () => {
    const { result } = renderHook(() => useMissingTabs('sheet-id', 'Alpha_Company'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missing).toEqual(['Alpha_Company_Soldiers'])
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useMissingTabs('sheet-id', 'Alpha_Company'))
    expect(result.current.loading).toBe(true)
  })

  it('returns error: true when checkTabs throws', async () => {
    const { SetupService } = await import('../services/setupService')
    vi.mocked(SetupService).mockImplementationOnce(function() {
      return { checkTabs: vi.fn().mockRejectedValue(new Error('network error')) }
    } as any)
    const { result } = renderHook(() => useMissingTabs('sheet-id', 'Alpha_Company'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.missing).toEqual([])
  })
})
