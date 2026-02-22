import type { Soldier, Task, LeaveRequest, LeaveAssignment } from '../models'

export function serializeSoldier(s: Soldier): string[] {
  return [
    s.id,
    s.name,
    s.role,
    s.serviceStart,
    s.serviceEnd,
    String(s.initialFairness),
    String(s.currentFairness),
    s.status,
    String(s.hoursWorked),
    String(s.weekendLeavesCount),
    String(s.midweekLeavesCount),
    String(s.afterLeavesCount),
  ]
}

export function serializeTask(t: Task): string[] {
  return [
    t.id,
    t.taskType,
    t.startTime,
    t.endTime,
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
