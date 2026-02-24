import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS, DEFAULT_CONFIG } from '../constants'
import type { AppConfig } from '../models'

const RANGE = `${SHEET_TABS.CONFIG}!A:B`

type PartialNumericConfig = Partial<Pick<AppConfig,
  'leaveRatioDaysInBase' | 'leaveRatioDaysHome' | 'longLeaveMaxDays' |
  'minBasePresence' | 'maxDrivingHours' | 'defaultRestPeriod'
>>

export class ConfigRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
  }

  async read(): Promise<AppConfig> {
    const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
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
      `${SHEET_TABS.CONFIG}!A2:B${rows.length + 1}`,
      rows
    )
  }

  async writeAdminEmails(emails: string[]): Promise<void> {
    await this.sheets.appendValues(
      this.spreadsheetId,
      `${SHEET_TABS.CONFIG}!A:B`,
      [['adminEmails', emails.join(',')]]
    )
  }
}
