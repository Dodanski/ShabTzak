import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth, AuthContext } from './AuthContext'
import type { AuthContextValue } from './AuthContext'
import React from 'react'

// Helper: render inside AuthProvider with mocked window.google
let capturedTokenCallback: ((r: TokenResponse) => void) | null = null
const mockRequestAccessToken = vi.fn()

function setupGoogleMock() {
  capturedTokenCallback = null
  Object.defineProperty(window, 'google', {
    value: {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((cfg: TokenClientConfig) => {
            capturedTokenCallback = cfg.callback
            return { requestAccessToken: mockRequestAccessToken }
          }),
        },
      },
    },
    writable: true,
    configurable: true,
  })
}

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress the expected React error
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within AuthProvider')
    err.mockRestore()
  })
})

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupGoogleMock()
  })

  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })
    expect(result.current.auth.isAuthenticated).toBe(false)
    expect(result.current.auth.accessToken).toBeNull()
  })

  it('signIn calls requestAccessToken on the token client', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })
    act(() => { result.current.signIn() })
    expect(mockRequestAccessToken).toHaveBeenCalledOnce()
  })

  it('becomes authenticated after token callback fires', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })
    act(() => {
      capturedTokenCallback?.({
        access_token: 'test-token', expires_in: 3600, scope: '', token_type: 'Bearer',
      })
    })
    expect(result.current.auth.isAuthenticated).toBe(true)
    expect(result.current.auth.accessToken).toBe('test-token')
  })

  it('signOut resets auth state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })
    act(() => {
      capturedTokenCallback?.({
        access_token: 'test-token', expires_in: 3600, scope: '', token_type: 'Bearer',
      })
    })
    expect(result.current.auth.isAuthenticated).toBe(true)

    act(() => { result.current.signOut() })

    expect(result.current.auth.isAuthenticated).toBe(false)
    expect(result.current.auth.accessToken).toBeNull()
  })

  it('handles missing window.google gracefully (no crash)', () => {
    Object.defineProperty(window, 'google', { value: undefined, writable: true, configurable: true })
    expect(() => {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
      })
    }).not.toThrow()
  })
})
