import { ROLES, CONSTRAINT_TYPES, PRIORITY_MIN, PRIORITY_MAX } from '../constants'
import type { CreateSoldierInput, CreateLeaveRequestInput, CreateTaskInput } from '../models'
import { parseDate } from './dateUtils'

export interface ValidationErrors {
  [field: string]: string
}

export function validateSoldier(input: CreateSoldierInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  if (!input.name || input.name.trim() === '') {
    errors.name = 'Name is required'
  } else if (input.name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }

  if (!input.role || !ROLES.includes(input.role as any)) {
    errors.role = 'Please select a valid role'
  }

  if (!input.serviceStart) {
    errors.serviceStart = 'Service start date is required'
  }

  if (!input.serviceEnd) {
    errors.serviceEnd = 'Service end date is required'
  }

  if (input.serviceStart && input.serviceEnd) {
    const start = parseDate(input.serviceStart)
    const end = parseDate(input.serviceEnd)
    if (end <= start) {
      errors.serviceEnd = 'Service end date must be after start date'
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function validateLeaveRequest(input: CreateLeaveRequestInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  if (!input.soldierId) {
    errors.soldierId = 'Soldier is required'
  }

  if (!input.startDate) {
    errors.startDate = 'Start date is required'
  }

  if (!input.endDate) {
    errors.endDate = 'End date is required'
  }

  if (input.startDate && input.endDate) {
    const start = parseDate(input.startDate)
    const end = parseDate(input.endDate)
    if (end < start) {
      errors.endDate = 'End date must be on or after start date'
    }
  }

  if (!input.constraintType || !CONSTRAINT_TYPES.includes(input.constraintType as any)) {
    errors.constraintType = 'Please select a valid constraint type'
  }

  if (!isPriorityValid(input.priority)) {
    errors.priority = `Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function validateTask(input: CreateTaskInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  if (!input.taskType || input.taskType.trim() === '') {
    errors.taskType = 'Task type is required'
  }

  if (!input.startTime) {
    errors.startTime = 'Start time is required'
  }

  if (!input.endTime) {
    errors.endTime = 'End time is required'
  }

  if (input.startTime && input.endTime) {
    const start = new Date(input.startTime)
    const end = new Date(input.endTime)
    if (end <= start) {
      errors.endTime = 'End time must be after start time'
    }
  }

  if (!input.roleRequirements || input.roleRequirements.length === 0) {
    errors.roleRequirements = 'At least one role requirement is needed'
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function isPriorityValid(priority: number): boolean {
  return Number.isInteger(priority) && priority >= PRIORITY_MIN && priority <= PRIORITY_MAX
}
