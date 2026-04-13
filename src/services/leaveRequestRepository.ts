import { JsonRepository } from './JsonRepository'
import type { LeaveRequest, CreateLeaveRequestInput, RequestStatus } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export class LeaveRequestRepository extends JsonRepository<LeaveRequest> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'leaveRequests')
  }

  async create(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const request: LeaveRequest = {
      id: generateId(),
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: 'After',
      constraintType: input.constraintType,
      priority: input.priority,
      status: 'Pending',
    }
    return super.create(request)
  }

  async updateStatus(id: string, status: RequestStatus): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) {
      throw new Error(`Leave request with id "${id}" not found`)
    }
    await super.update(id, { status })
  }
}
