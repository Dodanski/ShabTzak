import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SheetCache } from './cache'

describe('SheetCache', () => {
  let cache: SheetCache

  beforeEach(() => {
    cache = new SheetCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves a value', () => {
    cache.set('Soldiers', ['row1', 'row2'])
    expect(cache.get('Soldiers')).toEqual(['row1', 'row2'])
  })

  it('returns undefined for missing key', () => {
    expect(cache.get('Missing')).toBeUndefined()
  })

  it('has() returns true for existing key', () => {
    cache.set('Tasks', [])
    expect(cache.has('Tasks')).toBe(true)
  })

  it('has() returns false for missing key', () => {
    expect(cache.has('Missing')).toBe(false)
  })

  it('invalidate() removes a key', () => {
    cache.set('Soldiers', ['row1'])
    cache.invalidate('Soldiers')
    expect(cache.has('Soldiers')).toBe(false)
  })

  it('expires entry after TTL', () => {
    cache.set('Soldiers', ['row1'], 5000) // 5 second TTL
    vi.advanceTimersByTime(6000)
    expect(cache.get('Soldiers')).toBeUndefined()
    expect(cache.has('Soldiers')).toBe(false)
  })

  it('does not expire before TTL', () => {
    cache.set('Soldiers', ['row1'], 5000)
    vi.advanceTimersByTime(4000)
    expect(cache.get('Soldiers')).toEqual(['row1'])
  })

  it('invalidateAll() clears all entries', () => {
    cache.set('Soldiers', ['row1'])
    cache.set('Tasks', ['row2'])
    cache.invalidateAll()
    expect(cache.has('Soldiers')).toBe(false)
    expect(cache.has('Tasks')).toBe(false)
  })

  it('overwrites existing entry on set', () => {
    cache.set('Soldiers', ['old'])
    cache.set('Soldiers', ['new'])
    expect(cache.get('Soldiers')).toEqual(['new'])
  })
})
