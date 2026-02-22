import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVersionCheck } from './useVersionCheck'
import type { DataService } from '../services/dataService'

function makeMockDs(isStaleResult = false) {
  return {
    versions: {
      isStale: vi.fn().mockResolvedValue(isStaleResult),
    },
  } as unknown as DataService
}

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns isStale false initially when ds is null', () => {
    const { result } = renderHook(() => useVersionCheck(null, 'Soldiers'))
    expect(result.current.isStale).toBe(false)
  })

  it('does not poll when ds is null', async () => {
    const { result } = renderHook(() => useVersionCheck(null, 'Soldiers'))

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.isStale).toBe(false)
  })

  it('polls isStale after 60 seconds and updates state', async () => {
    const ds = makeMockDs(true)
    const { result } = renderHook(() => useVersionCheck(ds, 'Soldiers'))
    expect(result.current.isStale).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.isStale).toBe(true)
    expect(ds.versions.isStale).toHaveBeenCalledWith('Soldiers', 0)
  })

  it('resets isStale to false when ds becomes null', async () => {
    const ds = makeMockDs(true)
    const { result, rerender } = renderHook(
      ({ currentDs }: { currentDs: DataService | null }) =>
        useVersionCheck(currentDs, 'Soldiers'),
      { initialProps: { currentDs: ds } },
    )

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.isStale).toBe(true)

    act(() => {
      rerender({ currentDs: null })
    })
    expect(result.current.isStale).toBe(false)
  })
})
