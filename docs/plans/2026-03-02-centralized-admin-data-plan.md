# Centralized Admin Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Tasks, Config, and History from per-unit spreadsheets to the shared admin spreadsheet; reduce per-unit tabs from 8 to 4; auto-create missing unit tabs; remove all versioning machinery.

**Architecture:** `MasterDataService` gains `tasks`, `config`, `history`, `taskService`. `DataService` is slimmed to 4 per-unit repositories and injects `HistoryService` from master. `ScheduleService` receives tasks and config as method params instead of repository references. Commanders see tasks read-only; admins create/delete tasks in AdminPanel.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, Google Sheets API v4

---

## Context

Design doc: `docs/plans/2026-03-02-centralized-admin-data-design.md`

Run tests: `npx vitest run` — all tests must stay green after every task.

---

### Task 1: Reshape SHEET_TABS and MASTER_SHEET_TABS constants

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/constants/index.test.ts`

**Step 1: Add failing tests** to `src/constants/index.test.ts` (add to imports: `SHEET_TABS, MASTER_SHEET_TABS`):

```typescript
it('SHEET_TABS has exactly 4 unit-only tabs', () => {
  expect(Object.values(SHEET_TABS)).toHaveLength(4)
  expect(Object.keys(SHEET_TABS)).not.toContain('TASKS')
  expect(Object.keys(SHEET_TABS)).not.toContain('VERSION')
})
it('MASTER_SHEET_TABS includes Tasks, Config, History', () => {
  expect(MASTER_SHEET_TABS).toHaveProperty('TASKS', 'Tasks')
  expect(MASTER_SHEET_TABS).toHaveProperty('CONFIG', 'Config')
  expect(MASTER_SHEET_TABS).toHaveProperty('HISTORY', 'History')
})
```

**Step 2: Run** `npx vitest run src/constants/index.test.ts` — expect 2 FAIL.

**Step 3: Implement** — replace the two constant blocks in `src/constants/index.ts`:

```typescript
export const SHEET_TABS = {
  SOLDIERS: 'Soldiers',
  TASK_SCHEDULE: 'TaskSchedule',
  LEAVE_REQUESTS: 'LeaveRequests',
  LEAVE_SCHEDULE: 'LeaveSchedule',
} as const

export const MASTER_SHEET_TABS = {
  ADMINS: 'Admins',
  UNITS: 'Units',
  COMMANDERS: 'Commanders',
  TASKS: 'Tasks',
  CONFIG: 'Config',
  HISTORY: 'History',
} as const
```

**Step 4: Run** `npx vitest run src/constants/index.test.ts` — expect all PASS.

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

**Step 1: Update failing test** — in `setupService.test.ts`, the test `'creates only missing tabs and writes their headers'` currently expects `6` (8−2). Change it to expect `3` (4−1). Also replace the VERSION reference with `TASK_SCHEDULE`:

```typescript
// was: expect(requests.length).toBe(6) and expect(updateSpy).toHaveBeenCalledTimes(6)
expect(requests.length).toBe(3)
expect(updateSpy).toHaveBeenCalledTimes(3)
```

Also update the `'marks missing tabs as not existing'` test to replace `SHEET_TABS.VERSION` with `SHEET_TABS.TASK_SCHEDULE`.

**Step 2: Run** `npx vitest run src/services/setupService.test.ts` — expect failures.

**Step 3: Implement** — in `src/services/setupService.ts`, replace `TAB_HEADERS` to keep only 4 entries:

```typescript
const TAB_HEADERS: Record<string, string[][]> = {
  [SHEET_TABS.SOLDIERS]: [['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount']],
  [SHEET_TABS.TASK_SCHEDULE]: [['ScheduleID', 'TaskID', 'SoldierID', 'AssignedRole', 'IsLocked', 'CreatedAt', 'CreatedBy']],
  [SHEET_TABS.LEAVE_REQUESTS]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'ConstraintType', 'Priority', 'Status']],
  [SHEET_TABS.LEAVE_SCHEDULE]: [['ID', 'SoldierID', 'StartDate', 'EndDate', 'LeaveType', 'IsWeekend', 'IsLocked', 'RequestID', 'CreatedAt']],
}
```

`prefixedTabs()` and `checkTabs()`/`initializeMissingTabs()` bodies are unchanged — they already iterate `Object.values(SHEET_TABS)`.

**Step 4: Run** `npx vitest run src/services/setupService.test.ts` — expect all PASS.

**Step 5: Commit**
```bash
git add src/services/setupService.ts src/services/setupService.test.ts
git commit -m "feat: SetupService handles 4 unit tabs only"
```

---

### Task 3: Auto-create missing unit tabs in useMissingTabs

**Files:**
- Modify: `src/hooks/useMissingTabs.ts`
- Modify: `src/hooks/useMissingTabs.test.ts`

**Step 1: Update test** — in `useMissingTabs.test.ts`, the mock currently exposes `checkTabs`. Change it to expose `initializeMissingTabs` instead, and update all three tests to use `initializeMissingTabs`:

```typescript
// In the SetupService mock, replace checkTabs with:
initializeMissingTabs: vi.fn().mockResolvedValue([])

// Test: 'returns missing tab names' → rename to 'returns empty missing on success'
// and remove the assertion about 'Alpha_Company_Soldiers' since auto-create means missing=[]

// Test: 'returns error: true when checkTabs throws' → rename reference to initializeMissingTabs
```

**Step 2: Run** `npx vitest run src/hooks/useMissingTabs.test.ts` — expect failures.

**Step 3: Implement** — in `src/hooks/useMissingTabs.ts`, change `setup.checkTabs()` to `setup.initializeMissingTabs()` and on success always `setMissing([])`:

```typescript
setup.initializeMissingTabs()
  .then(() => {
    setMissing([])
    setLoading(false)
  })
  .catch(() => {
    setError(true)
    setLoading(false)
  })
```

**Step 4: Run** `npx vitest run src/hooks/useMissingTabs.test.ts` — expect all PASS.

**Step 5: Commit**
```bash
git add src/hooks/useMissingTabs.ts src/hooks/useMissingTabs.test.ts
git commit -m "feat: useMissingTabs auto-creates missing unit tabs"
```

---

### Task 4: Add tasks/config/history/taskService to MasterDataService

**Files:**
- Modify: `src/services/masterDataService.ts`
- Modify: `src/services/masterDataService.test.ts`

**Step 1: Add failing tests** — add to `masterDataService.test.ts`. Add mocks at top: `vi.mock('./taskRepository')`, `vi.mock('./configRepository')`, `vi.mock('./historyService')`, `vi.mock('./taskService')`. Add imports and a new describe block:

```typescript
describe('admin repositories', () => {
  it('exposes tasks, config, history, taskService', () => {
    const svc = new MasterDataService('token', 'master-id')
    expect(svc.tasks).toBeDefined()
    expect(svc.config).toBeDefined()
    expect(svc.history).toBeDefined()
    expect(svc.taskService).toBeDefined()
  })
})
```

Also update the existing `'creates missing tabs when some are absent'` test to include Tasks, Config, History in the `arrayContaining`.

**Step 2: Run** `npx vitest run src/services/masterDataService.test.ts` — expect failures.

**Step 3: Implement** — update `src/services/masterDataService.ts`:

Add imports: `TaskRepository`, `ConfigRepository`, `HistoryService`, `TaskService`.

Add constant for admin tab headers:
```typescript
const ADMIN_TAB_HEADERS: Record<string, string[][]> = {
  [MASTER_SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [MASTER_SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [MASTER_SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
}
```

Add to class:
```typescript
readonly tasks: TaskRepository
readonly config: ConfigRepository
readonly history: HistoryService
readonly taskService: TaskService
```

Add to constructor (after existing repos):
```typescript
this.tasks = new TaskRepository(this.sheets, spreadsheetId, cache)
this.config = new ConfigRepository(this.sheets, spreadsheetId)
this.history = new HistoryService(this.sheets, spreadsheetId)
this.taskService = new TaskService(this.tasks, this.history)
```

In `initialize()`, after `batchUpdate`, add header writing:
```typescript
for (const tabName of missing) {
  const headers = ADMIN_TAB_HEADERS[tabName]
  if (headers) {
    await this.sheets.updateValues(this.spreadsheetId, `${tabName}!A1`, headers)
  }
}
```

**Step 4: Run** `npx vitest run src/services/masterDataService.test.ts` — expect all PASS.

**Step 5: Commit**
```bash
git add src/services/masterDataService.ts src/services/masterDataService.test.ts
git commit -m "feat: MasterDataService gains tasks, config, history, taskService"
```

---

### Task 5: Update ScheduleService to accept tasks and config as params

**Files:**
- Modify: `src/services/scheduleService.ts`
- Modify: `src/services/scheduleService.test.ts`

**Step 1: Update tests** — in `scheduleService.test.ts`:

Remove `mockTasks` and `mockConfig` variables. Change the `ScheduleService` constructor call to remove those two args:
```typescript
service = new ScheduleService(
  mockSoldiers as any,
  mockLeaveRequests as any,
  mockLeaveAssignments as any,
  mockTaskAssignments as any,
  mockHistory as any,
)
```

Change method call signatures:
- `generateLeaveSchedule(CONFIG, '2026-03-01', '2026-03-31', 'admin')` — add `CONFIG` as first arg (define a `CONFIG` const at top of file using the same values currently in `mockConfig.read`'s return value)
- `generateTaskSchedule([TASK], 'admin')` — pass tasks array as first arg

**Step 2: Run** `npx vitest run src/services/scheduleService.test.ts` — expect failures.

**Step 3: Implement** — in `src/services/scheduleService.ts`:

Remove `TaskRepository` and `ConfigRepository` imports and constructor params. Change constructor to:
```typescript
constructor(
  private soldiers: SoldierRepository,
  private leaveRequests: LeaveRequestRepository,
  private leaveAssignments: LeaveAssignmentRepository,
  private taskAssignments: TaskAssignmentRepository,
  private history: HistoryService,
) {}
```

Change `generateLeaveSchedule` signature to:
```typescript
async generateLeaveSchedule(config: AppConfig, scheduleStart: string, scheduleEnd: string, changedBy: string)
```
Remove the `this.config.read()` call — use the passed-in `config` directly.

Change `generateTaskSchedule` signature to:
```typescript
async generateTaskSchedule(tasks: Task[], changedBy: string)
```
Remove the `this.tasks.list()` call — use the passed-in `tasks` directly.

Add `Task` and `AppConfig` to the model imports.

**Step 4: Run** `npx vitest run src/services/scheduleService.test.ts` — expect all PASS.

**Step 5: Commit**
```bash
git add src/services/scheduleService.ts src/services/scheduleService.test.ts
git commit -m "feat: ScheduleService accepts tasks and config as params"
```

---

### Task 6: Slim DataService — remove tasks/config/history/versions, inject HistoryService

**Files:**
- Modify: `src/services/dataService.ts`
- Modify: `src/services/dataService.test.ts`

**Step 1: Update tests** — in `dataService.test.ts`:

Add a `makeHistory()` helper:
```typescript
const makeHistory = () => ({
  append: vi.fn(), listAll: vi.fn(), getRecent: vi.fn(),
} as any)
```

Update all `new DataService('token', 'id')` calls to `new DataService('token', 'id', '', makeHistory())`.

Remove the tests for `tasks`, `config`, `history`, `versions`, `taskService`. Add one test:
```typescript
it('does not expose tasks, config, history, versions', () => {
  const svc = new DataService('token', 'id', '', makeHistory()) as any
  expect(svc.tasks).toBeUndefined()
  expect(svc.versions).toBeUndefined()
})
```

**Step 2: Run** `npx vitest run src/services/dataService.test.ts` — expect failures.

**Step 3: Implement** — rewrite `src/services/dataService.ts`:

Remove imports: `TaskRepository`, `ConfigRepository`, `HistoryService`, `VersionService`, `TaskService`.
Remove fields: `tasks`, `config`, `history`, `versions`, `taskService`.
Add `history: HistoryService` as 4th constructor param (import type only).
Update `ScheduleService` constructor call to remove the `this.tasks` and `this.config` args, passing `history` instead.
Pass `history` to `SoldierService`, `LeaveRequestService`, `FairnessUpdateService`.

**Step 4: Run** `npx vitest run src/services/dataService.test.ts` — expect all PASS.

**Step 5: Commit**
```bash
git add src/services/dataService.ts src/services/dataService.test.ts
git commit -m "feat: DataService slim — 4 unit repos, injects HistoryService from master"
```

---

### Task 7: Delete version machinery

**Files to delete:**
- `src/services/versionService.ts` + `src/services/versionService.test.ts`
- `src/hooks/useVersionCheck.ts`
- `src/components/VersionConflictBanner.tsx` + `src/components/VersionConflictBanner.test.tsx`

**Step 1: Delete**
```bash
rm src/services/versionService.ts src/services/versionService.test.ts
rm src/hooks/useVersionCheck.ts
rm src/components/VersionConflictBanner.tsx src/components/VersionConflictBanner.test.tsx
```

**Step 2: Commit**
```bash
git add -A
git commit -m "chore: delete VersionService, useVersionCheck, VersionConflictBanner"
```

---

### Task 8: Update useDataService hook

**Files:**
- Modify: `src/hooks/useDataService.ts`

**Step 1: Implement** — replace the file. Key changes:
- Signature: `useDataService(spreadsheetId: string, tabPrefix = '', masterDs: MasterDataService | null)`
- `DataService` constructed as: `new DataService(auth.accessToken, spreadsheetId, tabPrefix, masterDs.history)`
- `useMemo` deps includes `masterDs`; guard: `if (!masterDs) return null`
- Remove from state/fetch: `tasks`, `historyEntries`, `configData`
- Remove from `Promise.all`: `ds.tasks.list()`, `ds.history.listAll()`, `ds.config.read()`
- Return type loses `tasks`, `historyEntries`, `configData`

**Step 2: Commit**
```bash
git add src/hooks/useDataService.ts
git commit -m "feat: useDataService takes masterDs, returns 4 per-unit arrays only"
```

---

### Task 9: Update useScheduleGenerator hook

**Files:**
- Modify: `src/hooks/useScheduleGenerator.ts`

**Step 1: Implement** — replace the file. Key changes:
- New signature: `useScheduleGenerator(ds, tasks: Task[], config: AppConfig | null, startDate, endDate)`
- Guard: `if (!ds || !config) return`
- Call `ds.scheduleService.generateLeaveSchedule(config, startDate, endDate, 'user')`
- Call `ds.scheduleService.generateTaskSchedule(tasks, 'user')`

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

**Step 1: Update App.test.tsx** — make these targeted changes:

1. Update `EMPTY_DS_RESULT` — remove `tasks`, `historyEntries`, `configData` fields.
2. Update `MockMasterDataService` mock — add:
```typescript
tasks = { list: vi.fn().mockResolvedValue([]) }
config = { read: vi.fn().mockResolvedValue(null) }
history = { append: vi.fn() }
taskService = { create: vi.fn() }
```
3. The `mockResolveRole` response needs `tabPrefix: ''` added to the unit object.
4. In the two integration tests, update `mockDs.scheduleService.generateLeaveSchedule` calls — they now receive `config` as first arg (the mock just needs to `.mockResolvedValue(...)` regardless of args, so no change needed there).

**Step 2: Run** `npx vitest run src/App.test.tsx` — expect failures.

**Step 3: Implement App.tsx** — key changes:

`UnitAppProps` — add: `masterDs: MasterDataService`, `tasks: Task[]`, `configData: AppConfig | null`. Remove nothing.

`UnitApp` body:
- Remove: `import { useVersionCheck }`, `import VersionConflictBanner`, `import { prefixTab }`
- Remove: `const { isStale } = useVersionCheck(...)`
- Change: `useDataService(spreadsheetId, tabPrefix, masterDs)`
- Change: `useScheduleGenerator(ds, tasks, configData, today, scheduleEnd)`
- Remove: `handleAddTask` function
- Remove: `<VersionConflictBanner .../>` from JSX
- Change tasks section: `<TasksPage tasks={tasks} />` (no `onAddTask`)
- Change history section: `<HistoryPage entries={[]} loading={loading} />`
- In `handleGenerateSchedule`: change `ds.scheduleService.generateLeaveSchedule(configData!, today, scheduleEnd, 'user')` (config first arg)

`AppContent` — add state: `tasks: Task[]`, `configData: AppConfig | null`. Load them in the `useEffect` via `master.tasks.list()` and `master.config.read()`. Pass `masterDs={masterDs!}`, `tasks={tasks}`, `configData={configData}` to `<UnitApp>`.

**Step 4: Run** `npx vitest run src/App.test.tsx` — expect all PASS.

**Step 5: Run full suite** `npx vitest run` — expect all PASS.

**Step 6: Commit**
```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: App.tsx wires masterDs/tasks/config to UnitApp, removes version machinery"
```

---

### Task 11: AdminPanel — add Tasks and Config tabs

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Modify: `src/components/AdminPanel.test.tsx`

**Step 1: Add failing tests** — add to `mockMasterDs`:
```typescript
tasks: { list: vi.fn().mockResolvedValue([
  { id: 't1', taskType: 'Guard', startTime: '06:00', endTime: '', durationHours: 8, roleRequirements: [], minRestAfter: 6, isSpecial: false }
]) },
config: { read: vi.fn().mockResolvedValue({ leaveRatioDaysInBase: 10 }) },
taskService: { create: vi.fn().mockResolvedValue({}) },
```

Add tests:
```typescript
it('renders Tasks and Config tab buttons', async () => {
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
  await waitFor(() => expect(screen.getByText('Guard')).toBeInTheDocument())
})
it('shows config when Config tab clicked', async () => {
  render(<AdminPanel {...BASE_PROPS} />)
  await waitFor(() => screen.getByRole('button', { name: /^config$/i }))
  fireEvent.click(screen.getByRole('button', { name: /^config$/i }))
  await waitFor(() => expect(screen.getByText('leaveRatioDaysInBase')).toBeInTheDocument())
})
```

**Step 2: Run** `npx vitest run src/components/AdminPanel.test.tsx` — expect failures.

**Step 3: Implement** — update `AdminPanel.tsx`:

- `AdminTab` type: add `'tasks' | 'config'`
- Add `tasks: Task[]` and `configData: AppConfig | null` state
- Add `handleAddTask` that calls `masterDs.taskService.create(input, currentAdminEmail)`
- `reload()` also loads `masterDs.tasks.list()` and `masterDs.config.read()`
- Add tab buttons for Tasks and Config
- Add Tasks panel: renders `<TasksPage tasks={tasks} onAddTask={handleAddTask} />`
- Add Config panel: renders a table of `Object.entries(configData).filter(([,v]) => typeof v !== 'object')`
- Import `TasksPage` and `CreateTaskInput`

**Step 4: Run** `npx vitest run src/components/AdminPanel.test.tsx` — expect all PASS.

**Step 5: Commit**
```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.test.tsx
git commit -m "feat: AdminPanel gains Tasks and Config tabs"
```

---

### Task 12: TasksPage — make onAddTask optional

**Files:**
- Modify: `src/components/TasksPage.tsx`
- Modify: `src/components/TasksPage.test.tsx`

**Step 1: Add failing test**:
```typescript
it('hides Add Task button when onAddTask is not provided', () => {
  render(<TasksPage tasks={TASKS} />)
  expect(screen.queryByRole('button', { name: /add task/i })).not.toBeInTheDocument()
})
```

**Step 2: Run** `npx vitest run src/components/TasksPage.test.tsx` — expect 1 FAIL.

**Step 3: Implement** — in `TasksPage.tsx`:
- `onAddTask?: (input: CreateTaskInput) => void` (make optional)
- Wrap Add Task button in `{onAddTask && <button...>}`
- Wrap form in `{onAddTask && showForm && <form...>}`
- In `handleSubmit`: call `onAddTask?.(input)`

**Step 4: Run** `npx vitest run src/components/TasksPage.test.tsx` — expect all PASS.

**Step 5: Run full suite and build**
```bash
npx vitest run && npm run build
```
Both must succeed.

**Step 6: Commit and push**
```bash
git add src/components/TasksPage.tsx src/components/TasksPage.test.tsx
git commit -m "feat: TasksPage onAddTask optional — read-only for commanders"
git push origin main
```
