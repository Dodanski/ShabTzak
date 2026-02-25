# Multi-Tenancy + Admin Role Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-tenancy (multiple units, each with its own Google Spreadsheet) and two roles (Admin and Commander) to the ShabTzak app, with a master spreadsheet as the unit registry.

**Architecture:** `VITE_SPREADSHEET_ID` now points to a "master spreadsheet" with `Admins`, `Units`, and `Commanders` tabs. On login, the app reads the master spreadsheet to resolve the user's role: admins see an Admin Panel where they can manage units/commanders and enter any unit, commanders are auto-routed to their assigned unit. A new `MasterDataService` handles all master-spreadsheet operations; the existing `DataService` is reused unchanged for unit spreadsheets.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Google Sheets API v4, Vitest + Testing Library

**Design doc:** `docs/plans/2026-02-25-multi-tenancy-admin-role-design.md`

---

## Context for implementer

Read these files before starting any task — they show the patterns you must follow:

- `src/services/soldierRepository.ts` — repository pattern (self-healing headers, cache, parse/serialize)
- `src/services/dataService.ts` — DataService facade pattern
- `src/services/googleSheets.ts` — GoogleSheetsService (understand existing methods)
- `src/services/setupService.ts` — how tabs are created with batchUpdate
- `src/components/AppShell.tsx` — current nav structure
- `src/App.tsx` — current routing and state management
- `src/config/env.ts` — env config pattern

Run tests with: `npx vitest run`

---

### Task 1: Master models + MASTER_SHEET_TABS constant

**Files:**
- Create: `src/models/Master.ts`
- Modify: `src/constants/index.ts`
- Modify: `src/models/index.ts`

No test file needed — pure type definitions have no runtime behavior to test.

**Step 1: Create `src/models/Master.ts`**

```typescript
export interface Admin {
  id: string
  email: string
  addedAt: string
  addedBy: string
}

export interface CreateAdminInput {
  email: string
}

export interface Unit {
  id: string
  name: string
  spreadsheetId: string
  createdAt: string
  createdBy: string
}

export interface CreateUnitInput {
  name: string
  spreadsheetId: string
}

export interface Commander {
  id: string
  email: string
  unitId: string
  addedAt: string
  addedBy: string
}

export interface CreateCommanderInput {
  email: string
  unitId: string
}
```

**Step 2: Add `MASTER_SHEET_TABS` to `src/constants/index.ts`**

Append at the end of the file:

```typescript
export const MASTER_SHEET_TABS = {
  ADMINS: 'Admins',
  UNITS: 'Units',
  COMMANDERS: 'Commanders',
} as const
```

**Step 3: Export Master from `src/models/index.ts`**

Add this line at the end:

```typescript
export * from './Master'
```

**Step 4: Run tests to confirm nothing broke**

```bash
npx vitest run
```
Expected: all tests pass (458 passing)

**Step 5: Commit**

```bash
git add src/models/Master.ts src/constants/index.ts src/models/index.ts
git commit -m "feat: add master spreadsheet models and MASTER_SHEET_TABS constant"
```

---

### Task 2: Add `clearValues` to GoogleSheetsService

Needed by repository remove() methods to clear a range before rewriting.

**Files:**
- Modify: `src/services/googleSheets.ts`
- Modify: `src/services/googleSheets.test.ts`

**Step 1: Read `src/services/googleSheets.ts` and `src/services/googleSheets.test.ts` first**

Understand the existing `getValues`, `updateValues`, `appendValues` pattern. The new method follows the same fetch pattern.

**Step 2: Write the failing test in `src/services/googleSheets.test.ts`**

Add this test in the existing describe block:

```typescript
it('clearValues posts to the :clear endpoint', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  const service = new GoogleSheetsService('token123')
  await service.clearValues('spreadsheet1', 'Admins!A:D')
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining(':clear'),
    expect.objectContaining({ method: 'POST' })
  )
})
```

**Step 3: Run to confirm it fails**

```bash
npx vitest run src/services/googleSheets.test.ts
```
Expected: FAIL — "clearValues is not a function"

**Step 4: Implement `clearValues` in `src/services/googleSheets.ts`**

Add this method to the `GoogleSheetsService` class, following the same pattern as existing methods (look at how `appendValues` is implemented):

```typescript
async clearValues(spreadsheetId: string, range: string): Promise<void> {
  const encodedRange = encodeURIComponent(range)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:clear`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Failed to clear range: ${res.status}`)
}
```

**Step 5: Run to confirm it passes**

```bash
npx vitest run src/services/googleSheets.test.ts
```
Expected: all tests pass

**Step 6: Commit**

```bash
git add src/services/googleSheets.ts src/services/googleSheets.test.ts
git commit -m "feat: add clearValues to GoogleSheetsService"
```

---

### Task 3: AdminRepository

**Files:**
- Create: `src/services/adminRepository.ts`
- Create: `src/services/adminRepository.test.ts`

**Step 1: Write the failing tests in `src/services/adminRepository.test.ts`**

Look at `src/services/soldierRepository.test.ts` for the test pattern (vi.fn() mocks for sheets, SheetCache).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminRepository } from './adminRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new AdminRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminRepository', () => {
  it('list() returns empty array when sheet has only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['AdminID', 'Email', 'AddedAt', 'AddedBy']])
    const repo = makeRepo()
    expect(await repo.list()).toEqual([])
  })

  it('list() parses admin rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['AdminID', 'Email', 'AddedAt', 'AddedBy'],
      ['admin-1', 'alice@example.com', '2026-01-01T00:00:00.000Z', 'system'],
    ])
    const repo = makeRepo()
    const admins = await repo.list()
    expect(admins).toHaveLength(1)
    expect(admins[0]).toMatchObject({ id: 'admin-1', email: 'alice@example.com', addedBy: 'system' })
  })

  it('create() appends a row and returns the admin', async () => {
    mockSheets.getValues.mockResolvedValue([['AdminID', 'Email', 'AddedAt', 'AddedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    const admin = await repo.create({ email: 'bob@example.com' }, 'alice@example.com')
    expect(admin.email).toBe('bob@example.com')
    expect(admin.addedBy).toBe('alice@example.com')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header row on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    await repo.create({ email: 'bob@example.com' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['AdminID', 'Email', 'AddedAt', 'AddedBy']]
    )
  })

  it('remove() clears and rewrites without the removed admin', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['AdminID', 'Email', 'AddedAt', 'AddedBy'],
      ['admin-1', 'alice@example.com', '2026-01-01T00:00:00.000Z', 'system'],
      ['admin-2', 'bob@example.com', '2026-01-02T00:00:00.000Z', 'system'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    const repo = makeRepo()
    await repo.remove('admin-1')
    expect(mockSheets.clearValues).toHaveBeenCalledOnce()
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining admin
    expect(writtenRows[1][0]).toBe('admin-2')
  })
})
```

**Step 2: Run to confirm tests fail**

```bash
npx vitest run src/services/adminRepository.test.ts
```
Expected: FAIL — "AdminRepository is not a constructor"

**Step 3: Implement `src/services/adminRepository.ts`**

Follow the exact same pattern as `src/services/soldierRepository.ts`. Key differences:
- Range: `${MASTER_SHEET_TABS.ADMINS}!A:D`
- HEADER_ROW: `['AdminID', 'Email', 'AddedAt', 'AddedBy']`
- Self-heal check: `allRows[0]?.[0] !== 'AdminID'`
- Header range for self-heal: `${MASTER_SHEET_TABS.ADMINS}!A1:D1`

Add a `remove(id: string)` method (not in soldierRepository):

```typescript
async remove(id: string): Promise<void> {
  const { headers, rows } = await this.fetchAll()
  const remaining = rows.filter(r => r[headers.indexOf('AdminID')] !== id)
  await this.sheets.clearValues(this.spreadsheetId, `${MASTER_SHEET_TABS.ADMINS}!A:D`)
  await this.sheets.updateValues(
    this.spreadsheetId,
    `${MASTER_SHEET_TABS.ADMINS}!A1`,
    [HEADER_ROW, ...remaining]
  )
  this.cache.invalidate(CACHE_KEY)
}
```

Full `create()` signature: `async create(input: CreateAdminInput, createdBy: string): Promise<Admin>`

The `Admin` object created:
```typescript
const admin: Admin = {
  id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  email: input.email,
  addedAt: new Date().toISOString(),
  addedBy: createdBy,
}
```

**Step 4: Run to confirm tests pass**

```bash
npx vitest run src/services/adminRepository.test.ts
```
Expected: 5 tests pass

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass

**Step 6: Commit**

```bash
git add src/services/adminRepository.ts src/services/adminRepository.test.ts
git commit -m "feat: add AdminRepository for master spreadsheet Admins tab"
```

---

### Task 4: UnitRepository

**Files:**
- Create: `src/services/unitRepository.ts`
- Create: `src/services/unitRepository.test.ts`

**Step 1: Write failing tests in `src/services/unitRepository.test.ts`**

Same pattern as adminRepository.test.ts. Key fields: `UnitID`, `Name`, `SpreadsheetID`, `CreatedAt`, `CreatedBy`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnitRepository } from './unitRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new UnitRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('UnitRepository', () => {
  it('list() returns empty array when only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']])
    expect(await makeRepo().list()).toEqual([])
  })

  it('list() parses unit rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy'],
      ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
    ])
    const units = await makeRepo().list()
    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({ id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc' })
  })

  it('create() appends a row and returns the unit', async () => {
    mockSheets.getValues.mockResolvedValue([['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const unit = await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz' }, 'admin@example.com')
    expect(unit.name).toBe('Bravo')
    expect(unit.spreadsheetId).toBe('sheet-xyz')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    await makeRepo().create({ name: 'Bravo', spreadsheetId: 'sheet-xyz' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']]
    )
  })

  it('remove() clears and rewrites without the removed unit', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy'],
      ['unit-1', 'Alpha', 'sheet-abc', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['unit-2', 'Bravo', 'sheet-xyz', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    await makeRepo().remove('unit-1')
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining
    expect(writtenRows[1][0]).toBe('unit-2')
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/services/unitRepository.test.ts
```
Expected: FAIL

**Step 3: Implement `src/services/unitRepository.ts`**

Same pattern as adminRepository.ts. Key details:
- Range: `${MASTER_SHEET_TABS.UNITS}!A:E`
- HEADER_ROW: `['UnitID', 'Name', 'SpreadsheetID', 'CreatedAt', 'CreatedBy']`
- Self-heal check: `allRows[0]?.[0] !== 'UnitID'`
- Header range for self-heal: `${MASTER_SHEET_TABS.UNITS}!A1:E1`
- ID prefix: `unit-`
- `create()` signature: `async create(input: CreateUnitInput, createdBy: string): Promise<Unit>`

Unit object:
```typescript
const unit: Unit = {
  id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: input.name,
  spreadsheetId: input.spreadsheetId,
  createdAt: new Date().toISOString(),
  createdBy: createdBy,
}
```

`remove()` uses `${MASTER_SHEET_TABS.UNITS}!A:E` as clear range, `${MASTER_SHEET_TABS.UNITS}!A1` as write target.

**Step 4: Run tests**

```bash
npx vitest run src/services/unitRepository.test.ts
```
Expected: 5 tests pass

**Step 5: Run full suite, commit**

```bash
npx vitest run
git add src/services/unitRepository.ts src/services/unitRepository.test.ts
git commit -m "feat: add UnitRepository for master spreadsheet Units tab"
```

---

### Task 5: CommanderRepository

**Files:**
- Create: `src/services/commanderRepository.ts`
- Create: `src/services/commanderRepository.test.ts`

**Step 1: Write failing tests in `src/services/commanderRepository.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommanderRepository } from './commanderRepository'
import { SheetCache } from './cache'

const mockSheets = {
  getValues: vi.fn(),
  appendValues: vi.fn(),
  updateValues: vi.fn(),
  clearValues: vi.fn(),
}

function makeRepo() {
  return new CommanderRepository(mockSheets as any, 'master-sheet-id', new SheetCache())
}

beforeEach(() => { vi.clearAllMocks() })

describe('CommanderRepository', () => {
  it('list() returns empty array when only header row', async () => {
    mockSheets.getValues.mockResolvedValue([['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']])
    expect(await makeRepo().list()).toEqual([])
  })

  it('list() parses commander rows correctly', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
    ])
    const commanders = await makeRepo().list()
    expect(commanders).toHaveLength(1)
    expect(commanders[0]).toMatchObject({ id: 'cmd-1', email: 'yossi@example.com', unitId: 'unit-1' })
  })

  it('listByUnit() returns only commanders for the given unitId', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['cmd-2', 'dana@example.com', 'unit-2', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    const repo = makeRepo()
    const result = await repo.listByUnit('unit-1')
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('yossi@example.com')
  })

  it('create() appends a row and returns the commander', async () => {
    mockSheets.getValues.mockResolvedValue([['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']])
    mockSheets.appendValues.mockResolvedValue(undefined)
    const cmd = await makeRepo().create({ email: 'moshe@example.com', unitId: 'unit-1' }, 'admin@example.com')
    expect(cmd.email).toBe('moshe@example.com')
    expect(cmd.unitId).toBe('unit-1')
    expect(mockSheets.appendValues).toHaveBeenCalledOnce()
  })

  it('create() self-heals missing header on empty sheet', async () => {
    mockSheets.getValues.mockResolvedValue([])
    mockSheets.updateValues.mockResolvedValue(undefined)
    mockSheets.appendValues.mockResolvedValue(undefined)
    await makeRepo().create({ email: 'moshe@example.com', unitId: 'unit-1' }, 'system')
    expect(mockSheets.updateValues).toHaveBeenCalledWith(
      'master-sheet-id',
      expect.stringContaining('A1'),
      [['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']]
    )
  })

  it('remove() clears and rewrites without the removed commander', async () => {
    mockSheets.getValues.mockResolvedValue([
      ['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy'],
      ['cmd-1', 'yossi@example.com', 'unit-1', '2026-01-01T00:00:00.000Z', 'admin@example.com'],
      ['cmd-2', 'dana@example.com', 'unit-1', '2026-01-02T00:00:00.000Z', 'admin@example.com'],
    ])
    mockSheets.clearValues.mockResolvedValue(undefined)
    mockSheets.updateValues.mockResolvedValue(undefined)
    await makeRepo().remove('cmd-1')
    const writtenRows = mockSheets.updateValues.mock.calls[0][2] as string[][]
    expect(writtenRows).toHaveLength(2) // header + 1 remaining
    expect(writtenRows[1][0]).toBe('cmd-2')
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/services/commanderRepository.test.ts
```

**Step 3: Implement `src/services/commanderRepository.ts`**

Same pattern as adminRepository.ts. Key details:
- Range: `${MASTER_SHEET_TABS.COMMANDERS}!A:E`
- HEADER_ROW: `['CommanderID', 'Email', 'UnitID', 'AddedAt', 'AddedBy']`
- Self-heal check: `allRows[0]?.[0] !== 'CommanderID'`
- ID prefix: `cmd-`
- `create()` signature: `async create(input: CreateCommanderInput, createdBy: string): Promise<Commander>`

Add `listByUnit(unitId: string)` method:
```typescript
async listByUnit(unitId: string): Promise<Commander[]> {
  const all = await this.list()
  return all.filter(c => c.unitId === unitId)
}
```

**Step 4–6: Run tests, run full suite, commit**

```bash
npx vitest run src/services/commanderRepository.test.ts
npx vitest run
git add src/services/commanderRepository.ts src/services/commanderRepository.test.ts
git commit -m "feat: add CommanderRepository for master spreadsheet Commanders tab"
```

---

### Task 6: MasterDataService

**Files:**
- Create: `src/services/masterDataService.ts`
- Create: `src/services/masterDataService.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MasterDataService } from './masterDataService'

// Mock the repositories
vi.mock('./adminRepository')
vi.mock('./unitRepository')
vi.mock('./commanderRepository')
vi.mock('./googleSheets')

import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { GoogleSheetsService } from './googleSheets'

beforeEach(() => { vi.clearAllMocks() })

describe('MasterDataService', () => {
  describe('resolveRole()', () => {
    it('returns { role: "admin" } when email is in admins list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('admin@example.com')
      expect(result).toEqual({ role: 'admin' })
    })

    it('returns { role: "commander", unit } when email is in commanders list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([
        { id: 'c1', email: 'cmd@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }
      ])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([
        { id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc', createdAt: '', createdBy: '' }
      ])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('cmd@example.com')
      expect(result).toEqual({
        role: 'commander',
        unitId: 'unit-1',
        unit: expect.objectContaining({ name: 'Alpha' })
      })
    })

    it('returns null when email is in neither list', async () => {
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(CommanderRepository.prototype.list).mockResolvedValue([])
      vi.mocked(UnitRepository.prototype.list).mockResolvedValue([])

      const svc = new MasterDataService('token', 'master-id')
      const result = await svc.resolveRole('unknown@example.com')
      expect(result).toBeNull()
    })
  })

  describe('initialize()', () => {
    it('seeds first admin when admins tab is empty', async () => {
      vi.mocked(GoogleSheetsService.prototype.getSheetTitles).mockResolvedValue(['Admins', 'Units', 'Commanders'])
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([])
      vi.mocked(AdminRepository.prototype.create).mockResolvedValue({
        id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: ''
      })

      const svc = new MasterDataService('token', 'master-id')
      await svc.initialize('admin@example.com')
      expect(AdminRepository.prototype.create).toHaveBeenCalledWith(
        { email: 'admin@example.com' }, 'system'
      )
    })

    it('does not seed admin when admins already exist', async () => {
      vi.mocked(GoogleSheetsService.prototype.getSheetTitles).mockResolvedValue(['Admins', 'Units', 'Commanders'])
      vi.mocked(AdminRepository.prototype.list).mockResolvedValue([
        { id: 'a1', email: 'admin@example.com', addedAt: '', addedBy: '' }
      ])

      const svc = new MasterDataService('token', 'master-id')
      await svc.initialize('admin@example.com')
      expect(AdminRepository.prototype.create).not.toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/services/masterDataService.test.ts
```

**Step 3: Implement `src/services/masterDataService.ts`**

```typescript
import { GoogleSheetsService } from './googleSheets'
import { SheetCache } from './cache'
import { AdminRepository } from './adminRepository'
import { UnitRepository } from './unitRepository'
import { CommanderRepository } from './commanderRepository'
import { MASTER_SHEET_TABS } from '../constants'
import type { Unit } from '../models'

export type ResolvedRole =
  | { role: 'admin' }
  | { role: 'commander'; unitId: string; unit: Unit }
  | null

export class MasterDataService {
  readonly admins: AdminRepository
  readonly units: UnitRepository
  readonly commanders: CommanderRepository
  private sheets: GoogleSheetsService
  private spreadsheetId: string

  constructor(accessToken: string, spreadsheetId: string) {
    this.sheets = new GoogleSheetsService(accessToken)
    this.spreadsheetId = spreadsheetId
    const cache = new SheetCache()
    this.admins = new AdminRepository(this.sheets, spreadsheetId, cache)
    this.units = new UnitRepository(this.sheets, spreadsheetId, cache)
    this.commanders = new CommanderRepository(this.sheets, spreadsheetId, cache)
  }

  /**
   * Creates missing master tabs and seeds the first admin from env.
   * Idempotent — safe to call on every app load.
   */
  async initialize(firstAdminEmail: string): Promise<void> {
    const titles = await this.sheets.getSheetTitles(this.spreadsheetId)
    const needed = Object.values(MASTER_SHEET_TABS)
    const missing = needed.filter(t => !titles.includes(t))

    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } },
      }))
      await this.sheets.batchUpdate(this.spreadsheetId, requests)
    }

    const admins = await this.admins.list()
    if (admins.length === 0 && firstAdminEmail) {
      await this.admins.create({ email: firstAdminEmail }, 'system')
    }
  }

  /**
   * Determines the role of the given email by checking the master spreadsheet.
   * Returns null if the email is not authorized.
   */
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

**Step 4–6: Run tests, full suite, commit**

```bash
npx vitest run src/services/masterDataService.test.ts
npx vitest run
git add src/services/masterDataService.ts src/services/masterDataService.test.ts
git commit -m "feat: add MasterDataService with role resolution and initialization"
```

---

### Task 7: App routing — role detection + AccessDeniedPage

**Files:**
- Create: `src/components/AccessDeniedPage.tsx`
- Create: `src/components/AccessDeniedPage.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing tests for AccessDeniedPage**

```typescript
// src/components/AccessDeniedPage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AccessDeniedPage from './AccessDeniedPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

describe('AccessDeniedPage', () => {
  it('renders access denied message', () => {
    render(<AccessDeniedPage />)
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    expect(screen.getByText(/contact your admin/i)).toBeInTheDocument()
  })

  it('renders a sign out button', () => {
    render(<AccessDeniedPage />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/components/AccessDeniedPage.test.tsx
```

**Step 3: Implement `src/components/AccessDeniedPage.tsx`**

```typescript
import { useAuth } from '../context/AuthContext'

export default function AccessDeniedPage() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
        <p className="text-gray-600">Your account is not authorized to access this application.</p>
        <p className="text-gray-500 text-sm">Contact your admin to get access.</p>
        <button
          onClick={signOut}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Run to confirm AccessDeniedPage tests pass**

```bash
npx vitest run src/components/AccessDeniedPage.test.tsx
```

**Step 5: Modify `src/App.tsx` for role-based routing**

Read the current `src/App.tsx` first. You will refactor `AppContent` to handle three app modes.

Replace the existing `AppContent` function with this new structure:

```typescript
type AppMode = 'loading' | 'admin' | 'unit' | 'denied'

function AppContent() {
  const { auth } = useAuth()
  const [appMode, setAppMode] = useState<AppMode>('loading')
  const [masterDs, setMasterDs] = useState<MasterDataService | null>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)

  // Role resolution on login
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.email || !auth.accessToken) {
      setAppMode('loading')
      return
    }
    const master = new MasterDataService(auth.accessToken, config.spreadsheetId)
    setMasterDs(master)
    master.initialize(config.adminEmail)
      .then(() => master.resolveRole(auth.email!))
      .then(resolved => {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  )
  if (appMode === 'denied') return <AccessDeniedPage />
  if (appMode === 'admin' && !activeUnit) {
    return (
      <AdminPanel
        masterDs={masterDs!}
        currentAdminEmail={auth.email!}
        onEnterUnit={(unit) => { setActiveUnit(unit); setAppMode('unit') }}
      />
    )
  }

  // Unit view — for both commanders and admins who entered a unit
  const spreadsheetId = activeUnit?.spreadsheetId ?? ''
  const isAdmin = appMode === 'admin'

  return (
    <UnitApp
      spreadsheetId={spreadsheetId}
      isAdmin={isAdmin}
      unitName={activeUnit?.name ?? ''}
      onBackToAdmin={isAdmin ? () => { setActiveUnit(null); setAppMode('admin') } : undefined}
    />
  )
}
```

Extract the existing unit app content into a new `UnitApp` component within `App.tsx`:

```typescript
interface UnitAppProps {
  spreadsheetId: string
  isAdmin: boolean
  unitName: string
  onBackToAdmin?: () => void
}

function UnitApp({ spreadsheetId, isAdmin, unitName, onBackToAdmin }: UnitAppProps) {
  // Move ALL existing AppContent state and logic here
  // (section, showLeaveForm, scheduleDates, useDataService, useToast, etc.)
  // Change: pass unitName and onBackToAdmin to AppShell
  // Change: remove Config and Setup sections from routing (not shown in unit view)
  // Change: use the passed spreadsheetId instead of config.spreadsheetId
  ...
}
```

Add these imports to `src/App.tsx`:
```typescript
import { MasterDataService } from './services/masterDataService'
import AdminPanel from './components/AdminPanel'
import AccessDeniedPage from './components/AccessDeniedPage'
import type { Unit } from './models'
import LoginPage from './components/LoginPage'
```

**Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass (some App.tsx tests may need updating — fix any failures)

**Step 7: Commit**

```bash
git add src/App.tsx src/components/AccessDeniedPage.tsx src/components/AccessDeniedPage.test.tsx
git commit -m "feat: add role-based routing (admin panel / unit view / access denied)"
```

---

### Task 8: AdminPanel + sub-tabs

**Files:**
- Create: `src/components/AdminPanel.tsx`
- Create: `src/components/AdminPanel.test.tsx`

**Step 1: Write failing tests**

```typescript
// src/components/AdminPanel.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminPanel from './AdminPanel'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { email: 'admin@example.com' }, signOut: vi.fn() }),
}))

const mockMasterDs = {
  admins: {
    list: vi.fn().mockResolvedValue([
      { id: 'a1', email: 'admin@example.com', addedAt: '2026-01-01T00:00:00.000Z', addedBy: 'system' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'a2', email: 'new@example.com', addedAt: '', addedBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  units: {
    list: vi.fn().mockResolvedValue([
      { id: 'unit-1', name: 'Alpha', spreadsheetId: 'sheet-abc', createdAt: '', createdBy: '' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'unit-2', name: 'Bravo', spreadsheetId: 'sheet-xyz', createdAt: '', createdBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  commanders: {
    list: vi.fn().mockResolvedValue([
      { id: 'cmd-1', email: 'cmd@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }
    ]),
    create: vi.fn().mockResolvedValue({ id: 'cmd-2', email: 'cmd2@example.com', unitId: 'unit-1', addedAt: '', addedBy: '' }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}

const BASE_PROPS = {
  masterDs: mockMasterDs as any,
  currentAdminEmail: 'admin@example.com',
  onEnterUnit: vi.fn(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('AdminPanel', () => {
  it('renders three tabs: Admins, Units, Commanders', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^admins$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^units$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^commanders$/i })).toBeInTheDocument()
    })
  })

  it('shows admin list by default', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => {
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })
  })

  it('shows units list when Units tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^units$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^units$/i }))
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
  })

  it('calls onEnterUnit when Enter Unit is clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^units$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^units$/i }))
    await waitFor(() => screen.getByRole('button', { name: /enter unit/i }))
    fireEvent.click(screen.getByRole('button', { name: /enter unit/i }))
    expect(BASE_PROPS.onEnterUnit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alpha' })
    )
  })

  it('shows commanders list when Commanders tab clicked', async () => {
    render(<AdminPanel {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /^commanders$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^commanders$/i }))
    await waitFor(() => {
      expect(screen.getByText('cmd@example.com')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```

**Step 3: Implement `src/components/AdminPanel.tsx`**

This is a self-contained page component. It has:

1. A header with "ShabTzak — Admin Panel" title and Sign Out button
2. Three tab buttons: Admins, Units, Commanders
3. Each tab loads and displays its data with add/remove controls

Key behaviors:
- Load data with `useEffect` on mount and on tab change
- "Enter Unit" button in Units tab calls `onEnterUnit(unit)`
- "Open Spreadsheet ↗" link in Units tab: `href={`https://docs.google.com/spreadsheets/d/${unit.spreadsheetId}`}` with `target="_blank"`
- When adding a unit, show a sharing guide below the form listing all admin emails + the new commander's email (fetch current admins list)
- "Remove" buttons for admins (cannot remove self — disable if `admin.email === currentAdminEmail`), units (warn if has commanders), commanders
- Each tab has an "Add" form inline (email input for admins/commanders, name + spreadsheet ID for units)

Structure:
```typescript
type AdminTab = 'admins' | 'units' | 'commanders'

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
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    const [a, u, c] = await Promise.all([
      masterDs.admins.list(),
      masterDs.units.list(),
      masterDs.commanders.list(),
    ])
    setAdmins(a); setUnits(u); setCommanders(c)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  // ... render tabs
}
```

**Step 4: Run tests**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```
Expected: 5 tests pass

**Step 5: Run full suite, commit**

```bash
npx vitest run
git add src/components/AdminPanel.tsx src/components/AdminPanel.test.tsx
git commit -m "feat: add AdminPanel with Admins/Units/Commanders tabs"
```

---

### Task 9: AppShell unit context + access control

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx` (if it exists; otherwise create)

**Step 1: Read `src/components/AppShell.tsx` and any existing tests**

Look for `src/components/AppShell.test.tsx`. If it doesn't exist, create it.

**Step 2: Write failing tests**

```typescript
// src/components/AppShell.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppShell from './AppShell'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ auth: { isAuthenticated: true, email: 'user@example.com' }, signOut: vi.fn() }),
}))

describe('AppShell', () => {
  it('shows unit name when unitName prop is provided', () => {
    render(<AppShell unitName="Platoon Alpha">content</AppShell>)
    expect(screen.getByText('Platoon Alpha')).toBeInTheDocument()
  })

  it('shows Back to Admin Panel button when onBackToAdmin is provided', () => {
    render(<AppShell onBackToAdmin={vi.fn()}>content</AppShell>)
    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument()
  })

  it('does not show Config or Setup links in unit view', () => {
    render(<AppShell unitName="Alpha">content</AppShell>)
    expect(screen.queryByText('Config')).not.toBeInTheDocument()
    expect(screen.queryByText('Setup')).not.toBeInTheDocument()
  })

  it('renders children', () => {
    render(<AppShell><div>hello</div></AppShell>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
```

**Step 3: Run to confirm failures**

```bash
npx vitest run src/components/AppShell.test.tsx
```

**Step 4: Modify `src/components/AppShell.tsx`**

Update the interface and component:

```typescript
interface AppShellProps {
  children?: React.ReactNode
  isAdmin?: boolean
  unitName?: string
  onBackToAdmin?: () => void
}

export default function AppShell({ children, unitName, onBackToAdmin }: AppShellProps) {
  // Unit view nav — no Config, no Setup
  const navLinks = [
    { href: '#', label: 'Dashboard' },
    { href: '#soldiers', label: 'Soldiers' },
    { href: '#tasks', label: 'Tasks' },
    { href: '#leave', label: 'Leave' },
    { href: '#schedule', label: 'Schedule' },
    { href: '#history', label: 'History' },
  ]

  // ... existing hash tracking, useAuth

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-600">ShabTzak</span>
            {unitName && (
              <span className="text-sm text-gray-500 border-l pl-3">{unitName}</span>
            )}
          </div>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            {navLinks.map(({ href, label }) => {
              const isActive = hash === href || (href === '#' && (hash === '' || hash === '#'))
              return (
                <a key={href} href={href} aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'text-blue-600 font-medium' : 'hover:text-blue-600'}>
                  {label}
                </a>
              )
            })}
          </nav>
          <div className="flex items-center gap-3">
            {onBackToAdmin && (
              <button onClick={onBackToAdmin}
                className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                ← Admin Panel
              </button>
            )}
            <button onClick={signOut}
              className="text-sm text-gray-600 hover:text-red-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
```

Note: Config and Setup are intentionally removed from the unit nav. Admins who need to edit config can do so directly in the unit's Google Spreadsheet.

**Step 5: Update `UnitApp` in `App.tsx` to pass `unitName` and `onBackToAdmin` to AppShell**

In the `UnitApp` component created in Task 7, update the AppShell usage:
```typescript
<AppShell unitName={unitName} onBackToAdmin={onBackToAdmin}>
```

Also remove the `config` and `setup` sections from `UnitApp`'s routing switch (they're not accessible from unit view).

**Step 6: Run tests**

```bash
npx vitest run src/components/AppShell.test.tsx
npx vitest run
```
Expected: all tests pass

**Step 7: Final commit**

```bash
git add src/components/AppShell.tsx src/components/AppShell.test.tsx src/App.tsx
git commit -m "feat: update AppShell for unit context (unit name, back to admin, no config/setup)"
```

---

## Final verification

```bash
npx vitest run
```
Expected: all tests pass (>458 passing — new tests added)

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors
