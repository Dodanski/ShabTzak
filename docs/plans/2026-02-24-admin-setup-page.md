# Admin Setup Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an admin-only Setup page where the admin can initialize missing Google Sheets tabs and manage extra admin users.

**Architecture:** Fetch the signed-in user's email from Google's userinfo API after OAuth login, compare it against `VITE_ADMIN_EMAIL` env var and an `adminEmails` list stored in the Config tab to determine admin access. A new `SetupService` checks which of the 8 expected tabs exist and creates any that are missing. A new `SetupPage` component exposes both the tab health check and admin management UI.

**Tech Stack:** React 18, TypeScript, Vitest + React Testing Library, Google Sheets API v4, Google OAuth2 userinfo endpoint

---

### Task 1: Add `email` to AuthState and fetch from Google userinfo

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/context/AuthContext.test.tsx`

**Context:** `AuthState` currently has `isAuthenticated`, `accessToken`, `error`. We need `email` so the app can identify the signed-in user. Google's userinfo endpoint returns `{ email, name, picture }` given a valid access token.

**Step 1: Write failing tests**

Add these tests inside `describe('AuthProvider', ...)` in `src/context/AuthContext.test.tsx`, after the existing `'sets error state when token callback fires with an error'` test:

```typescript
it('sets email after successful sign-in by fetching userinfo', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ email: 'test@example.com' }),
  }))

  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })

  await act(async () => {
    await capturedTokenCallback?.({
      access_token: 'tok', expires_in: 3600, scope: '', token_type: 'Bearer',
    })
  })

  expect(result.current.auth.email).toBe('test@example.com')
  vi.unstubAllGlobals()
})

it('sets email to null when userinfo fetch fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })

  await act(async () => {
    await capturedTokenCallback?.({
      access_token: 'tok', expires_in: 3600, scope: '', token_type: 'Bearer',
    })
  })

  expect(result.current.auth.isAuthenticated).toBe(true)
  expect(result.current.auth.email).toBeNull()
  vi.unstubAllGlobals()
})

it('starts with null email', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
  })
  expect(result.current.auth.email).toBeNull()
})
```

**Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: 3 new tests FAIL, existing tests PASS

**Step 3: Implement**

In `src/context/AuthContext.tsx`, make these changes:

1. Update `AuthState` interface (add `email`):
```typescript
export interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  email: string | null
  error: string | null
}
```

2. Update `INITIAL_AUTH`:
```typescript
const INITIAL_AUTH: AuthState = { isAuthenticated: false, accessToken: null, email: null, error: null }
```

3. Replace the token callback inside `initClient` (the success branch only):
```typescript
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
```

**Step 4: Run all tests**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: All tests PASS

**Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/context/AuthContext.tsx src/context/AuthContext.test.tsx
git commit -m "feat: add email to AuthState via Google userinfo API"
```

---

### Task 2: Add `adminEmail` to env config

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

**Context:** The primary admin email is baked into the build via `VITE_ADMIN_EMAIL`. It is always an admin regardless of what's in the spreadsheet.

**Step 1: Update `src/config/env.ts`**

Add `adminEmail` to the config object:

```typescript
export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID || '',
  adminEmail: import.meta.env.VITE_ADMIN_EMAIL || '',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
```

**Step 2: Update `.env.example`**

Add after the existing lines:
```
VITE_ADMIN_EMAIL=your-email@gmail.com
```

**Step 3: Update `.env.local`**

Add your actual admin email:
```
VITE_ADMIN_EMAIL=guy.moshk@gmail.com
```

**Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/config/env.ts .env.example
git commit -m "feat: add adminEmail to env config"
```

---

### Task 3: Add `adminEmails` to AppConfig and ConfigRepository

**Files:**
- Modify: `src/models/Config.ts`
- Modify: `src/services/configRepository.ts`
- Modify: `src/services/configRepository.test.ts`

**Context:** Extra admins (beyond the primary env var admin) are stored in the Config tab as a row with key `adminEmails` and value = comma-separated emails. `ConfigRepository.read()` will parse this and include it in `AppConfig`. A new `writeAdminEmails()` method updates only this key.

**Step 1: Add `adminEmails` to `AppConfig` in `src/models/Config.ts`**

```typescript
export interface AppConfig {
  leaveRatioDaysInBase: number
  leaveRatioDaysHome: number
  longLeaveMaxDays: number
  weekendDays: string[]
  minBasePresence: number
  minBasePresenceByRole: Record<SoldierRole, number>
  maxDrivingHours: number
  defaultRestPeriod: number
  taskTypeRestPeriods: Record<string, number>
  adminEmails: string[]   // ADD THIS LINE
}
```

**Step 2: Write failing tests**

Add to `describe('ConfigRepository', ...)` in `src/services/configRepository.test.ts`:

```typescript
describe('read() adminEmails', () => {
  it('returns parsed adminEmails from config tab', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([
      ['Key', 'Value'],
      ['adminEmails', 'alice@example.com,bob@example.com'],
    ])
    const cfg = await repo.read()
    expect(cfg.adminEmails).toEqual(['alice@example.com', 'bob@example.com'])
  })

  it('returns empty array when adminEmails key is missing', async () => {
    vi.spyOn(mockSheets, 'getValues').mockResolvedValue([['Key', 'Value']])
    const cfg = await repo.read()
    expect(cfg.adminEmails).toEqual([])
  })
})

describe('writeAdminEmails()', () => {
  it('appends adminEmails row to Config tab', async () => {
    const appendSpy = vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
    await repo.writeAdminEmails(['alice@example.com', 'bob@example.com'])
    expect(appendSpy).toHaveBeenCalledWith(
      SHEET_ID,
      expect.stringContaining('Config'),
      [['adminEmails', 'alice@example.com,bob@example.com']]
    )
  })
})
```

**Step 3: Run tests to confirm they fail**

Run: `npx vitest run src/services/configRepository.test.ts`
Expected: New tests FAIL, existing PASS

**Step 4: Update `ConfigRepository.read()` to parse `adminEmails`**

In `src/services/configRepository.ts`, update the `read()` return value:

```typescript
async read(): Promise<AppConfig> {
  const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
  const dataRows = rows.slice(1)
  const map = new Map(dataRows.map(r => [r[0], r[1]]))

  const getNum = (key: string, fallback: number): number => {
    const val = map.get(key)
    return val !== undefined ? parseFloat(val) : fallback
  }

  const adminEmailsRaw = map.get('adminEmails') ?? ''
  const adminEmails = adminEmailsRaw
    ? adminEmailsRaw.split(',').map((e: string) => e.trim()).filter(Boolean)
    : []

  return {
    leaveRatioDaysInBase: getNum('leaveRatioDaysInBase', DEFAULT_CONFIG.leaveRatioDaysInBase),
    leaveRatioDaysHome: getNum('leaveRatioDaysHome', DEFAULT_CONFIG.leaveRatioDaysHome),
    longLeaveMaxDays: getNum('longLeaveMaxDays', DEFAULT_CONFIG.longLeaveMaxDays),
    weekendDays: [...DEFAULT_CONFIG.weekendDays],
    minBasePresence: getNum('minBasePresence', DEFAULT_CONFIG.minBasePresence),
    minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
    maxDrivingHours: getNum('maxDrivingHours', DEFAULT_CONFIG.maxDrivingHours),
    defaultRestPeriod: getNum('defaultRestPeriod', DEFAULT_CONFIG.defaultRestPeriod),
    taskTypeRestPeriods: {},
    adminEmails,
  }
}
```

Add new method after `write()`:

```typescript
async writeAdminEmails(emails: string[]): Promise<void> {
  await this.sheets.appendValues(
    this.spreadsheetId,
    `${SHEET_TABS.CONFIG}!A:B`,
    [['adminEmails', emails.join(',')]]
  )
}
```

**Step 5: Run tests**

Run: `npx vitest run src/services/configRepository.test.ts`
Expected: All tests PASS

**Step 6: Run full suite**

Run: `npx vitest run`
Expected: All tests PASS (TypeScript may have complaints about missing `adminEmails` in places that construct `AppConfig` — fix any such TypeScript errors with `adminEmails: []`)

**Step 7: Commit**

```bash
git add src/models/Config.ts src/services/configRepository.ts src/services/configRepository.test.ts
git commit -m "feat: add adminEmails to AppConfig and ConfigRepository"
```

---

### Task 4: Add `getSheetTitles` and `batchUpdate` to GoogleSheetsService

**Files:**
- Modify: `src/services/googleSheets.ts`
- Modify: `src/services/googleSheets.test.ts`

**Context:** `getSheetTitles` extracts tab names from the existing `getSpreadsheet()` metadata. `batchUpdate` adds new sheets (tabs) to an existing spreadsheet using the Sheets API batchUpdate endpoint.

**Step 1: Write failing tests**

Add to `describe('GoogleSheetsService', ...)` in `src/services/googleSheets.test.ts`:

```typescript
it('getSheetTitles returns tab names from spreadsheet metadata', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      sheets: [
        { properties: { title: 'Soldiers' } },
        { properties: { title: 'Tasks' } },
      ],
    }),
  }))

  const titles = await service.getSheetTitles('sheet-id')
  expect(titles).toEqual(['Soldiers', 'Tasks'])
  vi.unstubAllGlobals()
})

it('batchUpdate sends POST request to batchUpdate endpoint', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', mockFetch)

  await service.batchUpdate('sheet-id', [{ addSheet: { properties: { title: 'NewTab' } } }])

  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('batchUpdate'),
    expect.objectContaining({ method: 'POST' })
  )
  vi.unstubAllGlobals()
})

it('batchUpdate throws on failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Forbidden' }))
  await expect(service.batchUpdate('sheet-id', [])).rejects.toThrow('Failed to batch update')
  vi.unstubAllGlobals()
})
```

**Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/services/googleSheets.test.ts`
Expected: 3 new tests FAIL

**Step 3: Add methods to `src/services/googleSheets.ts`**

Add after the `createSpreadsheet` method:

```typescript
/**
 * Get list of sheet (tab) titles in a spreadsheet
 */
async getSheetTitles(spreadsheetId: string): Promise<string[]> {
  const spreadsheet = await this.getSpreadsheet(spreadsheetId)
  return (spreadsheet.sheets ?? []).map(
    (s: { properties: { title: string } }) => s.properties.title
  )
}

/**
 * Execute a batchUpdate on a spreadsheet (e.g. add sheets)
 */
async batchUpdate(spreadsheetId: string, requests: object[]): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  })

  if (!response.ok) {
    throw new Error(`Failed to batch update: ${response.statusText}`)
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/services/googleSheets.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/googleSheets.ts src/services/googleSheets.test.ts
git commit -m "feat: add getSheetTitles and batchUpdate to GoogleSheetsService"
```

---

### Task 5: Create SetupService

**Files:**
- Create: `src/services/setupService.ts`
- Create: `src/services/setupService.test.ts`

**Context:** `SetupService` checks which of the 8 expected tabs exist in the spreadsheet and creates any that are missing (using `batchUpdate`), then writes column headers to each newly created tab.

The 8 expected tabs and their headers come from `sheetTemplate.ts` (already defined as `TAB_HEADERS` there — but since that's not exported, we re-use `SHEET_TABS` constants and define headers inline in SetupService).

**Step 1: Write `src/services/setupService.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetupService } from './setupService'
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

const SHEET_ID = 'test-sheet-id'
const ALL_TABS = Object.values(SHEET_TABS)

describe('SetupService', () => {
  let mockSheets: GoogleSheetsService
  let service: SetupService

  beforeEach(() => {
    mockSheets = new GoogleSheetsService('test-token')
    service = new SetupService(mockSheets, SHEET_ID)
  })

  describe('checkTabs()', () => {
    it('marks all tabs as existing when all are present', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const results = await service.checkTabs()
      expect(results.every(r => r.exists)).toBe(true)
      expect(results.map(r => r.tab)).toEqual(expect.arrayContaining(ALL_TABS))
    })

    it('marks missing tabs as not existing', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers', 'Tasks'])
      const results = await service.checkTabs()
      const soldiers = results.find(r => r.tab === SHEET_TABS.SOLDIERS)
      const version = results.find(r => r.tab === SHEET_TABS.VERSION)
      expect(soldiers?.exists).toBe(true)
      expect(version?.exists).toBe(false)
    })
  })

  describe('initializeMissingTabs()', () => {
    it('creates only missing tabs and writes their headers', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers', 'Tasks'])
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      const created = results.filter(r => r.created)
      const skipped = results.filter(r => !r.created)

      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.SOLDIERS)
      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.TASKS)
      expect(skipped.map(r => r.tab)).toContain(SHEET_TABS.SOLDIERS)

      // batchUpdate called once with all missing tabs
      expect(batchSpy).toHaveBeenCalledOnce()
      const requests: object[] = batchSpy.mock.calls[0][1]
      expect(requests.length).toBe(6) // 8 total - 2 existing

      // headers written for each created tab
      expect(updateSpy).toHaveBeenCalledTimes(6)
    })

    it('does nothing when all tabs exist', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      expect(results.every(r => !r.created)).toBe(true)
      expect(batchSpy).not.toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/services/setupService.test.ts`
Expected: FAIL with "Cannot find module './setupService'"

**Step 3: Create `src/services/setupService.ts`**

```typescript
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

export interface TabStatus {
  tab: string
  exists: boolean
  created: boolean
  error?: string
}

const TAB_HEADERS: Record<string, string[][]> = {
  [SHEET_TABS.SOLDIERS]: [['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount']],
  [SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [SHEET_TABS.TASK_SCHEDULE]: [['ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole', 'IsLocked', 'CreatedAt', 'CreatedBy']],
  [SHEET_TABS.LEAVE_REQUESTS]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'ConstraintType', 'Priority', 'Status']],
  [SHEET_TABS.LEAVE_SCHEDULE]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt']],
  [SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
  [SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [SHEET_TABS.VERSION]: [['TabName', 'Version', 'LastModified', 'LastModifiedBy']],
}

export class SetupService {
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
  }

  async checkTabs(): Promise<TabStatus[]> {
    const existing = new Set(await this.sheets.getSheetTitles(this.spreadsheetId))
    return Object.values(SHEET_TABS).map(tab => ({
      tab,
      exists: existing.has(tab),
      created: false,
    }))
  }

  async initializeMissingTabs(): Promise<TabStatus[]> {
    const statuses = await this.checkTabs()
    const missing = statuses.filter(s => !s.exists).map(s => s.tab)

    if (missing.length === 0) return statuses

    // Create all missing tabs in one batchUpdate call
    await this.sheets.batchUpdate(
      this.spreadsheetId,
      missing.map(title => ({ addSheet: { properties: { title } } }))
    )

    // Write headers for each newly created tab
    for (const tab of missing) {
      const headers = TAB_HEADERS[tab]
      if (headers) {
        await this.sheets.updateValues(this.spreadsheetId, `${tab}!A1`, headers)
      }
    }

    return statuses.map(s => ({
      ...s,
      exists: true,
      created: !s.exists,
    }))
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/services/setupService.test.ts`
Expected: All tests PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/services/setupService.ts src/services/setupService.test.ts
git commit -m "feat: add SetupService to initialize missing spreadsheet tabs"
```

---

### Task 6: Create SetupPage component

**Files:**
- Create: `src/components/SetupPage.tsx`
- Create: `src/components/SetupPage.test.tsx`

**Context:** The Setup page has two sections: Tab Health (check + initialize missing tabs) and Admin Management (list/add/remove extra admin emails). It receives `ds` (DataService), `isAdmin` flag, `configData` (for reading current adminEmails), and `onReload` callback. If `isAdmin` is false it shows an "Access denied" message.

**Step 1: Write `src/components/SetupPage.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import SetupPage from './SetupPage'
import type { DataService } from '../services/dataService'
import type { AppConfig } from '../models'

const mockConfig: AppConfig = {
  leaveRatioDaysInBase: 10, leaveRatioDaysHome: 4, longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'], minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8, defaultRestPeriod: 6, taskTypeRestPeriods: {},
  adminEmails: ['extra@example.com'],
}

describe('SetupPage', () => {
  it('shows access denied when not admin', () => {
    render(
      <SetupPage ds={null} isAdmin={false} configData={null} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
  })

  it('shows tab health section when admin', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={mockConfig} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/initialize/i)).toBeInTheDocument()
  })

  it('shows existing admin emails', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={mockConfig} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText('extra@example.com')).toBeInTheDocument()
  })

  it('shows "no extra admins" when list is empty', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={{ ...mockConfig, adminEmails: [] }} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/no extra admins/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/components/SetupPage.test.tsx`
Expected: FAIL with "Cannot find module './SetupPage'"

**Step 3: Create `src/components/SetupPage.tsx`**

```typescript
import { useState } from 'react'
import { SetupService } from '../services/setupService'
import { GoogleSheetsService } from '../services/googleSheets'
import type { DataService } from '../services/dataService'
import type { AppConfig } from '../models'
import type { TabStatus } from '../services/setupService'

interface Props {
  ds: DataService | null
  isAdmin: boolean
  configData: AppConfig | null
  spreadsheetId: string
  onReload: () => void
}

export default function SetupPage({ ds, isAdmin, configData, spreadsheetId, onReload }: Props) {
  const [tabStatuses, setTabStatuses] = useState<TabStatus[]>([])
  const [initializing, setInitializing] = useState(false)
  const [initDone, setInitDone] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [adminSaving, setAdminSaving] = useState(false)

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-red-600 text-lg font-medium">Access Denied</p>
        <p className="text-gray-500 mt-2">This page is only accessible to admins.</p>
      </div>
    )
  }

  async function handleInitialize() {
    if (!ds) return
    setInitializing(true)
    setInitError(null)
    try {
      const sheets = new GoogleSheetsService(ds.soldiers['sheets']['accessToken'] as string)
      const setup = new SetupService(sheets, spreadsheetId)
      const results = await setup.initializeMissingTabs()
      setTabStatuses(results)
      setInitDone(true)
      onReload()
    } catch (e) {
      setInitError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setInitializing(false)
    }
  }

  async function handleCheckTabs() {
    if (!ds) return
    const sheets = new GoogleSheetsService((ds as any).soldiers.sheets.accessToken)
    const setup = new SetupService(sheets, spreadsheetId)
    const results = await setup.checkTabs()
    setTabStatuses(results)
  }

  async function handleAddAdmin() {
    const email = newAdminEmail.trim()
    if (!email || !ds) return
    setAdminSaving(true)
    try {
      const current = configData?.adminEmails ?? []
      if (!current.includes(email)) {
        await ds.config.writeAdminEmails([...current, email])
        onReload()
        setNewAdminEmail('')
      }
    } finally {
      setAdminSaving(false)
    }
  }

  async function handleRemoveAdmin(email: string) {
    if (!ds) return
    const current = configData?.adminEmails ?? []
    await ds.config.writeAdminEmails(current.filter(e => e !== email))
    onReload()
  }

  const extraAdmins = configData?.adminEmails ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Setup</h1>

      {/* Tab Health */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Spreadsheet Tabs</h2>
        <p className="text-sm text-gray-500">
          The app requires 8 tabs in your Google Sheet. Initialize any that are missing.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleCheckTabs}
            disabled={!ds}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Check Tabs
          </button>
          <button
            onClick={handleInitialize}
            disabled={!ds || initializing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {initializing ? 'Initializing…' : 'Initialize Missing Tabs'}
          </button>
        </div>

        {initError && (
          <p className="text-sm text-red-600">{initError}</p>
        )}
        {initDone && (
          <p className="text-sm text-green-600">Done! All tabs are ready.</p>
        )}

        {tabStatuses.length > 0 && (
          <ul className="space-y-1 mt-2">
            {tabStatuses.map(s => (
              <li key={s.tab} className="flex items-center gap-2 text-sm">
                <span>{s.exists ? '✅' : '❌'}</span>
                <span className="font-mono">{s.tab}</span>
                {s.created && <span className="text-green-600 text-xs">(created)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Admin Management */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Admin Users</h2>

        <div>
          <p className="text-sm text-gray-500 mb-2">Extra admins (in addition to the primary admin):</p>
          {extraAdmins.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No extra admins configured.</p>
          ) : (
            <ul className="space-y-1">
              {extraAdmins.map(email => (
                <li key={email} className="flex items-center justify-between text-sm">
                  <span>{email}</span>
                  <button
                    onClick={() => handleRemoveAdmin(email)}
                    className="text-red-500 hover:text-red-700 text-xs ml-4"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            value={newAdminEmail}
            onChange={e => setNewAdminEmail(e.target.value)}
            placeholder="new-admin@example.com"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddAdmin}
            disabled={!newAdminEmail.trim() || adminSaving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add Admin
          </button>
        </div>
      </section>
    </div>
  )
}
```

**Note:** The `handleInitialize` and `handleCheckTabs` functions access the GoogleSheetsService from DataService. Since `DataService` doesn't expose the service directly, use `(ds as any).soldiers.sheets` to get it. This is acceptable for an admin-only utility page.

**Step 4: Run tests**

Run: `npx vitest run src/components/SetupPage.test.tsx`
Expected: All tests PASS

**Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/components/SetupPage.tsx src/components/SetupPage.test.tsx
git commit -m "feat: add SetupPage component with tab health and admin management"
```

---

### Task 7: Wire routing and nav (App.tsx + AppShell.tsx)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/App.test.tsx` (if it exists)

**Context:** Add `#setup` to the hash router, compute `isAdmin` from the signed-in email, pass it to `AppShell` for conditional nav display, and render `SetupPage` in the correct route.

**Step 1: Update `src/App.tsx`**

1. Add import at top:
```typescript
import SetupPage from './components/SetupPage'
```

2. Add `'setup'` to `Section` type:
```typescript
type Section = 'dashboard' | 'soldiers' | 'tasks' | 'leave' | 'schedule' | 'history' | 'config' | 'setup'
```

3. Add hash case in `getHashSection()`:
```typescript
if (hash === '#setup') return 'setup'
```

4. Inside `AppContent`, after the `useDataService` line, add:
```typescript
const { auth } = useAuth()
const isAdmin = !!auth.email && (
  auth.email === config.adminEmail ||
  (configData?.adminEmails ?? []).includes(auth.email)
)
```

5. Update `<AppShell>` to pass `isAdmin`:
```typescript
<AppShell isAdmin={isAdmin}>
```

6. Add the setup route at the end of the JSX, before `</AppShell>`:
```typescript
{section === 'setup' && (
  <SetupPage
    ds={ds}
    isAdmin={isAdmin}
    configData={configData}
    spreadsheetId={config.spreadsheetId}
    onReload={reload}
  />
)}
```

**Step 2: Update `src/components/AppShell.tsx`**

1. Update `AppShellProps`:
```typescript
interface AppShellProps {
  children?: React.ReactNode
  isAdmin?: boolean
}
```

2. Update the function signature:
```typescript
export default function AppShell({ children, isAdmin }: AppShellProps) {
```

3. Replace the static `NAV_LINKS` with a computed list that includes Setup for admins:
```typescript
const NAV_LINKS = [
  { href: '#soldiers', label: 'Soldiers' },
  { href: '#tasks', label: 'Tasks' },
  { href: '#leave', label: 'Leave' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#history', label: 'History' },
  { href: '#config', label: 'Config' },
  ...(isAdmin ? [{ href: '#setup', label: 'Setup' }] : []),
]
```

**Step 3: Add `useAuth` import to App.tsx if not already present**

Check line 14 of `src/App.tsx` — `useAuth` is imported from `./hooks/useDataService` indirectly. Add direct import:
```typescript
import { useAuth } from './context/AuthContext'
```

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx
git commit -m "feat: wire #setup route and conditional admin nav link"
```

---

### Task 8: Update `.env.local`, deploy, and verify

**Step 1: Add admin email to `.env.local`**

Open `.env.local` and add:
```
VITE_ADMIN_EMAIL=guy.moshk@gmail.com
```

**Step 2: Run all tests one final time**

Run: `npx vitest run`
Expected: All 430+ tests PASS

**Step 3: Deploy**

Run: `npm run deploy`
Expected: Published to `https://dodanski.github.io/ShabTzak/`

**Step 4: Manual verification**

1. Open `https://dodanski.github.io/ShabTzak/`
2. Sign in with `guy.moshk@gmail.com`
3. Verify "Setup" link appears in the nav
4. Click Setup
5. Click "Check Tabs" — all 8 tabs should show ✅
6. Verify "Admin Users" section shows "No extra admins configured"
7. Add a test extra admin email, save, reload — verify it persists
