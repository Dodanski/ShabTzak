# Per-Unit Tab Prefix for Shared Spreadsheets

**Date:** 2026-03-02
**Status:** Approved

---

## Problem

Currently every unit requires its own dedicated Google Spreadsheet. All repositories use hardcoded tab names (`Soldiers`, `Tasks`, etc.). Two units pointing to the same spreadsheet would collide on identical tab names.

## Goal

Allow multiple units to share one spreadsheet, each with its own set of tabs, while preserving backward compatibility with existing single-spreadsheet deployments.

---

## Design

### Tab Prefix

Each unit gets a `tabPrefix` string that is prepended to every tab name:

- `tabPrefix = ""` → `Soldiers`, `Tasks`, … (current behavior, all existing units)
- `tabPrefix = "Alpha_Company"` → `Alpha_Company_Soldiers`, `Alpha_Company_Tasks`, …

The prefix is **auto-derived** from the unit name at creation time:

```
unitName.trim().replace(/\s+/g, '_')
```

Examples:
- `"Alpha Company"` → `"Alpha_Company"`
- `"מחלקה א"` → `"מחלקה_א"`

The derived prefix is **stored** in the Unit record. Renaming a unit does not affect its tabs.

---

### Data Model Changes

**`Unit` interface** (`src/models/Master.ts`):
```typescript
interface Unit {
  id: string
  name: string
  spreadsheetId: string
  tabPrefix: string      // new — empty string for legacy units
  createdAt: string
  createdBy: string
}

interface CreateUnitInput {
  name: string
  spreadsheetId: string
  tabPrefix: string      // new — caller derives this before calling create
}
```

**`UnitRepository`** (`src/services/unitRepository.ts`):
- Header row gains column F: `TabPrefix`
- `list()` reads `row[5]` → `tabPrefix` (defaults to `""` if missing, for backward compat)
- `create()` writes `tabPrefix` as column F

---

### Service Layer Changes

**`DataService`** (`src/services/dataService.ts`):
- Constructor signature: `constructor(accessToken: string, spreadsheetId: string, tabPrefix = "")`
- Passes `tabPrefix` to every repository and service constructor

**All repositories** (8 files: `SoldierRepository`, `TaskRepository`, `LeaveRequestRepository`, `LeaveAssignmentRepository`, `TaskAssignmentRepository`, `ConfigRepository`, `HistoryService`, `VersionService`):
- Constructor gains `tabPrefix = ""` param
- Module-level `const RANGE = ...` becomes an instance property computed in the constructor:
  ```typescript
  private readonly range: string
  constructor(sheets, spreadsheetId, cache, tabPrefix = "") {
    const tab = tabPrefix ? `${tabPrefix}_${SHEET_TABS.SOLDIERS}` : SHEET_TABS.SOLDIERS
    this.range = `${tab}!A:L`
  }
  ```

**`SetupService`** (`src/services/setupService.ts`):
- Constructor gains `tabPrefix = ""` param
- `checkTabs()` and `initializeMissingTabs()` use prefixed tab names
- `TAB_HEADERS` keys stay as bare names; a helper maps them to prefixed names at runtime

---

### Tab Validation (Error Display)

When `UnitApp` mounts it runs `SetupService.checkTabs()` before loading any data.

If tabs are missing, renders a blocking error panel instead of the app:

> **Missing tabs in spreadsheet**
> The following required tabs were not found: `Alpha_Company_Soldiers`, `Alpha_Company_Tasks`, …
> Please create them in the spreadsheet, or ask an admin to run Setup.

No data fetch happens until all tabs exist.

Implementation:
- `useDataService` hook gains an optional `tabPrefix` param, passes it to `DataService`
- `UnitApp` props gain `tabPrefix: string`
- Before the normal data load in `useDataService`, call `SetupService.checkTabs()`; surface missing tabs as a structured error
- OR: add a separate `useMissingTabs(spreadsheetId, tabPrefix)` hook checked in `UnitApp` before rendering

---

### Hook & Routing Changes

**`useDataService`** (`src/hooks/useDataService.ts`):
- Signature: `useDataService(spreadsheetId: string, tabPrefix = "")`
- Passes `tabPrefix` to `DataService` constructor

**`UnitApp`** (`src/App.tsx`):
- Props: add `tabPrefix: string`
- Passes `tabPrefix` to `useDataService`
- If `missingTabs.length > 0`, renders `MissingTabsError` component instead of app content

**`AppContent`** (`src/App.tsx`):
- Passes `activeUnit.tabPrefix ?? ""` when rendering `<UnitApp>`

---

### Admin Panel Changes

**`AdminPanel`** (`src/components/AdminPanel.tsx`):
- "Add Unit" form shows a live preview below the name field:
  > Tab prefix: `Alpha_Company` *(tabs will be named Alpha_Company_Soldiers, …)*
- Preview updates as the admin types the unit name
- Derives prefix with the same `trim().replace(/\s+/g, '_')` logic before calling `masterDs.units.create()`

---

## Backward Compatibility

- Existing units have no `TabPrefix` column in the sheet → `row[5]` is `undefined` → defaults to `""`
- `tabPrefix = ""` causes all repositories to use bare tab names (identical to current behavior)
- No migration required

---

## Files Changed

| File | Change |
|------|--------|
| `src/models/Master.ts` | Add `tabPrefix` to `Unit` and `CreateUnitInput` |
| `src/services/unitRepository.ts` | Read/write column F `TabPrefix` |
| `src/services/dataService.ts` | Accept `tabPrefix`, pass to all repos |
| `src/services/soldierRepository.ts` | Accept `tabPrefix`, compute range in constructor |
| `src/services/taskRepository.ts` | Same |
| `src/services/leaveRequestRepository.ts` | Same |
| `src/services/leaveAssignmentRepository.ts` | Same |
| `src/services/taskAssignmentRepository.ts` | Same |
| `src/services/configRepository.ts` | Same |
| `src/services/historyService.ts` | Same |
| `src/services/versionService.ts` | Same |
| `src/services/setupService.ts` | Accept `tabPrefix`, use prefixed names |
| `src/hooks/useDataService.ts` | Accept `tabPrefix`, pass to `DataService` |
| `src/App.tsx` | Pass `tabPrefix` to `UnitApp`; add missing-tabs error render |
| `src/components/AdminPanel.tsx` | Show prefix preview, derive prefix on create |
