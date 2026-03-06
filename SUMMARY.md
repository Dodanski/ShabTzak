# ShabTzak — Project Summary

> **For the next agent.** Read this before touching any code. Current state is clean: 510 tests passing, build clean, pushed to `origin/main`.

---

## What This App Does

Shabbat shift-scheduling web app for IDF units. Admins manage units, commanders, and task definitions. Commanders manage soldiers, leave requests, and generate duty schedules.

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Vitest, Google Sheets as the database.
**Deploy:** `npm run deploy` → GitHub Pages (the user runs this).
**Auth:** Google OAuth (access token in `AuthContext`).

---

## Architecture

### Two-spreadsheet model

**Admin spreadsheet** (ID from `VITE_SPREADSHEET_ID` env var) — managed by `MasterDataService`:

| Tab | Purpose |
|-----|---------|
| `Admins` | Admin email list |
| `Units` | Unit registry (name, spreadsheetId, tabPrefix) |
| `Commanders` | Commander → unit mapping |
| `Tasks` | Task definitions (shared across all units) |
| `Config` | Global config (leaveRatio, minBasePresence, etc.) |
| `History` | Audit log |

**Per-unit spreadsheet** (ID stored in Units row, same spreadsheet can be shared) — managed by `DataService`:

| Tab | Purpose |
|-----|---------|
| `{tabPrefix}` | **Soldier list** (tab name = unit name / tabPrefix, NOT `{prefix}_Soldiers`) |
| `{tabPrefix}_TaskSchedule` | Task assignments |
| `{tabPrefix}_LeaveRequests` | Leave requests |
| `{tabPrefix}_LeaveSchedule` | Leave assignments |

> **Key design decision (recent):** Soldiers live in a tab named exactly like the unit (e.g. `"א'"`) not in a separate `_Soldiers` tab. `SetupService` only auto-creates the 3 scheduling tabs.

### Data flow on login

```
AuthContext (OAuth token)
  → MasterDataService.initialize() — creates missing admin tabs, seeds first admin
  → MasterDataService.resolveRole(email) — returns 'admin' | 'commander' | null
    → if admin: show AdminPanel
    → if commander: show UnitApp with their unit
  → loads tasks + config from MasterDataService (Tasks/Config tabs)
  → passes tasks/configData down to UnitApp as props
```

### Key service classes

**`MasterDataService`** (`src/services/masterDataService.ts`)
- Fields: `admins`, `units`, `commanders`, `tasks`, `config`, `history`, `taskService`, `sheets`
- `initialize(firstAdminEmail)` — idempotent, creates missing tabs + seeds admin
- `resolveRole(email)` — returns `{ role: 'admin' }` | `{ role: 'commander'; unitId; unit }` | `null`

**`DataService`** (`src/services/dataService.ts`)
- Constructor: `(accessToken, spreadsheetId, tabPrefix, historyService)`
- Fields: `soldiers`, `leaveRequests`, `leaveAssignments`, `taskAssignments`, `soldierService`, `leaveRequestService`, `scheduleService`, `fairnessUpdate`
- `HistoryService` injected from `MasterDataService` (all history goes to the admin spreadsheet)

**`SoldierRepository`** (`src/services/soldierRepository.ts`)
- `tabName = tabPrefix || 'Soldiers'` — reads from `"א'"` tab (not `"א'_Soldiers"`)
- Sheet range is `A:M` (13 columns); `HEADER_ROW` ends with `'InactiveReason'`
- `create(input)` uses `input.id` directly (army ID supplied by user — no auto-generation)

**`SoldierService`** (`src/services/soldierService.ts`)
- `create(input, changedBy)` — army ID must be in `input.id`
- `updateStatus(id, status, changedBy, inactiveReason?)` — sets Active or Inactive; no `discharge()` method
- `updateFields(id, input, changedBy)` — updates name, role, serviceStart, serviceEnd, hoursWorked, or newId; `input` is `Omit<UpdateSoldierInput, 'id'>`

**`ScheduleService`** (`src/services/scheduleService.ts`)
- `generateLeaveSchedule(config, startDate, endDate, changedBy)` — config passed as param
- `generateTaskSchedule(tasks, changedBy)` — tasks passed as param (no internal repo reads for these)

### Key hooks

**`useDataService(spreadsheetId, tabPrefix, masterDs)`** → `{ ds, soldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload }`
**`useScheduleGenerator(ds, tasks, config, startDate, endDate)`** → `{ generate, conflicts }`
**`useMissingTabs(spreadsheetId, tabPrefix)`** → `{ loading, error }` — auto-creates the 3 scheduling tabs if missing

### Constants (`src/constants/index.ts`)

```typescript
SHEET_TABS = { TASK_SCHEDULE, LEAVE_REQUESTS, LEAVE_SCHEDULE }  // 3 tabs only
MASTER_SHEET_TABS = { ADMINS, UNITS, COMMANDERS, TASKS, CONFIG, HISTORY }
```

### tabPrefix logic

`deriveTabPrefix(unitName)` converts unit name to prefix: `"א'"` → `"א'"`, `"Alpha Co"` → `"Alpha_Co"`.
Scheduling tabs: `prefixTab(prefix, 'TaskSchedule')` → `"א'_TaskSchedule"`.
Soldiers tab: `tabPrefix || 'Soldiers'` (bare prefix, no suffix).

`App.tsx` passes `tabPrefix={activeUnit?.tabPrefix || activeUnit?.name || ''}` — if `tabPrefix` is empty in the Units row, falls back to the unit name to avoid writing soldiers to a generic `Soldiers` tab.

---

## Real spreadsheet setup

- **Admin spreadsheet ID:** `1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM`
- Contains Admins/Units/Commanders/Tasks/Config/History tabs (admin data)
- Also contains soldier tabs named `"א'"`, `"ב'"`, `"ג'"`, `"רפואה"` (67 soldiers from `soldier_list.xlsx`)
- Units registered in the Units tab point to this same spreadsheet with tabPrefix = company name

### Importing soldiers

`scripts/import-soldiers.py` reads `soldier_list.xlsx` and writes English-format soldier data to the correct tabs:
```bash
python3 scripts/import-soldiers.py \
  --token OAUTH_TOKEN \
  --spreadsheet-id 1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM \
  --xlsx soldier_list.xlsx
```
Get the OAuth token from DevTools → Network → any `sheets.googleapis.com` request → Authorization header (strip `"Bearer "`).

Soldier tab format (English headers, 13 columns):
`ID | Name | Role | ServiceStart | ServiceEnd | InitialFairness | CurrentFairness | Status | HoursWorked | WeekendLeavesCount | MidweekLeavesCount | AfterLeavesCount | InactiveReason`

> **Note:** Existing sheets with 12 columns will still parse correctly — `InactiveReason` gracefully defaults to `undefined` for missing headers.

---

## Component hierarchy

```
App
└─ AppContent
   ├─ LoginPage (not authenticated)
   ├─ AccessDeniedPage (no role)
   ├─ AdminPanel (admin, no unit selected)
   │   └─ TasksPage (tasks tab — with edit support)
   └─ UnitApp (commander, or admin who entered a unit)
       └─ AppShell (nav, back-to-admin button)
           ├─ Dashboard
           ├─ SoldiersPage
           ├─ TasksPage (read-only for commanders — no onUpdateTask)
           ├─ LeaveRequestsPage / LeaveRequestForm
           ├─ SchedulePage
           └─ HistoryPage
```

**AdminPanel tabs:** Admins | Units | Commanders | Tasks | Config
**UnitApp sections:** dashboard | soldiers | tasks | leave | schedule | history

---

## Models

**`Task`** — `id, taskType, startTime, endTime, durationHours, roleRequirements: RoleRequirement[], minRestAfter, isSpecial, specialDurationDays?`
**`CreateTaskInput`** — same minus `id` (all optional except `taskType, startTime, endTime, roleRequirements`)
**`UpdateTaskInput`** — `id` (required) + all Task fields optional
**`Unit`** — `id, name, spreadsheetId, tabPrefix, createdAt, createdBy`
**`Soldier`** — `id` (army ID, user-supplied), `name, role, serviceStart, serviceEnd, initialFairness, currentFairness, status: 'Active'|'Inactive', inactiveReason?, hoursWorked, weekendLeavesCount, midweekLeavesCount, afterLeavesCount`
**`CreateSoldierInput`** — `id` (required, army number), `name, role, serviceStart, serviceEnd`

---

## Recent changes (2026-03-05)

1. **Full soldier edit** — inline edit panel per row; editable fields: ID, name, role, service start/end (dd/mm/yy input), hours worked; `SoldierService.updateFields()` added
2. **`changedBy`** — all handlers in `App.tsx` now use `auth.email ?? 'user'`
3. **`HistoryPage`** — lazy-loads from `masterDs.history.listAll()` when the history section is opened
4. **`SetupPage` deleted** — orphaned component removed

## Recent changes (2026-03-03/04)

1. **Date display** — `formatDisplayDate(iso)` now returns `DD/MM/YY` (was `DD/MM`)
2. **Army ID** — `CreateSoldierInput.id` is now required (user-entered army number); `SoldierRepository.create()` uses it directly
3. **Status** — `SOLDIER_STATUS` is `['Active', 'Inactive']` (removed Injured/Discharged); `Soldier` has `inactiveReason?: string`; sheet is 13 columns (`A:M`)
4. **SoldiersPage** — `onDischarge` prop replaced by `onUpdateStatus(id, status, reason?)`; checkbox per row; Army ID form field; end-date validation
5. **tabPrefix fix** — `App.tsx` falls back to `activeUnit.name` when `tabPrefix` is empty, fixing soldiers being written to a generic `Soldiers` tab

---

## Known / potential issues

- Task editing is admin-only (commanders see tasks read-only in UnitApp's Tasks section)
- `soldier_list.xlsx` is gitignored; keep it locally for re-runs of the import script
- Soldier import script (`scripts/import-soldiers.py`) uses old 12-column format — needs `InactiveReason` column added if re-run

---

## Dev commands

```bash
npm run dev          # Vite dev server
npm test             # Vitest (510 tests)
npm run build        # TypeScript + Vite build
npm run deploy       # build + gh-pages publish
```

## Env vars (`.env`)

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
VITE_SPREADSHEET_ID=1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM
VITE_ADMIN_EMAIL=...
```
