import { JsonRepository } from './JsonRepository'
import type { LeaveAssignment, LeaveType } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 16).replace(/:/g, '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `leave_${date}_${time}_${random}`
}

interface CreateLeaveAssignmentInput {
  soldierId: string
  startDate: string
  endDate: string
  leaveType: LeaveType
  isWeekend: boolean
  requestId?: string
}

/**
 * JSON-based repository for shared leave assignments
 * Used by all units - ONE schedule shared across organization
 */
export class MasterLeaveAssignmentRepositoryJson extends JsonRepository<LeaveAssignment> {
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

  async setLocked(id: string, isLocked: boolean): Promise<void> {
    await super.update(id, { isLocked })
  }

  async delete(id: string): Promise<void> {
    await super.delete(id)
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
    const updated = {
      ...db,
      leaveAssignments: [...db.leaveAssignments, ...assignments]
    }
    this.context.setData(updated)
    return assignments
  }

  async clearFutureAssignments(): Promise<LeaveAssignment[]> {
    const today = new Date().toISOString().split('T')[0]
    const db = this.context.getData()
    const past = db.leaveAssignments.filter(a => a.startDate < today)
    this.context.setData({
      ...db,
      leaveAssignments: past
    })
    return past
  }
}
