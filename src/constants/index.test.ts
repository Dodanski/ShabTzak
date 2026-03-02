import { describe, it, expect } from 'vitest'
import { ROLES, CONSTRAINT_TYPES, DEFAULT_CONFIG, SHEET_TABS, MASTER_SHEET_TABS } from './index'

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

  it('SHEET_TABS has exactly 4 unit-only tabs', () => {
    expect(Object.values(SHEET_TABS)).toHaveLength(4)
    expect(Object.keys(SHEET_TABS)).not.toContain('TASKS')
    expect(Object.keys(SHEET_TABS)).not.toContain('VERSION')
  })
  it('MASTER_SHEET_TABS includes Tasks, Config, History', () => {
    expect(MASTER_SHEET_TABS).toHaveProperty('TASKS', 'Tasks')
    expect(MASTER_SHEET_TABS).toHaveProperty('CONFIG', 'Config')
    expect(MASTER_SHEET_TABS).toHaveProperty('HISTORY', 'History')
  })
})
