import { SoldierRole } from '../constants'

export interface RoleRequirement {
  role: SoldierRole | 'Any'
  count: number
}

export interface Task {
  id: string
  taskType: string
  startTime: string // ISO datetime
  endTime: string // ISO datetime
  durationHours: number
  roleRequirements: RoleRequirement[]
  minRestAfter: number // hours
  isSpecial: boolean
  specialDurationDays?: number
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
  roleRequirements: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
}
