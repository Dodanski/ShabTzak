import { describe, it, expect } from 'vitest'
import { ROLES, CONSTRAINT_TYPES, DEFAULT_CONFIG } from './index'

describe('Constants', () => {
  it('exports soldier roles', () => {
    expect(ROLES).toHaveLength(6)
    expect(ROLES).toContain('Driver')
    expect(ROLES).toContain('Medic')
  })

  it('exports constraint types', () => {
    expect(CONSTRAINT_TYPES).toHaveLength(10)
    expect(CONSTRAINT_TYPES).toContain('Family event')
  })

  it('exports default config', () => {
    expect(DEFAULT_CONFIG.leaveRatioDaysInBase).toBe(10)
    expect(DEFAULT_CONFIG.leaveRatioDaysHome).toBe(4)
    expect(DEFAULT_CONFIG.longLeaveMaxDays).toBe(4)
  })
})
