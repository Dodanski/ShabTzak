# OAuth Sign-In Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "Sign in with Google" button doing nothing on GitHub Pages by resolving a race condition between React mounting and the Google Identity Services script loading.

**Architecture:** Use `window.onGoogleLibraryLoad` — Google's official callback — to initialize the OAuth token client when the GSI script finishes loading. Handle the case where the script is already loaded before the component mounts.

**Tech Stack:** React 18, TypeScript, Google Identity Services (GSI), Vitest + React Testing Library

---

### Task 1: Add `onGoogleLibraryLoad` to Window type declaration

**Files:**
- Modify: `src/types/google.d.ts`

**Step 1: Add the type**

In `src/types/google.d.ts`, add `onGoogleLibraryLoad` to the `Window` interface. The interface block starts at line 3. Insert the new property after `google?`:

```typescript
interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void
        prompt: () => void
        renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void
        revoke: (email: string, callback: () => void) => void
      }
      oauth2: {
        initTokenClient: (config: TokenClientConfig) => TokenClient
      }
    }
  }
  onGoogleLibraryLoad?: () => void
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/google.d.ts
git commit -m "types: add onGoogleLibraryLoad to Window interface"
```

---

### Task 2: Write failing tests for the delayed-load path

**Files:**
- Modify: `src/context/AuthContext.test.tsx`

The existing tests all mock `window.google` as **already present** before mounting. We need tests for the case where Google loads **after** mount.

**Step 1: Add two new tests inside the `describe('AuthProvider', ...)` block**

Add these two `it(...)` blocks after the existing `'handles missing window.google gracefully'` test (line 93):

```typescript
it('registers onGoogleLibraryLoad when google is not yet loaded', () => {
  Object.defineProperty(window, 'google', { value: undefined, writable: true, configurable: true })

  renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })

  expect(window.onGoogleLibraryLoad).toBeTypeOf('function')
})

it('initializes token client and enables signIn when onGoogleLibraryLoad fires', () => {
  Object.defineProperty(window, 'google', { value: undefined, writable: true, configurable: true })

  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })

  // Simulate GSI script finishing load
  setupGoogleMock()
  act(() => { window.onGoogleLibraryLoad!() })

  // signIn should now trigger requestAccessToken
  act(() => { result.current.signIn() })
  expect(mockRequestAccessToken).toHaveBeenCalledOnce()
})

it('removes onGoogleLibraryLoad on unmount', () => {
  Object.defineProperty(window, 'google', { value: undefined, writable: true, configurable: true })

  const { unmount } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })

  expect(window.onGoogleLibraryLoad).toBeTypeOf('function')
  unmount()
  expect(window.onGoogleLibraryLoad).toBeUndefined()
})
```

**Step 2: Run only these new tests to confirm they fail**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: The 3 new tests FAIL (because the fix isn't implemented yet), existing tests PASS

**Step 3: Commit the failing tests**

```bash
git add src/context/AuthContext.test.tsx
git commit -m "test: add failing tests for onGoogleLibraryLoad race condition fix"
```

---

### Task 3: Fix the race condition in AuthContext

**Files:**
- Modify: `src/context/AuthContext.tsx`

**Step 1: Replace the `useEffect` body**

The current `useEffect` at lines 24–38 is:

```typescript
useEffect(() => {
  if (typeof window.google === 'undefined' || !window.google) return

  tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
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
}, [])
```

Replace it with:

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

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (including the 3 new ones from Task 2)

**Step 3: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "fix: use onGoogleLibraryLoad to resolve OAuth sign-in race condition"
```

---

### Task 4: Clean up diagnostic files and deploy

**Files:**
- Delete: `diagnostic.html`
- Delete: `public/oauth-test.html`
- Delete: `public/test-simple.html`
- Delete: `src/components/OAuthDiagnostic.tsx`
- Modify: `src/App.tsx` (remove the `#diagnostic` route)

These were temporary debugging tools added while investigating the OAuth problem. Remove them now that the root cause is fixed.

**Step 1: Remove the diagnostic files**

```bash
rm diagnostic.html public/oauth-test.html public/test-simple.html src/components/OAuthDiagnostic.tsx
```

**Step 2: Remove the diagnostic route from App.tsx**

Open `src/App.tsx` and find the import of `OAuthDiagnostic` and the route that renders it (the `#diagnostic` case). Remove both. The exact lines depend on what was added — search for `OAuthDiagnostic` or `diagnostic`.

**Step 3: Run all tests to confirm nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Build for production**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove OAuth diagnostic tools (race condition fixed)"
```

**Step 6: Deploy to GitHub Pages**

Run: `npm run deploy`
Expected: Deploys to `https://dodanski.github.io/ShabTzak/`

**Step 7: Manual verification**

1. Open `https://dodanski.github.io/ShabTzak/` in a browser
2. Click "Sign in with Google"
3. Expected: Google OAuth popup appears
4. Complete sign-in
5. Expected: Redirected to Dashboard
