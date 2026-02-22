import { SoldierRole, SoldierStatus } from '../constants'

export interface Soldier {
  id: string
  name: string
  role: SoldierRole
  serviceStart: string // ISO date
  serviceEnd: string // ISO date
  initialFairness: number
  currentFairness: number
  status: SoldierStatus
  hoursWorked: number
  weekendLeavesCount: number
  midweekLeavesCount: number
  afterLeavesCount: number
}

export interface CreateSoldierInput {
  name: string
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
}

export interface UpdateSoldierInput {
  id: string
  name?: string
  role?: SoldierRole
  serviceStart?: string
  serviceEnd?: string
  status?: SoldierStatus
  hoursWorked?: number
  weekendLeavesCount?: number
  midweekLeavesCount?: number
  afterLeavesCount?: number
  currentFairness?: number
}
