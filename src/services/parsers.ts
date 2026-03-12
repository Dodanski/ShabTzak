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
  // Use safeGet to handle missing columns gracefully (return 0 if not found)
  const value = safeGet(row, headers, name)
  return value ? parseFloat(value) || 0 : 0
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
    unit: safeGet(row, headers, 'Unit') || undefined, // Optional: reads if Unit column exists
    serviceStart: get(row, headers, 'ServiceStart'),
    serviceEnd: get(row, headers, 'ServiceEnd'),
    initialFairness: getNum(row, headers, 'InitialFairness'),
    currentFairness: getNum(row, headers, 'CurrentFairness'),
    status: (safeGet(row, headers, 'Status') || 'Active') as 'Active' | 'Inactive', // Default to Active if missing
    hoursWorked: getNum(row, headers, 'HoursWorked'),
    weekendLeavesCount: getNum(row, headers, 'WeekendLeavesCount'),
    midweekLeavesCount: getNum(row, headers, 'MidweekLeavesCount'),
    afterLeavesCount: getNum(row, headers, 'AfterLeavesCount'),
    inactiveReason: safeGet(row, headers, 'InactiveReason') || undefined,
  }
}

/**
 * Parse soldier from admin spreadsheet with optional columns
 * Admin sheet may not have all columns (e.g., leave counts), so use safe defaults
 */
export function parseSoldierFromAdmin(row: string[], headers: string[]): Soldier {
  if (row.length === 0) throw new Error('Cannot parse empty row')

  // Handle name columns
  const hasFirstNameSpaced = hasHeader(headers, 'First Name')
  const hasLastNameSpaced = hasHeader(headers, 'Last Name')
  const hasFirstNameNoSpace = hasHeader(headers, 'FirstName')
  const hasLastNameNoSpace = hasHeader(headers, 'LastName')
  const hasNameColumn = hasHeader(headers, 'Name')

  let firstName = ''
  let lastName = ''

  if (hasFirstNameSpaced && hasLastNameSpaced) {
    firstName = get(row, headers, 'First Name')
    lastName = get(row, headers, 'Last Name')
  } else if (hasFirstNameNoSpace && hasLastNameNoSpace) {
    firstName = get(row, headers, 'FirstName')
    lastName = get(row, headers, 'LastName')
  } else if (hasNameColumn) {
    firstName = ''
    lastName = get(row, headers, 'Name')
  }

  const statusStr = safeGet(row, headers, 'Status') || 'Active'
  const status = statusStr === 'Inactive' ? 'Inactive' : 'Active' as const

  return {
    id: get(row, headers, 'ID'),
    firstName,
    lastName,
    role: get(row, headers, 'Role') as Soldier['role'],
    unit: safeGet(row, headers, 'Unit') || undefined,
    serviceStart: get(row, headers, 'ServiceStart'),
    serviceEnd: get(row, headers, 'ServiceEnd'),
    // Admin sheet may not have these fields - use safe defaults
    initialFairness: getNum(row, headers, 'InitialFairness'),
    currentFairness: getNum(row, headers, 'CurrentFairness'),
    status,
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

  // Parse role requirements: support both old and new formats
  let roleRequirements: any[] = []
  try {
    const parsed = roleReqRaw ? JSON.parse(roleReqRaw) : []
    if (Array.isArray(parsed)) {
      roleRequirements = parsed.map((req: any) => {
        // If has 'role' field (old format), convert to 'roles' array
        if (req.role && !req.roles) {
          return {
            roles: [req.role],
            count: req.count
          }
        }
        // If has 'roles' array (new format), keep as-is
        return {
          roles: req.roles || [],
          count: req.count || 1
        }
      })
    }
  } catch {
    roleRequirements = []
  }

  const specialDaysRaw = get(row, headers, 'SpecialDurationDays')
  const isSpecial = getBool(row, headers, 'IsSpecial')

  // Parse start and end times
  // For recurring tasks, times are stored as HH:MM:SS - prepend today's date
  // For pillbox tasks, times are full ISO datetimes
  const normalizeTime = (timeStr: string): string => {
    if (!timeStr) return ''
    // If it already has 'T' (is full ISO), return as-is
    if (timeStr.includes('T')) return timeStr
    // Otherwise it's time-only, prepend today's date
    const today = new Date().toISOString().split('T')[0]
    return `${today}T${timeStr}`
  }

  return {
    id: get(row, headers, 'ID'),
    taskType: get(row, headers, 'TaskType'),
    startTime: normalizeTime(get(row, headers, 'StartTime')),
    endTime: normalizeTime(get(row, headers, 'EndTime')),
    durationHours: getNum(row, headers, 'DurationHours'),
    roleRequirements,
    minRestAfter: getNum(row, headers, 'MinRestAfter'),
    isSpecial,
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
