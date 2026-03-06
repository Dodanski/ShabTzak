# Split Soldier Name Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split soldier `name` field into `firstName` and `lastName`, update Google Sheet columns, and refactor SoldiersPage to display two name columns.

**Architecture:** Change `Soldier` model from `name: string` to `firstName: string + lastName: string`. Update parsers/serializers for backward compat with old `Name` column. Add auto-migration in `create()`. Refactor SoldiersPage to show two columns and two form inputs. Add `fullName()` helper for other components.

**Tech Stack:** React 18, TypeScript, Vitest, Google Sheets API (via GoogleSheetsService)

---

## Task 1: Update Soldier model interfaces

**Files:**
- Modify: `src/models/Soldier.ts`

**Step 1: Write failing test**

In `src/models/Soldier.test.ts`, add:
```typescript
it('Soldier has firstName and lastName fields (not name)', () => {
  const soldier: Soldier = {
    id: '1234567',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Driver',
    serviceStart: '2026-01-01',
    serviceEnd: '2026-12-31',
    initialFairness: 0,
    currentFairness: 0,
    status: 'Active',
    hoursWorked: 0,
    weekendLeavesCount: 0,
    midweekLeavesCount: 0,
    afterLeavesCount: 0,
  }
  expect(soldier.firstName).toBe('John')
  expect(soldier.lastName).toBe('Doe')
  expect((soldier as any).name).toBeUndefined()
})

it('CreateSoldierInput requires firstName and lastName', () => {
  const input: CreateSoldierInput = {
    id: '1234567',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Driver',
    serviceStart: '2026-01-01',
    serviceEnd: '2026-12-31',
  }
  expect(input.firstName).toBe('John')
  expect(input.lastName).toBe('Doe')
})

it('UpdateSoldierInput has optional firstName and lastName', () => {
  const input: UpdateSoldierInput = {
    id: '1234567',
    firstName: 'Jane',
  }
  expect(input.firstName).toBe('Jane')
  expect(input.lastName).toBeUndefined()
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/models/Soldier.test.ts
```
Expected: FAIL — `firstName` and `lastName` do not exist on Soldier

**Step 3: Update Soldier.ts**

Replace:
```typescript
export interface Soldier {
  id: string
  name: string
  role: SoldierRole
  // ... rest
}

export interface CreateSoldierInput {
  id: string
  name: string
  role: SoldierRole
  // ... rest
}

export interface UpdateSoldierInput {
  id: string
  name?: string
  // ... rest
}
```

With:
```typescript
export interface Soldier {
  id: string
  firstName: string
  lastName: string
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

export interface CreateSoldierInput {
  id: string
  firstName: string
  lastName: string
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
}

export interface UpdateSoldierInput {
  id: string
  newId?: string
  firstName?: string
  lastName?: string
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

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/models/Soldier.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/models/Soldier.ts src/models/Soldier.test.ts
git commit -m "feat: Soldier model — split name into firstName and lastName"
```

---

## Task 2: Update parseSoldier() with backward compat

**Files:**
- Modify: `src/services/parsers.ts`
- Modify: `src/services/parsers.test.ts` (if exists)

**Step 1: Write failing test for backward compat**

In a parsers test file (create if needed), add:
```typescript
it('parseSoldier handles old Name column format', () => {
  const oldRow = ['1234567', 'John Doe', 'Driver', '2026-01-01', '2026-12-31', '0', '0', 'Active', '0', '0', '0', '0', '']
  const oldHeaders = ['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount', 'InactiveReason']
  const soldier = parseSoldier(oldRow, oldHeaders)
  expect(soldier.firstName).toBe('')
  expect(soldier.lastName).toBe('John Doe')
})

it('parseSoldier handles new FirstName/LastName columns', () => {
  const newRow = ['1234567', 'John', 'Doe', 'Driver', '2026-01-01', '2026-12-31', '0', '0', 'Active', '0', '0', '0', '0', '']
  const newHeaders = ['ID', 'FirstName', 'LastName', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount', 'InactiveReason']
  const soldier = parseSoldier(newRow, newHeaders)
  expect(soldier.firstName).toBe('John')
  expect(soldier.lastName).toBe('Doe')
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/parsers.test.ts
```
Expected: FAIL — `firstName` and `lastName` don't exist

**Step 3: Update parseSoldier()**

In `src/services/parsers.ts`, replace the `parseSoldier` function:
```typescript
export function parseSoldier(row: string[], headers: string[]): Soldier {
  if (row.length === 0) throw new Error('Cannot parse empty row')

  // Handle both old (Name) and new (FirstName/LastName) formats
  const hasFirstNameColumn = headers.includes('FirstName')
  const hasLastNameColumn = headers.includes('LastName')
  const hasNameColumn = headers.includes('Name')

  let firstName = ''
  let lastName = ''

  if (hasFirstNameColumn && hasLastNameColumn) {
    // New format: separate columns
    firstName = get(row, headers, 'FirstName')
    lastName = get(row, headers, 'LastName')
  } else if (hasNameColumn) {
    // Old format: Name column → lastName
    firstName = ''
    lastName = get(row, headers, 'Name')
  }

  return {
    id: get(row, headers, 'ID'),
    firstName,
    lastName,
    role: get(row, headers, 'Role') as Soldier['role'],
    serviceStart: get(row, headers, 'ServiceStart'),
    serviceEnd: get(row, headers, 'ServiceEnd'),
    initialFairness: getNum(row, headers, 'InitialFairness'),
    currentFairness: getNum(row, headers, 'CurrentFairness'),
    status: get(row, headers, 'Status') as Soldier['status'],
    hoursWorked: getNum(row, headers, 'HoursWorked'),
    weekendLeavesCount: getNum(row, headers, 'WeekendLeavesCount'),
    midweekLeavesCount: getNum(row, headers, 'MidweekLeavesCount'),
    afterLeavesCount: getNum(row, headers, 'AfterLeavesCount'),
    inactiveReason: safeGet(row, headers, 'InactiveReason') || undefined,
  }
}
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/parsers.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/parsers.ts src/services/parsers.test.ts
git commit -m "feat: parseSoldier — support both old Name and new FirstName/LastName columns"
```

---

## Task 3: Update serializeSoldier()

**Files:**
- Modify: `src/services/serializers.ts`
- Modify: `src/services/serializers.test.ts` (if exists)

**Step 1: Write failing test**

In serializers test, add:
```typescript
it('serializeSoldier writes firstName and lastName as separate columns', () => {
  const soldier: Soldier = {
    id: '1234567',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Driver',
    serviceStart: '2026-01-01',
    serviceEnd: '2026-12-31',
    initialFairness: 0,
    currentFairness: 0,
    status: 'Active',
    hoursWorked: 0,
    weekendLeavesCount: 0,
    midweekLeavesCount: 0,
    afterLeavesCount: 0,
  }
  const row = serializeSoldier(soldier)
  expect(row[0]).toBe('1234567')   // ID at index 0
  expect(row[1]).toBe('John')      // FirstName at index 1
  expect(row[2]).toBe('Doe')       // LastName at index 2
  expect(row[3]).toBe('Driver')    // Role at index 3
  expect(row.length).toBe(14)      // 14 columns total
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/serializers.test.ts
```
Expected: FAIL — serializer doesn't have firstName/lastName

**Step 3: Update serializeSoldier()**

In `src/services/serializers.ts`, replace the function:
```typescript
export function serializeSoldier(s: Soldier): string[] {
  return [
    s.id,
    s.firstName,
    s.lastName,
    s.role,
    s.serviceStart,
    s.serviceEnd,
    String(s.initialFairness),
    String(s.currentFairness),
    s.status,
    String(s.hoursWorked),
    String(s.weekendLeavesCount),
    String(s.midweekLeavesCount),
    String(s.afterLeavesCount),
    s.inactiveReason ?? '',
  ]
}
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/serializers.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/serializers.ts src/services/serializers.test.ts
git commit -m "feat: serializeSoldier — write 14 columns with firstName and lastName"
```

---

## Task 4: Update SoldierRepository header and auto-migration

**Files:**
- Modify: `src/services/soldierRepository.ts`

**Step 1: Write failing test**

In `src/services/soldierRepository.test.ts` (or create), add:
```typescript
it('HEADER_ROW has 14 columns including FirstName and LastName', () => {
  // You may need to export HEADER_ROW or check it indirectly
  // For now, just verify the range is A:N
  const repo = new SoldierRepository(mockSheets, 'sheet-id', new SheetCache(), 'TestUnit')
  // Range should be A:N (14 columns)
  expect(repo['range']).toBe('TestUnit!A:N')
})

it('create() detects old Name column and rewrites header', async () => {
  const mockSheets = {
    getValues: vi.fn().mockResolvedValue([
      ['ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount', 'InactiveReason'],
      ['1111111', 'Existing Soldier', 'Driver', '2026-01-01', '2026-12-31', '0', '0', 'Active', '0', '0', '0', '0', ''],
    ]),
    appendValues: vi.fn().mockResolvedValue(undefined),
    updateValues: vi.fn().mockResolvedValue(undefined),
  }
  const repo = new SoldierRepository(mockSheets as any, 'sheet-id', new SheetCache(), 'TestUnit')

  const input: CreateSoldierInput = {
    id: '2222222',
    firstName: 'New',
    lastName: 'Soldier',
    role: 'Medic',
    serviceStart: '2026-02-01',
    serviceEnd: '2026-12-31',
  }

  await repo.create(input)

  // Should detect old format and rewrite header
  expect(mockSheets.updateValues).toHaveBeenCalledWith(
    'sheet-id',
    'TestUnit!A1:N1',
    [['ID', 'FirstName', 'LastName', 'Role', 'ServiceStart', 'ServiceEnd', 'InitialFairness', 'CurrentFairness', 'Status', 'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount', 'InactiveReason']]
  )
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/soldierRepository.test.ts
```
Expected: FAIL

**Step 3: Update HEADER_ROW and range**

In `src/services/soldierRepository.ts`, change:
```typescript
const HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]
```

To:
```typescript
const HEADER_ROW = [
  'ID', 'FirstName', 'LastName', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]
```

And change the range from `A:M` to `A:N`:
```typescript
this.range = `${this.tabName}!A:N`
```

**Step 4: Add auto-migration in create()**

In the `create()` method, after the existing self-heal logic, add:
```typescript
// Auto-migrate old Name column to FirstName/LastName
const hasNameColumn = allRows[0]?.includes('Name') && !allRows[0]?.includes('FirstName')
if (hasNameColumn) {
  const oldHeaderIndex = allRows[0].indexOf('Name')
  const newHeader = [...HEADER_ROW]
  // Replace old header with new format
  await this.sheets.updateValues(
    this.spreadsheetId,
    `${this.tabName}!A1:N1`,
    [newHeader]
  )
}
```

**Step 5: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/soldierRepository.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/soldierRepository.ts src/services/soldierRepository.test.ts
git commit -m "feat: SoldierRepository — 14-column header with auto-migration from Name column"
```

---

## Task 5: Create fullName() helper utility

**Files:**
- Create: `src/utils/helpers.ts` (or add to existing)
- Create: `src/utils/helpers.test.ts`

**Step 1: Write failing test**

In `src/utils/helpers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { fullName } from './helpers'
import type { Soldier } from '../models'

describe('fullName', () => {
  it('returns firstName and lastName combined with space', () => {
    const soldier: Soldier = {
      id: '1234567',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    expect(fullName(soldier)).toBe('John Doe')
  })

  it('returns only lastName when firstName is empty', () => {
    const soldier: Soldier = {
      id: '1234567',
      firstName: '',
      lastName: 'Doe',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    expect(fullName(soldier)).toBe('Doe')
  })

  it('returns only firstName when lastName is empty', () => {
    const soldier: Soldier = {
      id: '1234567',
      firstName: 'John',
      lastName: '',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    expect(fullName(soldier)).toBe('John')
  })

  it('returns empty string when both names are empty', () => {
    const soldier: Soldier = {
      id: '1234567',
      firstName: '',
      lastName: '',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }
    expect(fullName(soldier)).toBe('')
  })
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/utils/helpers.test.ts
```
Expected: FAIL — helpers.ts doesn't exist or fullName not exported

**Step 3: Create helpers.ts**

Create `src/utils/helpers.ts`:
```typescript
import type { Soldier } from '../models'

export function fullName(soldier: Soldier): string {
  const parts = [soldier.firstName, soldier.lastName].filter(Boolean)
  return parts.join(' ')
}
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/utils/helpers.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/helpers.ts src/utils/helpers.test.ts
git commit -m "feat: add fullName() helper for displaying soldier names"
```

---

## Task 6: Update validation for firstName and lastName

**Files:**
- Modify: `src/utils/validation.ts`
- Modify: `src/utils/validation.test.ts`

**Step 1: Write failing test**

In `src/utils/validation.test.ts`, add:
```typescript
it('validateSoldier returns error when firstName is empty', () => {
  const input = { id: '1234567', firstName: '', lastName: 'Doe', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.firstName).toBeDefined()
})

it('validateSoldier returns error when lastName is empty', () => {
  const input = { id: '1234567', firstName: 'John', lastName: '', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.lastName).toBeDefined()
})

it('validateSoldier passes when both firstName and lastName are provided', () => {
  const input = { id: '1234567', firstName: 'John', lastName: 'Doe', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.firstName).toBeUndefined()
  expect(errors?.lastName).toBeUndefined()
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/utils/validation.test.ts
```
Expected: FAIL

**Step 3: Update validateSoldier()**

In `src/utils/validation.ts`, find the `validateSoldier` function. Replace the `name` validation block:
```typescript
if (!input.name || input.name.trim() === '') {
  errors.name = 'Name is required'
}
```

With:
```typescript
if (!input.firstName || input.firstName.trim() === '') {
  errors.firstName = 'First name is required'
}
if (!input.lastName || input.lastName.trim() === '') {
  errors.lastName = 'Last name is required'
}
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/utils/validation.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/validation.ts src/utils/validation.test.ts
git commit -m "feat: validation — require both firstName and lastName"
```

---

## Task 7: Update SoldiersPage table to show two name columns

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Step 1: Write failing test**

In `src/components/SoldiersPage.test.tsx`, add:
```typescript
it('renders First Name and Last Name as separate columns in the table', () => {
  const soldiers = [
    {
      id: '1111111',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active' as const,
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    },
  ]
  render(
    <SoldiersPage
      soldiers={soldiers}
      onUpdateSoldier={vi.fn()}
      onUpdateStatus={vi.fn()}
      onAddSoldier={vi.fn()}
      roles={['Driver', 'Medic']}
    />
  )
  expect(screen.getByText('John')).toBeInTheDocument()
  expect(screen.getByText('Doe')).toBeInTheDocument()
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: FAIL

**Step 3: Update SoldiersPage table JSX**

In `src/components/SoldiersPage.tsx`, find the table that displays soldiers. Update the table headers and rows:

Find the `<table>` with headers that currently show:
```tsx
<th>Name</th>
<th>Role</th>
...
```

Replace with:
```tsx
<th>First Name</th>
<th>Last Name</th>
<th>Role</th>
...
```

And in the table body, find the cell that displays `<td>{soldier.name}</td>` and replace with:
```tsx
<td>{soldier.firstName}</td>
<td>{soldier.lastName}</td>
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: SoldiersPage table — display firstName and lastName as separate columns"
```

---

## Task 8: Update SoldiersPage add form for two name inputs

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Step 1: Write failing test**

In `src/components/SoldiersPage.test.tsx`, add:
```typescript
it('add form has separate firstName and lastName inputs', async () => {
  render(
    <SoldiersPage
      soldiers={[]}
      onUpdateSoldier={vi.fn()}
      onUpdateStatus={vi.fn()}
      onAddSoldier={vi.fn()}
      roles={['Driver', 'Medic']}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
  expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument()
})

it('add form submission sends firstName and lastName', async () => {
  const handleAdd = vi.fn()
  render(
    <SoldiersPage
      soldiers={[]}
      onUpdateSoldier={vi.fn()}
      onUpdateStatus={vi.fn()}
      onAddSoldier={handleAdd}
      roles={['Driver', 'Medic']}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
  await userEvent.type(screen.getByRole('textbox', { name: /army id/i }), '1234567')
  await userEvent.type(screen.getByRole('textbox', { name: /first name/i }), 'John')
  await userEvent.type(screen.getByRole('textbox', { name: /last name/i }), 'Doe')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /role/i }), 'Driver')
  await userEvent.type(screen.getByRole('textbox', { name: /service start/i }), '01/01/26')
  await userEvent.type(screen.getByRole('textbox', { name: /service end/i }), '31/12/26')
  await userEvent.click(screen.getByRole('button', { name: /save/i }))
  expect(handleAdd).toHaveBeenCalledWith(
    expect.objectContaining({
      id: '1234567',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver',
    })
  )
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: FAIL

**Step 3: Update add form in SoldiersPage**

In `src/components/SoldiersPage.tsx`, find the add form JSX. Currently it likely has:
```tsx
const [form, setForm] = useState({ id: '', name: '', role: roles[0] ?? '', ... })
```

Change to:
```tsx
const [form, setForm] = useState({ id: '', firstName: '', lastName: '', role: roles[0] ?? '', ... })
```

Find the form inputs. Replace:
```tsx
<input ... placeholder="Name" ... />
```

With:
```tsx
<input ... placeholder="First Name" aria-label="First Name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
<input ... placeholder="Last Name" aria-label="Last Name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
```

And update the submit handler to send both `firstName` and `lastName`:
```tsx
if (form.id && form.firstName && form.lastName && form.role && form.serviceStart && form.serviceEnd) {
  onAddSoldier({ id: form.id, firstName: form.firstName, lastName: form.lastName, role: form.role as SoldierRole, serviceStart: form.serviceStart, serviceEnd: form.serviceEnd })
  setForm({ id: '', firstName: '', lastName: '', role: roles[0] ?? '', serviceStart: '', serviceEnd: '' })
  setShowForm(false)
}
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: SoldiersPage add form — firstName and lastName inputs"
```

---

## Task 9: Update SoldiersPage edit form for two name inputs

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Step 1: Write failing test**

In `src/components/SoldiersPage.test.tsx`, add:
```typescript
it('edit form has separate firstName and lastName inputs', async () => {
  const soldiers = [
    {
      id: '1111111',
      firstName: 'John',
      lastName: 'Doe',
      role: 'Driver' as const,
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active' as const,
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    },
  ]
  render(
    <SoldiersPage
      soldiers={soldiers}
      onUpdateSoldier={vi.fn()}
      onUpdateStatus={vi.fn()}
      onAddSoldier={vi.fn()}
      roles={['Driver', 'Medic']}
    />
  )
  // Click edit button for the soldier
  await userEvent.click(screen.getByRole('button', { name: /edit/i }))
  const firstNameInput = screen.getByRole('textbox', { name: /first name/i })
  const lastNameInput = screen.getByRole('textbox', { name: /last name/i })
  expect(firstNameInput).toHaveValue('John')
  expect(lastNameInput).toHaveValue('Doe')
})
```

**Step 2: Run test to confirm fails**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: FAIL

**Step 3: Update edit form in SoldiersPage**

In `src/components/SoldiersPage.tsx`, find the edit form state. Currently:
```tsx
const [editForm, setEditForm] = useState({ id: '', name: '', role: '', ... })
```

Change to:
```tsx
const [editForm, setEditForm] = useState({ id: '', firstName: '', lastName: '', role: '', ... })
```

When opening edit mode, set the form from the selected soldier:
```tsx
setEditForm({ id: soldier.id, firstName: soldier.firstName, lastName: soldier.lastName, role: soldier.role, ... })
```

Add form inputs for both fields in the edit panel:
```tsx
<input ... placeholder="First Name" aria-label="First Name" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
<input ... placeholder="Last Name" aria-label="Last Name" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
```

And update the save handler to send both fields:
```tsx
onUpdateSoldier(editForm.id, { firstName: editForm.firstName, lastName: editForm.lastName, ... })
```

**Step 4: Run test to confirm passes**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: SoldiersPage edit form — firstName and lastName inputs"
```

---

## Task 10: Update other components to use fullName() helper

**Files:**
- Modify: `src/components/SchedulePage.tsx`
- Modify: `src/components/LeaveRequestsPage.tsx` (if displays names)
- Modify: `src/components/Dashboard.tsx` (if displays names)
- Modify: `src/components/HistoryPage.tsx` (if displays names)

**Step 1: Write failing tests** (for each component)

For each component that displays soldier names, add a test checking that it uses the full name format:
```typescript
it('displays soldier full name when rendering', () => {
  // test that the component shows the combined first and last name
})
```

**Step 2: Update component imports**

In each component, add the import:
```typescript
import { fullName } from '../utils/helpers'
```

**Step 3: Replace name references**

For each place that displays `soldier.name`, replace with `fullName(soldier)`.

Example in SchedulePage:
```tsx
// Before
<span>{soldier.name}</span>

// After
<span>{fullName(soldier)}</span>
```

**Step 4: Run tests**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run
```
Expected: all PASS

**Step 5: Commit**

```bash
git add src/components/SchedulePage.tsx src/components/LeaveRequestsPage.tsx src/components/Dashboard.tsx src/components/HistoryPage.tsx
git commit -m "feat: use fullName() helper in components that display soldier names"
```

---

## Task 11: Update SoldierService to handle firstName/lastName

**Files:**
- Modify: `src/services/soldierService.ts`

**Step 1: Write failing test** (if needed)

Check if `SoldierService` tests need updates for the new field names.

**Step 2: Update updateFields() logic**

In `src/services/soldierService.ts`, the `updateFields()` method should handle both `firstName` and `lastName`:
```typescript
async updateFields(id: string, input: Omit<UpdateSoldierInput, 'id'>, changedBy: string): Promise<void> {
  await this.repo.update({ id, ...input })
  const entityId = input.newId ?? id
  const changedFields = Object.keys(input).filter(key => input[key as keyof typeof input] !== undefined)
  await this.history.append('UPDATE_FIELDS', 'Soldier', entityId, changedBy, `Updated fields for soldier ${entityId}: ${changedFields.join(', ')}`)
}
```

(This should already work since we're just passing through the input.)

**Step 3: Run tests**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run src/services/soldierService.test.ts
```
Expected: all PASS

**Step 4: Commit**

```bash
git add src/services/soldierService.ts
git commit -m "feat: SoldierService handles firstName and lastName updates"
```

---

## Task 12: Run full test suite and update SUMMARY.md

**Files:**
- Modify: `SUMMARY.md`

**Step 1: Run full test suite**

```bash
cd /home/moshko/testDir/ShabTzak && npx vitest run
```

Expected: all tests PASS (may be more or fewer than 521, depending on any test additions/removals)

**Step 2: Update SUMMARY.md**

Add to the "Recent changes (2026-03-06)" section:
```markdown
11. **Soldier name split** — `name: string` → `firstName: string + lastName: string`
12. **SoldierRepository** — 14-column header (A:N) with `FirstName` and `LastName`; auto-migrates old `Name` column on first soldier creation
13. **Backward compatibility** — `parseSoldier()` handles both old `Name` and new `FirstName`/`LastName` columns
14. **Helper function** — `fullName(soldier)` utility for displaying names in other components
15. **SoldiersPage** — table shows two name columns; add/edit forms have separate inputs for firstName and lastName
```

Also update the test count in the dev commands section.

**Step 3: Commit**

```bash
git add SUMMARY.md
git commit -m "docs: update SUMMARY.md — soldier name split feature complete"
```

---

## Summary

This plan splits the soldier `name` field into `firstName` and `lastName` across data, persistence, and UI layers. Key points:

- **Backward compatibility** via `parseSoldier()` detecting old `Name` column
- **Auto-migration** in `create()` rewrites headers when needed
- **Two separate columns** in the soldiers table for clarity
- **Helper function** (`fullName()`) for other components
- **Validation** requires both firstName and lastName
- **14-column sheet** format (A:N) replacing 13-column (A:M)

All tasks are TDD with failing → pass → commit cycle.
