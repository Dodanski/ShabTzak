import { describe, it, expect } from 'vitest'
import { deriveTabPrefix, prefixTab } from './tabPrefix'

describe('deriveTabPrefix', () => {
  it('replaces spaces with underscores', () => {
    expect(deriveTabPrefix('Alpha Company')).toBe('Alpha_Company')
  })
  it('trims leading/trailing whitespace', () => {
    expect(deriveTabPrefix('  Alpha  ')).toBe('Alpha')
  })
  it('preserves Hebrew characters', () => {
    expect(deriveTabPrefix('מחלקה א')).toBe('מחלקה_א')
  })
  it('handles single-word name', () => {
    expect(deriveTabPrefix('Bravo')).toBe('Bravo')
  })
  it('collapses multiple spaces', () => {
    expect(deriveTabPrefix('Alpha  Bravo')).toBe('Alpha_Bravo')
  })
})

describe('prefixTab', () => {
  it('prepends prefix with underscore separator', () => {
    expect(prefixTab('Alpha_Company', 'Soldiers')).toBe('Alpha_Company_Soldiers')
  })
  it('returns bare tab name when prefix is empty', () => {
    expect(prefixTab('', 'Soldiers')).toBe('Soldiers')
  })
})
