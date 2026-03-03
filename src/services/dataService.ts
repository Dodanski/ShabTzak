import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SoldierRepository } from './soldierRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { HistoryService } from './historyService'
import { SoldierService } from './soldierService'
import { LeaveRequestService } from './leaveRequestService'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'

/**
 * Single entry point for per-unit data operations.
 * Wires together the 4 unit repositories and services sharing one cache instance.
 * Receives HistoryService injected from MasterDataService.
 */
export class DataService {
  readonly sheets: GoogleSheetsService
  readonly soldiers: SoldierRepository
  readonly leaveRequests: LeaveRequestRepository
  readonly leaveAssignments: LeaveAssignmentRepository
  readonly taskAssignments: TaskAssignmentRepository
  readonly soldierService: SoldierService
  readonly leaveRequestService: LeaveRequestService
  readonly scheduleService: ScheduleService
  readonly fairnessUpdate: FairnessUpdateService

  private cache: SheetCache

  constructor(
    accessToken: string,
    spreadsheetId: string,
    tabPrefix = '',
    private historyService: HistoryService,
  ) {
    const sheets = new GoogleSheetsService(accessToken)
    this.sheets = sheets
    this.cache = new SheetCache()

    this.soldiers = new SoldierRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.leaveRequests = new LeaveRequestRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.leaveAssignments = new LeaveAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.taskAssignments = new TaskAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)

    this.soldierService = new SoldierService(this.soldiers, this.historyService)
    this.leaveRequestService = new LeaveRequestService(this.leaveRequests, this.historyService)
    this.fairnessUpdate = new FairnessUpdateService(this.soldiers, this.historyService)
    this.scheduleService = new ScheduleService(
      this.soldiers,
      this.leaveRequests,
      this.leaveAssignments,
      this.taskAssignments,
      this.historyService,
    )
  }

  /** Clears all cached data, forcing fresh fetches on next access. */
  invalidateAll(): void {
    this.cache.invalidateAll()
  }
}
