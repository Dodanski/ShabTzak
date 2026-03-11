import { SoldierRole } from '../constants'

export interface RoleRequirement {
  role: SoldierRole | 'Any'
  count: number
}

export interface Task {
  id: string
  taskType: string
  startTime: string // ISO datetime (defines the time of day and start date)
  endTime: string // ISO datetime
  durationHours: number
  roleRequirements: RoleRequirement[]
  minRestAfter: number // hours
  isSpecial: boolean
  specialDurationDays?: number
  recurrence?: 'daily' | 'pillbox' // 'daily' = repeat every day; 'pillbox' = multi-day special task
  recurrenceEndDate?: string // ISO date (YYYY-MM-DD) - when the daily recurrence stops
}

export interface TaskAssignment {
  scheduleId: string
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  isLocked: boolean
  createdAt: string
  createdBy: string
}

export interface CreateTaskInput {
  taskType: string
  startTime: string
  endTime: string
  durationHours?: number
  roleRequirements: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
  recurrence?: 'daily' | 'pillbox'
  recurrenceEndDate?: string
}

export interface UpdateTaskInput {
  id: string
  taskType?: string
  startTime?: string
  endTime?: string
  durationHours?: number
  roleRequirements?: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
  recurrence?: 'daily' | 'pillbox'
  recurrenceEndDate?: string
}
