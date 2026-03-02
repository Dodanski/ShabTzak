# Tab Prefix for Shared Spreadsheets — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow multiple units to share one Google Spreadsheet by prefixing each unit's tabs with a string auto-derived from the unit name.

**Architecture:** Add an optional `tabPrefix` field to the `Unit` model. All repositories compute their tab ranges at construction time using the prefix. On `UnitApp` load, validate that the required prefixed tabs exist and show a blocking error if any are missing. Empty prefix = bare tab names = existing behavior (backward compatible, no migration needed).

**Tech Stack:** React 18, TypeScript, Vitest, Google Sheets API v4, Vite

---

### Task 1: Add deriveTabPrefix utility + update Unit model

**Files:**
- Create: `src/utils/tabPrefix.ts`
- Create: `src/utils/tabPrefix.test.ts`
- Modify: `src/models/Master.ts`

**Step 1: Write the failing test**

Create `src/utils/tabPrefix.test.ts`:
```typescript
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
```

**Step 2: Run to see it fail**

```
npx vitest run src/utils/tabPrefix.test.ts
```
Expected: FAIL — "Cannot find module './tabPrefix'"

**Step 3: Create the utility**

Create `src/utils/tabPrefix.ts`:
```typescript
/**
 * Derives a spreadsheet tab prefix from a unit name.
 * "Alpha Company" → "Alpha_Company"
 * "מחלקה א"       → "מחלקה_א"
 */
export function deriveTabPrefix(unitName: string): string {
  return unitName.trim().replace(/\s+/g, '_')
}

/**
 * Returns the full tab name with prefix applied.
 * prefixTab('Alpha_Company', 'Soldiers') → 'Alpha_Company_Soldiers'
 * prefixTab('', 'Soldiers')             → 'Soldiers'  (legacy behavior)
 */
export function prefixTab(prefix: string, tabName: string): string {
  return prefix ? `${prefix}_${tabName}` : tabName
}
```

**Step 4: Run to see it pass**

```
npx vitest run src/utils/tabPrefix.test.ts
```
Expected: PASS — 7 tests

**Step 5: Update Unit model**

In `src/models/Master.ts`, update `Unit` and `CreateUnitInput`:
```typescript
export interface Unit {
  id: string
  name: string
  spreadsheetId: string
  tabPrefix: string      // auto-derived from name at creation; empty = legacy (no prefix)
  createdAt: string
  createdBy: string
}

export interface CreateUnitInput {
  name: string
  spreadsheetId: string
  tabPrefix: string
}
```

**Step 6: Commit**

```bash
git add src/utils/tabPrefix.ts src/utils/tabPrefix.test.ts src/models/Master.ts
git commit -m "feat: add deriveTabPrefix utility and tabPrefix field to Unit model"
```

---

### Task 2: Update UnitRepository

**Files:**
- Modify: `src/services/unitRepository.ts`
- Modify: `src/services/unitRepository.test.ts`

**Step 1: Add failing tests**

In `src/services/unitRepository.test.ts`, add these three tests inside the existing `describe('UnitRepository', ...)` block:

```typescript
it('list() parses tabPrefix from column F', async () => {
  mockSheets.getValues.mockResolvedValue([
    ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy', 'TabPrefix'],
    ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com', 'Alpha'],
  ])
  const units = await makeRepo().list()
  expect(units[0].tabPrefix).toBe('Alpha')
})

it('list() defaults tabPrefix to empty string when column F is missing', async () => {
  mockSheets.getValues.mockResolvedValue([
    ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy'],
    ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
  ])
  const units = await makeRepo().list()
  expect(units[0].tabPrefix).toBe('')
})

it('create() stores tabPrefix in column F', async () => {
  mockSheets.getValues.mockResolvedValue([
    ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy', 'TabPrefix'],
  ])
  mockSheets.appendValues.mockResolvedValue(undefined)
  await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz', tabPrefix: 'Bravo' }, 'admin@example.com')
  const appendedRow = mockSheets.appendValues.mock.calls[0][2][0] as string[]
  expect(appendedRow[5]).toBe('Bravo')
})
```

Also update the two existing `create()` tests to pass `tabPrefix` in the input object:
```typescript
// In "create() appends a row" test:
await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz', tabPrefix: 'Bravo' }, 'admin@example.com')

// In "create() self-heals missing header" test:
await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz', tabPrefix: 'Bravo' }, 'system')
// And update expected header assertion:
expect(mockSheets.updateValues).toHaveBeenCalledWith(
  'master-sheet-id',
  expect.stringContaining('A1'),
  [['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy', 'TabPrefix']]
)
```

**Step 2: Run to see failures**

```
npx vitest run src/services/unitRepository.test.ts
```
Expected: several tests fail

**Step 3: Update UnitRepository**

In `src/services/unitRepository.ts`:

1. Update `HEADER_ROW`:
```typescript
const HEADER_ROW = ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy', 'TabPrefix']
```

2. In `list()`, update the row mapping to read column F:
```typescript
const units = dataRows.map(row => ({
  id: row[0],
  name: row[1],
  spreadsheetId: row[2],
  createdAt: row[3],
  createdBy: row[4],
  tabPrefix: row[5] ?? '',
}))
```

3. In `create()`, update the unit object and append call:
```typescript
const unit: Unit = {
  id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: input.name,
  spreadsheetId: input.spreadsheetId,
  tabPrefix: input.tabPrefix,
  createdAt: new Date().toISOString(),
  createdBy: createdBy,
}
await this.sheets.appendValues(this.spreadsheetId, RANGE, [
  [unit.id, unit.name, unit.spreadsheetId, unit.createdAt, unit.createdBy, unit.tabPrefix]
])
```

**Step 4: Run to see all pass**

```
npx vitest run src/services/unitRepository.test.ts
```
Expected: PASS — all tests

**Step 5: Commit**

```bash
git add src/services/unitRepository.ts src/services/unitRepository.test.ts
git commit -m "feat: store and retrieve tabPrefix in UnitRepository"
```

---

### Task 3: Add tabPrefix to all 8 repositories/services

**Files (modify all):**
- `src/services/soldierRepository.ts` + `.test.ts`
- `src/services/taskRepository.ts` + `.test.ts`
- `src/services/leaveRequestRepository.ts` + `.test.ts`
- `src/services/leaveAssignmentRepository.ts` + `.test.ts`
- `src/services/taskAssignmentRepository.ts` + `.test.ts`
- `src/services/configRepository.ts` + `.test.ts`
- `src/services/historyService.ts` + `.test.ts`
- `src/services/versionService.ts` + `.test.ts`

All 8 follow the same pattern. This task shows the full change for `SoldierRepository`; apply identically to the other 7.

**The pattern**

Before (module-level constant):
```typescript
const RANGE = `${SHEET_TABS.SOLDIERS}!A:L`

export class SoldierRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache) {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
  }
```

After (instance-level, prefix-aware):
```typescript
import { prefixTab } from '../utils/tabPrefix'
// remove the module-level const RANGE

export class SoldierRepository {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private cache: SheetCache
  private range: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, cache: SheetCache, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.cache = cache
    this.range = `${prefixTab(tabPrefix, SHEET_TABS.SOLDIERS)}!A:L`
  }
```

Replace every reference to the bare `RANGE` constant in the class body with `this.range`.

**Per-file reference table**

> Before editing each file, read it to verify the exact column count in the range string.

| File | Old constant name | Tab key | Example range string |
|------|------------------|---------|----------------------|
| `soldierRepository.ts` | `RANGE` | `SHEET_TABS.SOLDIERS` | `...!A:L` |
| `taskRepository.ts` | `RANGE` | `SHEET_TABS.TASKS` | check file |
| `leaveRequestRepository.ts` | `RANGE` | `SHEET_TABS.LEAVE_REQUESTS` | check file |
| `leaveAssignmentRepository.ts` | `RANGE` | `SHEET_TABS.LEAVE_SCHEDULE` | check file |
| `taskAssignmentRepository.ts` | `RANGE` | `SHEET_TABS.TASK_SCHEDULE` | check file |
| `configRepository.ts` | `RANGE` | `SHEET_TABS.CONFIG` | `...!A:B` |
| `historyService.ts` | `RANGE` | `SHEET_TABS.HISTORY` | `...!A:F` |
| `versionService.ts` | `VERSION_RANGE` | `SHEET_TABS.VERSION` | `...!A:D` |

For `configRepository.ts` and `historyService.ts` (no `cache` param):
```typescript
constructor(sheets: GoogleSheetsService, spreadsheetId: string, tabPrefix = '') {
  this.sheets = sheets
  this.spreadsheetId = spreadsheetId
  this.range = `${prefixTab(tabPrefix, SHEET_TABS.CONFIG)}!A:B`
}
```

For `versionService.ts`, rename `this.versionRange` or just use `this.range` — pick one and update all references in the class.

**Step 1: Write one failing test (SoldierRepository)**

Add to `src/services/soldierRepository.test.ts` inside the outer `describe`:
```typescript
it('uses prefixed tab name when tabPrefix is provided', async () => {
  const prefixedRepo = new SoldierRepository(mockSheets, SHEET_ID, new SheetCache(), 'Alpha_Company')
  vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])
  await prefixedRepo.list()
  expect(mockSheets.getValues).toHaveBeenCalledWith(SHEET_ID, 'Alpha_Company_Soldiers!A:L')
})
```

Add the equivalent test to each of the other 7 test files, adjusting class name, tab name, and range string.

**Step 2: Run to see them fail**

```
npx vitest run src/services/soldierRepository.test.ts
```
Expected: new test fails, existing tests pass

**Step 3: Implement in all 8 files**

Apply the pattern above to each file. Steps per file:
1. Add `import { prefixTab } from '../utils/tabPrefix'`
2. Remove the module-level `const RANGE` (or `const VERSION_RANGE`)
3. Add `private range: string` field
4. Add `tabPrefix = ''` param to constructor
5. Compute `this.range` in constructor using `prefixTab`
6. Replace all bare `RANGE` / `VERSION_RANGE` references in the class body with `this.range`

**Step 4: Run all service tests**

```
npx vitest run src/services/
```
Expected: all tests pass

**Step 5: Commit**

```bash
git add \
  src/services/soldierRepository.ts src/services/soldierRepository.test.ts \
  src/services/taskRepository.ts src/services/taskRepository.test.ts \
  src/services/leaveRequestRepository.ts src/services/leaveRequestRepository.test.ts \
  src/services/leaveAssignmentRepository.ts src/services/leaveAssignmentRepository.test.ts \
  src/services/taskAssignmentRepository.ts src/services/taskAssignmentRepository.test.ts \
  src/services/configRepository.ts src/services/configRepository.test.ts \
  src/services/historyService.ts src/services/historyService.test.ts \
  src/services/versionService.ts src/services/versionService.test.ts
git commit -m "feat: add tabPrefix support to all repositories and services"
```

---

### Task 4: Update DataService

**Files:**
- Modify: `src/services/dataService.ts`
- Modify: `src/services/dataService.test.ts`

**Step 1: Write failing test**

Add to `src/services/dataService.test.ts`:
```typescript
it('passes tabPrefix to repositories — soldiers list uses prefixed range', async () => {
  const ds = new DataService('token', 'sheet-id', 'Alpha_Company')
  vi.spyOn(ds.sheets, 'getValues').mockResolvedValue([])
  await ds.soldiers.list()
  expect(ds.sheets.getValues).toHaveBeenCalledWith('sheet-id', 'Alpha_Company_Soldiers!A:L')
})
```

**Step 2: Run to see it fail**

```
npx vitest run src/services/dataService.test.ts
```
Expected: FAIL

**Step 3: Update DataService constructor**

In `src/services/dataService.ts`, change the constructor signature and pass `tabPrefix` to every constructor call:

```typescript
constructor(accessToken: string, spreadsheetId: string, tabPrefix = '') {
  const sheets = new GoogleSheetsService(accessToken)
  this.sheets = sheets
  this.cache = new SheetCache()

  this.soldiers = new SoldierRepository(sheets, spreadsheetId, this.cache, tabPrefix)
  this.tasks = new TaskRepository(sheets, spreadsheetId, this.cache, tabPrefix)
  this.leaveRequests = new LeaveRequestRepository(sheets, spreadsheetId, this.cache, tabPrefix)
  this.leaveAssignments = new LeaveAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)
  this.taskAssignments = new TaskAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)
  this.config = new ConfigRepository(sheets, spreadsheetId, tabPrefix)
  this.history = new HistoryService(sheets, spreadsheetId, tabPrefix)
  this.versions = new VersionService(sheets, spreadsheetId, tabPrefix)

  this.soldierService = new SoldierService(this.soldiers, this.history)
  this.taskService = new TaskService(this.tasks, this.history)
  this.leaveRequestService = new LeaveRequestService(this.leaveRequests, this.history)
  this.fairnessUpdate = new FairnessUpdateService(this.soldiers, this.history)
  this.scheduleService = new ScheduleService(
    this.soldiers, this.leaveRequests, this.leaveAssignments,
    this.tasks, this.taskAssignments, this.config, this.history,
  )
}
```

**Step 4: Run to see it pass**

```
npx vitest run src/services/dataService.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/dataService.ts src/services/dataService.test.ts
git commit -m "feat: pass tabPrefix through DataService to all repositories"
```

---

### Task 5: Update SetupService

**Files:**
- Modify: `src/services/setupService.ts`
- Modify: `src/services/setupService.test.ts`

**Step 1: Write failing tests**

Add to `src/services/setupService.test.ts`:
```typescript
it('checkTabs() returns prefixed tab names when tabPrefix is set', async () => {
  const mockSheets = {
    getSheetTitles: vi.fn().mockResolvedValue(['Alpha_Company_Soldiers']),
  } as any
  const setup = new SetupService(mockSheets, 'sheet-id', 'Alpha_Company')
  const statuses = await setup.checkTabs()
  const soldierStatus = statuses.find(s => s.tab === 'Alpha_Company_Soldiers')
  expect(soldierStatus?.exists).toBe(true)
  const taskStatus = statuses.find(s => s.tab === 'Alpha_Company_Tasks')
  expect(taskStatus?.exists).toBe(false)
})

it('checkTabs() uses bare tab names when tabPrefix is empty', async () => {
  const mockSheets = {
    getSheetTitles: vi.fn().mockResolvedValue(['Soldiers']),
  } as any
  const setup = new SetupService(mockSheets, 'sheet-id')
  const statuses = await setup.checkTabs()
  expect(statuses.find(s => s.tab === 'Soldiers')?.exists).toBe(true)
})
```

**Step 2: Run to see them fail**

```
npx vitest run src/services/setupService.test.ts
```
Expected: new tests fail

**Step 3: Update SetupService**

In `src/services/setupService.ts`:

1. Add import at top:
```typescript
import { prefixTab } from '../utils/tabPrefix'
```

2. Replace the class body with:
```typescript
export class SetupService {
  private sheets: GoogleSheetsService
  private spreadsheetId: string
  private tabPrefix: string

  constructor(sheets: GoogleSheetsService, spreadsheetId: string, tabPrefix = '') {
    this.sheets = sheets
    this.spreadsheetId = spreadsheetId
    this.tabPrefix = tabPrefix
  }

  private prefixedTabs(): string[] {
    return Object.values(SHEET_TABS).map(tab => prefixTab(this.tabPrefix, tab))
  }

  async checkTabs(): Promise<TabStatus[]> {
    const existing = new Set(await this.sheets.getSheetTitles(this.spreadsheetId))
    return this.prefixedTabs().map(tab => ({
      tab,
      exists: existing.has(tab),
      created: false,
    }))
  }

  async initializeMissingTabs(): Promise<TabStatus[]> {
    const statuses = await this.checkTabs()
    const missing = statuses.filter(s => !s.exists).map(s => s.tab)

    if (missing.length === 0) return statuses

    await this.sheets.batchUpdate(
      this.spreadsheetId,
      missing.map(title => ({ addSheet: { properties: { title } } }))
    )

    for (const prefixedTabName of missing) {
      // Strip the prefix to look up headers by bare tab name
      const bareTab = this.tabPrefix
        ? prefixedTabName.slice(this.tabPrefix.length + 1)
        : prefixedTabName
      const headers = TAB_HEADERS[bareTab]
      if (headers) {
        await this.sheets.updateValues(this.spreadsheetId, `${prefixedTabName}!A1`, headers)
      }
    }

    return statuses.map(s => ({ ...s, exists: true, created: !s.exists }))
  }
}
```

> `TAB_HEADERS` stays keyed by bare names (e.g. `'Soldiers'`). The bare-name lookup strips the prefix before the map lookup.

**Step 4: Run to see all pass**

```
npx vitest run src/services/setupService.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/setupService.ts src/services/setupService.test.ts
git commit -m "feat: add tabPrefix support to SetupService"
```

---

### Task 6: Update useDataService + add useMissingTabs hook

**Files:**
- Modify: `src/hooks/useDataService.ts`
- Create: `src/hooks/useMissingTabs.ts`
- Create: `src/hooks/useMissingTabs.test.ts`

**Step 1: Write failing test for useMissingTabs**

Create `src/hooks/useMissingTabs.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMissingTabs } from './useMissingTabs'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { accessToken: 'test-token' } }),
}))

vi.mock('../services/setupService', () => ({
  SetupService: vi.fn().mockImplementation(() => ({
    checkTabs: vi.fn().mockResolvedValue([
      { tab: 'Alpha_Company_Soldiers', exists: false, created: false },
      { tab: 'Alpha_Company_Tasks', exists: true, created: false },
    ]),
  })),
}))

describe('useMissingTabs', () => {
  it('returns missing tab names', async () => {
    const { result } = renderHook(() => useMissingTabs('sheet-id', 'Alpha_Company'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missing).toEqual(['Alpha_Company_Soldiers'])
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useMissingTabs('sheet-id', 'Alpha_Company'))
    expect(result.current.loading).toBe(true)
  })
})
```

**Step 2: Run to see it fail**

```
npx vitest run src/hooks/useMissingTabs.test.ts
```
Expected: FAIL — module not found

**Step 3: Create useMissingTabs**

Create `src/hooks/useMissingTabs.ts`:
```typescript
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleSheetsService } from '../services/googleSheets'
import { SetupService } from '../services/setupService'

export interface UseMissingTabsResult {
  missing: string[]
  loading: boolean
}

export function useMissingTabs(spreadsheetId: string, tabPrefix: string): UseMissingTabsResult {
  const { auth } = useAuth()
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth.accessToken || !spreadsheetId) {
      setLoading(false)
      return
    }
    const sheets = new GoogleSheetsService(auth.accessToken)
    const setup = new SetupService(sheets, spreadsheetId, tabPrefix)
    setup.checkTabs()
      .then(statuses => {
        setMissing(statuses.filter(s => !s.exists).map(s => s.tab))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [auth.accessToken, spreadsheetId, tabPrefix])

  return { missing, loading }
}
```

**Step 4: Update useDataService to accept tabPrefix**

In `src/hooks/useDataService.ts`:

1. Change signature: `export function useDataService(spreadsheetId: string, tabPrefix = '')`
2. Pass `tabPrefix` to `DataService`:
```typescript
const ds = useMemo(() => {
  if (!auth.accessToken || !spreadsheetId) return null
  return new DataService(auth.accessToken, spreadsheetId, tabPrefix)
}, [auth.accessToken, spreadsheetId, tabPrefix])
```

**Step 5: Run to see all pass**

```
npx vitest run src/hooks/
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/hooks/useMissingTabs.ts src/hooks/useMissingTabs.test.ts src/hooks/useDataService.ts
git commit -m "feat: add useMissingTabs hook and tabPrefix param to useDataService"
```

---

### Task 7: Wire tabPrefix through App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update UnitAppProps**

Add `tabPrefix: string` to the interface:
```typescript
interface UnitAppProps {
  spreadsheetId: string
  tabPrefix: string
  unitName: string
  onBackToAdmin?: () => void
}
```

**Step 2: Update UnitApp body**

1. Destructure the new prop:
```typescript
function UnitApp({ spreadsheetId, tabPrefix, unitName, onBackToAdmin }: UnitAppProps) {
```

2. Add the hooks (after the existing `useState` / `useEffect`):
```typescript
const { missing, loading: tabsLoading } = useMissingTabs(spreadsheetId, tabPrefix)
```

3. Pass `tabPrefix` to `useDataService`:
```typescript
const { ds, soldiers, ... } = useDataService(spreadsheetId, tabPrefix)
```

4. Add the missing-tabs guard **before** the existing `if (loading)` block:
```tsx
if (tabsLoading) {
  return (
    <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Checking spreadsheet…</p>
      </div>
    </AppShell>
  )
}

if (missing.length > 0) {
  return (
    <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
      <div className="max-w-xl mx-auto py-16 space-y-4">
        <h2 className="text-lg font-semibold text-red-700">Missing spreadsheet tabs</h2>
        <p className="text-sm text-gray-600">
          The following tabs are required but were not found in the spreadsheet:
        </p>
        <ul className="list-disc list-inside text-sm font-mono text-red-600 space-y-1">
          {missing.map(tab => <li key={tab}>{tab}</li>)}
        </ul>
        <p className="text-sm text-gray-500">
          Create these tabs in the spreadsheet, then reload the page.
        </p>
      </div>
    </AppShell>
  )
}
```

**Step 3: Add import for useMissingTabs**

At the top of `App.tsx`:
```typescript
import { useMissingTabs } from './hooks/useMissingTabs'
```

**Step 4: Pass tabPrefix in AppContent**

Find where `<UnitApp>` is rendered in `AppContent` and add the prop:
```tsx
<UnitApp
  spreadsheetId={activeUnit?.spreadsheetId ?? ''}
  tabPrefix={activeUnit?.tabPrefix ?? ''}
  unitName={activeUnit?.name ?? ''}
  onBackToAdmin={isAdmin ? () => { setActiveUnit(null); setAppMode('admin') } : undefined}
/>
```

**Step 5: Build check**

```
npm run build
```
Expected: clean build, no TypeScript errors

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire tabPrefix through UnitApp, show error for missing tabs"
```

---

### Task 8: Update AdminPanel — tab prefix preview

**Files:**
- Modify: `src/components/AdminPanel.tsx`

**Step 1: Add import**

At the top of `src/components/AdminPanel.tsx`:
```typescript
import { deriveTabPrefix } from '../utils/tabPrefix'
```

**Step 2: Add computed prefix preview**

Immediately before the Units tab JSX, compute the derived prefix reactively from existing state (no new `useState` needed):
```typescript
const derivedPrefix = deriveTabPrefix(newUnitName)
```

**Step 3: Update the Add Unit form JSX**

Find the `<div className="grid grid-cols-2 gap-2">` for adding units and update it:

```tsx
<div className="grid grid-cols-2 gap-2">
  <input
    value={newUnitName}
    onChange={e => setNewUnitName(e.target.value)}
    placeholder="Unit name"
    className="border border-olive-200 rounded px-2 py-1 text-sm"
  />
  <input
    value={newUnitSheetId}
    onChange={e => setNewUnitSheetId(e.target.value)}
    placeholder="Google Sheet ID"
    className="border border-olive-200 rounded px-2 py-1 text-sm"
  />
  {newUnitName && (
    <p className="col-span-2 text-xs text-olive-500">
      Tab prefix: <span className="font-mono font-medium">{derivedPrefix}</span>
      {' '}— tabs will be named {derivedPrefix}_Soldiers, {derivedPrefix}_Tasks, …
    </p>
  )}
  <button
    onClick={handleAddUnit}
    className="col-span-2 px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800"
  >
    Add Unit
  </button>
</div>
```

**Step 4: Pass tabPrefix when creating the unit**

Update `handleAddUnit`:
```typescript
async function handleAddUnit() {
  if (!newUnitName || !newUnitSheetId) return
  setError(null)
  try {
    await masterDs.units.create(
      { name: newUnitName, spreadsheetId: newUnitSheetId, tabPrefix: deriveTabPrefix(newUnitName) },
      currentAdminEmail
    )
    setNewUnitName('')
    setNewUnitSheetId('')
    await reload()
  } catch {
    setError('Failed to add unit')
  }
}
```

**Step 5: Run full test suite**

```
npx vitest run --reporter=verbose
```
Expected: all tests pass (no regressions)

**Step 6: Final build check**

```
npm run build
```
Expected: clean build

**Step 7: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "feat: show tab prefix preview in AdminPanel and derive prefix on unit create"
```
