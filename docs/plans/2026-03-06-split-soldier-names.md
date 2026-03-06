# Design: Split Soldier Name into First Name and Last Name

**Date:** 2026-03-06

---

## Goal

Split the `name` field on soldiers into `firstName` and `lastName` for better data organization. Existing soldiers' `name` value becomes their `lastName`, with `firstName` starting blank.

---

## Data Layer

### Soldier Model Changes

**`src/models/Soldier.ts`:**
```typescript
interface Soldier {
  id: string
  firstName: string        // new
  lastName: string         // new (replaces 'name')
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
  initialFairness: number
  currentFairness: number
  status: SoldierStatus
  inactiveReason?: string
  hoursWorked: number
  weekendLeavesCount: number
  midweekLeavesCount: number
  afterLeavesCount: number
}

interface CreateSoldierInput {
  id: string
  firstName: string        // new
  lastName: string         // new
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
}

interface UpdateSoldierInput {
  id: string
  newId?: string
  firstName?: string       // new
  lastName?: string        // new
  role?: SoldierRole
  serviceStart?: string
  serviceEnd?: string
  status?: SoldierStatus
  inactiveReason?: string
  hoursWorked?: number
  weekendLeavesCount?: number
  midweekLeavesCount?: number
  afterLeavesCount?: number
  currentFairness?: number
}
```

### Sheet Format

**Current:** `A:M` (13 columns)
```
ID | Name | Role | ServiceStart | ServiceEnd | InitialFairness | CurrentFairness | Status | HoursWorked | WeekendLeavesCount | MidweekLeavesCount | AfterLeavesCount | InactiveReason
```

**New:** `A:N` (14 columns)
```
ID | FirstName | LastName | Role | ServiceStart | ServiceEnd | InitialFairness | CurrentFairness | Status | HoursWorked | WeekendLeavesCount | MidweekLeavesCount | AfterLeavesCount | InactiveReason
```

### Parser and Serializer

**`src/services/parsers.ts`** — `parseSoldier()`:
- If headers contain `FirstName` + `LastName` → parse both fields directly
- If headers contain only `Name` (old format) → set `firstName = ''`, `lastName = Name value` (backward compat)
- Guards against either field being missing

**`src/services/serializers.ts`** — `serializeSoldier()`:
- Always writes `[id, firstName, lastName, role, ...]` in row format
- Works with the new 14-column layout

### Repository

**`src/services/soldierRepository.ts`:**
- `HEADER_ROW` updated to 14 columns: `['ID', 'FirstName', 'LastName', 'Role', ...]`
- Range changes from `A:M` to `A:N`
- `create()` method: add auto-migration logic
  - Detect if sheet header still has `Name` column (not `FirstName`/`LastName`)
  - If detected: rewrite header to new format before appending (existing rows preserve their data in the Name column, which now reads as LastName)
  - This ensures old sheets auto-migrate on first new soldier creation

---

## UI Layer

### SoldiersPage

**Table display:**
- Two separate columns: `First Name | Last Name | Role | Service Start | Service End | Hours Worked | Status`
- Existing soldiers show: `First Name = ''`, `Last Name = old name value`

**Add soldier form:**
- Two text inputs: `First Name` (required), `Last Name` (required)
- Rest of form unchanged

**Edit soldier form:**
- Two text inputs: `First Name`, `Last Name` (both present when editing)
- Both fields editable

**Role filter:** unchanged

### Display Helper

**`src/utils/helpers.ts`** (or similar) — new utility:
```typescript
export function fullName(soldier: Soldier): string {
  const parts = [soldier.firstName, soldier.lastName].filter(Boolean)
  return parts.join(' ')
}
```

**Usage in other components:**
- `SchedulePage`: use `fullName(soldier)` when displaying soldier names
- `LeaveRequestsPage`: use `fullName(soldier)`
- `Dashboard`: use `fullName(soldier)`
- `HistoryPage`: use `fullName(soldier)` in audit log entries

### Validation

**`src/utils/validation.ts`:**
- Add validation for `firstName` (required, non-empty)
- Add validation for `lastName` (required, non-empty)
- Update `validateSoldier()` to validate both fields instead of `name`

---

## Backward Compatibility

- Old sheets with `Name` column continue to work — `parseSoldier()` handles the mapping
- Existing soldiers retain their data (Name → LastName)
- New soldiers created with split fields
- First soldier create triggers auto-migration if needed

---

## Out of Scope

- No UI for renaming the `Name` header manually — auto-migration in `create()` handles it
- No special handling for soldiers with empty `firstName` after migration — they display as last-name-only

---

## Test Coverage

- `parseSoldier()`: old format (Name column), new format (FirstName/LastName columns)
- `serializeSoldier()`: writes correct 14-column format
- `SoldiersPage`: add form requires both firstName and lastName
- `SoldiersPage`: edit form updates both fields correctly
- `SoldiersPage`: table displays both columns
- `fullName()` utility: returns correct format, handles empty firstName
- Auto-migration: detect old header, rewrite to new format
