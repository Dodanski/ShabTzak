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
}

export interface VersionInfo {
  tabName: string
  version: number
  lastModified: string
  lastModifiedBy: string
}
