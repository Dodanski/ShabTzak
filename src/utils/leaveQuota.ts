import type { Soldier, AppConfig, LeaveAssignment } from '../models'

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)))
}

export function calculateLeaveEntitlement(soldier: Soldier, config: AppConfig): number {
  const serviceDays = daysBetween(soldier.serviceStart, soldier.serviceEnd)
  if (serviceDays === 0) return 0
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
  return Math.floor((serviceDays / cycleLength) * config.leaveRatioDaysHome)
}

export function countUsedLeaveDays(soldierId: string, leaveAssignments: LeaveAssignment[]): number {
  return leaveAssignments
    .filter(a => a.soldierId === soldierId)
    .reduce((sum, a) => sum + daysBetween(a.startDate, a.endDate), 0)
}
