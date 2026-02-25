# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle ShabTzak with a military olive/khaki theme, replacing all blue accents with an olive color scale and adding the unit logo to every page and IDF emblem to the login page.

**Architecture:** Add a custom `olive` Tailwind color scale, then do a surgical find-and-replace of all `blue-*` color classes across components. Login page and AppShell get structural changes (logos). All other components get color-only changes. No logic changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3

**Design doc:** `docs/plans/2026-02-25-ui-redesign-design.md`

---

## Context for implementer

- Logos are already in `public/`: `public/logo-unit.jpg` (wolf, every page) and `public/logo-idf.jpeg` (IDF emblem, login only)
- The olive Tailwind scale maps `olive-700` = `#4a5a2a` (primary, replaces `blue-600`)
- **No logic changes** — only visual/styling changes in this plan
- Run tests with: `npx vitest run`
- Build check: `npm run build`

---

### Task 1: Add olive color scale to Tailwind + set page background

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

**Step 1: Update `tailwind.config.js`**

Replace the entire file content with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50:  '#f5f2e8',
          100: '#ebe8d4',
          200: '#d4d0a8',
          300: '#b8b87c',
          400: '#8fa050',
          500: '#6b7c3f',
          600: '#556630',
          700: '#4a5a2a',
          800: '#3a4a1a',
          900: '#2a3510',
          950: '#1a2008',
        },
      },
    },
  },
  plugins: [],
}
```

**Step 2: Update `src/index.css`**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f5f2e8;
}
```

**Step 3: Run tests to confirm nothing broke**

```bash
npx vitest run
```
Expected: all 458 tests pass

**Step 4: Run build to confirm Tailwind compiles**

```bash
npm run build
```
Expected: build succeeds, no errors

**Step 5: Commit**

```bash
git add tailwind.config.js src/index.css
git commit -m "feat: add olive color scale to Tailwind config"
```

---

### Task 2: Redesign LoginPage with logos and olive styling

**Files:**
- Modify: `src/components/LoginPage.tsx`
- Modify: `src/components/LoginPage.test.tsx` (if it exists; check first with `ls src/components/LoginPage.test.tsx`)

**Step 1: Check for existing LoginPage tests**

```bash
ls src/components/LoginPage.test.tsx 2>/dev/null && echo "exists" || echo "no test file"
```

**Step 2: Write failing tests** (create or update the test file)

```typescript
// src/components/LoginPage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LoginPage from './LoginPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { error: null }, signIn: vi.fn() }),
}))

describe('LoginPage', () => {
  it('renders IDF logo', () => {
    render(<LoginPage />)
    expect(screen.getByAltText('IDF')).toBeInTheDocument()
  })

  it('renders unit logo', () => {
    render(<LoginPage />)
    expect(screen.getByAltText('זאבי הגבעה')).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows error when auth.error is set', () => {
    vi.mocked(require('../context/AuthContext').useAuth).mockReturnValue({
      auth: { error: 'Login failed' }, signIn: vi.fn(),
    })
    render(<LoginPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Login failed')
  })
})
```

**Step 3: Run to confirm tests fail (or note which ones fail)**

```bash
npx vitest run src/components/LoginPage.test.tsx
```

**Step 4: Rewrite `src/components/LoginPage.tsx`**

```typescript
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { auth, signIn } = useAuth()

  return (
    <div className="min-h-screen bg-olive-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg border border-olive-200 p-10 flex flex-col items-center gap-5 w-88 max-w-sm">

        {/* IDF emblem */}
        <img
          src="/logo-idf.jpeg"
          alt="IDF"
          className="h-24 w-24 object-contain"
        />

        {/* Unit logo */}
        <img
          src="/logo-unit.jpg"
          alt="זאבי הגבעה"
          className="h-16 w-16 object-contain"
        />

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-olive-800">ShabTzak</h1>
          <p className="text-olive-600 text-sm mt-1 font-medium" dir="rtl">
            מערכת ניהול סידור שירות
          </p>
        </div>

        {auth.error && (
          <div
            role="alert"
            className="w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700"
          >
            {auth.error}
          </div>
        )}

        <button
          onClick={signIn}
          className="w-full py-2 px-4 bg-olive-700 text-white rounded-lg hover:bg-olive-800 transition-colors font-medium"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

**Step 5: Run tests**

```bash
npx vitest run src/components/LoginPage.test.tsx
```
Expected: all tests pass

**Step 6: Run full suite**

```bash
npx vitest run
```
Expected: all 458+ tests pass

**Step 7: Commit**

```bash
git add src/components/LoginPage.tsx src/components/LoginPage.test.tsx
git commit -m "feat: redesign LoginPage with IDF and unit logos, olive styling"
```

---

### Task 3: Update AppShell with unit logo and olive nav styling

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx` (create if missing)

**Step 1: Write failing tests**

```typescript
// src/components/AppShell.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppShell from './AppShell'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { isAuthenticated: true, email: 'user@example.com' }, signOut: vi.fn() }),
}))

describe('AppShell', () => {
  it('renders unit logo in nav bar', () => {
    render(<AppShell>content</AppShell>)
    expect(screen.getByAltText('זאבי הגבעה')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<AppShell>content</AppShell>)
    expect(screen.getByRole('link', { name: /soldiers/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument()
  })

  it('renders children', () => {
    render(<AppShell><div>hello world</div></AppShell>)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('shows unit name when unitName prop is provided', () => {
    render(<AppShell unitName="Platoon Alpha">content</AppShell>)
    expect(screen.getByText('Platoon Alpha')).toBeInTheDocument()
  })

  it('shows Back to Admin Panel button when onBackToAdmin provided', () => {
    render(<AppShell onBackToAdmin={vi.fn()}>content</AppShell>)
    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument()
  })
})
```

**Step 2: Run to confirm failures**

```bash
npx vitest run src/components/AppShell.test.tsx
```

**Step 3: Rewrite `src/components/AppShell.tsx`**

Read the current file first to preserve all existing logic. Then apply these changes:

```typescript
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginPage from './LoginPage'

interface AppShellProps {
  children?: React.ReactNode
  isAdmin?: boolean
  unitName?: string
  onBackToAdmin?: () => void
}

export default function AppShell({ children, unitName, onBackToAdmin }: AppShellProps) {
  const navLinks = [
    { href: '#', label: 'Dashboard' },
    { href: '#soldiers', label: 'Soldiers' },
    { href: '#tasks', label: 'Tasks' },
    { href: '#leave', label: 'Leave' },
    { href: '#schedule', label: 'Schedule' },
    { href: '#history', label: 'History' },
  ]

  const { auth, signOut } = useAuth()
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (!auth.isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-olive-50">
      <header className="bg-white border-b-2 border-olive-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Left: unit logo + name */}
          <div className="flex items-center gap-3">
            <img
              src="/logo-unit.jpg"
              alt="זאבי הגבעה"
              className="h-8 w-8 object-contain rounded"
            />
            {unitName && (
              <span className="text-sm font-medium text-olive-600 border-l border-olive-200 pl-3">
                {unitName}
              </span>
            )}
          </div>

          {/* Center: nav links */}
          <nav className="flex items-center gap-4 text-sm">
            {navLinks.map(({ href, label }) => {
              const isActive = hash === href || (href === '#' && (hash === '' || hash === '#'))
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    isActive
                      ? 'text-olive-700 font-semibold border-b-2 border-olive-700 pb-0.5'
                      : 'text-olive-500 hover:text-olive-700'
                  }
                >
                  {label}
                </a>
              )
            })}
          </nav>

          {/* Right: back to admin + sign out */}
          <div className="flex items-center gap-3">
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="text-sm text-olive-500 hover:text-olive-700 transition-colors"
              >
                ← Admin Panel
              </button>
            )}
            <button
              onClick={signOut}
              className="text-sm text-olive-400 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npx vitest run src/components/AppShell.test.tsx
npx vitest run
```
Expected: all tests pass

**Step 5: Commit**

```bash
git add src/components/AppShell.tsx src/components/AppShell.test.tsx
git commit -m "feat: update AppShell with unit logo and olive nav styling"
```

---

### Task 4: Restyle Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

No new tests needed — existing Dashboard tests cover functionality; color changes don't affect behavior.

**Step 1: Apply olive styling to `src/components/Dashboard.tsx`**

Make these exact replacements (read the file first, apply each change):

| Find | Replace |
|------|---------|
| `text-gray-800` (heading) | `text-olive-800` |
| `bg-blue-600` | `bg-olive-700` |
| `hover:bg-blue-700` | `hover:bg-olive-800` |
| `text-gray-500` (card labels) | `text-olive-500` |
| `text-gray-800` (card values) | `text-olive-800` |
| `bg-white rounded-lg shadow p-4` (KPI cards) | `bg-white rounded-lg border border-olive-200 shadow-sm p-4 border-l-4 border-l-olive-700` |
| `text-sm font-semibold text-gray-700` (section headers) | `text-sm font-semibold text-olive-700` |
| `text-sm text-gray-600` (fairness summary) | `text-sm text-olive-600` |
| `font-semibold text-gray-800` (fairness values) | `font-semibold text-olive-800` |

**Step 2: Run tests**

```bash
npx vitest run
```
Expected: all tests pass

**Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: apply olive styling to Dashboard"
```

---

### Task 5: Restyle SoldiersPage and FairnessBar

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/FairnessBar.tsx`

**Step 1: Read both files first**

```bash
# Just read them before editing
```

**Step 2: Apply replacements to `src/components/SoldiersPage.tsx`**

| Find | Replace |
|------|---------|
| `bg-blue-600` | `bg-olive-700` |
| `hover:bg-blue-700` | `hover:bg-olive-800` |
| `bg-blue-700` | `bg-olive-800` |
| `text-blue-600` | `text-olive-700` |
| `text-blue-500` | `text-olive-600` |
| `border-blue-` | `border-olive-` |
| `bg-gray-50` (page/section background) | `bg-olive-50` |
| `text-gray-800` (headings) | `text-olive-800` |
| `text-gray-700` (subheadings) | `text-olive-700` |
| `text-gray-500` (labels) | `text-olive-500` |
| `text-gray-600` (body text) | `text-olive-600` |
| `bg-white rounded-lg shadow` (cards) | `bg-white rounded-lg border border-olive-200 shadow-sm` |
| `focus:ring-blue-` | `focus:ring-olive-` |
| `focus:border-blue-` | `focus:border-olive-` |

**Step 3: Update `src/components/FairnessBar.tsx`**

Replace the medium fill class. Currently uses `bg-green-400` (good score) and `bg-red-400` (over average). Keep those — add a medium case for near-average:

```typescript
interface FairnessBarProps {
  score: number
  average: number
}

export default function FairnessBar({ score, average }: FairnessBarProps) {
  const max = Math.max(average * 2, score, 1)
  const widthPct = Math.min(100, Math.round((score / max) * 100))
  const isAboveAverage = score > average
  const fillClass = isAboveAverage ? 'bg-red-400' : 'bg-olive-500'

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 bg-olive-100 rounded overflow-hidden">
        <div
          data-testid="fairness-fill"
          className={`h-full rounded ${fillClass}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-olive-600 w-8 text-right">
        {score.toFixed(1)}
      </span>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npx vitest run
```
Expected: all tests pass

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/FairnessBar.tsx
git commit -m "feat: apply olive styling to SoldiersPage and FairnessBar"
```

---

### Task 6: Restyle Tasks, Leave, and Form components

**Files:**
- Modify: `src/components/TasksPage.tsx`
- Modify: `src/components/LeaveRequestsPage.tsx`
- Modify: `src/components/LeaveRequestForm.tsx`

**Step 1: Read all three files**

**Step 2: Apply the same replacement table from Task 5 to each file**

Same replacements:
- `bg-blue-*` → `bg-olive-*` (600→700, 700→800, etc.)
- `text-blue-*` → `text-olive-*`
- `hover:bg-blue-*` → `hover:bg-olive-*`
- `border-blue-*` → `border-olive-*`
- `focus:ring-blue-*` → `focus:ring-olive-*`
- `focus:border-blue-*` → `focus:border-olive-*`
- `bg-gray-50` → `bg-olive-50`
- `text-gray-800` (headings) → `text-olive-800`
- `text-gray-700` → `text-olive-700`
- `text-gray-600` → `text-olive-600`
- `text-gray-500` → `text-olive-500`
- `bg-white rounded-lg shadow` → `bg-white rounded-lg border border-olive-200 shadow-sm`
- Table header `bg-gray-50` → `bg-olive-700 text-white` (flip to dark header)
- `text-gray-900` (table cell) → `text-olive-900`

**Step 3: Run tests**

```bash
npx vitest run
```
Expected: all tests pass

**Step 4: Commit**

```bash
git add src/components/TasksPage.tsx src/components/LeaveRequestsPage.tsx src/components/LeaveRequestForm.tsx
git commit -m "feat: apply olive styling to Tasks and Leave components"
```

---

### Task 7: Restyle Schedule components

**Files:**
- Modify: `src/components/SchedulePage.tsx`
- Modify: `src/components/ScheduleCalendar.tsx`

**Step 1: Read both files**

**Step 2: Apply same replacements from Task 5**

Additional ScheduleCalendar-specific replacements:
- Table header cells `bg-gray-100` → `bg-olive-700 text-white`
- Soldier name column `bg-gray-50` → `bg-olive-50`
- Legend dots: any `bg-blue-*` → `bg-olive-700`

**Step 3: Run tests**

```bash
npx vitest run
```
Expected: all tests pass

**Step 4: Commit**

```bash
git add src/components/SchedulePage.tsx src/components/ScheduleCalendar.tsx
git commit -m "feat: apply olive styling to Schedule components"
```

---

### Task 8: Restyle Config, Setup, and History pages

**Files:**
- Modify: `src/components/ConfigPage.tsx`
- Modify: `src/components/SetupPage.tsx`
- Modify: `src/components/HistoryPage.tsx`

**Step 1: Read all three files**

**Step 2: Apply same replacements from Task 5 to all three**

**Step 3: Run tests**

```bash
npx vitest run
```
Expected: all tests pass

**Step 4: Commit**

```bash
git add src/components/ConfigPage.tsx src/components/SetupPage.tsx src/components/HistoryPage.tsx
git commit -m "feat: apply olive styling to Config, Setup, and History pages"
```

---

### Task 9: Restyle error/status/notification components

**Files:**
- Modify: `src/components/ErrorBanner.tsx`
- Modify: `src/components/VersionConflictBanner.tsx`
- Modify: `src/components/ConflictList.tsx`
- Modify: `src/components/ToastList.tsx` (check if exists: `ls src/components/ToastList.tsx`)
- Modify any toast-related component (check what exists in `src/components/`)

**Step 1: Find all toast/notification components**

```bash
ls src/components/ | grep -i toast
ls src/components/ | grep -i notification
```

**Step 2: Read all files found + the 3 error components**

**Step 3: Apply replacements**

For error/warning components — keep red (`bg-red-*`) as-is. These are critical visibility components.

For info/neutral notifications:
- Any `bg-blue-*` → `bg-olive-*`
- Any `text-blue-*` → `text-olive-*`
- `bg-yellow-*` (warnings) → keep as-is
- `border-blue-*` → `border-olive-*`

**Step 4: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass

**Step 5: Run build**

```bash
npm run build
```
Expected: build succeeds, no TypeScript errors

**Step 6: Final commit**

```bash
git add src/components/ErrorBanner.tsx src/components/VersionConflictBanner.tsx src/components/ConflictList.tsx
git add src/components/ToastList.tsx  # add any toast files found
git commit -m "feat: apply olive styling to notification and error components"
```

---

## Final verification

```bash
npx vitest run
```
Expected: all 458+ tests pass

```bash
npm run build
```
Expected: clean build, no errors

Visually verify in browser (`npm run dev`):
- Login page shows both logos
- Nav bar shows wolf logo on every page
- All buttons are olive (not blue)
- Page background is khaki (`#f5f2e8`)
- Table headers are dark olive with white text
