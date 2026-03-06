# Soldier Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Five improvements to soldier management: dd/mm/yy date display, end-date validation, correct tab routing for new soldiers, army ID as primary key, and Active/Inactive status toggle with plain-text reason.

**Architecture:** Changes flow from data layer outward — constants → models → parsers/serializers/repo → service → UI → app wiring. Each task is independently testable. The status change from `Active|Injured|Discharged` to `Active|Inactive` plus a `inactiveReason` field adds one new column (M) to the soldier sheet.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, Google Sheets (column range `A:M` after this change)

---

## Context: Key File Paths

| File | Purpose |
|------|---------|
| `src/constants/index.ts` | `SOLDIER_STATUS` enum |
| `src/models/Soldier.ts` | `Soldier`, `CreateSoldierInput`, `UpdateSoldierInput` |
| `src/services/parsers.ts` | `parseSoldier` — reads sheet row → `Soldier` |
| `src/services/serializers.ts` | `serializeSoldier` — `Soldier` → sheet row |
| `src/services/soldierRepository.ts` | CRUD against Google Sheets, `HEADER_ROW`, range |
| `src/services/soldierService.ts` | Business logic: `create`, `updateStatus`, `discharge` |
| `src/utils/dateUtils.ts` | `formatDisplayDate` — all date display goes through here |
| `src/utils/validation.ts` | `validateSoldier` |
| `src/components/SoldiersPage.tsx` | The main UI component |
| `src/App.tsx` | `UnitApp`, `handleDischarge`, tab-prefix wiring |

---

### Task 1: Update date display format to dd/mm/yy

**Files:**
- Modify: `src/utils/dateUtils.ts`
- Modify: `src/utils/dateUtils.test.ts`

**Step 1: Write a failing test for the new format**

In `src/utils/dateUtils.test.ts`, add after the existing `formatDate` tests:

```ts
it('formatDisplayDate returns dd/mm/yy', () => {
  expect(formatDisplayDate('2026-03-15')).toBe('15/03/26')
})

it('formatDisplayDate handles datetime strings', () => {
  expect(formatDisplayDate('2026-12-01T14:00:00Z')).toBe('01/12/26')
})
```

**Step 2: Run to confirm it fails**

```bash
npx vitest run src/utils/dateUtils.test.ts
```
Expected: FAIL — `'15/03/26'` received `'15/03'` (current implementation omits year).

**Step 3: Implement**

In `src/utils/dateUtils.ts`, replace the `formatDisplayDate` function:

```ts
export function formatDisplayDate(iso: string): string {
  const date = iso.split('T')[0]
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year.slice(-2)}`
}
```

**Step 4: Run tests to confirm pass**

```bash
npx vitest run src/utils/dateUtils.test.ts
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/utils/dateUtils.ts src/utils/dateUtils.test.ts
git commit -m "feat: format display dates as dd/mm/yy"
```

---

### Task 2: Army ID as primary soldier ID

**Files:**
- Modify: `src/models/Soldier.ts`
- Modify: `src/utils/validation.ts`
- Modify: `src/utils/validation.test.ts`
- Modify: `src/services/soldierRepository.ts`
- Modify: `src/services/soldierRepository.test.ts`

**Background:** Currently `CreateSoldierInput` has no `id` — the repository calls `generateId()` internally. We want the user to supply the army ID number, which becomes the `Soldier.id`.

**Step 1: Add `id` to `CreateSoldierInput`**

In `src/models/Soldier.ts`, update:

```ts
export interface CreateSoldierInput {
  id: string          // army ID number, e.g. "1234567" — user-supplied
  name: string
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
}
```

**Step 2: Add validation test for required army ID**

In `src/utils/validation.test.ts`, add inside `describe('validateSoldier')`:

```ts
it('returns error when id is missing', () => {
  const input = { id: '', name: 'Yoni', role: 'Driver' as SoldierRole, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.id).toBeTruthy()
})

it('returns no id error when id is provided', () => {
  const input = { id: '1234567', name: 'Yoni', role: 'Driver' as SoldierRole, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.id).toBeUndefined()
})
```

**Step 3: Run to confirm validation tests fail**

```bash
npx vitest run src/utils/validation.test.ts
```
Expected: FAIL — `validateSoldier` doesn't check `id` yet.

**Step 4: Update `validateSoldier` in `src/utils/validation.ts`**

Add at the top of the function body, before the name check:

```ts
if (!input.id || input.id.trim() === '') {
  errors.id = 'Army ID is required'
}
```

**Step 5: Write failing repo test for army ID usage**

In `src/services/soldierRepository.test.ts`, update the `create()` test to include `id`:

```ts
it('uses the provided army ID as the soldier id', async () => {
  vi.spyOn(mockSheets, 'appendValues').mockResolvedValue(undefined)
  vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW])

  const soldier = await repo.create({
    id: '9876543',
    name: 'Yoni Ben',
    role: 'Squad Leader',
    serviceStart: '2026-03-01',
    serviceEnd: '2026-10-31',
  })

  expect(soldier.id).toBe('9876543')
})
```

Also update the existing `create()` test that doesn't provide `id` — add `id: 'test-id'` to the input.

**Step 6: Run to confirm repo test fails**

```bash
npx vitest run src/services/soldierRepository.test.ts
```
Expected: TypeScript compile error (missing `id` field) or test failure.

**Step 7: Update `SoldierRepository.create()` in `src/services/soldierRepository.ts`**

Replace:
```ts
const soldier: Soldier = {
  id: generateId(),
```
With:
```ts
const soldier: Soldier = {
  id: input.id,
```

Also remove the `generateId` function (it is no longer used).

**Step 8: Run all tests**

```bash
npx vitest run
```
Expected: all PASS (some existing tests may need `id` added to their `create()` calls — fix each).

**Step 9: Commit**

```bash
git add src/models/Soldier.ts src/utils/validation.ts src/utils/validation.test.ts \
        src/services/soldierRepository.ts src/services/soldierRepository.test.ts
git commit -m "feat: use army ID as primary soldier identifier"
```

---

### Task 3: Active/Inactive status with reason (data layer)

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/models/Soldier.ts`
- Modify: `src/services/parsers.ts`
- Modify: `src/services/serializers.ts`
- Modify: `src/services/soldierRepository.ts`
- Modify: `src/services/soldierRepository.test.ts`
- Modify: `src/services/soldierService.ts`
- Modify: `src/services/soldierService.test.ts`

**Background:** Replace the 3-value `Active|Injured|Discharged` status with `Active|Inactive`. Add `inactiveReason?: string` field. This adds column M (`InactiveReason`) to the sheet.

**Step 1: Update constants**

In `src/constants/index.ts`, replace:
```ts
export const SOLDIER_STATUS = ['Active', 'Injured', 'Discharged'] as const
export type SoldierStatus = typeof SOLDIER_STATUS[number]
```
With:
```ts
export const SOLDIER_STATUS = ['Active', 'Inactive'] as const
export type SoldierStatus = typeof SOLDIER_STATUS[number]
```

**Step 2: Update `Soldier` model**

In `src/models/Soldier.ts`, add `inactiveReason` field to `Soldier` and `UpdateSoldierInput`:

```ts
export interface Soldier {
  id: string
  name: string
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
  initialFairness: number
  currentFairness: number
  status: SoldierStatus
  inactiveReason?: string     // new
  hoursWorked: number
  weekendLeavesCount: number
  midweekLeavesCount: number
  afterLeavesCount: number
}
```

In `UpdateSoldierInput`, add:
```ts
inactiveReason?: string
```

**Step 3: Update parser**

In `src/services/parsers.ts`, in `parseSoldier`, add before the closing `}`:
```ts
inactiveReason: get(row, headers, 'InactiveReason') || undefined,
```

Note: `get()` returns `''` if column is missing; convert to `undefined` with `|| undefined`.

**Step 4: Update serializer**

In `src/services/serializers.ts`, `serializeSoldier` currently returns 12 items. Add a 13th:
```ts
export function serializeSoldier(s: Soldier): string[] {
  return [
    s.id,
    s.name,
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
    s.inactiveReason ?? '',    // new column M
  ]
}
```

**Step 5: Update `SoldierRepository`**

In `src/services/soldierRepository.ts`:

a) Update `HEADER_ROW` to add `'InactiveReason'`:
```ts
const HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]
```

b) Update `range` from `A:L` to `A:M`:
```ts
this.range = `${this.tabName}!A:M`
```

c) In `update()`, change the sheet range from `L` to `M`:
```ts
await this.sheets.updateValues(
  this.spreadsheetId,
  `${this.tabName}!A${sheetRow}:M${sheetRow}`,
  [updatedRow]
)
```

d) The `update()` method must also handle `inactiveReason`:
```ts
...(input.inactiveReason !== undefined && { inactiveReason: input.inactiveReason }),
```

**Step 6: Write updated repo tests**

In `src/services/soldierRepository.test.ts`:

Update the constant definitions at the top:
```ts
const HEADER_ROW = [
  'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
  'InitialFairness', 'CurrentFairness', 'Status',
  'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
  'InactiveReason',
]

const SOLDIER_ROW = [
  's1', 'David Cohen', 'Driver', '2026-01-01', '2026-08-31',
  '0', '0', 'Active', '0', '0', '0', '0', '',
]

const SOLDIER_ROW_2 = [
  's2', 'Moshe Levi', 'Medic', '2026-02-01', '2026-09-30',
  '0', '1', 'Active', '8', '1', '0', '0', '',
]
```

Update all assertions that reference `'Soldiers!A1:L1'` → `'Soldiers!A1:M1'`, and range `'Soldiers!A:L'` → `'Soldiers!A:M'`. Update `update()` test assertion for row range `A2:L2` → `A2:M2`.

Add test for `inactiveReason` serialization:
```ts
it('serializes inactiveReason when updating status to Inactive', async () => {
  vi.spyOn(mockSheets, 'getValues').mockResolvedValue([HEADER_ROW, SOLDIER_ROW])
  const updateSpy = vi.spyOn(mockSheets, 'updateValues').mockResolvedValue(undefined)

  await repo.update({ id: 's1', status: 'Inactive', inactiveReason: 'Medical leave' })

  const calledRow = updateSpy.mock.calls[0][2][0] as string[]
  const reasonIdx = HEADER_ROW.indexOf('InactiveReason')
  expect(calledRow[reasonIdx]).toBe('Medical leave')
})
```

**Step 7: Update `soldierService.ts`**

Replace the entire service with:
```ts
import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { Soldier, CreateSoldierInput, SoldierStatus } from '../models'

export class SoldierService {
  constructor(
    private repo: SoldierRepository,
    private history: HistoryService,
  ) {}

  async create(input: CreateSoldierInput, changedBy: string): Promise<Soldier> {
    const soldier = await this.repo.create(input)
    await this.history.append('CREATE', 'Soldier', soldier.id, changedBy, `Created soldier ${soldier.name}`)
    return soldier
  }

  async updateStatus(id: string, status: SoldierStatus, changedBy: string, inactiveReason?: string): Promise<void> {
    await this.repo.update({ id, status, inactiveReason: inactiveReason ?? '' })
    await this.history.append('UPDATE_STATUS', 'Soldier', id, changedBy, `Status changed to ${status}${inactiveReason ? `: ${inactiveReason}` : ''}`)
  }
}
```

Note: `discharge()` is removed — it's replaced by `updateStatus(id, 'Inactive', changedBy, reason)`.

**Step 8: Update `soldierService.test.ts`**

Replace file content — update SOLDIER mock to use `status: 'Active'` (remove `'Injured'`/`'Discharged'`), remove `discharge()` test, update `updateStatus` test:

```ts
import { describe, it, expect, vi } from 'vitest'
import { SoldierService } from './soldierService'
import type { SoldierRepository } from './soldierRepository'
import type { HistoryService } from './historyService'
import type { Soldier } from '../models'

const MOCK_SOLDIER: Soldier = {
  id: '1234567', name: 'Yoni Ben', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

describe('SoldierService', () => {
  let repo: SoldierRepository
  let history: HistoryService
  let service: SoldierService

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(MOCK_SOLDIER),
      update: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    } as unknown as SoldierRepository
    history = { append: vi.fn().mockResolvedValue(undefined) } as unknown as HistoryService
    service = new SoldierService(repo, history)
  })

  it('create() calls repo.create and logs history', async () => {
    const input = { id: '1234567', name: 'Yoni Ben', role: 'Driver' as const, serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
    await service.create(input, 'admin@test.com')
    expect(repo.create).toHaveBeenCalledWith(input)
    expect(history.append).toHaveBeenCalledWith('CREATE', 'Soldier', '1234567', 'admin@test.com', expect.any(String))
  })

  it('updateStatus() sets Active status', async () => {
    await service.updateStatus('1234567', 'Active', 'admin@test.com')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', status: 'Active', inactiveReason: '' })
  })

  it('updateStatus() sets Inactive status with reason', async () => {
    await service.updateStatus('1234567', 'Inactive', 'admin@test.com', 'Medical leave')
    expect(repo.update).toHaveBeenCalledWith({ id: '1234567', status: 'Inactive', inactiveReason: 'Medical leave' })
  })
})
```

**Step 9: Run tests**

```bash
npx vitest run src/services/
```
Expected: all PASS.

**Step 10: Commit**

```bash
git add src/constants/index.ts src/models/Soldier.ts \
        src/services/parsers.ts src/services/serializers.ts \
        src/services/soldierRepository.ts src/services/soldierRepository.test.ts \
        src/services/soldierService.ts src/services/soldierService.test.ts
git commit -m "feat: Active/Inactive soldier status with inactiveReason column"
```

---

### Task 4: Update SoldiersPage UI

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Changes:**
1. Add **Army ID** field (`id`) to add-soldier form
2. Add **end-date-before-start-date** inline validation
3. Replace status badge + Discharge button with **checkbox** (Active/Inactive) + inline reason input
4. Add `onUpdateStatus` prop; remove `onDischarge` prop
5. Status filter: `Active` / `Inactive` only

**Step 1: Write failing component tests first**

Replace `src/components/SoldiersPage.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoldiersPage from './SoldiersPage'
import type { Soldier, AppConfig, LeaveAssignment } from '../models'
import React from 'react'

const BASE_CONFIG: AppConfig = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
  taskTypeRestPeriods: {},
  adminEmails: [],
}

const SOLDIERS: Soldier[] = [
  {
    id: '1111111', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 2.5, status: 'Active',
    hoursWorked: 24, weekendLeavesCount: 1, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: '2222222', name: 'Moshe Levi', role: 'Medic',
    serviceStart: '2026-02-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 1.0, status: 'Inactive',
    inactiveReason: 'Medical leave',
    hoursWorked: 8, weekendLeavesCount: 0, midweekLeavesCount: 1, afterLeavesCount: 0,
  },
]

describe('SoldiersPage', () => {
  it('renders all soldier names', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows loading indicator when loading', () => {
    render(<SoldiersPage soldiers={[]} loading onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no soldiers', () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText(/no soldiers/i)).toBeInTheDocument()
  })

  it('shows a checked checkbox for Active soldiers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    expect(checkboxes[0]).toBeChecked()    // David: Active
    expect(checkboxes[1]).not.toBeChecked() // Moshe: Inactive
  })

  it('shows reason text next to inactive soldiers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('Medical leave')).toBeInTheDocument()
  })

  it('calls onUpdateStatus with Active when checkbox is checked', async () => {
    const onUpdateStatus = vi.fn()
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={onUpdateStatus} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[1]) // Moshe: Inactive → Active
    expect(onUpdateStatus).toHaveBeenCalledWith('2222222', 'Active', undefined)
  })

  it('shows inline reason input when unchecking an active soldier', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[0]) // David: Active → pending reason input
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument()
  })

  it('calls onUpdateStatus with Inactive + reason when reason is confirmed', async () => {
    const onUpdateStatus = vi.fn()
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={onUpdateStatus} onAddSoldier={vi.fn()} />)
    const checkboxes = screen.getAllByRole('checkbox', { name: /active status/i })
    await userEvent.click(checkboxes[0]) // open reason input
    await userEvent.type(screen.getByPlaceholderText(/reason/i), 'Sick')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onUpdateStatus).toHaveBeenCalledWith('1111111', 'Inactive', 'Sick')
  })

  it('shows Fairness and Hours column headers', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByText('Fairness')).toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
  })

  it('shows add form when Add Soldier button is clicked', async () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/army id/i)).toBeInTheDocument()
  })

  it('calls onAddSoldier with army id and form data on submit', async () => {
    const onAddSoldier = vi.fn()
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={onAddSoldier} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))

    await userEvent.type(screen.getByPlaceholderText(/army id/i), '9876543')
    await userEvent.type(screen.getByPlaceholderText(/name/i), 'Yoni Ben')
    await userEvent.type(screen.getByLabelText(/service start/i), '2026-03-01')
    await userEvent.type(screen.getByLabelText(/service end/i), '2026-12-31')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(onAddSoldier).toHaveBeenCalledWith(
      expect.objectContaining({ id: '9876543', name: 'Yoni Ben' })
    )
  })

  it('disables Add button and shows error when end date is before start date', async () => {
    render(<SoldiersPage soldiers={[]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))

    await userEvent.type(screen.getByLabelText(/service start/i), '2026-12-01')
    await userEvent.type(screen.getByLabelText(/service end/i), '2026-01-01')

    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
    expect(screen.getByText(/end date must be after start/i)).toBeInTheDocument()
  })

  it('filters soldiers by status Active', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'Active')
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
    expect(screen.queryByText('Moshe Levi')).not.toBeInTheDocument()
  })

  it('filters soldiers by status Inactive', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'Inactive')
    expect(screen.queryByText('David Cohen')).not.toBeInTheDocument()
    expect(screen.getByText('Moshe Levi')).toBeInTheDocument()
  })

  it('shows Adjust button for each soldier', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /adjust/i })).toHaveLength(2)
  })

  it('calls onAdjustFairness on submit', async () => {
    const onAdjustFairness = vi.fn()
    render(<SoldiersPage soldiers={[SOLDIERS[0]]} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} onAdjustFairness={onAdjustFairness} />)
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }))
    await userEvent.type(screen.getByLabelText(/delta/i), '2')
    await userEvent.type(screen.getByLabelText(/reason/i), 'Extra duty')
    await userEvent.click(screen.getByRole('button', { name: /apply/i }))
    expect(onAdjustFairness).toHaveBeenCalledWith('1111111', 2, 'Extra duty')
  })

  it('shows Quota column header when configData is provided', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} configData={BASE_CONFIG} leaveAssignments={[]} />)
    expect(screen.getByText('Quota')).toBeInTheDocument()
  })

  it('renders a name filter input', () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search soldiers/i)).toBeInTheDocument()
  })

  it('sorts soldiers by name ascending when Name header clicked', async () => {
    render(<SoldiersPage soldiers={SOLDIERS} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
    await userEvent.click(screen.getByRole('columnheader', { name: /name/i }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('David Cohen')
    expect(rows[1]).toHaveTextContent('Moshe Levi')
  })
})
```

**Step 2: Run to confirm tests fail**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: many FAIL (old prop names, old status values, missing army ID field).

**Step 3: Rewrite `SoldiersPage.tsx`**

Replace `src/components/SoldiersPage.tsx` with:

```tsx
import React, { useState } from 'react'
import { ROLES } from '../constants'
import type { Soldier, CreateSoldierInput, SoldierRole, SoldierStatus, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'

interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onUpdateStatus: (soldierId: string, status: SoldierStatus, reason?: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
  onAdjustFairness?: (soldierId: string, delta: number, reason: string) => void
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
}

const EMPTY_FORM: CreateSoldierInput = {
  id: '',
  name: '',
  role: 'Driver',
  serviceStart: '',
  serviceEnd: '',
}

export default function SoldiersPage({ soldiers, loading, onUpdateStatus, onAddSoldier, onAdjustFairness, configData, leaveAssignments = [] }: SoldiersPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateSoldierInput>(EMPTY_FORM)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'fairness' | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  // Tracks which soldier is pending deactivation (needs reason)
  const [pendingInactiveId, setPendingInactiveId] = useState<string | null>(null)
  const [pendingReason, setPendingReason] = useState('')

  const endBeforeStart =
    form.serviceStart && form.serviceEnd && form.serviceEnd <= form.serviceStart

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (endBeforeStart) return
    onAddSoldier(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleAdjustSubmit(soldierId: string) {
    const delta = parseFloat(adjustDelta)
    if (!isNaN(delta) && adjustReason.trim()) {
      onAdjustFairness?.(soldierId, delta, adjustReason.trim())
      setAdjustingId(null)
      setAdjustDelta('')
      setAdjustReason('')
    }
  }

  function handleCheckboxChange(soldier: Soldier) {
    if (soldier.status === 'Active') {
      // Show inline reason input before marking inactive
      setPendingInactiveId(soldier.id)
      setPendingReason('')
    } else {
      // Reactivate immediately
      onUpdateStatus(soldier.id, 'Active', undefined)
    }
  }

  function handleConfirmInactive(soldierId: string) {
    onUpdateStatus(soldierId, 'Inactive', pendingReason || undefined)
    setPendingInactiveId(null)
    setPendingReason('')
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading soldiers…</div>
  }

  function handleSortClick(key: 'name' | 'fairness') {
    if (sortKey === key) {
      setSortAsc(a => !a)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const filteredSoldiers = soldiers
    .filter(s => {
      const nameMatch = nameFilter === '' || s.name.toLowerCase().includes(nameFilter.toLowerCase())
      const roleMatch = roleFilter === '' || s.role === roleFilter
      const statusMatch = statusFilter === '' || s.status === statusFilter
      return nameMatch && roleMatch && statusMatch
    })
    .sort((a, b) => {
      if (!sortKey) return 0
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      if (sortKey === 'fairness') cmp = a.currentFairness - b.currentFairness
      return sortAsc ? cmp : -cmp
    })

  const avgFairness = soldiers.length
    ? soldiers.reduce((sum, s) => sum + s.currentFairness, 0) / soldiers.length
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-olive-800">Soldiers</h2>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800"
        >
          Add Soldier
        </button>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Search soldiers"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-olive-200 shadow-sm p-4 space-y-3">
          <div>
            <input
              placeholder="Army ID"
              value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <input
              placeholder="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as SoldierRole }))}
              className="w-full border rounded px-3 py-1.5 text-sm"
              aria-label="Role"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-olive-600 mb-1" htmlFor="svc-start">Service start</label>
            <input
              id="svc-start"
              type="date"
              value={form.serviceStart}
              onChange={e => setForm(f => ({ ...f, serviceStart: e.target.value }))}
              required
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-olive-600 mb-1" htmlFor="svc-end">Service end</label>
            <input
              id="svc-end"
              type="date"
              value={form.serviceEnd}
              onChange={e => setForm(f => ({ ...f, serviceEnd: e.target.value }))}
              required
              className={`w-full border rounded px-3 py-1.5 text-sm ${endBeforeStart ? 'border-red-400' : ''}`}
            />
            {endBeforeStart && (
              <p className="text-xs text-red-600 mt-1">End date must be after start date</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!!endBeforeStart}
              className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded-lg hover:bg-olive-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-olive-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {soldiers.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">No soldiers found.</p>
      )}

      {soldiers.length > 0 && (
        <div className="bg-white rounded-lg border border-olive-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-olive-700 text-white">
              <tr>
                <th className="text-left px-4 py-2">Active</th>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-600"
                  onClick={() => handleSortClick('name')}
                >
                  Name{sortKey === 'name' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Role</th>
                <th
                  className="text-left px-4 py-2 cursor-pointer select-none hover:bg-olive-600"
                  onClick={() => handleSortClick('fairness')}
                >
                  Fairness{sortKey === 'fairness' ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
                <th className="text-left px-4 py-2">Hours</th>
                {configData && <th className="text-left px-4 py-2">Quota</th>}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filteredSoldiers.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="border-t">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label="active status"
                        checked={s.status === 'Active'}
                        onChange={() => handleCheckboxChange(s)}
                        className="cursor-pointer"
                      />
                      {s.status === 'Inactive' && s.inactiveReason && (
                        <span className="ml-2 text-xs text-gray-500">{s.inactiveReason}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2 text-olive-500">{s.role}</td>
                    <td className="px-4 py-2">
                      <FairnessBar score={s.currentFairness} average={avgFairness} />
                    </td>
                    <td className="px-4 py-2 text-olive-500 text-xs">{s.hoursWorked}h</td>
                    {configData && (
                      <td className="px-4 py-2 text-olive-500 text-xs">
                        <span>{calculateLeaveEntitlement(s, configData)}</span>
                        {' '}<span className="text-gray-400">{countUsedLeaveDays(s.id, leaveAssignments)} used</span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setAdjustingId(id => id === s.id ? null : s.id)}
                        className="text-xs text-olive-700 hover:text-olive-800"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>

                  {pendingInactiveId === s.id && (
                    <tr className="bg-red-50 border-t">
                      <td colSpan={configData ? 7 : 6} className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-red-700">Reason for deactivation:</span>
                          <input
                            type="text"
                            value={pendingReason}
                            onChange={e => setPendingReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 border rounded px-2 py-1 text-xs min-w-[120px]"
                          />
                          <button
                            onClick={() => handleConfirmInactive(s.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setPendingInactiveId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {adjustingId === s.id && (
                    <tr className="bg-olive-50 border-t">
                      <td colSpan={configData ? 7 : 6} className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-olive-600" htmlFor={`delta-${s.id}`}>Delta</label>
                          <input
                            id={`delta-${s.id}`}
                            type="number"
                            step="0.5"
                            value={adjustDelta}
                            onChange={e => setAdjustDelta(e.target.value)}
                            className="w-20 border rounded px-2 py-1 text-xs"
                            placeholder="e.g. 2 or -1"
                          />
                          <label className="text-xs text-olive-600" htmlFor={`reason-${s.id}`}>Reason</label>
                          <input
                            id={`reason-${s.id}`}
                            type="text"
                            value={adjustReason}
                            onChange={e => setAdjustReason(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-xs min-w-[120px]"
                            placeholder="Reason for adjustment"
                          />
                          <button
                            onClick={() => handleAdjustSubmit(s.id)}
                            className="px-2 py-1 text-xs bg-olive-700 text-white rounded hover:bg-olive-800"
                          >
                            Apply
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: SoldiersPage — army ID field, date validation, Active/Inactive toggle"
```

---

### Task 5: Wire up App.tsx

**Files:**
- Modify: `src/App.tsx`

**Changes:**
1. Fix `tabPrefix` bug: fall back to unit name if `tabPrefix` is empty
2. Replace `handleDischarge` with `handleUpdateStatus`
3. Update `SoldiersPage` props: `onUpdateStatus` instead of `onDischarge`

**Step 1: Apply changes to `src/App.tsx`**

a) Replace `handleDischarge`:

```ts
async function handleUpdateStatus(soldierId: string, status: SoldierStatus, reason?: string) {
  try {
    await ds?.soldierService.updateStatus(soldierId, status, 'user', reason)
    reload()
    addToast(status === 'Active' ? 'Soldier reactivated' : 'Soldier deactivated', 'success')
  } catch {
    addToast('Failed to update soldier status', 'error')
  }
}
```

Import `SoldierStatus` by adding it to the existing import from `'./constants'`:
```ts
import type { SoldierRole, SoldierStatus } from './constants'
```

b) Update `SoldiersPage` usage (around line 191):
```tsx
{section === 'soldiers' && (
  <SoldiersPage
    soldiers={soldiers}
    onUpdateStatus={handleUpdateStatus}
    onAddSoldier={handleAddSoldier}
    onAdjustFairness={handleAdjustFairness}
    leaveAssignments={leaveAssignments}
  />
)}
```

c) Fix the tabPrefix bug (line ~315 in `AppContent`):
```tsx
tabPrefix={activeUnit?.tabPrefix || activeUnit?.name || ''}
```

**Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: all PASS.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: wire onUpdateStatus, fall back to unit name for tabPrefix"
```

---

### Task 6: Update SUMMARY.md

**Step 1:** Update `SUMMARY.md` to reflect:
- `SOLDIER_STATUS` is now `['Active', 'Inactive']`
- `Soldier` model has `inactiveReason?: string`
- `CreateSoldierInput` now requires `id` (army ID)
- `SoldierRepository` range is `A:M`, header has 13 columns
- `SoldierService` has no `discharge()` — use `updateStatus(id, 'Inactive', changedBy, reason)`
- `SoldiersPage` prop is `onUpdateStatus` (no `onDischarge`)
- `formatDisplayDate` now returns `DD/MM/YY`
- tabPrefix bug fixed in `App.tsx`

**Step 2:** Commit
```bash
git add SUMMARY.md
git commit -m "docs: update SUMMARY.md after soldier features implementation"
```
