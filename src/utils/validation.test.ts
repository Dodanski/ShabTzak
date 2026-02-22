import { describe, it, expect } from 'vitest'
import {
  validateSoldier,
  validateLeaveRequest,
  validateTask,
  isPriorityValid,
} from './validation'
import type { CreateSoldierInput, CreateLeaveRequestInput } from '../models'

describe('Validation Utils', () => {
  describe('validateSoldier', () => {
    it('returns null for valid soldier', () => {
      const input: CreateSoldierInput = {
        name: 'David',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      expect(validateSoldier(input)).toBeNull()
    })

    it('returns error for missing name', () => {
      const input: any = {
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('name')
    })

    it('returns error for invalid role', () => {
      const input: any = {
        name: 'David',
        role: 'InvalidRole',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('role')
    })

    it('returns error for end date before start date', () => {
      const input: CreateSoldierInput = {
        name: 'David',
        role: 'Driver',
        serviceStart: '2026-08-31',
        serviceEnd: '2026-01-01',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('serviceEnd')
    })
  })

  describe('validateLeaveRequest', () => {
    it('returns null for valid request', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        constraintType: 'Family event',
        priority: 5,
      }
      expect(validateLeaveRequest(input)).toBeNull()
    })

    it('returns error for invalid priority', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        constraintType: 'Family event',
        priority: 15,
      }
      const errors = validateLeaveRequest(input)
      expect(errors).toHaveProperty('priority')
    })

    it('returns error for end date before start date', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-21',
        endDate: '2026-03-20',
        constraintType: 'Family event',
        priority: 5,
      }
      const errors = validateLeaveRequest(input)
      expect(errors).toHaveProperty('endDate')
    })
  })

  describe('isPriorityValid', () => {
    it('returns true for valid priorities', () => {
      expect(isPriorityValid(1)).toBe(true)
      expect(isPriorityValid(5)).toBe(true)
      expect(isPriorityValid(10)).toBe(true)
    })

    it('returns false for invalid priorities', () => {
      expect(isPriorityValid(0)).toBe(false)
      expect(isPriorityValid(11)).toBe(false)
      expect(isPriorityValid(-1)).toBe(false)
    })
  })
})
