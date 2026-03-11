import type { Soldier, Task, LeaveRequest, LeaveAssignment } from '../models'

function get(row: string[], headers: string[], name: string): string {
  // Try exact match first
  let i = headers.indexOf(name)
  if (i !== -1) return row[i] ?? ''

  // Try case-insensitive + trimmed match as fallback
  const normalizedName = name.toLowerCase().trim()
  i = headers.findIndex(h => h.toLowerCase().trim() === normalizedName)
  if (i !== -1) return row[i] ?? ''

  throw new Error(`Header "${name}" not found`)
}

function getNum(row: string[], headers: string[], name: string): number {
  return parseFloat(get(row, headers, name)) || 0
}

function getBool(row: string[], headers: string[], name: string): boolean {
  return get(row, headers, name).toLowerCase() === 'true'
}

function safeGet(row: string[], headers: string[], name: string): string {
  const i = headers.indexOf(name)
  return i === -1 ? '' : (row[i] ?? '')
}

function hasHeader(headers: string[], name: string): boolean {
  const normalizedName = name.toLowerCase().trim()
  return headers.some(h => h.toLowerCase().trim() === normalizedName)
}

export function parseSoldier(row: string[], headers: string[]): Soldier {
  if (row.length === 0) throw new Error('Cannot parse empty row')

  // Handle multiple column name formats:
  // - New: "First Name" and "Last Name" (with spaces)
  // - Fallback: "FirstName" and "LastName" (no spaces)
  // - Old: "Name" column only
  const hasFirstNameSpaced = hasHeader(headers, 'First Name')
  const hasLastNameSpaced = hasHeader(headers, 'Last Name')
  const hasFirstNameNoSpace = hasHeader(headers, 'FirstName')
  const hasLastNameNoSpace = hasHeader(headers, 'LastName')
  const hasNameColumn = hasHeader(headers, 'Name')

  // Debug: log headers to help diagnose parsing issues
  if (import.meta.env.DEV) {
    console.debug('[parseSoldier] Headers:', headers)
    console.debug('[parseSoldier] Has "First Name":', hasFirstNameSpaced, 'Has "Last Name":', hasLastNameSpaced)
  }

  let firstName = ''
  let lastName = ''

  if (hasFirstNameSpaced && hasLastNameSpaced) {
    // Current format: "First Name" and "Last Name" with spaces
    firstName = get(row, headers, 'First Name')
    lastName = get(row, headers, 'Last Name')
  } else if (hasFirstNameNoSpace && hasLastNameNoSpace) {
    // Fallback: no spaces
    firstName = get(row, headers, 'FirstName')
    lastName = get(row, headers, 'LastName')
  } else if (hasNameColumn) {
    // Old format: Name column → lastName
    firstName = ''
    lastName = get(row, headers, 'Name')
  }

  return {
    id: get(row, headers, 'ID'),
    firstName,
    lastName,
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
    inactiveReason: safeGet(row, headers, 'InactiveReason') || undefined,
  }
}

export function parseTask(row: string[], headers: string[]): Task {
  if (row.length === 0) throw new Error('Cannot parse empty row')
  const roleReqRaw = get(row, headers, 'RoleRequirements')
  const roleRequirements = roleReqRaw ? JSON.parse(roleReqRaw) : []
  const specialDaysRaw = get(row, headers, 'SpecialDurationDays')
  const recurrenceRaw = get(row, headers, 'Recurrence')
  const recurrence = recurrenceRaw && (recurrenceRaw === 'daily' || recurrenceRaw === 'pillbox') ? recurrenceRaw : undefined
  const recurrenceEndDate = get(row, headers, 'RecurrenceEndDate') || undefined
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
    recurrence,
    recurrenceEndDate,
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
