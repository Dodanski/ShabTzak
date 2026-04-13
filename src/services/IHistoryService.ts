export interface HistoryEntry {
  timestamp: string
  action: string
  entityType: string
  entityId: string
  changedBy: string
  details: string
}

/**
 * Interface for history logging service.
 * Implemented by both Google Sheets-based HistoryService (legacy)
 * and in-memory HistoryServiceStub (JSON database).
 */
export interface IHistoryService {
  append(
    action: string,
    entityType: string,
    entityId: string,
    changedBy: string,
    details: string
  ): Promise<void>

  listAll(): Promise<HistoryEntry[]>

  getRecent(entityType: string, entityId: string): Promise<HistoryEntry[]>
}
