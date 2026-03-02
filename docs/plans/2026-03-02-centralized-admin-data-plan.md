# Centralized Admin Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Tasks, Config, and History from per-unit spreadsheets to the shared admin spreadsheet; reduce per-unit tabs from 8 to 4; auto-create missing unit tabs; remove all versioning machinery.

**Architecture:** `MasterDataService` gains `tasks`, `config`, `history`, `taskService`. `DataService` is slimmed to 4 per-unit repositories and injects `HistoryService` from master. `ScheduleService` receives tasks and config as method params instead of repository references. Commanders see tasks read-only; admins create/delete tasks in AdminPanel.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, Google Sheets API v4

---

## Context

Read the design doc at `docs/plans/2026-03-02-centralized-admin-data-design.md` before starting.

Key files to understand before each task are listed inline. Run all tests with:
```bash
npx vitest run
```
All 516 tests must stay green after every task.

---

### Task 1: Reshape SHEET_TABS and MASTER_SHEET_TABS constants

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/constants/index.test.ts`

**Context:** `SHEET_TABS` currently has 8 entries. After this task it has 4 (unit-only). `MASTER_SHEET_TABS` gains Tasks, Config, History. All downstream code that references the removed keys will break and be fixed in later tasks.

**Step 1: Write the failing tests**

In `src/constants/index.test.ts`, add at the bottom of the `describe('Constants')` block:

```typescript
it('SHEET_TABS has exactly 4 unit-only tabs', () => {
  expect(Object.values(SHEET_TABS)).toHaveLength(4)
  expect(Object.keys(SHEET_TABS)).toContain('SOLDIERS')
  expect(Object.keys(SHEET_TABS)).toContain('TASK_SCHEDULE')
  expect(Object.keys(SHEET_TABS)).toContain('LEAVE_REQUESTS')
  expect(Object.keys(SHEET_TABS)).toContain('LEAVE_SCHEDULE')
  expect(Object.keys(SHEET_TABS)).not.toContain('TASKS')
  expect(Object.keys(SHEET_TABS)).not.toContain('CONFIG')
  expect(Object.keys(SHEET_TABS)).not.toContain('HISTORY')
  expect(Object.keys(SHEET_TABS)).not.toContain('VERSION')
})

it('MASTER_SHEET_TABS includes Tasks, Config, History', () => {
  expect(MASTER_SHEET_TABS).toHaveProperty('TASKS', 'Tasks')
  expect(MASTER_SHEET_TABS).toHaveProperty('CONFIG', 'Config')
  expect(MASTER_SHEET_TABS).toHaveProperty('HISTORY', 'History')
})
```

Also add `SHEET_TABS, MASTER_SHEET_TABS` to the import line.

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/constants/index.test.ts
```
Expected: 2 new tests FAIL.

**Step 3: Implement**

In `src/constants/index.ts`, replace the `SHEET_TABS` and `MASTER_SHEET_TABS` blocks:

```typescript
// Google Sheets tabs — per-unit only (4 tabs)
export const SHEET_TABS = {
  SOLDIERS: 'Soldiers',
  TASK_SCHEDULE: 'TaskSchedule',
  LEAVE_REQUESTS: 'LeaveRequests',
  LEAVE_SCHEDULE: 'LeaveSchedule',
} as const

// Master / admin spreadsheet tabs
export const MASTER_SHEET_TABS = {
  ADMINS: 'Admins',
  UNITS: 'Units',
  COMMANDERS: 'Commanders',
  TASKS: 'Tasks',
  CONFIG: 'Config',
  HISTORY: 'History',
} as const
```

**Step 4: Run tests**

```bash
npx vitest run src/constants/index.test.ts
```
Expected: all PASS. (Other test files may now have TypeScript errors, but the constants tests pass.)

**Step 5: Commit**

```bash
git add src/constants/index.ts src/constants/index.test.ts
git commit -m "feat: SHEET_TABS 4 unit tabs only; MASTER_SHEET_TABS gains Tasks/Config/History"
```

---

### Task 2: Update SetupService to handle only 4 unit tabs

**Files:**
- Modify: `src/services/setupService.ts`
- Modify: `src/services/setupService.test.ts`

**Context:** `SetupService` iterates `Object.values(SHEET_TABS)` so the constant change from Task 1 already reduces the tab list. But `TAB_HEADERS` still has 8 entries — remove the 4 that belong to admin now. Also remove the `VERSION` import from `SHEET_TABS` references in the test.

**Step 1: Write failing tests**

In `src/services/setupService.test.ts`, the existing test checks `8 total - 2 existing = 6`. Update the constant and the expected count. Replace the entire file content:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SetupService } from './setupService'
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'

const SHEET_ID = 'test-sheet-id'
const ALL_TABS = Object.values(SHEET_TABS) // now 4 tabs

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
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers'])
      const results = await service.checkTabs()
      const soldiers = results.find(r => r.tab === SHEET_TABS.SOLDIERS)
      const schedule = results.find(r => r.tab === SHEET_TABS.TASK_SCHEDULE)
      expect(soldiers?.exists).toBe(true)
      expect(schedule?.exists).toBe(false)
    })
  })

  describe('initializeMissingTabs()', () => {
    it('creates only missing tabs and writes their headers', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(['Soldiers'])
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)
      const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      const created = results.filter(r => r.created)
      expect(created.map(r => r.tab)).not.toContain(SHEET_TABS.SOLDIERS)

      // 4 total - 1 existing = 3 missing
      expect(batchSpy).toHaveBeenCalledOnce()
      const requests: object[] = batchSpy.mock.calls[0][1]
      expect(requests.length).toBe(3)

      expect(updateSpy).toHaveBeenCalledTimes(3)
    })

    it('does nothing when all tabs exist', async () => {
      vi.spyOn(mockSheets, 'getSheetTitles').mockResolvedValue(ALL_TABS)
      const batchSpy = vi.spyOn(mockSheets, 'batchUpdate').mockResolvedValue(undefined)

      const results = await service.initializeMissingTabs()

      expect(results.every(r => !r.created)).toBe(true)
      expect(batchSpy).not.toHaveBeenCalled()
    })
  })

  describe('tabPrefix support', () => {
    it('checkTabs() returns prefixed tab names when tabPrefix is set', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue(['Alpha_Company_Soldiers']),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id', 'Alpha_Company')
      const statuses = await setup.checkTabs()
      const soldierStatus = statuses.find(s => s.tab === 'Alpha_Company_Soldiers')
      expect(soldierStatus?.exists).toBe(true)
      const scheduleStatus = statuses.find(s => s.tab === 'Alpha_Company_TaskSchedule')
      expect(scheduleStatus?.exists).toBe(false)
    })

    it('checkTabs() uses bare tab names when tabPrefix is empty', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue(['Soldiers']),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id')
      const statuses = await setup.checkTabs()
      expect(statuses.find(s => s.tab === 'Soldiers')?.exists).toBe(true)
    })

    it('initializeMissingTabs() creates and writes headers to prefixed tab names', async () => {
      const mockSheets = {
        getSheetTitles: vi.fn().mockResolvedValue([]),
        batchUpdate: vi.fn().mockResolvedValue(undefined),
        updateValues: vi.fn().mockResolvedValue(undefined),
      } as any
      const setup = new SetupService(mockSheets, 'sheet-id', 'Alpha_Company')
      await setup.initializeMissingTabs()
      const batchArg = mockSheets.batchUpdate.mock.calls[0][1] as Array<{ addSheet: { properties: { title: string } } }>
      expect(batchArg.some(r => r.addSheet.properties.title === 'Alpha_Company_Soldiers')).toBe(true)
      expect(mockSheets.updateValues).toHaveBeenCalledWith(
        'sheet-id',
        'Alpha_Company_Soldiers!A1',
        expect.arrayContaining([expect.any(Array)])
      )
    })
  })
})
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/services/setupService.test.ts
```
Expected: multiple FAIL (wrong tab counts, VERSION reference).

**Step 3: Implement**

Replace entire `src/services/setupService.ts`:

```typescript
import { GoogleSheetsService } from './googleSheets'
import { SHEET_TABS } from '../constants'
import { prefixTab } from '../utils/tabPrefix'

export interface TabStatus {
  tab: string
  exists: boolean
  created: boolean
  error?: string
}

const TAB_HEADERS: Record<string, string[][]> = {
  [SHEET_TABS.SOLDIERS]: [['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount']],
  [SHEET_TABS.TASK_SCHEDULE]: [['ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole', 'IsLocked', 'CreatedAt', 'CreatedBy']],
  [SHEET_TABS.LEAVE_REQUESTS]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'ConstraintType', 'Priority', 'Status']],
  [SHEET_TABS.LEAVE_SCHEDULE]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt']],
}

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

**Step 4: Run tests**

```bash
npx vitest run src/services/setupService.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/services/setupService.ts src/services/setupService.test.ts
git commit -m "feat: SetupService handles 4 unit tabs only, drops Tasks/Config/History/Version"
```

---

### Task 3: Auto-create missing unit tabs in useMissingTabs

**Files:**
- Modify: `src/hooks/useMissingTabs.ts`
- Modify: `src/hooks/useMissingTabs.test.ts`

**Context:** Currently `useMissingTabs` calls `checkTabs()` and blocks the UI if tabs are missing. After this change it calls `initializeMissingTabs()` which creates missing tabs automatically. On success `missing` is always `[]`.

**Step 1: Write failing tests**

Replace entire `src/hooks/useMissingTabs.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMissingTabs } from './useMissingTabs'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { accessToken: 'test-token' } }),
}))

vi.mock('../services/googleSheets', () => ({
  GoogleSheetsService: vi.fn().mockImplementation(function () { return {} }),
}))

const mockInitializeMissingTabs = vi.fn().mockResolvedValue([])

vi.mock('../services/setupService', () => ({
  SetupService: vi.fn().mockImplementation(function () {
    return { initializeMissingTabs: mockInitializeMissingTabs }
  }),
}))

describe('useMissingTabs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('auto-creates tabs and returns empty missing array on success', async () => {
    mockInitializeMissingTabs.mockResolvedValue([
      { tab: 'Soldiers', exists: true, created: true },
    ])
    const { result } = renderHook(() => useMissingTabs('sheet-id', ''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.missing).toEqual([])
    expect(result.current.error).toBe(false)
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useMissingTabs('sheet-id', ''))
    expect(result.current.loading).toBe(true)
  })

  it('returns error: true when initializeMissingTabs throws', async () => {
    mockInitializeMissingTabs.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useMissingTabs('sheet-id', ''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.missing).toEqual([])
  })

  it('calls initializeMissingTabs with spreadsheetId and tabPrefix', async () => {
    mockInitializeMissingTabs.mockResolvedValue([])
    renderHook(() => useMissingTabs('sheet-abc', 'Alpha_Company'))
    await waitFor(() => {
      const { SetupService } = require('../services/setupService')
      expect(SetupService).toHaveBeenCalledWith(expect.anything(), 'sheet-abc', 'Alpha_Company')
    })
  })
})
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/hooks/useMissingTabs.test.ts
```
Expected: FAIL (still uses `checkTabs`).

**Step 3: Implement**

Replace entire `src/hooks/useMissingTabs.ts`:

```typescript
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { GoogleSheetsService } from '../services/googleSheets'
import { SetupService } from '../services/setupService'

export interface UseMissingTabsResult {
  missing: string[]
  loading: boolean
  error: boolean
}

export function useMissingTabs(spreadsheetId: string, tabPrefix: string): UseMissingTabsResult {
  const { auth } = useAuth()
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!auth.accessToken || !spreadsheetId) {
      setLoading(false)
      return
    }
    const sheets = new GoogleSheetsService(auth.accessToken)
    const setup = new SetupService(sheets, spreadsheetId, tabPrefix)
    setup.initializeMissingTabs()
      .then(() => {
        setMissing([])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [auth.accessToken, spreadsheetId, tabPrefix])

  return { missing, loading, error }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/hooks/useMissingTabs.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/hooks/useMissingTabs.ts src/hooks/useMissingTabs.test.ts
git commit -m "feat: useMissingTabs auto-creates missing unit tabs via initializeMissingTabs"
```

---

### Task 4: Add tasks/config/history/taskService to MasterDataService

**Files:**
- Modify: `src/services/masterDataService.ts`
- Modify: `src/services/masterDataService.test.ts`

**Context:** `MasterDataService` already manages `admins`, `units`, `commanders`. It now gains `tasks` (TaskRepository), `config` (ConfigRepository), `history` (HistoryService), `taskService` (TaskService) — all pointing at the admin spreadsheet with no tab prefix. `initialize()` also creates and writes headers for the 3 new tabs.

**Step 1: Write failing tests**

Add to `src/services/masterDataService.test.ts`. Add these mocks at the top alongside existing mocks:

```typescript
vi.mock('./taskRepository')
vi.mock('./configRepository')
vi.mock('./historyService')
vi.mock('./taskService')
```

Add these imports:
```typescript
import { TaskRepository } from './taskRepository'
import { ConfigRepository } from './configRepository'
import { HistoryService } from './historyService'
import { TaskService } from './taskService'
```

Add a new describe block at the bottom:
```typescript
describe('admin data repositories', () => {
  it('exposes tasks repository on admin spreadsheet (no prefix)', () => {
    const svc = new MasterDataService('token', 'master-id')
    expect(svc.tasks).toBeDefined()
    expect(svc.tasks.list).toBeDefined()
  })

  it('exposes config repository', () => {
    const svc = new MasterDataService('token', 'master-id')
    expect(svc.config).toBeDefined()
    expect(svc.config.read).toBeDefined()
  })

  it('exposes history service', () => {
    const svc = new MasterDataService('token', 'master-id')
    expect(svc.history).toBeDefined()
    expect(svc.history.append).toBeDefined()
  })

  it('exposes taskService', () => {
    const svc = new MasterDataService('token', 'master-id')
    expect(svc.taskService).toBeDefined()
    expect(svc.taskService.create).toBeDefined()
  })
})
```

Also update the existing `initialize()` test `'creates missing tabs when some are absent'`:
Change `expect.arrayContaining` to also include `Tasks`, `Config`, `History`:
```typescript
expect(GoogleSheetsService.prototype.batchUpdate).toHaveBeenCalledWith(
  'master-id',
  expect.arrayContaining([
    { addSheet: { properties: { title: 'Units' } } },
    { addSheet: { properties: { title: 'Commanders' } } },
    { addSheet: { properties: { title: 'Tasks' } } },
    { addSheet: { properties: { title: 'Config' } } },
    { addSheet: { properties: { title: 'History' } } },
  ])
)
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/services/masterDataService.test.ts
```
Expected: FAIL on new tests.

**Step 3: Implement**

Replace entire `src/services/masterDataService.ts`:

```typescript
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { TaskRepository } from './taskRepository'
import { ConfigRepository } from './configRepository'
import { HistoryService } from './historyService'
import { TaskService } from './taskService'
import { MASTER_SHEET_TABS } from '../constants'
import type { Unit } from '../models'

const ADMIN_TAB_HEADERS: Record<string, string[][]> = {
  [MASTER_SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [MASTER_SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [MASTER_SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
}

export type ResolvedRole =
  | { role: 'admin' }
  | { role: 'commander'; unitId: string; unit: Unit }
  | null

export class MasterDataService {
  readonly admins: AdminRepository
  readonly units: UnitRepository
  readonly commanders: CommanderRepository
  readonly tasks: TaskRepository
  readonly config: ConfigRepository
  readonly history: HistoryService
  readonly taskService: TaskService
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(accessToken: string, spreadsheetId: string) {
    this.sheets = new GoogleSheetsService(accessToken)
    this.spreadsheetId = spreadsheetId
    const cache = new SheetCache()
    this.admins = new AdminRepository(this.sheets, spreadsheetId, cache)
    this.units = new UnitRepository(this.sheets, spreadsheetId, cache)
    this.commanders = new CommanderRepository(this.sheets, spreadsheetId, cache)
    this.tasks = new TaskRepository(this.sheets, spreadsheetId, cache)
    this.config = new ConfigRepository(this.sheets, spreadsheetId)
    this.history = new HistoryService(this.sheets, spreadsheetId)
    this.taskService = new TaskService(this.tasks, this.history)
  }

  async initialize(firstAdminEmail: string): Promise<void> {
    const titles = await this.sheets.getSheetTitles(this.spreadsheetId)
    const needed = Object.values(MASTER_SHEET_TABS)
    const missing = needed.filter(t => !titles.includes(t))

    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } },
      }))
      await this.sheets.batchUpdate(this.spreadsheetId, requests)

      for (const tabName of missing) {
        const headers = ADMIN_TAB_HEADERS[tabName]
        if (headers) {
          await this.sheets.updateValues(this.spreadsheetId, `${tabName}!A1`, headers)
        }
      }
    }

    const admins = await this.admins.list()
    if (admins.length === 0 && firstAdminEmail) {
      await this.admins.create({ email: firstAdminEmail }, 'system')
    }
  }

  async resolveRole(email: string): Promise<ResolvedRole> {
    const [admins, commanders, units] = await Promise.all([
      this.admins.list(),
      this.commanders.list(),
      this.units.list(),
    ])

    if (admins.some(a => a.email === email)) {
      return { role: 'admin' }
    }

    const cmdEntry = commanders.find(c => c.email === email)
    if (cmdEntry) {
      const unit = units.find(u => u.id === cmdEntry.unitId)
      if (unit) return { role: 'commander', unitId: cmdEntry.unitId, unit }
    }

    return null
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/masterDataService.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/services/masterDataService.ts src/services/masterDataService.test.ts
git commit -m "feat: MasterDataService gains tasks, config, history, taskService repos"
```

---

### Task 5: Update ScheduleService to accept tasks and config as params

**Files:**
- Modify: `src/services/scheduleService.ts`
- Modify: `src/services/scheduleService.test.ts`

**Context:** `ScheduleService` currently holds `TaskRepository` and `ConfigRepository`. After this change those are removed from the constructor. `generateTaskSchedule` receives `tasks: Task[]` directly. `generateLeaveSchedule` receives `config: AppConfig` directly. `HistoryService` stays as a constructor param (it now comes from master).

**Step 1: Write failing tests**

Replace entire `src/services/scheduleService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleService } from './scheduleService'
import type { Soldier, LeaveRequest, Task, AppConfig } from '../models'

const CONFIG: AppConfig = {
  minBasePresence: 25,
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
  minBasePresenceByRole: {},
  adminEmails: [],
}

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: 's2', name: 'Moshe', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
]

const PENDING_REQUEST: LeaveRequest = {
  id: 'req-1', soldierId: 's1',
  startDate: '2026-03-20', endDate: '2026-03-22',
  leaveType: 'After', constraintType: 'Preference',
  priority: 5, status: 'Pending',
}

const TASK: Task = {
  id: 't1', taskType: 'Guard',
  startTime: '2026-03-20T08:00:00Z', endTime: '2026-03-20T16:00:00Z',
  durationHours: 8, roleRequirements: [{ role: 'Driver', count: 1 }],
  minRestAfter: 6, isSpecial: false,
}

const makeRepo = (overrides = {}) => ({
  list: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
  ...overrides,
})

const mockHistory = {
  append: vi.fn().mockResolvedValue(undefined),
}

describe('ScheduleService', () => {
  let mockSoldiers: ReturnType<typeof makeRepo>
  let mockLeaveRequests: ReturnType<typeof makeRepo>
  let mockLeaveAssignments: ReturnType<typeof makeRepo>
  let mockTaskAssignments: ReturnType<typeof makeRepo>
  let service: ScheduleService

  beforeEach(() => {
    vi.clearAllMocks()
    mockSoldiers = makeRepo({ list: vi.fn().mockResolvedValue(SOLDIERS) })
    mockLeaveRequests = makeRepo({ list: vi.fn().mockResolvedValue([PENDING_REQUEST]) })
    mockLeaveAssignments = makeRepo({ list: vi.fn().mockResolvedValue([]) })
    mockTaskAssignments = makeRepo({ list: vi.fn().mockResolvedValue([]) })

    service = new ScheduleService(
      mockSoldiers as any,
      mockLeaveRequests as any,
      mockLeaveAssignments as any,
      mockTaskAssignments as any,
      mockHistory as any,
    )
  })

  describe('generateLeaveSchedule()', () => {
    it('runs the scheduler and returns a LeaveSchedule', async () => {
      const result = await service.generateLeaveSchedule(CONFIG, '2026-03-01', '2026-03-31', 'admin')
      expect(result.startDate).toBe('2026-03-01')
      expect(result.endDate).toBe('2026-03-31')
      expect(Array.isArray(result.assignments)).toBe(true)
    })

    it('persists new assignments via repository', async () => {
      await service.generateLeaveSchedule(CONFIG, '2026-03-01', '2026-03-31', 'admin')
      expect(mockLeaveAssignments.create).toHaveBeenCalledOnce()
    })

    it('does not re-persist existing assignments', async () => {
      const existingAssignment = {
        id: 'existing-1', soldierId: 's1',
        startDate: '2026-03-20', endDate: '2026-03-22',
        leaveType: 'After', isWeekend: false, isLocked: true,
        createdAt: '2026-02-01T00:00:00',
      }
      mockLeaveAssignments.list.mockResolvedValue([existingAssignment])
      mockLeaveRequests.list.mockResolvedValue([])
      await service.generateLeaveSchedule(CONFIG, '2026-03-01', '2026-03-31', 'admin')
      expect(mockLeaveAssignments.create).not.toHaveBeenCalled()
    })

    it('logs generation to history', async () => {
      await service.generateLeaveSchedule(CONFIG, '2026-03-01', '2026-03-31', 'admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'GENERATE_LEAVE_SCHEDULE', 'LeaveSchedule', '2026-03-01', 'admin', expect.any(String)
      )
    })
  })

  describe('generateTaskSchedule()', () => {
    it('runs the scheduler and returns a TaskSchedule', async () => {
      const result = await service.generateTaskSchedule([TASK], 'admin')
      expect(Array.isArray(result.assignments)).toBe(true)
    })

    it('persists new task assignments via repository', async () => {
      await service.generateTaskSchedule([TASK], 'admin')
      expect(mockTaskAssignments.create).toHaveBeenCalledOnce()
    })

    it('logs generation to history', async () => {
      await service.generateTaskSchedule([TASK], 'admin')
      expect(mockHistory.append).toHaveBeenCalledWith(
        'GENERATE_TASK_SCHEDULE', 'TaskSchedule', '', 'admin', expect.any(String)
      )
    })
  })
})
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/services/scheduleService.test.ts
```
Expected: FAIL (wrong constructor arity, wrong method signatures).

**Step 3: Implement**

Replace entire `src/services/scheduleService.ts`:

```typescript
import { scheduleLeave } from '../algorithms/leaveScheduler'
import { scheduleTasks } from '../algorithms/taskScheduler'
import type { SoldierRepository } from './soldierRepository'
import type { LeaveRequestRepository } from './leaveRequestRepository'
import type { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import type { TaskAssignmentRepository } from './taskAssignmentRepository'
import type { HistoryService } from './historyService'
import type { LeaveSchedule, TaskSchedule, Task, AppConfig } from '../models'

export class ScheduleService {
  constructor(
    private soldiers: SoldierRepository,
    private leaveRequests: LeaveRequestRepository,
    private leaveAssignments: LeaveAssignmentRepository,
    private taskAssignments: TaskAssignmentRepository,
    private history: HistoryService,
  ) {}

  async generateLeaveSchedule(
    config: AppConfig,
    scheduleStart: string,
    scheduleEnd: string,
    changedBy: string,
  ): Promise<LeaveSchedule> {
    const [soldiers, requests, existing] = await Promise.all([
      this.soldiers.list(),
      this.leaveRequests.list(),
      this.leaveAssignments.list(),
    ])

    const schedule = scheduleLeave(requests, soldiers, existing, config, scheduleStart, scheduleEnd)

    const existingIds = new Set(existing.map(a => a.id))
    for (const assignment of schedule.assignments) {
      if (!existingIds.has(assignment.id)) {
        await this.leaveAssignments.create({
          soldierId: assignment.soldierId,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          leaveType: assignment.leaveType,
          isWeekend: assignment.isWeekend,
          requestId: assignment.requestId,
        })
      }
    }

    await this.history.append(
      'GENERATE_LEAVE_SCHEDULE', 'LeaveSchedule', scheduleStart,
      changedBy, `Generated for ${scheduleStart} to ${scheduleEnd}`
    )

    return schedule
  }

  async generateTaskSchedule(tasks: Task[], changedBy: string): Promise<TaskSchedule> {
    const [soldiers, existing] = await Promise.all([
      this.soldiers.list(),
      this.taskAssignments.list(),
    ])

    const schedule = scheduleTasks(tasks, soldiers, existing)

    const existingKeys = new Set(existing.map(a => `${a.taskId}:${a.soldierId}`))
    for (const assignment of schedule.assignments) {
      if (!existingKeys.has(`${assignment.taskId}:${assignment.soldierId}`)) {
        await this.taskAssignments.create({
          taskId: assignment.taskId,
          soldierId: assignment.soldierId,
          assignedRole: assignment.assignedRole,
          createdBy: changedBy,
        })
      }
    }

    await this.history.append(
      'GENERATE_TASK_SCHEDULE', 'TaskSchedule', '',
      changedBy, `Generated task schedule`
    )

    return schedule
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/scheduleService.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/services/scheduleService.ts src/services/scheduleService.test.ts
git commit -m "feat: ScheduleService accepts tasks and config as params, removes repo deps"
```

---

### Task 6: Slim DataService — remove tasks/config/history/versions, inject HistoryService

**Files:**
- Modify: `src/services/dataService.ts`
- Modify: `src/services/dataService.test.ts`

**Context:** `DataService` no longer owns tasks, config, history, or versions. It receives a `HistoryService` (from master) as a constructor param and passes it to all domain services. `taskService` moves to `MasterDataService`.

**Step 1: Write failing tests**

Replace entire `src/services/dataService.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { DataService } from './dataService'
import { HistoryService } from './historyService'

const makeHistory = (): HistoryService => ({
  append: vi.fn().mockResolvedValue(undefined),
  listAll: vi.fn().mockResolvedValue([]),
  getRecent: vi.fn().mockResolvedValue([]),
} as any)

describe('DataService', () => {
  it('creates from access token, spreadsheet id, tabPrefix and history', () => {
    const service = new DataService('access-token', 'sheet-id', '', makeHistory())
    expect(service).toBeDefined()
  })

  it('exposes soldiers repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.soldiers).toBeDefined()
    expect(service.soldiers.list).toBeDefined()
    expect(service.soldiers.create).toBeDefined()
  })

  it('exposes leaveRequests repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveRequests).toBeDefined()
    expect(service.leaveRequests.updateStatus).toBeDefined()
  })

  it('exposes leaveAssignments repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveAssignments).toBeDefined()
    expect(service.leaveAssignments.setLocked).toBeDefined()
  })

  it('exposes taskAssignments repository', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.taskAssignments).toBeDefined()
    expect(service.taskAssignments.listByTask).toBeDefined()
  })

  it('exposes soldierService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.soldierService).toBeDefined()
    expect(service.soldierService.create).toBeDefined()
    expect(service.soldierService.discharge).toBeDefined()
  })

  it('exposes leaveRequestService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.leaveRequestService).toBeDefined()
    expect(service.leaveRequestService.approve).toBeDefined()
  })

  it('exposes scheduleService', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.scheduleService).toBeDefined()
    expect(service.scheduleService.generateLeaveSchedule).toBeDefined()
    expect(service.scheduleService.generateTaskSchedule).toBeDefined()
  })

  it('exposes fairnessUpdate service', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.fairnessUpdate).toBeDefined()
    expect(service.fairnessUpdate.applyTaskAssignment).toBeDefined()
  })

  it('does NOT expose tasks, config, history, or versions', () => {
    const service = new DataService('token', 'id', '', makeHistory()) as any
    expect(service.tasks).toBeUndefined()
    expect(service.config).toBeUndefined()
    expect(service.history).toBeUndefined()
    expect(service.versions).toBeUndefined()
    expect(service.taskService).toBeUndefined()
  })

  it('exposes invalidateAll to clear all caches', () => {
    const service = new DataService('token', 'id', '', makeHistory())
    expect(service.invalidateAll).toBeDefined()
    expect(() => service.invalidateAll()).not.toThrow()
  })

  it('passes tabPrefix to repositories — soldiers list uses prefixed range', async () => {
    const ds = new DataService('token', 'sheet-id', 'Alpha_Company', makeHistory())
    vi.spyOn(ds.sheets, 'getValues').mockResolvedValue([])
    await ds.soldiers.list()
    expect(ds.sheets.getValues).toHaveBeenCalledWith('sheet-id', 'Alpha_Company_Soldiers!A:L')
  })
})
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/services/dataService.test.ts
```
Expected: FAIL.

**Step 3: Implement**

Replace entire `src/services/dataService.ts`:

```typescript
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { SoldierRepository } from './soldierRepository'
import { LeaveRequestRepository } from './leaveRequestRepository'
import { LeaveAssignmentRepository } from './leaveAssignmentRepository'
import { TaskAssignmentRepository } from './taskAssignmentRepository'
import { SoldierService } from './soldierService'
import { LeaveRequestService } from './leaveRequestService'
import { ScheduleService } from './scheduleService'
import { FairnessUpdateService } from './fairnessUpdateService'
import type { HistoryService } from './historyService'

export class DataService {
  readonly sheets: GoogleSheetsService
  readonly soldiers: SoldierRepository
  readonly leaveRequests: LeaveRequestRepository
  readonly leaveAssignments: LeaveAssignmentRepository
  readonly taskAssignments: TaskAssignmentRepository
  readonly soldierService: SoldierService
  readonly leaveRequestService: LeaveRequestService
  readonly scheduleService: ScheduleService
  readonly fairnessUpdate: FairnessUpdateService

  private cache: SheetCache

  constructor(accessToken: string, spreadsheetId: string, tabPrefix = '', history: HistoryService) {
    const sheets = new GoogleSheetsService(accessToken)
    this.sheets = sheets
    this.cache = new SheetCache()

    this.soldiers = new SoldierRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.leaveRequests = new LeaveRequestRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.leaveAssignments = new LeaveAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)
    this.taskAssignments = new TaskAssignmentRepository(sheets, spreadsheetId, this.cache, tabPrefix)

    this.soldierService = new SoldierService(this.soldiers, history)
    this.leaveRequestService = new LeaveRequestService(this.leaveRequests, history)
    this.fairnessUpdate = new FairnessUpdateService(this.soldiers, history)
    this.scheduleService = new ScheduleService(
      this.soldiers,
      this.leaveRequests,
      this.leaveAssignments,
      this.taskAssignments,
      history,
    )
  }

  invalidateAll(): void {
    this.cache.invalidateAll()
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/dataService.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/services/dataService.ts src/services/dataService.test.ts
git commit -m "feat: DataService slim — 4 unit repos only, injects HistoryService from master"
```

---

### Task 7: Delete version machinery

**Files:**
- Delete: `src/services/versionService.ts`
- Delete: `src/services/versionService.test.ts`
- Delete: `src/hooks/useVersionCheck.ts`
- Delete: `src/components/VersionConflictBanner.tsx`
- Delete: `src/components/VersionConflictBanner.test.tsx`

**Context:** Version tracking was an internal concurrency mechanism that the user has asked to remove. Deleting all 5 files and their test references.

**Step 1: Delete files**

```bash
rm src/services/versionService.ts
rm src/services/versionService.test.ts
rm src/hooks/useVersionCheck.ts
rm src/components/VersionConflictBanner.tsx
rm src/components/VersionConflictBanner.test.tsx
```

**Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: Some tests fail/error due to broken imports that reference deleted files. These will be fixed in tasks 8–10.

**Step 3: Commit deletions**

```bash
git add -A
git commit -m "chore: delete VersionService, useVersionCheck, VersionConflictBanner"
```

---

### Task 8: Update useDataService hook

**Files:**
- Modify: `src/hooks/useDataService.ts`

**Context:** The hook no longer loads tasks, configData, or historyEntries from the unit spreadsheet. It now receives `masterDs: MasterDataService` and passes `masterDs.history` to `DataService`. The return type shrinks accordingly.

**Step 1: No failing test needed** — this is wiring; the broken import from Task 7 deletion will cause a TypeScript compile error. After fixing the hook, run the full suite.

**Step 2: Implement**

Replace entire `src/hooks/useDataService.ts`:

```typescript
import { useState, useEffect, useMemo } from 'react'
import { DataService } from '../services/dataService'
import { useAuth } from '../context/AuthContext'
import type { MasterDataService } from '../services/masterDataService'
import type { Soldier, LeaveRequest, TaskAssignment, LeaveAssignment } from '../models'

export interface UseDataServiceResult {
  ds: DataService | null
  soldiers: Soldier[]
  leaveRequests: LeaveRequest[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useDataService(
  spreadsheetId: string,
  tabPrefix = '',
  masterDs: MasterDataService | null,
): UseDataServiceResult {
  const { auth } = useAuth()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([])
  const [leaveAssignments, setLeaveAssignments] = useState<LeaveAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const ds = useMemo(() => {
    if (!auth.accessToken || !spreadsheetId || !masterDs) return null
    return new DataService(auth.accessToken, spreadsheetId, tabPrefix, masterDs.history)
  }, [auth.accessToken, spreadsheetId, tabPrefix, masterDs])

  useEffect(() => {
    if (!ds) return
    setLoading(true)
    setError(null)
    Promise.all([
      ds.soldiers.list(),
      ds.leaveRequests.list(),
      ds.taskAssignments.list(),
      ds.leaveAssignments.list(),
    ])
      .then(([s, lr, ta, la]) => {
        setSoldiers(s)
        setLeaveRequests(lr)
        setTaskAssignments(ta)
        setLeaveAssignments(la)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
  }, [ds, tick])

  const reload = () => setTick(n => n + 1)

  return { ds, soldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload }
}
```

**Step 3: Run full suite**

```bash
npx vitest run
```
Expected: compile errors in App.tsx and App.test.tsx about broken useDataService signature — those are fixed in Task 10. For now this is OK; this step's goal is just the hook itself.

**Step 4: Commit**

```bash
git add src/hooks/useDataService.ts
git commit -m "feat: useDataService takes masterDs, returns 4 per-unit arrays only"
```

---

### Task 9: Update useScheduleGenerator to accept tasks and config as params

**Files:**
- Modify: `src/hooks/useScheduleGenerator.ts`

**Context:** `generateLeaveSchedule` now takes `config` as first param; `generateTaskSchedule` now takes `tasks` as first param.

**Step 1: Implement**

Replace entire `src/hooks/useScheduleGenerator.ts`:

```typescript
import { useState, useCallback } from 'react'
import type { DataService } from '../services/dataService'
import type { ScheduleConflict, Task, AppConfig } from '../models'

export interface UseScheduleGeneratorResult {
  generate: () => void
  loading: boolean
  conflicts: ScheduleConflict[]
  error: Error | null
}

export function useScheduleGenerator(
  ds: DataService | null,
  tasks: Task[],
  config: AppConfig | null,
  startDate: string,
  endDate: string,
): UseScheduleGeneratorResult {
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async () => {
    if (!ds || !config) return
    setLoading(true)
    setError(null)
    try {
      const [leave, task] = await Promise.all([
        ds.scheduleService.generateLeaveSchedule(config, startDate, endDate, 'user'),
        ds.scheduleService.generateTaskSchedule(tasks, 'user'),
      ])
      setConflicts([...leave.conflicts, ...task.conflicts])
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [ds, tasks, config, startDate, endDate])

  return { generate, loading, conflicts, error }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useScheduleGenerator.ts
git commit -m "feat: useScheduleGenerator accepts tasks and config params"
```

---

### Task 10: Wire App.tsx — masterDs to UnitApp, tasks/config from AppContent, remove version

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Context:** `AppContent` loads `tasks` and `configData` from `masterDs` and passes them to `UnitApp` as props. `UnitApp` receives `masterDs` prop for history injection. Version machinery (`useVersionCheck`, `VersionConflictBanner`, `prefixTab` import) all removed. `handleAddTask` removed from UnitApp (admin-only, handled in AdminPanel).

**Step 1: Write failing test additions**

In `src/App.test.tsx`, update `EMPTY_DS_RESULT` to remove `tasks`, `historyEntries`, `configData` fields. Also update `MockMasterDataService` mock to expose tasks and config. Replace the file:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('./context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, useAuth: vi.fn() }
})
vi.mock('./hooks/useDataService')
vi.mock('./hooks/useMissingTabs', () => ({
  useMissingTabs: vi.fn().mockReturnValue({ missing: [], loading: false, error: false }),
}))

const mockResolveRole = vi.fn().mockResolvedValue({
  role: 'commander',
  unitId: 'u1',
  unit: { id: 'u1', name: 'Test Unit', spreadsheetId: 'sheet1', tabPrefix: '', createdAt: '', createdBy: '' },
})

vi.mock('./services/masterDataService', () => {
  class MockMasterDataService {
    initialize = vi.fn().mockResolvedValue(undefined)
    resolveRole = mockResolveRole
    tasks = { list: vi.fn().mockResolvedValue([]) }
    config = { read: vi.fn().mockResolvedValue(null) }
    history = { append: vi.fn() }
    taskService = { create: vi.fn() }
  }
  return { MasterDataService: MockMasterDataService }
})

import { useAuth } from './context/AuthContext'
import { useDataService } from './hooks/useDataService'
import App from './App'

const EMPTY_DS_RESULT = {
  ds: null, soldiers: [], leaveRequests: [],
  taskAssignments: [], leaveAssignments: [],
  loading: false, error: null, reload: vi.fn(),
}

function mockUnauthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    auth: { isAuthenticated: false, accessToken: null, email: null, error: null },
    signIn: vi.fn(), signOut: vi.fn(),
  })
  vi.mocked(useDataService).mockReturnValue(EMPTY_DS_RESULT)
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnauthenticated()
  })

  it('renders ShabTzak title', () => {
    render(<App />)
    expect(screen.getByText('ShabTzak')).toBeInTheDocument()
  })

  it('renders login page with sign-in button when not authenticated', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('shows conflicts on Dashboard after schedule generation', async () => {
    const reload = vi.fn()
    const mockDs = {
      scheduleService: {
        generateLeaveSchedule: vi.fn().mockResolvedValue({
          assignments: [],
          conflicts: [{ type: 'INSUFFICIENT_BASE_PRESENCE', message: 'Not enough soldiers', affectedSoldierIds: [], suggestions: [] }],
        }),
        generateTaskSchedule: vi.fn().mockResolvedValue({ assignments: [], conflicts: [] }),
      },
      fairnessUpdate: { applyLeaveAssignment: vi.fn().mockResolvedValue(undefined) },
    }
    vi.mocked(useAuth).mockReturnValue({
      auth: { isAuthenticated: true, accessToken: 'tok', email: 'commander@test.com', error: null },
      signIn: vi.fn(), signOut: vi.fn(),
    })
    vi.mocked(useDataService).mockReturnValue({ ...EMPTY_DS_RESULT, ds: mockDs as any, reload })
    mockResolveRole.mockResolvedValue({
      role: 'commander',
      unitId: 'u1',
      unit: { id: 'u1', name: 'Test Unit', spreadsheetId: 'sheet1', tabPrefix: '', createdAt: '', createdBy: '' },
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /generate schedule/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(screen.getByText('Not enough soldiers')).toBeInTheDocument())
  })

  it('calls fairnessUpdate.applyLeaveAssignment for new leave assignments after generate', async () => {
    const applyLeaveAssignment = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()
    const mockDs = {
      scheduleService: {
        generateLeaveSchedule: vi.fn().mockResolvedValue({
          assignments: [
            { id: 'la1', soldierId: 's1', leaveType: 'Long', isWeekend: true },
          ],
          conflicts: [],
        }),
        generateTaskSchedule: vi.fn().mockResolvedValue({ assignments: [], conflicts: [] }),
      },
      fairnessUpdate: { applyLeaveAssignment },
    }
    vi.mocked(useAuth).mockReturnValue({
      auth: { isAuthenticated: true, accessToken: 'tok', email: 'commander@test.com', error: null },
      signIn: vi.fn(), signOut: vi.fn(),
    })
    vi.mocked(useDataService).mockReturnValue({ ...EMPTY_DS_RESULT, ds: mockDs as any, reload })
    mockResolveRole.mockResolvedValue({
      role: 'commander',
      unitId: 'u1',
      unit: { id: 'u1', name: 'Test Unit', spreadsheetId: 'sheet1', tabPrefix: '', createdAt: '', createdBy: '' },
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /generate schedule/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(applyLeaveAssignment).toHaveBeenCalledWith('s1', 'Long', true, 'user'))
  })
})
```

**Step 2: Implement**

Replace entire `src/App.tsx`. Key changes:
- `UnitAppProps` adds `masterDs: MasterDataService` and `tasks: Task[]` and `configData: AppConfig | null`; removes nothing else
- `UnitApp`: removes `handleAddTask`, `useVersionCheck`, `VersionConflictBanner`, `prefixTab` usage; calls `useDataService(spreadsheetId, tabPrefix, masterDs)`; passes `tasks` prop to `TasksPage`; `useScheduleGenerator(ds, tasks, configData, today, scheduleEnd)`
- `AppContent`: loads tasks+configData from masterDs; passes them to UnitApp

```typescript
import { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Dashboard from './components/Dashboard'
import SoldiersPage from './components/SoldiersPage'
import LeaveRequestForm from './components/LeaveRequestForm'
import LeaveRequestsPage from './components/LeaveRequestsPage'
import SchedulePage from './components/SchedulePage'
import TasksPage from './components/TasksPage'
import HistoryPage from './components/HistoryPage'
import ToastList from './components/ToastList'
import ErrorBoundary from './components/ErrorBoundary'
import { useDataService } from './hooks/useDataService'
import { useMissingTabs } from './hooks/useMissingTabs'
import { useToast } from './hooks/useToast'
import { useScheduleGenerator } from './hooks/useScheduleGenerator'
import ErrorBanner from './components/ErrorBanner'
import { config } from './config/env'
import { MasterDataService } from './services/masterDataService'
import AccessDeniedPage from './components/AccessDeniedPage'
import LoginPage from './components/LoginPage'
import AdminPanel from './components/AdminPanel'
import type { CreateLeaveRequestInput, CreateSoldierInput, TaskAssignment, Unit, Task, AppConfig } from './models'
import type { SoldierRole } from './constants'

type Section = 'dashboard' | 'soldiers' | 'tasks' | 'leave' | 'schedule' | 'history'

function getHashSection(): Section {
  const hash = window.location.hash
  if (hash === '#soldiers') return 'soldiers'
  if (hash === '#tasks') return 'tasks'
  if (hash === '#leave') return 'leave'
  if (hash === '#schedule') return 'schedule'
  if (hash === '#history') return 'history'
  return 'dashboard'
}

function generateNextDays(n: number): string[] {
  const today = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

interface UnitAppProps {
  spreadsheetId: string
  tabPrefix: string
  unitName: string
  masterDs: MasterDataService
  tasks: Task[]
  configData: AppConfig | null
  onBackToAdmin?: () => void
}

function UnitApp({ spreadsheetId, tabPrefix, unitName, masterDs, tasks, configData, onBackToAdmin }: UnitAppProps) {
  const [section, setSection] = useState<Section>(getHashSection)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const scheduleDates = generateNextDays(30)
  const today = new Date().toISOString().split('T')[0]
  const scheduleEnd = scheduleDates[scheduleDates.length - 1] ?? today

  useEffect(() => {
    const onHashChange = () => setSection(getHashSection())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { missing, loading: tabsLoading, error: tabsError } = useMissingTabs(spreadsheetId, tabPrefix)

  const { ds, soldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload } =
    useDataService(spreadsheetId, tabPrefix, masterDs)
  const { auth } = useAuth()
  const { toasts, addToast, removeToast } = useToast()
  const { generate: runSchedule, conflicts } = useScheduleGenerator(ds, tasks, configData, today, scheduleEnd)

  async function handleDischarge(soldierId: string) {
    try { await ds?.soldierService.discharge(soldierId, 'user'); reload(); addToast('Soldier discharged', 'success') }
    catch { addToast('Failed to discharge soldier', 'error') }
  }

  async function handleAddSoldier(input: CreateSoldierInput) {
    try { await ds?.soldierService.create(input, 'user'); reload(); addToast('Soldier added', 'success') }
    catch { addToast('Failed to add soldier', 'error') }
  }

  async function handleAdjustFairness(soldierId: string, delta: number, reason: string) {
    try { await ds?.fairnessUpdate.applyManualAdjustment(soldierId, delta, reason, 'user'); reload(); addToast('Fairness adjusted', 'success') }
    catch { addToast('Failed to adjust fairness', 'error') }
  }

  async function handleSubmitLeave(input: CreateLeaveRequestInput) {
    try { await ds?.leaveRequestService.submit(input, 'user'); setShowLeaveForm(false); reload(); addToast('Leave request submitted', 'success') }
    catch { addToast('Failed to submit leave request', 'error') }
  }

  async function handleApprove(id: string) {
    try { await ds?.leaveRequestService.approve(id, 'user'); reload(); addToast('Leave request approved', 'success') }
    catch { addToast('Failed to approve leave request', 'error') }
  }

  async function handleDeny(id: string) {
    try { await ds?.leaveRequestService.deny(id, 'user'); reload(); addToast('Leave request denied', 'success') }
    catch { addToast('Failed to deny leave request', 'error') }
  }

  async function handleManualAssign(soldierId: string, taskId: string, role: SoldierRole) {
    try {
      await ds?.taskAssignments.create({ taskId, soldierId, assignedRole: role, createdBy: auth.email ?? 'user' })
      reload()
      addToast('Assignment created', 'success')
    } catch { addToast('Failed to create assignment', 'error') }
  }

  async function handleGenerateSchedule() {
    if (!ds) return
    try {
      await runSchedule()
      const existingIds = new Set(leaveAssignments.map((a: TaskAssignment) => a.id))
      const leaveSchedule = await ds.scheduleService.generateLeaveSchedule(configData!, today, scheduleEnd, 'user')
      for (const assignment of leaveSchedule.assignments) {
        if (!existingIds.has(assignment.id)) {
          await ds.fairnessUpdate.applyLeaveAssignment(
            assignment.soldierId, assignment.leaveType, assignment.isWeekend, 'user'
          )
        }
      }
      reload()
      addToast('Schedule generated', 'success')
    } catch { addToast('Failed to generate schedule', 'error') }
  }

  if (tabsLoading) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Checking spreadsheet…</p>
        </div>
      </AppShell>
    )
  }

  if (tabsError) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="max-w-xl mx-auto py-16 space-y-4">
          <h2 className="text-lg font-semibold text-red-700">Could not verify spreadsheet tabs</h2>
          <p className="text-sm text-gray-600">
            Failed to connect to the spreadsheet. Check your internet connection and reload the page.
          </p>
        </div>
      </AppShell>
    )
  }

  if (missing.length > 0) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="max-w-xl mx-auto py-16 space-y-4">
          <h2 className="text-lg font-semibold text-red-700">Missing spreadsheet tabs</h2>
          <ul className="list-disc list-inside text-sm font-mono text-red-600 space-y-1">
            {missing.map(tab => <li key={tab}>{tab}</li>)}
          </ul>
        </div>
      </AppShell>
    )
  }

  if (loading) {
    return (
      <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading…</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
      <ErrorBanner error={error} onRetry={reload} />
      <ToastList toasts={toasts} onRemove={removeToast} />

      {section === 'dashboard' && (
        <Dashboard
          soldiers={soldiers}
          leaveRequests={leaveRequests}
          taskAssignments={taskAssignments}
          conflicts={conflicts}
          onGenerateSchedule={handleGenerateSchedule}
        />
      )}

      {section === 'soldiers' && (
        <SoldiersPage
          soldiers={soldiers}
          onDischarge={handleDischarge}
          onAddSoldier={handleAddSoldier}
          onAdjustFairness={handleAdjustFairness}
          configData={configData}
          leaveAssignments={leaveAssignments}
        />
      )}

      {section === 'tasks' && (
        <TasksPage tasks={tasks} />
      )}

      {section === 'leave' && (
        showLeaveForm ? (
          <LeaveRequestForm
            soldiers={soldiers}
            onSubmit={handleSubmitLeave}
            onCancel={() => setShowLeaveForm(false)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowLeaveForm(true)}
                className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
              >
                New Request
              </button>
            </div>
            <LeaveRequestsPage
              leaveRequests={leaveRequests}
              soldiers={soldiers}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          </div>
        )
      )}

      {section === 'schedule' && (
        <SchedulePage
          soldiers={soldiers}
          dates={scheduleDates}
          tasks={tasks}
          taskAssignments={taskAssignments}
          leaveAssignments={leaveAssignments}
          conflicts={conflicts}
          onGenerate={handleGenerateSchedule}
          onManualAssign={handleManualAssign}
        />
      )}

      {section === 'history' && (
        <HistoryPage entries={[]} loading={loading} />
      )}

    </AppShell>
  )
}

type AppMode = 'loading' | 'admin' | 'unit' | 'denied'

function AppContent() {
  const { auth } = useAuth()
  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [masterDs, setMasterDs] = useState<MasterDataService | null>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [configData, setConfigData] = useState<AppConfig | null>(null)

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.email || !auth.accessToken) {
      setAppMode('loading')
      return
    }
    const master = new MasterDataService(auth.accessToken, config.spreadsheetId)
    setMasterDs(master)
    master.initialize(config.adminEmail)
      .then(() => Promise.all([
        master.resolveRole(auth.email!),
        master.tasks.list(),
        master.config.read(),
      ]))
      .then(([resolved, t, c]) => {
        setTasks(t)
        setConfigData(c)
        if (!resolved) { setAppMode('denied'); return }
        if (resolved.role === 'admin') { setAppMode('admin') }
        if (resolved.role === 'commander') {
          setActiveUnit(resolved.unit)
          setAppMode('unit')
        }
      })
      .catch(() => setAppMode('denied'))
  }, [auth.isAuthenticated, auth.email, auth.accessToken])

  if (!auth.isAuthenticated) return <LoginPage />
  if (appMode === 'loading') return (
    <div className="min-h-screen bg-olive-50 flex items-center justify-center">
      <p className="text-olive-500">Loading…</p>
    </div>
  )
  if (appMode === 'denied') return <AccessDeniedPage />
  if (appMode === 'admin' && !activeUnit) {
    return (
      <AdminPanel
        masterDs={masterDs!}
        currentAdminEmail={auth.email!}
        onEnterUnit={(unit) => { setActiveUnit(unit) }}
      />
    )
  }

  const isAdmin = appMode === 'admin'

  return (
    <UnitApp
      spreadsheetId={activeUnit?.spreadsheetId ?? ''}
      tabPrefix={activeUnit?.tabPrefix ?? ''}
      unitName={activeUnit?.name ?? ''}
      masterDs={masterDs!}
      tasks={tasks}
      configData={configData}
      onBackToAdmin={isAdmin ? () => { setActiveUnit(null); setAppMode('admin') } : undefined}
    />
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

**Note:** `HistoryPage` now receives `entries={[]}` — history is in the admin spreadsheet, not loaded in UnitApp. This is intentional; if history viewing by commanders is desired, it can be added later.

**Step 3: Run tests**

```bash
npx vitest run src/App.test.tsx
```
Expected: all PASS.

**Step 4: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass (or only tests for deleted components fail, which were already deleted in Task 7).

**Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: App.tsx — masterDs/tasks/config flow through AppContent to UnitApp, remove version"
```

---

### Task 11: Update AdminPanel — add Tasks and Config tabs

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Modify: `src/components/AdminPanel.test.tsx`

**Context:** AdminPanel gains two new tabs: `Tasks` (list/add/remove tasks using `masterDs.taskService` and `masterDs.tasks`) and `Config` (view/edit global config using `masterDs.config`). The mock in AdminPanel.test.tsx must add `tasks`, `config`, and `taskService`.

**Step 1: Write failing tests**

Add to `src/components/AdminPanel.test.tsx`. Update `mockMasterDs` to add:

```typescript
tasks: {
  list: vi.fn().mockResolvedValue([
    { id: 't1', taskType: 'Guard', startTime: '06:00', endTime: '14:00', durationHours: 8, roleRequirements: [], minRestAfter: 6, isSpecial: false }
  ]),
},
config: {
  read: vi.fn().mockResolvedValue({ leaveRatioDaysInBase: 10, leaveRatioDaysHome: 4 }),
  write: vi.fn().mockResolvedValue(undefined),
},
taskService: {
  create: vi.fn().mockResolvedValue({ id: 't2', taskType: 'Patrol' }),
},
```

Add tests:
```typescript
it('renders five tabs including Tasks and Config', async () => {
  render(<AdminPanel {...BASE_PROPS} />)
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^tasks$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^config$/i })).toBeInTheDocument()
  })
})

it('shows task list when Tasks tab clicked', async () => {
  render(<AdminPanel {...BASE_PROPS} />)
  await waitFor(() => screen.getByRole('button', { name: /^tasks$/i }))
  fireEvent.click(screen.getByRole('button', { name: /^tasks$/i }))
  await waitFor(() => {
    expect(screen.getByText('Guard')).toBeInTheDocument()
  })
})

it('shows config values when Config tab clicked', async () => {
  render(<AdminPanel {...BASE_PROPS} />)
  await waitFor(() => screen.getByRole('button', { name: /^config$/i }))
  fireEvent.click(screen.getByRole('button', { name: /^config$/i }))
  await waitFor(() => {
    expect(screen.getByText(/leaveRatioDaysInBase/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run to verify failures**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```
Expected: FAIL on new tests (no Tasks/Config tabs).

**Step 3: Implement**

Update `src/components/AdminPanel.tsx`. Change `AdminTab` type to `'admins' | 'units' | 'commanders' | 'tasks' | 'config'`. Add tasks and config state and handlers. Add Tasks tab UI (reuse TasksPage component with `onAddTask` wired to `masterDs.taskService.create`). Add Config tab UI showing key-value pairs.

```typescript
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import type { MasterDataService } from '../services/masterDataService'
import type { Admin, Unit, Commander, Task, AppConfig } from '../models'
import { deriveTabPrefix } from '../utils/tabPrefix'
import TasksPage from './TasksPage'
import type { CreateTaskInput } from '../models'

type AdminTab = 'admins' | 'units' | 'commanders' | 'tasks' | 'config'

interface AdminPanelProps {
  masterDs: MasterDataService
  currentAdminEmail: string
  onEnterUnit: (unit: Unit) => void
}

export default function AdminPanel({ masterDs, currentAdminEmail, onEnterUnit }: AdminPanelProps) {
  const { signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('admins')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [commanders, setCommanders] = useState<Commander[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [configData, setConfigData] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitSheetId, setNewUnitSheetId] = useState('')
  const [newCmdEmail, setNewCmdEmail] = useState('')
  const [newCmdUnitId, setNewCmdUnitId] = useState('')

  async function reload() {
    setLoading(true)
    const [a, u, c, t, cfg] = await Promise.all([
      masterDs.admins.list(),
      masterDs.units.list(),
      masterDs.commanders.list(),
      masterDs.tasks.list(),
      masterDs.config.read(),
    ])
    setAdmins(a); setUnits(u); setCommanders(c); setTasks(t); setConfigData(cfg)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function handleAddAdmin() {
    if (!newAdminEmail) return
    setError(null)
    try {
      await masterDs.admins.create({ email: newAdminEmail }, currentAdminEmail)
      setNewAdminEmail('')
      await reload()
    } catch { setError('Failed to add admin') }
  }

  async function handleRemoveAdmin(id: string) {
    setError(null)
    try { await masterDs.admins.remove(id); await reload() }
    catch { setError('Failed to remove admin') }
  }

  async function handleAddUnit() {
    if (!newUnitName || !newUnitSheetId) return
    setError(null)
    try {
      await masterDs.units.create({ name: newUnitName, spreadsheetId: newUnitSheetId, tabPrefix: deriveTabPrefix(newUnitName) }, currentAdminEmail)
      setNewUnitName(''); setNewUnitSheetId('')
      await reload()
    } catch { setError('Failed to add unit') }
  }

  async function handleRemoveUnit(id: string) {
    setError(null)
    try { await masterDs.units.remove(id); await reload() }
    catch { setError('Failed to remove unit') }
  }

  async function handleAddCommander() {
    if (!newCmdEmail || !newCmdUnitId) return
    setError(null)
    try {
      await masterDs.commanders.create({ email: newCmdEmail, unitId: newCmdUnitId }, currentAdminEmail)
      setNewCmdEmail(''); setNewCmdUnitId('')
      await reload()
    } catch { setError('Failed to add commander') }
  }

  async function handleRemoveCommander(id: string) {
    setError(null)
    try { await masterDs.commanders.remove(id); await reload() }
    catch { setError('Failed to remove commander') }
  }

  async function handleAddTask(input: CreateTaskInput) {
    setError(null)
    try {
      await masterDs.taskService.create(input, currentAdminEmail)
      await reload()
    } catch { setError('Failed to add task') }
  }

  const derivedPrefix = deriveTabPrefix(newUnitName)

  const tabClass = (tab: AdminTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-olive-700 text-white'
        : 'text-olive-600 hover:bg-olive-100'
    }`

  return (
    <div className="min-h-screen bg-olive-50">
      <header className="bg-white border-b-2 border-olive-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo-unit.jpg`} alt="זאבי הגבעה" className="h-8 w-8 object-contain rounded" />
            <span className="text-xl font-bold text-olive-800">ShabTzak</span>
            <span className="text-sm text-olive-500 border-l border-olive-200 pl-3">Admin Panel</span>
          </div>
          <button onClick={signOut} className="text-sm text-olive-500 hover:text-red-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex gap-2 flex-wrap">
          <button className={tabClass('admins')} onClick={() => setActiveTab('admins')}>Admins</button>
          <button className={tabClass('units')} onClick={() => setActiveTab('units')}>Units</button>
          <button className={tabClass('commanders')} onClick={() => setActiveTab('commanders')}>Commanders</button>
          <button className={tabClass('tasks')} onClick={() => setActiveTab('tasks')}>Tasks</button>
          <button className={tabClass('config')} onClick={() => setActiveTab('config')}>Config</button>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <p className="text-olive-500">Loading…</p>}

        {!loading && activeTab === 'admins' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Admins</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Email</th><th className="text-left p-2">Added At</th><th className="text-left p-2 rounded-tr">Action</th></tr></thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} className="border-b border-olive-100">
                    <td className="p-2">{a.email}</td>
                    <td className="p-2 text-olive-500">{a.addedAt ? new Date(a.addedAt).toLocaleDateString() : ''}</td>
                    <td className="p-2">
                      <button
                        onClick={() => handleRemoveAdmin(a.id)}
                        disabled={a.email === currentAdminEmail}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
                placeholder="admin@example.com" className="flex-1 border border-olive-200 rounded px-2 py-1 text-sm" />
              <button onClick={handleAddAdmin} className="px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Admin</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'units' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Units</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Name</th><th className="text-left p-2">Spreadsheet</th><th className="text-left p-2 rounded-tr">Actions</th></tr></thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id} className="border-b border-olive-100">
                    <td className="p-2 font-medium">{u.name}</td>
                    <td className="p-2">
                      <a href={`https://docs.google.com/spreadsheets/d/${u.spreadsheetId}`} target="_blank" rel="noopener noreferrer"
                        className="text-olive-600 hover:underline text-xs">Open ↗</a>
                    </td>
                    <td className="p-2 flex gap-2">
                      <button onClick={() => onEnterUnit(u)} className="text-xs px-2 py-1 bg-olive-700 text-white rounded hover:bg-olive-800">Enter Unit</button>
                      <button onClick={() => handleRemoveUnit(u.id)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          </div>
        )}

        {!loading && activeTab === 'commanders' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Commanders</h2>
            <table className="w-full text-sm">
              <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Email</th><th className="text-left p-2">Unit</th><th className="text-left p-2 rounded-tr">Action</th></tr></thead>
              <tbody>
                {commanders.map(c => {
                  const unitName = units.find(u => u.id === c.unitId)?.name ?? c.unitId
                  return (
                    <tr key={c.id} className="border-b border-olive-100">
                      <td className="p-2">{c.email}</td>
                      <td className="p-2 text-olive-500">{unitName}</td>
                      <td className="p-2">
                        <button onClick={() => handleRemoveCommander(c.id)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-2">
              <input value={newCmdEmail} onChange={e => setNewCmdEmail(e.target.value)}
                placeholder="commander@example.com" className="border border-olive-200 rounded px-2 py-1 text-sm" />
              <select value={newCmdUnitId} onChange={e => setNewCmdUnitId(e.target.value)}
                className="border border-olive-200 rounded px-2 py-1 text-sm">
                <option value="">Select unit...</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button onClick={handleAddCommander} className="col-span-2 px-3 py-1 bg-olive-700 text-white text-sm rounded hover:bg-olive-800">Add Commander</button>
            </div>
          </div>
        )}

        {!loading && activeTab === 'tasks' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4">
            <h2 className="font-semibold text-olive-800 mb-4">Tasks</h2>
            <TasksPage tasks={tasks} onAddTask={handleAddTask} />
          </div>
        )}

        {!loading && activeTab === 'config' && (
          <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-olive-800">Config</h2>
            {configData ? (
              <table className="w-full text-sm">
                <thead><tr className="bg-olive-700 text-white"><th className="text-left p-2 rounded-tl">Key</th><th className="text-left p-2 rounded-tr">Value</th></tr></thead>
                <tbody>
                  {Object.entries(configData).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
                    <tr key={k} className="border-b border-olive-100">
                      <td className="p-2 font-mono text-xs">{k}</td>
                      <td className="p-2 text-olive-600">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-olive-500">No config found. Default values are in use.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.test.tsx
git commit -m "feat: AdminPanel gains Tasks and Config tabs backed by masterDs"
```

---

### Task 12: TasksPage — make onAddTask optional (read-only for commanders)

**Files:**
- Modify: `src/components/TasksPage.tsx`
- Modify: `src/components/TasksPage.test.tsx`

**Context:** `TasksPage` is used in two places: AdminPanel (with `onAddTask`) and UnitApp (without — read-only). Making `onAddTask` optional hides the Add Task button when absent.

**Step 1: Write failing test**

In `src/components/TasksPage.test.tsx`, add:

```typescript
it('hides Add Task button when onAddTask is not provided', () => {
  render(<TasksPage tasks={TASKS} />)
  expect(screen.queryByRole('button', { name: /add task/i })).not.toBeInTheDocument()
})
```

**Step 2: Run to verify failure**

```bash
npx vitest run src/components/TasksPage.test.tsx
```
Expected: FAIL (button always shown).

**Step 3: Implement**

In `src/components/TasksPage.tsx`, change the interface and guard the button:

```typescript
interface TasksPageProps {
  tasks: Task[]
  onAddTask?: (input: CreateTaskInput) => void   // optional
  loading?: boolean
}
```

In the JSX, change the Add Task button section:
```tsx
<div className="flex items-center justify-between">
  <h2 className="text-xl font-semibold text-olive-800">Tasks</h2>
  {onAddTask && (
    <button
      onClick={() => setShowForm(s => !s)}
      className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
    >
      Add Task
    </button>
  )}
</div>
```

Also guard the form render:
```tsx
{onAddTask && showForm && (
  <form onSubmit={handleSubmit} ...>
    ...
    <button type="submit" ...>Add</button>
  </form>
)}
```

And `handleSubmit` calls `onAddTask?.(input)` → change to guard: `if (onAddTask) { onAddTask(input) }`.

**Step 4: Run tests**

```bash
npx vitest run src/components/TasksPage.test.tsx
```
Expected: all PASS.

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/components/TasksPage.tsx src/components/TasksPage.test.tsx
git commit -m "feat: TasksPage onAddTask optional — hides Add Task button for commanders"
```

---

## Final Verification

```bash
npx vitest run
npm run build
```

Both must succeed. Then push:
```bash
git push origin main
```
