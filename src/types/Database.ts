import type { Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment, AppConfig, Unit, Admin, Commander } from '../models'

export interface Database {
  version: number
  lastModified: string
  soldiers: Soldier[]
  tasks: Task[]
  units: Unit[]
  leaveRequests: LeaveRequest[]
  leaveAssignments: LeaveAssignment[]
  taskAssignments: TaskAssignment[]
  config: AppConfig
  roles: string[]
  admins: Admin[]
  commanders: Commander[]
}
