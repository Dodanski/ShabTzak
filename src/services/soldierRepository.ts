import { JsonRepository } from './JsonRepository'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class SoldierRepository extends JsonRepository<Soldier> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'soldiers')
  }

  async createSoldier(input: CreateSoldierInput): Promise<Soldier> {
    const soldier: Soldier = {
      id: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone,
      unit: input.unit,
      serviceStart: input.serviceStart,
      serviceEnd: input.serviceEnd,
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    return super.create(soldier)
  }

  async updateSoldier(input: UpdateSoldierInput): Promise<void> {
    const existing = await this.getById(input.id)
    if (!existing) {
      throw new Error(`Soldier with id "${input.id}" not found`)
    }

    const updates: Partial<Soldier> = {}
    if (input.newId !== undefined) updates.id = input.newId
    if (input.firstName !== undefined) updates.firstName = input.firstName
    if (input.lastName !== undefined) updates.lastName = input.lastName
    if (input.role !== undefined) updates.role = input.role
    if (input.phone !== undefined) updates.phone = input.phone
    if (input.unit !== undefined) updates.unit = input.unit
    if (input.serviceStart !== undefined) updates.serviceStart = input.serviceStart
    if (input.serviceEnd !== undefined) updates.serviceEnd = input.serviceEnd
    if (input.status !== undefined) updates.status = input.status
    if (input.hoursWorked !== undefined) updates.hoursWorked = input.hoursWorked
    if (input.weekendLeavesCount !== undefined) updates.weekendLeavesCount = input.weekendLeavesCount
    if (input.midweekLeavesCount !== undefined) updates.midweekLeavesCount = input.midweekLeavesCount
    if (input.afterLeavesCount !== undefined) updates.afterLeavesCount = input.afterLeavesCount
    if (input.currentFairness !== undefined) updates.currentFairness = input.currentFairness
    if (input.inactiveReason !== undefined) updates.inactiveReason = input.inactiveReason

    await super.update(input.id, updates)
  }
}
