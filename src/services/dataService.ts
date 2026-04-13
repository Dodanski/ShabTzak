import { useDatabase } from '../contexts/DatabaseContext'
import { SoldierRepository } from './soldierRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import { TaskRepository } from './taskRepository'
import { UnitRepository } from './unitRepository'
import { AdminRepository } from './adminRepository'
import { CommanderRepository } from './commanderRepository'
import { ConfigRepository } from './configRepository'
import type { HistoryService } from './historyService'
import type { MasterLeaveAssignmentRepository } from './masterLeaveAssignmentRepository'
import type { MasterTaskAssignmentRepository } from './masterTaskAssignmentRepository'
import { SoldierService } from './soldierService'
import { LeaveRequestService } from './leaveRequestService'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'

/**
 * Single entry point for per-unit data operations.
 * Wires together all unit repositories and services using DatabaseContext.
 * Receives HistoryService injected from MasterDataService.
 * Optionally receives master assignment repositories for shared multi-unit scheduling.
 * When master repositories are provided, they override unit-specific ones for shared schedule access.
 */
export class DataService {
  readonly soldiers: SoldierRepository
  readonly tasks: TaskRepository
  readonly leaveRequests: LeaveRequestRepository
  readonly leaveAssignments: LeaveAssignmentRepository | MasterLeaveAssignmentRepository
  readonly taskAssignments: TaskAssignmentRepository | MasterTaskAssignmentRepository
  readonly units: UnitRepository
  readonly admins: AdminRepository
  readonly commanders: CommanderRepository
  readonly config: ConfigRepository
  readonly soldierService: SoldierService
  readonly leaveRequestService: LeaveRequestService
  readonly scheduleService: ScheduleService
  readonly fairnessUpdate: FairnessUpdateService

  constructor(
    dbContext: ReturnType<typeof useDatabase>,
    private historyService: HistoryService,
    masterLeaveAssignments?: MasterLeaveAssignmentRepository,
    masterTaskAssignments?: MasterTaskAssignmentRepository,
  ) {
    this.soldiers = new SoldierRepository(dbContext)
    this.tasks = new TaskRepository(dbContext)
    this.leaveRequests = new LeaveRequestRepository(dbContext)
    this.units = new UnitRepository(dbContext)
    this.admins = new AdminRepository(dbContext)
    this.commanders = new CommanderRepository(dbContext)
    this.config = new ConfigRepository(dbContext)

    // Use master repositories if provided (shared multi-unit scheduling), otherwise unit-specific ones
    const unitLeaveAssignments = new LeaveAssignmentRepository(dbContext)
    const unitTaskAssignments = new TaskAssignmentRepository(dbContext)

    this.leaveAssignments = masterLeaveAssignments || unitLeaveAssignments
    this.taskAssignments = masterTaskAssignments || unitTaskAssignments

    if (import.meta.env.DEV) {
      console.log('[DataService] Using', masterLeaveAssignments ? 'MASTER' : 'unit-specific', 'leave assignments')
      console.log('[DataService] Using', masterTaskAssignments ? 'MASTER' : 'unit-specific', 'task assignments')
    }

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
}
