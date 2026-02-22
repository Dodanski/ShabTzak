import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

const RANGE = `${SHEET_TABS.HISTORY}!A:F`

export interface HistoryEntry {
  timestamp: string
  action: string
  entityType: string
  entityId: string
  changedBy: string
  details: string
}

export class HistoryService {
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
  }

  async append(
    action: string,
    entityType: string,
    entityId: string,
    changedBy: string,
    details: string
  ): Promise<void> {
    const row = [
      new Date().toISOString(),
      action,
      entityType,
      entityId,
      changedBy,
      details,
    ]
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [row])
  }

  async listAll(): Promise<HistoryEntry[]> {
    const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    return rows.slice(1).filter(r => r.length > 0).map(r => ({
      timestamp: r[0] ?? '',
      action: r[1] ?? '',
      entityType: r[2] ?? '',
      entityId: r[3] ?? '',
      changedBy: r[4] ?? '',
      details: r[5] ?? '',
    }))
  }

  async getRecent(entityType: string, entityId: string): Promise<HistoryEntry[]> {
    const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    const dataRows = rows.slice(1).filter(r => r.length > 0)

    return dataRows
      .filter(r => r[2] === entityType && r[3] === entityId)
      .map(r => ({
        timestamp: r[0] ?? '',
        action: r[1] ?? '',
        entityType: r[2] ?? '',
        entityId: r[3] ?? '',
        changedBy: r[4] ?? '',
        details: r[5] ?? '',
      }))
  }
}
