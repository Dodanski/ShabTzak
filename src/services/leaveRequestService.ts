import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { HistoryService } from './historyService'
import type { LeaveRequest, CreateLeaveRequestInput } from '../models'

/**
 * Orchestrates leave request lifecycle (submit → approve/deny) with history logging.
 */
export class LeaveRequestService {
  constructor(
    private repo: LeaveRequestRepository,
    private history: HistoryService,
  ) {}

  async submit(input: CreateLeaveRequestInput, changedBy: string): Promise<LeaveRequest> {
    const request = await this.repo.create(input)
    await this.history.append(
      'SUBMIT', 'LeaveRequest', request.id, changedBy,
      `Leave request from ${input.startDate} to ${input.endDate}`
    )
    return request
  }

  async approve(id: string, changedBy: string): Promise<void> {
    await this.repo.updateStatus(id, 'Approved')
    await this.history.append('APPROVE', 'LeaveRequest', id, changedBy, 'Request approved')
  }

  async deny(id: string, changedBy: string): Promise<void> {
    await this.repo.updateStatus(id, 'Denied')
    await this.history.append('DENY', 'LeaveRequest', id, changedBy, 'Request denied')
  }
}
