import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { TaskRepository } from './taskRepository'
import { ConfigRepository } from './configRepository'
import { HistoryService } from './historyService'
import { TaskService } from './taskService'
import { RolesService } from './rolesService'
import { SoldierRepository } from './soldierRepository'
import { MasterTaskAssignmentRepository } from './masterTaskAssignmentRepository'
import { MasterLeaveAssignmentRepository } from './masterLeaveAssignmentRepository'
import { MASTER_SHEET_TABS } from '../constants'
import type { Unit } from '../models'

const ADMIN_TAB_HEADERS: Record<string, string[][]> = {
  [MASTER_SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [MASTER_SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [MASTER_SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
  [MASTER_SHEET_TABS.ROLES]: [['RoleName']],
  [MASTER_SHEET_TABS.TASK_SCHEDULE]: [['ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole', 'AssignedUnitID', 'IsLocked', 'CreatedAt', 'CreatedBy']],
  [MASTER_SHEET_TABS.LEAVE_SCHEDULE]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt']],
}

export type ResolvedRole =
  | { role: 'admin' }
  | { role: 'commander'; unitId: string; unit: Unit }
  | null

export class MasterDataService {
  readonly admins: AdminRepository
  readonly units: UnitRepository
  readonly commanders: CommanderRepository
  readonly tasks: TaskRepository
  readonly config: ConfigRepository
  readonly history: HistoryService
  readonly taskService: TaskService
  readonly roles: RolesService
  readonly soldiers: SoldierRepository
  readonly taskAssignments: MasterTaskAssignmentRepository
  readonly leaveAssignments: MasterLeaveAssignmentRepository
  readonly sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(accessToken: string, spreadsheetId: string) {
    this.sheets = new GoogleSheetsService(accessToken)
    this.spreadsheetId = spreadsheetId
    const cache = new SheetCache()
    this.admins = new AdminRepository(this.sheets, spreadsheetId, cache)
    this.units = new UnitRepository(this.sheets, spreadsheetId, cache)
    this.commanders = new CommanderRepository(this.sheets, spreadsheetId, cache)
    this.tasks = new TaskRepository(this.sheets, spreadsheetId, cache)
    this.config = new ConfigRepository(this.sheets, spreadsheetId)
    this.history = new HistoryService(this.sheets, spreadsheetId)
    this.taskService = new TaskService(this.tasks, this.history)
    this.roles = new RolesService(this.sheets, spreadsheetId)
    this.soldiers = new SoldierRepository(this.sheets, spreadsheetId, cache, 'Soldiers')
    this.taskAssignments = new MasterTaskAssignmentRepository(this.sheets, spreadsheetId, cache)
    this.leaveAssignments = new MasterLeaveAssignmentRepository(this.sheets, spreadsheetId, cache)

    if (import.meta.env.DEV) {
      console.log('[MasterDataService] Initialized master repositories (TaskSchedule, LeaveSchedule)')
    }
  }

  /**
   * Creates missing master tabs and seeds the first admin from env.
   * Idempotent — safe to call on every app load.
   */
  async initialize(firstAdminEmail: string): Promise<void> {
    const titles = await this.sheets.getSheetTitles(this.spreadsheetId)
    const needed = Object.values(MASTER_SHEET_TABS)
    const missing = needed.filter(t => !titles.includes(t))

    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } },
      }))
      await this.sheets.batchUpdate(this.spreadsheetId, requests)

      for (const tabName of missing) {
        const headers = ADMIN_TAB_HEADERS[tabName]
        if (headers) {
          await this.sheets.updateValues(this.spreadsheetId, `${tabName}!A1`, headers)
        }
      }
    }

    const admins = await this.admins.list()
    if (admins.length === 0 && firstAdminEmail) {
      await this.admins.create({ email: firstAdminEmail }, 'system')
    }
  }

  /**
   * Determines the role of the given email by checking the master spreadsheet.
   * Returns null if the email is not authorized.
   */
  async resolveRole(email: string): Promise<ResolvedRole> {
    const [admins, commanders, units] = await Promise.all([
      this.admins.list(),
      this.commanders.list(),
      this.units.list(),
    ])

    if (admins.some(a => a.email === email)) {
      return { role: 'admin' }
    }

    const cmdEntry = commanders.find(c => c.email === email)
    if (cmdEntry) {
      const unit = units.find(u => u.id === cmdEntry.unitId)
      if (unit) return { role: 'commander', unitId: cmdEntry.unitId, unit }
    }

    return null
  }
}
