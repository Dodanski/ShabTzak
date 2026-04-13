import { JsonRepository } from './JsonRepository'
import type { LeaveAssignment, LeaveType } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

function generateId(): string {
  // Generate plain text ID: leave_YYYYMMDD_HHMM_RANDOM
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `leave_${date}_${time}_${random}`
}

export interface CreateLeaveAssignmentInput {
  soldierId: string
  startDate: string
  endDate: string
  leaveType: LeaveType
  isWeekend: boolean
  requestId?: string
}

export class LeaveAssignmentRepository extends JsonRepository<LeaveAssignment> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'leaveAssignments')
  }

  async listBySoldier(soldierId: string): Promise<LeaveAssignment[]> {
    const all = await this.list()
    return all.filter(a => a.soldierId === soldierId)
  }

  async create(input: CreateLeaveAssignmentInput): Promise<LeaveAssignment> {
    const assignment: LeaveAssignment = {
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      isWeekend: input.isWeekend,
      isLocked: false,
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
    }
    return super.create(assignment)
  }

  async createBatch(inputs: CreateLeaveAssignmentInput[]): Promise<LeaveAssignment[]> {
    const assignments = inputs.map(input => ({
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: input.leaveType,
      isWeekend: input.isWeekend,
      isLocked: false,
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
    }))

    const db = this.context.getData()
    const items = [...db[this.entityKey] as LeaveAssignment[], ...assignments]
    this.context.setData({ ...db, [this.entityKey]: items })
    return assignments
  }

  async setLocked(id: string, locked: boolean): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`Leave assignment with id "${id}" not found`)
    }
    await super.update(id, { isLocked: locked })
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const db = this.context.getData()
    const items = db[this.entityKey] as LeaveAssignment[]
    const idsSet = new Set(ids)
    const filtered = items.filter(item => !idsSet.has(item.id))
    this.context.setData({ ...db, [this.entityKey]: filtered })
  }
}
