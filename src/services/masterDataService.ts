import { useDatabase } from '../contexts/DatabaseContext'
import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { TaskRepository } from './taskRepository'
import { ConfigRepository } from './configRepository'
import { HistoryService } from './historyService'
import { TaskService } from './taskService'
import { RolesService } from './rolesService'
import { SoldierRepository } from './soldierRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { MasterTaskAssignmentRepository } from './masterTaskAssignmentRepository'
import { MasterLeaveAssignmentRepository } from './masterLeaveAssignmentRepository'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'
import type { Unit } from '../models'

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
  readonly leaveRequests: LeaveRequestRepository
  readonly taskAssignments: MasterTaskAssignmentRepository
  readonly leaveAssignments: MasterLeaveAssignmentRepository
  readonly scheduleService: ScheduleService
  readonly fairnessUpdate: FairnessUpdateService

  constructor(
    dbContext: ReturnType<typeof useDatabase>,
  ) {
    this.admins = new AdminRepository(dbContext)
    this.units = new UnitRepository(dbContext)
    this.commanders = new CommanderRepository(dbContext)
    this.tasks = new TaskRepository(dbContext)
    this.config = new ConfigRepository(dbContext)
    this.history = new HistoryService()
    this.taskService = new TaskService(this.tasks, this.history)
    this.roles = new RolesService()
    this.soldiers = new SoldierRepository(dbContext)
    this.leaveRequests = new LeaveRequestRepository(dbContext)
    this.taskAssignments = new MasterTaskAssignmentRepository(dbContext)
    this.leaveAssignments = new MasterLeaveAssignmentRepository(dbContext)
    this.scheduleService = new ScheduleService(
      this.soldiers,
      this.leaveRequests,
      this.leaveAssignments,
      this.taskAssignments,
      this.history
    )
    this.fairnessUpdate = new FairnessUpdateService(this.soldiers, this.history)

    if (import.meta.env.DEV) {
      console.log('[MasterDataService] Initialized master repositories with DatabaseContext')
    }
  }

  /**
   * Determines the role of the given email by checking the master data.
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
