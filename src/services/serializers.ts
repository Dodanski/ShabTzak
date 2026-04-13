import type { Soldier, Task, LeaveRequest, LeaveAssignment } from '../models'

export function serializeSoldier(s: Soldier): string[] {
  return [
    s.id,
    s.firstName,
    s.lastName,
    s.role,
    s.phone ?? '',
    s.unit ?? '',
    s.serviceStart,
    s.serviceEnd,
    String(s.initialFairness),
    String(s.currentFairness),
    s.status,
    String(s.hoursWorked),
    String(s.weekendLeavesCount),
    String(s.midweekLeavesCount),
    String(s.afterLeavesCount),
    s.inactiveReason ?? '',
  ]
}

export function serializeTask(t: Task): string[] {
  // For regular recurring tasks, store only the time part (HH:MM:SS)
  // For pillbox tasks, keep the full datetime
  const startTimeStr = !t.isSpecial
    ? t.startTime.split('T')[1] // Extract time only: HH:MM:SS
    : t.startTime // Keep full datetime for pillbox
  const endTimeStr = !t.isSpecial
    ? t.endTime.split('T')[1] // Extract time only: HH:MM:SS
    : t.endTime // Keep full datetime for pillbox

  return [
    t.id,
    t.taskType,
    startTimeStr,
    endTimeStr,
    String(t.durationHours),
    JSON.stringify(t.roleRequirements),
    String(t.minRestAfter),
    String(t.isSpecial),
    t.specialDurationDays != null ? String(t.specialDurationDays) : '',
  ]
}

export function serializeLeaveRequest(r: LeaveRequest): string[] {
  return [
    r.id,
    r.soldierId,
    r.startDate,
    r.endDate,
    r.leaveType,
    r.constraintType,
    String(r.priority),
    r.status,
  ]
}

export function serializeLeaveAssignment(a: LeaveAssignment): string[] {
  return [
    a.id,
    a.soldierId,
    a.startDate,
    a.endDate,
    a.leaveType,
    String(a.isWeekend),
    String(a.isLocked),
    a.requestId ?? '',
    a.createdAt,
  ]
}
