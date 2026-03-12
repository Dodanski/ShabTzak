import { SoldierRole } from '../constants'

export interface RoleRequirement {
  roles: (SoldierRole | 'Any')[]  // Array of acceptable roles
  count: number
  // Backward compat field (deprecated):
  role?: SoldierRole | 'Any'      // For reading old tasks
}

export interface Task {
  id: string
  taskType: string
  startTime: string // ISO datetime (defines the time of day and start date)
  endTime: string // ISO datetime
  durationHours: number
  roleRequirements: RoleRequirement[]
  minRestAfter: number // hours
  isSpecial: boolean // pillbox = multi-day special task that recurs sequentially
  specialDurationDays?: number
}

export interface TaskAssignment {
  scheduleId: string
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  assignedUnitId?: string  // NEW: which unit the soldier belongs to
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
}
