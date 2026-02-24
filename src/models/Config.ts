import { SoldierRole } from '../constants'

export interface AppConfig {
  leaveRatioDaysInBase: number
  leaveRatioDaysHome: number
  longLeaveMaxDays: number
  weekendDays: string[]
  minBasePresence: number
  minBasePresenceByRole: Record<SoldierRole, number>
  maxDrivingHours: number
  defaultRestPeriod: number
  taskTypeRestPeriods: Record<string, number>
  adminEmails: string[]
}

export interface VersionInfo {
  tabName: string
  version: number
  lastModified: string
  lastModifiedBy: string
}
