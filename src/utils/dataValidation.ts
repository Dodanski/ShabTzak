/**
 * Data Validation Utilities
 *
 * Validates spreadsheet data for common issues that can cause scheduling failures.
 */

import type { Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment, AppConfig } from '../models'

export interface ValidationError {
  severity: 'error' | 'warning'
  entity: 'soldier' | 'task' | 'leaveRequest' | 'leaveAssignment' | 'taskAssignment' | 'config'
  id: string
  field: string
  message: string
  value?: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  summary: {
    soldiers: { total: number; valid: number; errors: number }
    tasks: { total: number; valid: number; errors: number }
    leaveRequests: { total: number; valid: number; errors: number }
    leaveAssignments: { total: number; valid: number; errors: number }
    taskAssignments: { total: number; valid: number; errors: number }
    roleMismatches: string[]
  }
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  // Accept both date-only and datetime formats
  if (!ISO_DATE_REGEX.test(dateStr) && !ISO_DATETIME_REGEX.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

function isValidTime(timeStr: string): boolean {
  if (!timeStr) return false
  // Accept HH:MM or HH:MM:SS
  return /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)
}

/**
 * Validate a single soldier record
 */
export function validateSoldier(soldier: Soldier): ValidationError[] {
  const errors: ValidationError[] = []
  const id = soldier.id || 'UNKNOWN'

  // Required fields
  if (!soldier.id || soldier.id.trim() === '') {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'id', message: 'Soldier ID is required' })
  }

  if (!soldier.role || soldier.role.trim() === '') {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'role', message: 'Role is required', value: soldier.role })
  }

  // Service dates
  if (!soldier.serviceStart) {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'serviceStart', message: 'Service start date is required' })
  } else if (!isValidDate(soldier.serviceStart)) {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'serviceStart', message: 'Invalid service start date format', value: soldier.serviceStart })
  }

  if (!soldier.serviceEnd) {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'serviceEnd', message: 'Service end date is required' })
  } else if (!isValidDate(soldier.serviceEnd)) {
    errors.push({ severity: 'error', entity: 'soldier', id, field: 'serviceEnd', message: 'Invalid service end date format', value: soldier.serviceEnd })
  }

  // Service date logic
  if (soldier.serviceStart && soldier.serviceEnd && isValidDate(soldier.serviceStart) && isValidDate(soldier.serviceEnd)) {
    if (soldier.serviceStart > soldier.serviceEnd) {
      errors.push({ severity: 'error', entity: 'soldier', id, field: 'serviceEnd', message: 'Service end date is before start date' })
    }

    // Check if service dates are reasonable
    const today = new Date().toISOString().split('T')[0]
    if (soldier.serviceEnd < today && soldier.status === 'Active') {
      errors.push({ severity: 'warning', entity: 'soldier', id, field: 'serviceEnd', message: 'Active soldier has service end date in the past', value: soldier.serviceEnd })
    }
  }

  // Status
  if (soldier.status && !['Active', 'Inactive'].includes(soldier.status)) {
    errors.push({ severity: 'warning', entity: 'soldier', id, field: 'status', message: 'Invalid status (expected Active or Inactive)', value: soldier.status })
  }

  // Name check
  if (!soldier.firstName && !soldier.lastName) {
    errors.push({ severity: 'warning', entity: 'soldier', id, field: 'name', message: 'Soldier has no name' })
  }

  return errors
}

/**
 * Validate a single task record
 */
export function validateTask(task: Task): ValidationError[] {
  const errors: ValidationError[] = []
  const id = task.id || 'UNKNOWN'

  // Required fields
  if (!task.id || task.id.trim() === '') {
    errors.push({ severity: 'error', entity: 'task', id, field: 'id', message: 'Task ID is required' })
  }

  if (!task.taskType || task.taskType.trim() === '') {
    errors.push({ severity: 'error', entity: 'task', id, field: 'taskType', message: 'Task type is required' })
  }

  // Times - can be time-only (HH:MM:SS) or full datetime
  if (!task.startTime) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'startTime', message: 'Start time is required' })
  } else if (!isValidDate(task.startTime) && !isValidTime(task.startTime)) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'startTime', message: 'Invalid start time format', value: task.startTime })
  }

  if (!task.endTime) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'endTime', message: 'End time is required' })
  } else if (!isValidDate(task.endTime) && !isValidTime(task.endTime)) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'endTime', message: 'Invalid end time format', value: task.endTime })
  }

  // Role requirements - CRITICAL CHECK
  if (!task.roleRequirements || !Array.isArray(task.roleRequirements)) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'roleRequirements', message: 'Role requirements must be an array', value: task.roleRequirements })
  } else if (task.roleRequirements.length === 0) {
    errors.push({ severity: 'error', entity: 'task', id, field: 'roleRequirements', message: 'Task has no role requirements - no soldiers can be assigned!' })
  } else {
    // Validate each requirement
    task.roleRequirements.forEach((req, i) => {
      const roles = req.roles ?? (req.role ? [req.role] : [])
      if (roles.length === 0) {
        errors.push({ severity: 'error', entity: 'task', id, field: `roleRequirements[${i}].roles`, message: 'Role requirement has no roles specified', value: req })
      }
      if (!req.count || req.count <= 0) {
        errors.push({ severity: 'error', entity: 'task', id, field: `roleRequirements[${i}].count`, message: 'Role requirement count must be positive', value: req.count })
      }
    })
  }

  // Duration
  if (task.durationHours !== undefined && task.durationHours < 0) {
    errors.push({ severity: 'warning', entity: 'task', id, field: 'durationHours', message: 'Duration hours is negative', value: task.durationHours })
  }

  // Rest period
  if (task.minRestAfter !== undefined && task.minRestAfter < 0) {
    errors.push({ severity: 'warning', entity: 'task', id, field: 'minRestAfter', message: 'Min rest after is negative', value: task.minRestAfter })
  }

  return errors
}

/**
 * Validate a leave request
 */
export function validateLeaveRequest(request: LeaveRequest): ValidationError[] {
  const errors: ValidationError[] = []
  const id = request.id || 'UNKNOWN'

  if (!request.id) {
    errors.push({ severity: 'error', entity: 'leaveRequest', id, field: 'id', message: 'Leave request ID is required' })
  }

  if (!request.soldierId) {
    errors.push({ severity: 'error', entity: 'leaveRequest', id, field: 'soldierId', message: 'Soldier ID is required' })
  }

  if (!request.startDate || !isValidDate(request.startDate)) {
    errors.push({ severity: 'error', entity: 'leaveRequest', id, field: 'startDate', message: 'Invalid start date', value: request.startDate })
  }

  if (!request.endDate || !isValidDate(request.endDate)) {
    errors.push({ severity: 'error', entity: 'leaveRequest', id, field: 'endDate', message: 'Invalid end date', value: request.endDate })
  }

  if (request.startDate && request.endDate && request.startDate > request.endDate) {
    errors.push({ severity: 'error', entity: 'leaveRequest', id, field: 'endDate', message: 'End date is before start date' })
  }

  if (!request.leaveType || !['After', 'Long'].includes(request.leaveType)) {
    errors.push({ severity: 'warning', entity: 'leaveRequest', id, field: 'leaveType', message: 'Invalid leave type', value: request.leaveType })
  }

  return errors
}

/**
 * Validate a leave assignment
 */
export function validateLeaveAssignment(assignment: LeaveAssignment): ValidationError[] {
  const errors: ValidationError[] = []
  const id = assignment.id || 'UNKNOWN'

  if (!assignment.id) {
    errors.push({ severity: 'error', entity: 'leaveAssignment', id, field: 'id', message: 'Leave assignment ID is required' })
  }

  if (!assignment.soldierId) {
    errors.push({ severity: 'error', entity: 'leaveAssignment', id, field: 'soldierId', message: 'Soldier ID is required' })
  }

  if (!assignment.startDate || !isValidDate(assignment.startDate)) {
    errors.push({ severity: 'error', entity: 'leaveAssignment', id, field: 'startDate', message: 'Invalid start date', value: assignment.startDate })
  }

  if (!assignment.endDate || !isValidDate(assignment.endDate)) {
    errors.push({ severity: 'error', entity: 'leaveAssignment', id, field: 'endDate', message: 'Invalid end date', value: assignment.endDate })
  }

  return errors
}

/**
 * Validate a task assignment
 */
export function validateTaskAssignment(assignment: TaskAssignment): ValidationError[] {
  const errors: ValidationError[] = []
  const id = assignment.scheduleId || 'UNKNOWN'

  if (!assignment.scheduleId) {
    errors.push({ severity: 'error', entity: 'taskAssignment', id, field: 'scheduleId', message: 'Schedule ID is required' })
  }

  if (!assignment.taskId) {
    errors.push({ severity: 'error', entity: 'taskAssignment', id, field: 'taskId', message: 'Task ID is required' })
  }

  if (!assignment.soldierId) {
    errors.push({ severity: 'error', entity: 'taskAssignment', id, field: 'soldierId', message: 'Soldier ID is required' })
  }

  if (!assignment.assignedRole) {
    errors.push({ severity: 'error', entity: 'taskAssignment', id, field: 'assignedRole', message: 'Assigned role is required' })
  }

  return errors
}

/**
 * Validate config
 */
export function validateConfig(config: AppConfig): ValidationError[] {
  const errors: ValidationError[] = []

  // Schedule period validation
  if (config.scheduleStartDate && !isValidDate(config.scheduleStartDate)) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'scheduleStartDate', message: 'Invalid schedule start date format (expected YYYY-MM-DD)', value: config.scheduleStartDate })
  }

  if (config.scheduleEndDate && !isValidDate(config.scheduleEndDate)) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'scheduleEndDate', message: 'Invalid schedule end date format (expected YYYY-MM-DD)', value: config.scheduleEndDate })
  }

  if (config.scheduleStartDate && config.scheduleEndDate &&
      isValidDate(config.scheduleStartDate) && isValidDate(config.scheduleEndDate)) {
    if (config.scheduleStartDate > config.scheduleEndDate) {
      errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'scheduleEndDate', message: 'Schedule end date must be after start date', value: `${config.scheduleStartDate} > ${config.scheduleEndDate}` })
    }
  }

  // Leave ratio validation
  if (!config.leaveRatioDaysInBase || config.leaveRatioDaysInBase <= 0) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'leaveRatioDaysInBase', message: 'Leave ratio days in base must be positive', value: config.leaveRatioDaysInBase })
  }

  if (!config.leaveRatioDaysHome || config.leaveRatioDaysHome <= 0) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'leaveRatioDaysHome', message: 'Leave ratio days home must be positive', value: config.leaveRatioDaysHome })
  }

  if (config.minBasePresence === undefined || config.minBasePresence < 0) {
    errors.push({ severity: 'warning', entity: 'config', id: 'config', field: 'minBasePresence', message: 'Min base presence should be set', value: config.minBasePresence })
  }

  if (config.leaveBaseExitHour && !isValidTime(config.leaveBaseExitHour)) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'leaveBaseExitHour', message: 'Invalid exit hour format (expected HH:MM)', value: config.leaveBaseExitHour })
  }

  if (config.leaveBaseReturnHour && !isValidTime(config.leaveBaseReturnHour)) {
    errors.push({ severity: 'error', entity: 'config', id: 'config', field: 'leaveBaseReturnHour', message: 'Invalid return hour format (expected HH:MM)', value: config.leaveBaseReturnHour })
  }

  return errors
}

/**
 * Cross-validate all data for consistency
 */
export function crossValidate(
  soldiers: Soldier[],
  tasks: Task[],
  leaveRequests: LeaveRequest[],
  leaveAssignments: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
): ValidationError[] {
  const errors: ValidationError[] = []
  const soldierIds = new Set(soldiers.map(s => s.id))
  const taskIds = new Set(tasks.map(t => t.id))

  // Check for duplicate soldier IDs
  const seenSoldierIds = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    const existing = seenSoldierIds.get(soldier.id) || []
    existing.push(soldier)
    seenSoldierIds.set(soldier.id, existing)
  }

  for (const [id, duplicates] of seenSoldierIds) {
    if (duplicates.length > 1) {
      const units = duplicates.map(s => s.unit || 'Unknown').join(', ')
      const roles = duplicates.map(s => s.role).join(', ')
      errors.push({
        severity: 'error',
        entity: 'soldier',
        id,
        field: 'id',
        message: `Duplicate soldier ID found ${duplicates.length} times in units: [${units}] with roles: [${roles}]. Each soldier must have a unique ID.`,
        value: { units: duplicates.map(s => s.unit), roles: duplicates.map(s => s.role) }
      })
    }
  }

  // Check soldier roles vs task roles
  const soldierRoles = new Set(soldiers.map(s => s.role).filter(Boolean))
  const taskRoles = new Set(
    tasks.flatMap(t => t.roleRequirements?.flatMap(r => r.roles ?? (r.role ? [r.role] : [])) ?? [])
  )

  // Find roles required by tasks but not present in soldiers
  const missingRoles = Array.from(taskRoles).filter(r => r !== 'Any' && !soldierRoles.has(r))
  if (missingRoles.length > 0) {
    errors.push({
      severity: 'error',
      entity: 'task',
      id: 'CROSS_VALIDATION',
      field: 'roleRequirements',
      message: `Tasks require roles that no soldier has: ${missingRoles.join(', ')}. Soldier roles: ${Array.from(soldierRoles).join(', ')}`,
      value: { missingRoles, soldierRoles: Array.from(soldierRoles), taskRoles: Array.from(taskRoles) }
    })
  }

  // Check leave requests reference valid soldiers
  for (const req of leaveRequests) {
    if (req.soldierId && !soldierIds.has(req.soldierId)) {
      errors.push({
        severity: 'error',
        entity: 'leaveRequest',
        id: req.id,
        field: 'soldierId',
        message: `References non-existent soldier: ${req.soldierId}`
      })
    }
  }

  // Check leave assignments reference valid soldiers
  for (const assignment of leaveAssignments) {
    if (assignment.soldierId && !soldierIds.has(assignment.soldierId)) {
      errors.push({
        severity: 'warning',
        entity: 'leaveAssignment',
        id: assignment.id,
        field: 'soldierId',
        message: `References non-existent soldier: ${assignment.soldierId}`
      })
    }
  }

  // Check task assignments reference valid soldiers and tasks
  for (const assignment of taskAssignments) {
    if (assignment.soldierId && !soldierIds.has(assignment.soldierId)) {
      errors.push({
        severity: 'warning',
        entity: 'taskAssignment',
        id: assignment.scheduleId,
        field: 'soldierId',
        message: `References non-existent soldier: ${assignment.soldierId}`
      })
    }
    // Note: taskId in assignments may have _dayN suffix, so we check base ID
    const baseTaskId = assignment.taskId?.replace(/_day\d+$/, '').replace(/_pill\d+$/, '')
    if (baseTaskId && !taskIds.has(baseTaskId) && !taskIds.has(assignment.taskId)) {
      errors.push({
        severity: 'warning',
        entity: 'taskAssignment',
        id: assignment.scheduleId,
        field: 'taskId',
        message: `References non-existent task: ${assignment.taskId}`
      })
    }
  }

  // Check for active soldiers who can be scheduled
  const activeSoldiers = soldiers.filter(s => s.status === 'Active')
  if (activeSoldiers.length === 0) {
    errors.push({
      severity: 'error',
      entity: 'soldier',
      id: 'CROSS_VALIDATION',
      field: 'status',
      message: 'No active soldiers found! All soldiers are inactive or have invalid status.'
    })
  }

  // Check for future tasks
  const today = new Date().toISOString().split('T')[0]
  const futureTasks = tasks.filter(t => {
    const taskDate = t.startTime?.split('T')[0]
    return taskDate && taskDate >= today
  })
  if (futureTasks.length === 0 && tasks.length > 0) {
    errors.push({
      severity: 'warning',
      entity: 'task',
      id: 'CROSS_VALIDATION',
      field: 'startTime',
      message: 'No future tasks found. All tasks are in the past.'
    })
  }

  return errors
}

/**
 * Validate all data and return comprehensive result
 */
export function validateAllData(
  soldiers: Soldier[],
  tasks: Task[],
  leaveRequests: LeaveRequest[],
  leaveAssignments: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config?: AppConfig,
): ValidationResult {
  const allErrors: ValidationError[] = []

  // Validate individual records
  const soldierErrors = new Map<string, ValidationError[]>()
  for (const soldier of soldiers) {
    const errors = validateSoldier(soldier)
    soldierErrors.set(soldier.id, errors)
    allErrors.push(...errors)
  }

  const taskErrors = new Map<string, ValidationError[]>()
  for (const task of tasks) {
    const errors = validateTask(task)
    taskErrors.set(task.id, errors)
    allErrors.push(...errors)
  }

  for (const request of leaveRequests) {
    allErrors.push(...validateLeaveRequest(request))
  }

  for (const assignment of leaveAssignments) {
    allErrors.push(...validateLeaveAssignment(assignment))
  }

  for (const assignment of taskAssignments) {
    allErrors.push(...validateTaskAssignment(assignment))
  }

  if (config) {
    allErrors.push(...validateConfig(config))
  }

  // Cross-validation
  allErrors.push(...crossValidate(soldiers, tasks, leaveRequests, leaveAssignments, taskAssignments))

  // Separate errors and warnings
  const errors = allErrors.filter(e => e.severity === 'error')
  const warnings = allErrors.filter(e => e.severity === 'warning')

  // Calculate role mismatches
  const soldierRoles = new Set(soldiers.map(s => s.role).filter(Boolean))
  const taskRoles = new Set(
    tasks.flatMap(t => t.roleRequirements?.flatMap(r => r.roles ?? (r.role ? [r.role] : [])) ?? [])
  )
  const roleMismatches = Array.from(taskRoles).filter(r => r !== 'Any' && !soldierRoles.has(r))

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      soldiers: {
        total: soldiers.length,
        valid: soldiers.filter(s => !soldierErrors.get(s.id)?.some(e => e.severity === 'error')).length,
        errors: soldiers.filter(s => soldierErrors.get(s.id)?.some(e => e.severity === 'error')).length,
      },
      tasks: {
        total: tasks.length,
        valid: tasks.filter(t => !taskErrors.get(t.id)?.some(e => e.severity === 'error')).length,
        errors: tasks.filter(t => taskErrors.get(t.id)?.some(e => e.severity === 'error')).length,
      },
      leaveRequests: {
        total: leaveRequests.length,
        valid: leaveRequests.length, // Simplified
        errors: 0,
      },
      leaveAssignments: {
        total: leaveAssignments.length,
        valid: leaveAssignments.length,
        errors: 0,
      },
      taskAssignments: {
        total: taskAssignments.length,
        valid: taskAssignments.length,
        errors: 0,
      },
      roleMismatches,
    },
  }
}

/**
 * Format validation result as readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  lines.push('=' .repeat(60))
  lines.push('DATA VALIDATION REPORT')
  lines.push('='.repeat(60))
  lines.push('')

  // Summary
  lines.push('SUMMARY:')
  lines.push(`  Soldiers: ${result.summary.soldiers.valid}/${result.summary.soldiers.total} valid`)
  lines.push(`  Tasks: ${result.summary.tasks.valid}/${result.summary.tasks.total} valid`)
  lines.push(`  Leave Requests: ${result.summary.leaveRequests.total}`)
  lines.push(`  Leave Assignments: ${result.summary.leaveAssignments.total}`)
  lines.push(`  Task Assignments: ${result.summary.taskAssignments.total}`)
  lines.push('')

  if (result.summary.roleMismatches.length > 0) {
    lines.push(`⚠️  ROLE MISMATCHES: ${result.summary.roleMismatches.join(', ')}`)
    lines.push('')
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push(`ERRORS (${result.errors.length}):`)
    for (const error of result.errors) {
      lines.push(`  ❌ [${error.entity}:${error.id}] ${error.field}: ${error.message}`)
      if (error.value !== undefined) {
        lines.push(`     Value: ${JSON.stringify(error.value)}`)
      }
    }
    lines.push('')
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`WARNINGS (${result.warnings.length}):`)
    for (const warning of result.warnings.slice(0, 20)) {
      lines.push(`  ⚠️  [${warning.entity}:${warning.id}] ${warning.field}: ${warning.message}`)
    }
    if (result.warnings.length > 20) {
      lines.push(`  ... and ${result.warnings.length - 20} more warnings`)
    }
    lines.push('')
  }

  // Final verdict
  lines.push('='.repeat(60))
  if (result.valid) {
    lines.push('✅ DATA IS VALID - No errors found')
  } else {
    lines.push(`❌ DATA HAS ${result.errors.length} ERROR(S) - Scheduling may fail!`)
  }
  lines.push('='.repeat(60))

  return lines.join('\n')
}
