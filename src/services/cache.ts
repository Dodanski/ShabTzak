const DEFAULT_TTL_MS = 60_000 // 1 minute

interface CacheEntry<T> {
  value: T
  expiresAt: number | null
}

export class SheetCache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidateAll(): void {
    this.store.clear()
  }
}
