import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SoldierRepository } from './soldierRepository'
import { TaskRepository } from './taskRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import { ConfigRepository } from './configRepository'
import { HistoryService } from './historyService'
import { VersionService } from './versionService'
import { SoldierService } from './soldierService'
import { TaskService } from './taskService'
import { LeaveRequestService } from './leaveRequestService'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'

/**
 * Single entry point for all data operations.
 * Wires together all repositories and services sharing one cache instance.
 */
export class DataService {
  readonly soldiers: SoldierRepository
  readonly tasks: TaskRepository
  readonly leaveRequests: LeaveRequestRepository
  readonly leaveAssignments: LeaveAssignmentRepository
  readonly taskAssignments: TaskAssignmentRepository
  readonly config: ConfigRepository
  readonly history: HistoryService
  readonly versions: VersionService
  readonly soldierService: SoldierService
  readonly taskService: TaskService
  readonly leaveRequestService: LeaveRequestService
  readonly scheduleService: ScheduleService
  readonly fairnessUpdate: FairnessUpdateService

  private cache: SheetCache

  constructor(accessToken: string, spreadsheetId: string) {
    const sheets = new GoogleSheetsService(accessToken)
    this.cache = new SheetCache()

    this.soldiers = new SoldierRepository(sheets, spreadsheetId, this.cache)
    this.tasks = new TaskRepository(sheets, spreadsheetId, this.cache)
    this.leaveRequests = new LeaveRequestRepository(sheets, spreadsheetId, this.cache)
    this.leaveAssignments = new LeaveAssignmentRepository(sheets, spreadsheetId, this.cache)
    this.taskAssignments = new TaskAssignmentRepository(sheets, spreadsheetId, this.cache)
    this.config = new ConfigRepository(sheets, spreadsheetId)
    this.history = new HistoryService(sheets, spreadsheetId)
    this.versions = new VersionService(sheets, spreadsheetId)

    this.soldierService = new SoldierService(this.soldiers, this.history)
    this.taskService = new TaskService(this.tasks, this.history)
    this.leaveRequestService = new LeaveRequestService(this.leaveRequests, this.history)
    this.fairnessUpdate = new FairnessUpdateService(this.soldiers, this.history)
    this.scheduleService = new ScheduleService(
      this.soldiers,
      this.leaveRequests,
      this.leaveAssignments,
      this.tasks,
      this.taskAssignments,
      this.config,
      this.history,
    )
  }

  /** Clears all cached data, forcing fresh fetches on next access. */
  invalidateAll(): void {
    this.cache.invalidateAll()
  }
}
