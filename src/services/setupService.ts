import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

export interface TabStatus {
  tab: string
  exists: boolean
  created: boolean
  error?: string
}

const TAB_HEADERS: Record<string, string[][]> = {
  [SHEET_TABS.SOLDIERS]: [['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount']],
  [SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [SHEET_TABS.TASK_SCHEDULE]: [['ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole', 'IsLocked', 'CreatedAt', 'CreatedBy']],
  [SHEET_TABS.LEAVE_REQUESTS]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'ConstraintType', 'Priority', 'Status']],
  [SHEET_TABS.LEAVE_SCHEDULE]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt']],
  [SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
  [SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [SHEET_TABS.VERSION]: [['TabName', 'Version', 'LastModified', 'LastModifiedBy']],
}

export class SetupService {
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
  }

  async checkTabs(): Promise<TabStatus[]> {
    const existing = new Set(await this.sheets.getSheetTitles(this.spreadsheetId))
    return Object.values(SHEET_TABS).map(tab => ({
      tab,
      exists: existing.has(tab),
      created: false,
    }))
  }

  async initializeMissingTabs(): Promise<TabStatus[]> {
    const statuses = await this.checkTabs()
    const missing = statuses.filter(s => !s.exists).map(s => s.tab)

    if (missing.length === 0) return statuses

    // Create all missing tabs in one batchUpdate call
    await this.sheets.batchUpdate(
      this.spreadsheetId,
      missing.map(title => ({ addSheet: { properties: { title } } }))
    )

    // Write headers for each newly created tab
    for (const tab of missing) {
      const headers = TAB_HEADERS[tab]
      if (headers) {
        await this.sheets.updateValues(this.spreadsheetId, `${tab}!A1`, headers)
      }
    }

    return statuses.map(s => ({
      ...s,
      exists: true,
      created: !s.exists,
    }))
  }
}
