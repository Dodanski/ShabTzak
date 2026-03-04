# Design: Full Soldier Edit + Known Issues Fixes

**Date:** 2026-03-05

---

## Feature 1: Full soldier field editing

### UI (SoldiersPage)

- "Edit" button opens an inline expanded sub-row below the soldier's table row (same pattern as the Adjust fairness panel)
- Sub-row contains: ID, Name, Role (dropdown), Service Start, Service End, Hours Worked
- All date fields use `dd/mm/yy` text inputs — pre-filled via `formatDisplayDate()`, parsed on save via `parseDisplayDateInput()`
- End-before-start validation (same as add form)
- "Save" calls new `onUpdateSoldier` prop; "Cancel" closes the panel
- The existing ID-only inline edit (`editingIdFor` / `onEditId`) is removed — replaced by this full edit panel

### Service layer (SoldierService)

Add `updateFields(id, input, changedBy)`:
- Accepts `{ newId?, name?, role?, serviceStart?, serviceEnd?, hoursWorked? }`
- Calls `repo.update({ id, ...input })`
- Logs `UPDATE_FIELDS` history entry

### App wiring (App.tsx)

Add `handleUpdateSoldier(id, input)` using `auth.email ?? 'user'`.
Pass as `onUpdateSoldier` prop to `SoldiersPage`. Remove `onEditId` / `handleEditId`.

---

## Fix 1: `changedBy` hardcoded as `'user'`

In `App.tsx` `UnitApp`, replace `'user'` with `auth.email ?? 'user'` in:
- `handleAddSoldier`
- `handleAdjustFairness`
- `handleSubmitLeave`
- `handleApprove`
- `handleDeny`
- `handleAddTask`
- `handleGenerateSchedule` (two occurrences)

---

## Fix 2: HistoryPage always empty

In `UnitApp`:
- Add `historyEntries` state (`HistoryEntry[]`) and `historyLoading` state
- `useEffect` keyed on `section`: when section becomes `'history'`, call `masterDs?.history.listAll()` and store results
- Pass `entries={historyEntries}` and `loading={historyLoading}` to `HistoryPage`

---

## Fix 3: SetupPage orphan

Delete `src/components/SetupPage.tsx`.

---

## Out of scope

- Soldier import script Python update
- Task editing for commanders
