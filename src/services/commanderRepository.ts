import { JsonRepository } from './JsonRepository'
import type { Commander, CreateCommanderInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class CommanderRepository extends JsonRepository<Commander> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'commanders')
  }

  async listByUnit(unitId: string): Promise<Commander[]> {
    const all = await this.list()
    return all.filter(c => c.unitId === unitId)
  }

  async createCommander(input: CreateCommanderInput, createdBy: string): Promise<Commander> {
    const commander: Commander = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: input.email,
      unitId: input.unitId,
      addedAt: new Date().toISOString(),
      addedBy: createdBy,
    }
    return super.create(commander)
  }

  async remove(id: string): Promise<void> {
    await super.delete(id)
  }
}
