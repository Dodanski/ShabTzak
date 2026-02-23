# OAuth Sign-In Fix Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

The "Sign in with Google" button does nothing when clicked on GitHub Pages (`https://dodanski.github.io/ShabTzak/`).

### Root Cause

Race condition in `src/context/AuthContext.tsx`. The token client is initialized in a `useEffect` with `[]` deps that runs once on mount. It guards with `if (typeof window.google === 'undefined') return`. Since `index.html` loads the Google Identity Services script with `async defer`, the script often hasn't finished loading by the time the effect runs. The guard exits early, `tokenClientRef.current` stays `null` forever, and clicking the button calls `null?.requestAccessToken()` — a no-op.

### Verified Non-Issues

- Authorized JavaScript origin is correctly set to `https://dodanski.github.io` in Google Cloud Console
- `.env.local` has correct `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_SPREADSHEET_ID`
- Google Sheets API is enabled on the project

## Solution

Use `window.onGoogleLibraryLoad` — Google's official callback for detecting when the GSI script finishes loading. Handle both timing cases:

1. Script already loaded when effect runs → init immediately
2. Script not yet loaded → register callback, init when it fires

Add cleanup to remove the pending callback if the component unmounts before the script loads.

## Changes

### `src/types/google.d.ts`

Add `onGoogleLibraryLoad` to the `Window` interface:

```typescript
interface Window {
  google?: { ... }
  onGoogleLibraryLoad?: () => void  // ADD
}
```

### `src/context/AuthContext.tsx`

Replace the `useEffect` body:

```typescript
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
```

No other files change. `LoginPage.tsx` and `signIn` remain untouched.

## Testing

- Unit test: mock `window.google` as undefined on mount, then call `window.onGoogleLibraryLoad()` — verify `tokenClientRef.current` is set and clicking sign-in triggers `requestAccessToken`
- Unit test: mock `window.google` as already present on mount — verify immediate initialization
- Manual: deploy to GitHub Pages, click sign-in, confirm OAuth popup appears
