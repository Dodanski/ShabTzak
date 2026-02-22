import { describe, it, expect } from 'vitest'
import { config } from './env'

describe('Environment Config', () => {
  it('exports config object', () => {
    expect(config).toBeDefined()
    expect(config).toHaveProperty('googleClientId')
    expect(config).toHaveProperty('isDevelopment')
  })
})
