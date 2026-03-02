import { GoogleSheetsService } from './googleSheets'
import { MASTER_SHEET_TABS, DEFAULT_CONFIG } from '../constants'
import { prefixTab } from '../utils/tabPrefix'
import type { AppConfig } from '../models'

type PartialNumericConfig = Partial<Pick<AppConfig,
  'leaveRatioDaysInBase' | 'leaveRatioDaysHome' | 'longLeaveMaxDays' |
  'minBasePresence' | 'maxDrivingHours' | 'defaultRestPeriod'
>>

export class ConfigRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private range: string
  private tabName: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.tabName = prefixTab(tabPrefix, MASTER_SHEET_TABS.CONFIG)
    this.range = `${this.tabName}!A:B`
  }

  async read(): Promise<AppConfig> {
    const rows = await this.sheets.getValues(this.spreadsheetId, this.range)
    const dataRows = rows.slice(1) // skip header
    const map = new Map(dataRows.map(r => [r[0], r[1]]))

    const getNum = (key: string, fallback: number): number => {
      const val = map.get(key)
      return val !== undefined ? parseFloat(val) : fallback
    }

    const adminEmailsRaw = map.get('adminEmails') ?? ''
    const adminEmails = adminEmailsRaw
      ? adminEmailsRaw.split(',').map((e: string) => e.trim()).filter(Boolean)
      : []

    return {
      leaveRatioDaysInBase: getNum('leaveRatioDaysInBase', DEFAULT_CONFIG.leaveRatioDaysInBase),
      leaveRatioDaysHome: getNum('leaveRatioDaysHome', DEFAULT_CONFIG.leaveRatioDaysHome),
      longLeaveMaxDays: getNum('longLeaveMaxDays', DEFAULT_CONFIG.longLeaveMaxDays),
      weekendDays: [...DEFAULT_CONFIG.weekendDays],
      minBasePresence: getNum('minBasePresence', DEFAULT_CONFIG.minBasePresence),
      minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
      maxDrivingHours: getNum('maxDrivingHours', DEFAULT_CONFIG.maxDrivingHours),
      defaultRestPeriod: getNum('defaultRestPeriod', DEFAULT_CONFIG.defaultRestPeriod),
      taskTypeRestPeriods: {},
      adminEmails,
    }
  }

  async write(updates: PartialNumericConfig): Promise<void> {
    const rows = Object.entries(updates).map(([key, value]) => [key, String(value)])
    await this.sheets.updateValues(
      this.spreadsheetId,
      `${this.tabName}!A2:B${rows.length + 1}`,
      rows
    )
  }

  async writeAdminEmails(emails: string[]): Promise<void> {
    const rows = await this.sheets.getValues(this.spreadsheetId, this.range)
    const dataRows = rows.slice(1) // skip header
    const existingRowIndex = dataRows.findIndex(r => r[0] === 'adminEmails')

    if (existingRowIndex >= 0) {
      // Overwrite the existing row (offset by 2: 1 for header, 1 for 1-based index)
      const rowNumber = existingRowIndex + 2
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${this.tabName}!A${rowNumber}:B${rowNumber}`,
        [['adminEmails', emails.join(',')]]
      )
    } else {
      await this.sheets.appendValues(
        this.spreadsheetId,
        `${this.tabName}!A:B`,
        [['adminEmails', emails.join(',')]]
      )
    }
  }
}
