import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { Soldier, CreateSoldierInput, SoldierStatus } from '../models'

/**
 * Orchestrates soldier CRUD with audit history logging.
 */
export class SoldierService {
  constructor(
    private repo: SoldierRepository,
    private history: HistoryService,
  ) {}

  async create(input: CreateSoldierInput, changedBy: string): Promise<Soldier> {
    const soldier = await this.repo.create(input)
    await this.history.append('CREATE', 'Soldier', soldier.id, changedBy, `Created soldier ${soldier.name}`)
    return soldier
  }

  async updateStatus(id: string, status: SoldierStatus, changedBy: string): Promise<void> {
    await this.repo.update({ id, status })
    await this.history.append('UPDATE_STATUS', 'Soldier', id, changedBy, `Status changed to ${status}`)
  }

  async discharge(id: string, changedBy: string): Promise<void> {
    await this.repo.update({ id, status: 'Discharged' })
    await this.history.append('DISCHARGE', 'Soldier', id, changedBy, `Soldier discharged`)
  }
}
