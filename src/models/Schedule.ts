import { TaskAssignment } from './Task'
import { LeaveAssignment } from './Leave'

export interface TaskSchedule {
  startDate: string
  endDate: string
  assignments: TaskAssignment[]
  conflicts: ScheduleConflict[]
}

export interface LeaveSchedule {
  startDate: string
  endDate: string
  assignments: LeaveAssignment[]
  conflicts: ScheduleConflict[]
}

export interface ScheduleConflict {
  type: ConflictType
  message: string
  affectedSoldierIds: string[]
  affectedTaskIds?: string[]
  affectedRequestIds?: string[]
  suggestions: string[]
}

export type ConflictType =
  | 'INSUFFICIENT_BASE_PRESENCE'
  | 'NO_ROLE_AVAILABLE'
  | 'REST_PERIOD_VIOLATION'
  | 'OVERLAPPING_ASSIGNMENT'
  | 'OVER_QUOTA'
