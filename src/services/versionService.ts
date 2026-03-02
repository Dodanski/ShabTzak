import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'
import { prefixTab } from '../utils/tabPrefix'
import type { VersionInfo } from '../models'

export class VersionService {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.tabName = prefixTab(tabPrefix, SHEET_TABS.VERSION)
    this.range = `${this.tabName}!A:D`
  }

  /**
   * Read all version rows and return info for a specific tab.
   * Returns null if the tab has no version entry.
   */
  async getVersion(tabName: string): Promise<VersionInfo | null> {
    const rows = await this.sheets.getValues(this.spreadsheetId, this.range)
    if (rows.length < 2) return null

    const headers = rows[0]
    const dataRows = rows.slice(1)

    const tabIdx = headers.indexOf('TabName')
    const verIdx = headers.indexOf('Version')
    const modIdx = headers.indexOf('LastModified')
    const byIdx = headers.indexOf('LastModifiedBy')

    const row = dataRows.find(r => r[tabIdx] === tabName)
    if (!row) return null

    return {
      tabName: row[tabIdx],
      version: parseInt(row[verIdx]) || 0,
      lastModified: row[modIdx] ?? '',
      lastModifiedBy: row[byIdx] ?? '',
    }
  }

  /**
   * Increment the version for a tab and record who changed it.
   */
  async incrementVersion(tabName: string, changedBy: string): Promise<void> {
    const rows = await this.sheets.getValues(this.spreadsheetId, this.range)
    const headers = rows[0] ?? []
    const dataRows = rows.slice(1)

    const tabIdx = headers.indexOf('TabName')
    const verIdx = headers.indexOf('Version')

    const rowIndex = dataRows.findIndex(r => r[tabIdx] === tabName)
    const newVersion = rowIndex >= 0 ? (parseInt(dataRows[rowIndex][verIdx]) || 0) + 1 : 1
    const now = new Date().toISOString()
    const updatedRow = [tabName, String(newVersion), now, changedBy]

    // Row index in sheet = header row (1) + data offset (rowIndex) + 1-based = rowIndex + 2
    const sheetRow = rowIndex >= 0 ? rowIndex + 2 : dataRows.length + 2
    const range = `${this.tabName}!A${sheetRow}:D${sheetRow}`

    await this.sheets.updateValues(this.spreadsheetId, range, [updatedRow])
  }

  /**
   * Returns true if localVersion is behind the sheet's current version.
   */
  async isStale(tabName: string, localVersion: number): Promise<boolean> {
    const info = await this.getVersion(tabName)
    if (!info) return false
    return info.version > localVersion
  }
}
