import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { config } from '../config/env'

export interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  email: string | null
  error: string | null
}

export interface AuthContextValue {
  auth: AuthState
  signIn: () => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const INITIAL_AUTH: AuthState = { isAuthenticated: false, accessToken: null, email: null, error: null }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH)
  const tokenClientRef = useRef<TokenClient | null>(null)

  useEffect(() => {
    const initClient = () => {
      tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: async (response: TokenResponse) => {
          if (response.error) {
            setAuth({ isAuthenticated: false, accessToken: null, email: null, error: response.error })
            return
          }
          let email: string | null = null
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            })
            const info = await res.json()
            email = info.email ?? null
          } catch {
            // email stays null — still authenticated
          }
          setAuth({ isAuthenticated: true, accessToken: response.access_token, email, error: null })
        },
      })
    }

    if (window.google) {
      initClient()
    } else {
      window.onGoogleLibraryLoad = initClient
    }

    return () => {
      if (window.onGoogleLibraryLoad === initClient) {
        window.onGoogleLibraryLoad = undefined
      }
    }
  }, [])

  const signIn = useCallback(() => {
    tokenClientRef.current?.requestAccessToken()
  }, [])

  const signOut = useCallback(() => {
    setAuth(INITIAL_AUTH)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
