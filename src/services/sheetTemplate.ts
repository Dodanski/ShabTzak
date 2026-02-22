import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS, DEFAULT_CONFIG } from '../constants'

const TAB_HEADERS: Record<string, string[][]> = {
  [SHEET_TABS.SOLDIERS]: [[
    'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
    'InitialFairness', 'CurrentFairness', 'Status',
    'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  ]],
  [SHEET_TABS.TASKS]: [[
    'ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours',
    'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays',
  ]],
  [SHEET_TABS.TASK_SCHEDULE]: [[
    'ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole',
    'IsLocked', 'CreatedAt', 'CreatedBy',
  ]],
  [SHEET_TABS.LEAVE_REQUESTS]: [[
    'ID', 'SoldierID', 'StartDate', 'EndDate',
    'LeaveType', 'ConstraintType', 'Priority', 'Status',
  ]],
  [SHEET_TABS.LEAVE_SCHEDULE]: [[
    'ID', 'SoldierID', 'StartDate', 'EndDate',
    'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt',
  ]],
  [SHEET_TABS.HISTORY]: [[
    'Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details',
  ]],
  [SHEET_TABS.CONFIG]: [[
    'Key', 'Value',
  ]],
  [SHEET_TABS.VERSION]: [[
    'TabName', 'Version', 'LastModified', 'LastModifiedBy',
  ]],
}

const DEFAULT_CONFIG_ROWS: string[][] = [
  ['leaveRatioDaysInBase', String(DEFAULT_CONFIG.leaveRatioDaysInBase)],
  ['leaveRatioDaysHome', String(DEFAULT_CONFIG.leaveRatioDaysHome)],
  ['longLeaveMaxDays', String(DEFAULT_CONFIG.longLeaveMaxDays)],
  ['minBasePresence', String(DEFAULT_CONFIG.minBasePresence)],
  ['maxDrivingHours', String(DEFAULT_CONFIG.maxDrivingHours)],
  ['defaultRestPeriod', String(DEFAULT_CONFIG.defaultRestPeriod)],
]

export class SheetTemplateGenerator {
  private service: GoogleSheetsService

  constructor(service: GoogleSheetsService) {
    this.service = service
  }

  /**
   * Create a new spreadsheet with all required tabs and headers
   * Returns the new spreadsheet ID
   */
  async createTemplate(title: string): Promise<string> {
    const spreadsheet = await this.service.createSpreadsheet(title)
    const spreadsheetId = spreadsheet.spreadsheetId

    // Write headers for each tab
    for (const [tab, headers] of Object.entries(TAB_HEADERS)) {
      await this.service.updateValues(spreadsheetId, `${tab}!A1`, headers)
    }

    // Write default config values
    await this.service.appendValues(
      spreadsheetId,
      `${SHEET_TABS.CONFIG}!A2`,
      DEFAULT_CONFIG_ROWS
    )

    return spreadsheetId
  }
}
