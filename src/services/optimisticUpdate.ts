import { SheetCache } from './cache'

export class OptimisticUpdater {
  private cache: SheetCache

  constructor(cache: SheetCache) {
    this.cache = cache
  }

  /**
   * Apply an optimistic update: sets the cache immediately, calls writeFn,
   * and rolls back the cache to the previous value if writeFn throws.
   */
  async apply<T>(
    key: string,
    newValue: T,
    writeFn: () => Promise<void>
  ): Promise<void> {
    const previous = this.cache.get<T>(key)
    const hadPrevious = this.cache.has(key)

    this.cache.set(key, newValue)

    try {
      await writeFn()
    } catch (err) {
      if (hadPrevious) {
        this.cache.set(key, previous)
      } else {
        this.cache.invalidate(key)
      }
      throw err
    }
  }
}
