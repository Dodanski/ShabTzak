import { JsonRepository } from './JsonRepository'
import type { Unit, CreateUnitInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class UnitRepository extends JsonRepository<Unit> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'units')
  }

  async createUnit(input: CreateUnitInput, createdBy: string): Promise<Unit> {
    const unit: Unit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name,
      spreadsheetId: input.spreadsheetId,
      tabPrefix: input.tabPrefix,
      createdAt: new Date().toISOString(),
      createdBy: createdBy,
    }
    return super.create(unit)
  }

  async remove(id: string): Promise<void> {
    await super.delete(id)
  }
}
