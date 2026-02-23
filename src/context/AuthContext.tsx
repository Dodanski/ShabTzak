import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { config } from '../config/env'

export interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  error: string | null
}

export interface AuthContextValue {
  auth: AuthState
  signIn: () => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const INITIAL_AUTH: AuthState = { isAuthenticated: false, accessToken: null, error: null }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH)
  const tokenClientRef = useRef<TokenClient | null>(null)

  useEffect(() => {
    const initClient = () => {
      tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (response: TokenResponse) => {
          if (response.error) {
            setAuth({ isAuthenticated: false, accessToken: null, error: response.error })
            return
          }
          setAuth({ isAuthenticated: true, accessToken: response.access_token, error: null })
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
