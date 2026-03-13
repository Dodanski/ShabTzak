import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SoldierRepository } from './soldierRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { HistoryService } from './historyService'
import type { MasterLeaveAssignmentRepository } from './masterLeaveAssignmentRepository'
import type { MasterTaskAssignmentRepository } from './masterTaskAssignmentRepository'
import { SoldierService } from './soldierService'
import { LeaveRequestService } from './leaveRequestService'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'

/**
 * Single entry point for per-unit data operations.
 * Wires together the 4 unit repositories and services sharing one cache instance.
 * Receives HistoryService injected from MasterDataService.
 * Optionally receives master assignment repositories for shared multi-unit scheduling.
 * When master repositories are provided, they override unit-specific ones for shared schedule access.
 */
export class DataService {
  readonly sheets: GoogleSheetsService
  readonly soldiers: SoldierRepository
  readonly leaveRequests: LeaveRequestRepository
  readonly leaveAssignments: LeaveAssignmentRepository | MasterLeaveAssignmentRepository
  readonly taskAssignments: TaskAssignmentRepository | MasterTaskAssignmentRepository
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
    masterLeaveAssignments?: MasterLeaveAssignmentRepository,
    masterTaskAssignments?: MasterTaskAssignmentRepository,
  ) {
    const sheets = new GoogleSheetsService(accessToken)
    this.sheets = sheets
    this.cache = new SheetCache()

    this.soldiers = new SoldierRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.leaveRequests = new LeaveRequestRepository(sheets, spreadsheetId, this.cache, tabPrefix)

    // Use master repositories if provided (shared multi-unit scheduling), otherwise unit-specific ones
    const unitLeaveAssignments = new LeaveAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    const unitTaskAssignments = new TaskAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)

    this.leaveAssignments = masterLeaveAssignments || unitLeaveAssignments
    this.taskAssignments = masterTaskAssignments || unitTaskAssignments

    this.soldierService = new SoldierService(this.soldiers, this.historyService)
    this.leaveRequestService = new LeaveRequestService(this.leaveRequests, this.historyService)
    this.fairnessUpdate = new FairnessUpdateService(this.soldiers, this.historyService)

    this.scheduleService = new ScheduleService(
      this.soldiers,
      this.leaveRequests,
      this.leaveAssignments as any,
      this.taskAssignments as any,
      this.historyService,
    )
  }

  /** Clears all cached data, forcing fresh fetches on next access. */
  invalidateAll(): void {
    this.cache.invalidateAll()
  }
}
