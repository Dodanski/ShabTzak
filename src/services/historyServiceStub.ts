import type { IHistoryService, HistoryEntry } from './IHistoryService'

/**
 * Stub implementation of HistoryService for JSON database.
 * History is not persisted in Phase 1 - operations are logged to console in dev mode.
 */
export class HistoryServiceStub implements IHistoryService {
  private entries: HistoryEntry[] = []

  async append(
    action: string,
    entityType: string,
    entityId: string,
    changedBy: string,
    details: string
  ): Promise<void> {
    const entry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      changedBy,
      details,
    }
    this.entries.push(entry)

    if (import.meta.env.DEV) {
      console.log('[History]', action, entityType, entityId, 'by', changedBy)
    }
  }

  async listAll(): Promise<HistoryEntry[]> {
    return [...this.entries]
  }

  async getRecent(entityType: string, entityId: string): Promise<HistoryEntry[]> {
    return this.entries.filter(
      e => e.entityType === entityType && e.entityId === entityId
    )
  }
}
