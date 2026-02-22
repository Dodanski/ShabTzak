import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OptimisticUpdater } from './optimisticUpdate'
import { SheetCache } from './cache'

describe('OptimisticUpdater', () => {
  let cache: SheetCache
  let updater: OptimisticUpdater

  beforeEach(() => {
    cache = new SheetCache()
    updater = new OptimisticUpdater(cache)
  })

  it('applies new value to cache immediately', async () => {
    cache.set('Soldiers', ['original'])
    const writeFn = vi.fn().mockResolvedValue(undefined)

    await updater.apply('Soldiers', ['updated'], writeFn)

    expect(writeFn).toHaveBeenCalledOnce()
    expect(cache.get('Soldiers')).toEqual(['updated'])
  })

  it('rolls back to previous value if writeFn throws', async () => {
    cache.set('Soldiers', ['original'])
    const writeFn = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(updater.apply('Soldiers', ['updated'], writeFn)).rejects.toThrow('Network error')

    expect(cache.get('Soldiers')).toEqual(['original'])
  })

  it('invalidates cache if no previous value and writeFn throws', async () => {
    const writeFn = vi.fn().mockRejectedValue(new Error('Failed'))

    await expect(updater.apply('NewKey', ['data'], writeFn)).rejects.toThrow()

    expect(cache.has('NewKey')).toBe(false)
  })

  it('sets cache even when no prior value exists on success', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined)

    await updater.apply('NewKey', ['data'], writeFn)

    expect(cache.get('NewKey')).toEqual(['data'])
  })
})
