import type { Soldier, Task, LeaveRequest, LeaveAssignment } from '../models'

function idx(headers: string[], name: string): number {
  const i = headers.indexOf(name)
  if (i === -1) throw new Error(`Header "${name}" not found`)
  return i
}

function get(row: string[], headers: string[], name: string): string {
  return row[idx(headers, name)] ?? ''
}

function getNum(row: string[], headers: string[], name: string): number {
  return parseFloat(get(row, headers, name)) || 0
}

function getBool(row: string[], headers: string[], name: string): boolean {
  return get(row, headers, name).toLowerCase() === 'true'
}

export function parseSoldier(row: string[], headers: string[]): Soldier {
  if (row.length === 0) throw new Error('Cannot parse empty row')
  return {
    id: get(row, headers, 'ID'),
    name: get(row, headers, 'Name'),
    role: get(row, headers, 'Role') as Soldier['role'],
    serviceStart: get(row, headers, 'ServiceStart'),
    serviceEnd: get(row, headers, 'ServiceEnd'),
    initialFairness: getNum(row, headers, 'InitialFairness'),
    currentFairness: getNum(row, headers, 'CurrentFairness'),
    status: get(row, headers, 'Status') as Soldier['status'],
    hoursWorked: getNum(row, headers, 'HoursWorked'),
    weekendLeavesCount: getNum(row, headers, 'WeekendLeavesCount'),
    midweekLeavesCount: getNum(row, headers, 'MidweekLeavesCount'),
    afterLeavesCount: getNum(row, headers, 'AfterLeavesCount'),
  }
}

export function parseTask(row: string[], headers: string[]): Task {
  if (row.length === 0) throw new Error('Cannot parse empty row')
  const roleReqRaw = get(row, headers, 'RoleRequirements')
  const roleRequirements = roleReqRaw ? JSON.parse(roleReqRaw) : []
  const specialDaysRaw = get(row, headers, 'SpecialDurationDays')
  return {
    id: get(row, headers, 'ID'),
    taskType: get(row, headers, 'TaskType'),
    startTime: get(row, headers, 'StartTime'),
    endTime: get(row, headers, 'EndTime'),
    durationHours: getNum(row, headers, 'DurationHours'),
    roleRequirements,
    minRestAfter: getNum(row, headers, 'MinRestAfter'),
    isSpecial: getBool(row, headers, 'IsSpecial'),
    specialDurationDays: specialDaysRaw ? parseInt(specialDaysRaw) : undefined,
  }
}

export function parseLeaveRequest(row: string[], headers: string[]): LeaveRequest {
  if (row.length === 0) throw new Error('Cannot parse empty row')
  return {
    id: get(row, headers, 'ID'),
    soldierId: get(row, headers, 'SoldierID'),
    startDate: get(row, headers, 'StartDate'),
    endDate: get(row, headers, 'EndDate'),
    leaveType: get(row, headers, 'LeaveType') as LeaveRequest['leaveType'],
    constraintType: get(row, headers, 'ConstraintType') as LeaveRequest['constraintType'],
    priority: getNum(row, headers, 'Priority'),
    status: get(row, headers, 'Status') as LeaveRequest['status'],
  }
}

export function parseLeaveAssignment(row: string[], headers: string[]): LeaveAssignment {
  if (row.length === 0) throw new Error('Cannot parse empty row')
  const requestId = get(row, headers, 'RequestID')
  return {
    id: get(row, headers, 'ID'),
    soldierId: get(row, headers, 'SoldierID'),
    startDate: get(row, headers, 'StartDate'),
    endDate: get(row, headers, 'EndDate'),
    leaveType: get(row, headers, 'LeaveType') as LeaveAssignment['leaveType'],
    isWeekend: getBool(row, headers, 'IsWeekend'),
    isLocked: getBool(row, headers, 'IsLocked'),
    requestId: requestId || undefined,
    createdAt: get(row, headers, 'CreatedAt'),
  }
}
