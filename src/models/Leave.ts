import { LeaveType, ConstraintType, RequestStatus } from '../constants'

export interface LeaveRequest {
  id: string
  soldierId: string
  startDate: string // ISO date
  endDate: string // ISO date
  leaveType: LeaveType
  constraintType: ConstraintType
  priority: number // 1-10
  status: RequestStatus
}

export interface LeaveAssignment {
  id: string
  soldierId: string
  startDate: string
  endDate: string
  leaveType: LeaveType
  isWeekend: boolean
  isLocked: boolean
  requestId?: string
  createdAt: string
}

export interface CreateLeaveRequestInput {
  soldierId: string
  startDate: string
  endDate: string
  constraintType: ConstraintType
  priority: number
}
