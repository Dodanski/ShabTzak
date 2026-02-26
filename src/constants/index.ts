// Soldier roles
export const ROLES = [
  'Driver',
  'Radio Operator',
  'Medic',
  'Squad Leader',
  'Operations Room',
  'Weapons Specialist',
] as const

export type SoldierRole = typeof ROLES[number]

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
export const SOLDIER_STATUS = ['Active', 'Injured', 'Discharged'] as const
export type SoldierStatus = typeof SOLDIER_STATUS[number]

// Configuration defaults
export const DEFAULT_CONFIG = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
} as const

// Google Sheets tabs
export const SHEET_TABS = {
  SOLDIERS: 'Soldiers',
  TASKS: 'Tasks',
  TASK_SCHEDULE: 'TaskSchedule',
  LEAVE_REQUESTS: 'LeaveRequests',
  LEAVE_SCHEDULE: 'LeaveSchedule',
  HISTORY: 'History',
  CONFIG: 'Config',
  VERSION: 'Version',
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
} as const
