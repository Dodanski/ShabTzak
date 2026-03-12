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
  leaveBaseExitHour: string // HH:MM format, time soldier leaves base
  leaveBaseReturnHour: string // HH:MM format, time soldier returns to base
}

export interface VersionInfo {
  tabName: string
  version: number
  lastModified: string
  lastModifiedBy: string
}
