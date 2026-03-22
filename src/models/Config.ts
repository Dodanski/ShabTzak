import { SoldierRole } from '../constants'

export interface AppConfig {
  // Schedule period - defines the active scheduling window
  scheduleStartDate: string // YYYY-MM-DD format, start of scheduling period
  scheduleEndDate: string   // YYYY-MM-DD format, end of scheduling period

  // Leave ratio settings
  leaveRatioDaysInBase: number
  leaveRatioDaysHome: number
  longLeaveMaxDays: number
  weekendDays: string[]

  // Capacity and presence
  minBasePresence: number
  minBasePresenceByRole: Record<SoldierRole, number>

  // Task settings
  maxDrivingHours: number
  defaultRestPeriod: number
  taskTypeRestPeriods: Record<string, number>

  // Admin
  adminEmails: string[]

  // Leave timing
  leaveBaseExitHour: string // HH:MM format, time soldier leaves base
  leaveBaseReturnHour: string // HH:MM format, time soldier returns to base
}

export interface VersionInfo {
  tabName: string
  version: number
  lastModified: string
  lastModifiedBy: string
}
