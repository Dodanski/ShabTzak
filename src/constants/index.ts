export type SoldierRole = string

// Leave types
export const LEAVE_TYPES = ['After', 'Long'] as const
export type LeaveType = typeof LEAVE_TYPES[number]

// Leave constraint types
export const CONSTRAINT_TYPES = [
  'Family event',
  'University exam',
  'Civilian job',
  'Medical appointment',
  "Child's birthday",
  "Wife's birthday",
  'Wedding anniversary',
  'Parent medical appointment',
  'General home issue',
  'Preference',
] as const

export type ConstraintType = typeof CONSTRAINT_TYPES[number]

// Request status
export const REQUEST_STATUS = ['Pending', 'Approved', 'Denied'] as const
export type RequestStatus = typeof REQUEST_STATUS[number]

// Soldier status
export const SOLDIER_STATUS = ['Active', 'Inactive'] as const
export type SoldierStatus = typeof SOLDIER_STATUS[number]

// Helper to compute default schedule dates
function getDefaultScheduleDates() {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 30) // Default: 30 days from today
  return {
    start: today.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

// Configuration defaults
export const DEFAULT_CONFIG = {
  // Schedule period defaults (computed at runtime)
  get scheduleStartDate() { return getDefaultScheduleDates().start },
  get scheduleEndDate() { return getDefaultScheduleDates().end },

  // Leave ratio
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],

  // Capacity
  minBasePresence: 20,

  // Tasks
  maxDrivingHours: 8,
  defaultRestPeriod: 6,

  // Leave timing
  leaveBaseExitHour: '06:00',
  leaveBaseReturnHour: '22:00',
} as const

// Google Sheets tabs (per-unit scheduling tabs only; soldier list lives in admin spreadsheet under unit-name tabs)
export const SHEET_TABS = {
  TASK_SCHEDULE: 'TaskSchedule',
  LEAVE_REQUESTS: 'LeaveRequests',
  LEAVE_SCHEDULE: 'LeaveSchedule',
} as const

// Priority range
export const PRIORITY_MIN = 1
export const PRIORITY_MAX = 10

// Weekend definition (day indices: 0 = Sunday, 5 = Friday, 6 = Saturday)
export const WEEKEND_DAY_INDICES = [5, 6] // Friday, Saturday

// Fairness weights
export const FAIRNESS_WEIGHTS = {
  WEEKEND_LEAVE: 1.5,
  MIDWEEK_LEAVE: 1.0,
  AFTER_LEAVE: 0.5,
} as const

export const MASTER_SHEET_TABS = {
  ADMINS: 'Admins',
  UNITS: 'Units',
  COMMANDERS: 'Commanders',
  TASKS: 'Tasks',
  CONFIG: 'Config',
  HISTORY: 'History',
  ROLES: 'Roles',
  LEAVE_REQUESTS: 'LeaveRequests',  // NEW: Centralized leave requests
  TASK_SCHEDULE: 'TaskSchedule',  // NEW: Shared across all units
  LEAVE_SCHEDULE: 'LeaveSchedule',  // NEW: Shared across all units
} as const
