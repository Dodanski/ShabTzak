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
  inactiveReason?: string
  hoursWorked: number
  weekendLeavesCount: number
  midweekLeavesCount: number
  afterLeavesCount: number
}

export interface CreateSoldierInput {
  id: string          // army ID number, e.g. "1234567" — user-supplied
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
  inactiveReason?: string
  hoursWorked?: number
  weekendLeavesCount?: number
  midweekLeavesCount?: number
  afterLeavesCount?: number
  currentFairness?: number
}
