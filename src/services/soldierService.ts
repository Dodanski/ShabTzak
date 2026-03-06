import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { Soldier, CreateSoldierInput, SoldierStatus, UpdateSoldierInput } from '../models'
import { fullName } from '../utils/helpers'

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
    const name = `${input.firstName} ${input.lastName}`
    await this.history.append('CREATE', 'Soldier', soldier.id, changedBy, `Created soldier ${name}`)
    return soldier
  }

  async updateStatus(id: string, status: SoldierStatus, changedBy: string, inactiveReason?: string): Promise<void> {
    await this.repo.update({ id, status, inactiveReason: inactiveReason ?? '' })
    await this.history.append('UPDATE_STATUS', 'Soldier', id, changedBy, `Status changed to ${status}${inactiveReason ? `: ${inactiveReason}` : ''}`)
  }

  async updateFields(id: string, input: Omit<UpdateSoldierInput, 'id'>, changedBy: string): Promise<void> {
    await this.repo.update({ id, ...input })
    const entityId = input.newId ?? id
    await this.history.append('UPDATE_FIELDS', 'Soldier', entityId, changedBy, `Updated fields for soldier ${entityId}`)
  }
}
