# Centralized Admin Data Design

**Date:** 2026-03-02
**Status:** Approved

---

## Problem

Currently every unit owns all its data — Tasks, Config, History, Soldiers, LeaveRequests, TaskSchedule, LeaveSchedule — in its own spreadsheet. This prevents admins from managing a shared task list and global configuration. It also requires every unit to maintain its own redundant copies of tasks.

## Goal

- Tasks and Config are centralized in the admin spreadsheet, managed by admins only.
- History (audit log) is centralized in the admin spreadsheet.
- Soldiers, LeaveRequests, TaskSchedule, LeaveSchedule remain per-unit (in commander spreadsheets).
- Multiple units can share one commander spreadsheet (existing tabPrefix feature) or each have their own.
- Missing unit tabs are auto-created when a unit is entered.
- Version tab and all versioning machinery removed.

---

## Data Architecture

### Admin Spreadsheet (= current master spreadsheet, `config.spreadsheetId`)

| Tab | Status |
|-----|--------|
| Admins | existing |
| Units | existing |
| Commanders | existing |
| Tasks | **NEW** |
| Config | **NEW** |
| History | **NEW** |

### Commander / Unit Spreadsheet(s)

Each unit gets 4 prefixed tabs (prefix = `""` for legacy units):

| Tab | Status |
|-----|--------|
| `{prefix}_Soldiers` | existing (reduced from 8 tabs to 4) |
| `{prefix}_LeaveRequests` | existing |
| `{prefix}_TaskSchedule` | existing |
| `{prefix}_LeaveSchedule` | existing |

### Removed

- `{prefix}_Tasks` tab
- `{prefix}_Config` tab
- `{prefix}_History` tab
- `{prefix}_Version` tab (and all versioning machinery)

---

## Service Layer

### `MasterDataService` — gains:
- `tasks: TaskRepository` — reads/writes Tasks tab in admin spreadsheet (no prefix)
- `config: ConfigRepository` — reads Config tab in admin spreadsheet (no prefix)
- `history: HistoryService` — appends to History tab in admin spreadsheet (no prefix)
- `initialize()` creates Tasks, Config, History tabs if missing

### `DataService` (per-unit) — loses:
- Remove `taskService` / `TaskRepository`
- Remove `configRepository`
- Remove `historyService`
- Remove `VersionService`

Keeps: `soldierService`, `leaveRequestService`, `taskAssignments`, `leaveAssignments`, `scheduleService`, `fairnessUpdate`

### `ScheduleService`
Currently reads tasks and config from the unit spreadsheet. After this change it receives them as parameters:
```typescript
generateTaskSchedule(tasks: Task[], config: AppConfig, ...): Promise<Schedule>
generateLeaveSchedule(config: AppConfig, ...): Promise<Schedule>
```

### `SetupService`
Checks/creates only the 4 per-unit tabs. Admin tab creation stays in `MasterDataService.initialize()`.

---

## Auto-Create Unit Tabs

When a unit is entered (UnitApp mounts), `useMissingTabs` already checks for missing tabs. `SetupService.initializeMissingTabs()` is called to create any missing tabs automatically — no manual spreadsheet editing required.

The 4 required per-unit tabs are created with correct headers if absent.

---

## UI Changes

### AdminPanel
- Add **Tasks** tab: list tasks, add/remove tasks (uses `masterDs.tasks`)
- Add **Config** tab: view/edit global config (uses `masterDs.config`)
- Existing Admins / Units / Commanders tabs unchanged

### UnitApp (commander view)
- **TasksPage**: tasks loaded from `masterDs.tasks` (read-only definitions; commanders cannot create/delete tasks)
- **SchedulePage**: task assignment overrides still work (writes to per-unit `TaskSchedule`)
- **Remove**: config management UI (config is now admin-only)
- **Remove**: `VersionConflictBanner` (version machinery gone)

### `useDataService` hook
- No longer provides `tasks` or `configData`
- `UnitApp` receives `tasks` and `config` as props passed down from `AppContent` (which loads them from `masterDs`)

---

## Backward Compatibility

- Legacy units (tabPrefix = `""`) continue to work — unit tab names stay bare.
- Units that previously had Tasks/Config/History tabs in their spreadsheet: those tabs are ignored (not read, not written). Data migration is not required; admins re-enter tasks in the new admin Tasks tab.

---

## Files Changed

| File | Change |
|------|--------|
| `src/constants/index.ts` | Add Tasks, Config, History to `MASTER_SHEET_TABS`; remove from `SHEET_TABS` |
| `src/services/masterDataService.ts` | Add tasks, config, history repositories; update initialize() |
| `src/services/dataService.ts` | Remove taskService, configRepository, historyService, versionService |
| `src/services/scheduleService.ts` | Accept tasks and config as params instead of reading from unit spreadsheet |
| `src/services/setupService.ts` | Only check/create 4 per-unit tabs |
| `src/services/versionService.ts` | Delete |
| `src/services/versionRepository.ts` | Delete (if exists separately) |
| `src/hooks/useDataService.ts` | Remove tasks, configData from return value |
| `src/hooks/useVersionCheck.ts` | Delete |
| `src/App.tsx` | Load tasks+config from masterDs; pass to UnitApp as props; remove VersionConflictBanner |
| `src/components/AdminPanel.tsx` | Add Tasks and Config tabs |
| `src/components/VersionConflictBanner.tsx` | Delete |
| `src/components/TasksPage.tsx` | Make task list read-only for commanders (no add/delete) |
