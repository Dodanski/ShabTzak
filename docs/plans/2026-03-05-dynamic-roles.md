# Dynamic Roles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move soldier roles from a hardcoded TypeScript array into an admin-managed `Roles` tab in the Google Sheets admin spreadsheet, editable via a new Roles tab in the Admin panel.

**Architecture:** New `RolesService` reads/writes a `Roles` tab (single `RoleName` column). `MasterDataService` gains a `roles` field. `SoldierRole` type widens to `string`. Components that render role dropdowns receive `roles: string[]` as a prop instead of importing the constant. Admin panel manages roles inline alongside admins/units/commanders.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, Google Sheets API (via GoogleSheetsService)

---

## Context: Key File Paths

| File | Purpose |
|------|---------|
| `src/constants/index.ts` | `ROLES` constant + `SoldierRole` type — both will change |
| `src/constants/index.test.ts` | Tests checking ROLES array — will need updating in final task |
| `src/services/rolesService.ts` | **Create** — list/create/delete roles in the Roles tab |
| `src/services/rolesService.test.ts` | **Create** — tests for RolesService |
| `src/services/masterDataService.ts` | Add `roles: RolesService` field + header for Roles tab |
| `src/utils/validation.ts` | Remove role validation (dropdown constrains input) |
| `src/utils/validation.test.ts` | Remove role validation test |
| `src/App.tsx` | Load roles in AppContent; thread as prop into UnitApp |
| `src/components/SoldiersPage.tsx` | Replace `ROLES` import with `roles` prop |
| `src/components/SoldiersPage.test.tsx` | Update to pass `roles` prop |
| `src/components/TasksPage.tsx` | Replace hardcoded `FORM_ROLES` with `roles` prop |
| `src/components/SchedulePage.tsx` | Replace `ROLES` import with `roles` prop |
| `src/components/AdminPanel.tsx` | Add Roles tab (list, add, delete) |

---

### Task 1: RolesService

**Files:**
- Modify: `src/constants/index.ts`
- Create: `src/services/rolesService.ts`
- Create: `src/services/rolesService.test.ts`

**Background:** `GoogleSheetsService` has `getValues`, `appendValues`, `clearValues`, `updateValues`. No row-delete API exists — `delete()` is implemented by reading all roles, clearing the column, and re-writing the filtered list. The tab has a `RoleName` header row on creation (added in Task 2).

**Step 1: Add ROLES to MASTER_SHEET_TABS**

In `src/constants/index.ts`, update `MASTER_SHEET_TABS`:

```ts
export const MASTER_SHEET_TABS = {
  ADMINS: 'Admins',
  UNITS: 'Units',
  COMMANDERS: 'Commanders',
  TASKS: 'Tasks',
  CONFIG: 'Config',
  HISTORY: 'History',
  ROLES: 'Roles',
} as const
```

**Step 2: Write failing tests**

Create `src/services/rolesService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RolesService } from './rolesService'
import type { GoogleSheetsService } from './googleSheets'

describe('RolesService', () => {
  let sheets: GoogleSheetsService
  let service: RolesService

  beforeEach(() => {
    sheets = {
      getValues: vi.fn(),
      appendValues: vi.fn().mockResolvedValue(undefined),
      clearValues: vi.fn().mockResolvedValue(undefined),
      updateValues: vi.fn().mockResolvedValue(undefined),
    } as unknown as GoogleSheetsService
    service = new RolesService(sheets, 'sheet-id')
  })

  it('list() returns empty array when tab has no data rows', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([['RoleName']])
    expect(await service.list()).toEqual([])
  })

  it('list() returns empty array when getValues returns nothing', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([])
    expect(await service.list()).toEqual([])
  })

  it('list() returns role names skipping the header row', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'], ['Medic'],
    ])
    expect(await service.list()).toEqual(['Driver', 'Medic'])
  })

  it('create() appends the role name as a row', async () => {
    const spy = vi.spyOn(sheets, 'appendValues').mockResolvedValue(undefined)
    await service.create('NewRole')
    expect(spy).toHaveBeenCalledWith('sheet-id', 'Roles!A:A', [['NewRole']])
  })

  it('delete() rewrites the column without the deleted role', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'], ['Medic'], ['NewRole'],
    ])
    const clearSpy = vi.spyOn(sheets, 'clearValues').mockResolvedValue(undefined)
    const updateSpy = vi.spyOn(sheets, 'updateValues').mockResolvedValue(undefined)

    await service.delete('Medic')

    expect(clearSpy).toHaveBeenCalledWith('sheet-id', 'Roles!A:A')
    expect(updateSpy).toHaveBeenCalledWith('sheet-id', 'Roles!A1', [
      ['RoleName'], ['Driver'], ['NewRole'],
    ])
  })

  it('delete() is a no-op when role is not found', async () => {
    vi.spyOn(sheets, 'getValues').mockResolvedValue([
      ['RoleName'], ['Driver'],
    ])
    const clearSpy = vi.spyOn(sheets, 'clearValues').mockResolvedValue(undefined)
    await service.delete('NonExistent')
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
```

**Step 3: Run to confirm fails**

```bash
npx vitest run src/services/rolesService.test.ts
```
Expected: FAIL — `rolesService.ts` doesn't exist yet

**Step 4: Create RolesService**

Create `src/services/rolesService.ts`:

```ts
import type { GoogleSheetsService } from './googleSheets'
import { MASTER_SHEET_TABS } from '../constants'

const TAB = MASTER_SHEET_TABS.ROLES
const RANGE = `${TAB}!A:A`
const HEADER = 'RoleName'

export class RolesService {
  constructor(
    private sheets: GoogleSheetsService,
    private spreadsheetId: string,
  ) {}

  async list(): Promise<string[]> {
    const rows = await this.sheets.getValues(this.spreadsheetId, RANGE)
    if (!rows || rows.length === 0) return []
    const data = rows[0]?.[0] === HEADER ? rows.slice(1) : rows
    return data.map(r => r[0]).filter(Boolean)
  }

  async create(name: string): Promise<void> {
    await this.sheets.appendValues(this.spreadsheetId, RANGE, [[name]])
  }

  async delete(name: string): Promise<void> {
    const current = await this.list()
    if (!current.includes(name)) return
    const remaining = current.filter(r => r !== name)
    await this.sheets.clearValues(this.spreadsheetId, RANGE)
    const rows: string[][] = [[HEADER], ...remaining.map(r => [r])]
    await this.sheets.updateValues(this.spreadsheetId, `${TAB}!A1`, rows)
  }
}
```

**Step 5: Run tests**

```bash
npx vitest run src/services/rolesService.test.ts
```
Expected: all PASS

**Step 6: Commit**

```bash
git add src/constants/index.ts src/services/rolesService.ts src/services/rolesService.test.ts
git commit -m "feat: RolesService — list/create/delete roles in Roles tab"
```

---

### Task 2: MasterDataService — add roles field

**Files:**
- Modify: `src/services/masterDataService.ts`

**Background:** `initialize()` already auto-creates any tab listed in `MASTER_SHEET_TABS` that is missing. `ADMIN_TAB_HEADERS` controls what header row to write on creation. Adding `ROLES: [['RoleName']]` means a newly-created Roles tab gets the header but no role data — exactly what the design calls for.

**Step 1: Modify masterDataService.ts**

a) Add import:
```ts
import { RolesService } from './rolesService'
```

b) Add `readonly roles: RolesService` to the class fields (after `taskService`):
```ts
readonly roles: RolesService
```

c) In the constructor, add (after `this.taskService = ...`):
```ts
this.roles = new RolesService(this.sheets, spreadsheetId)
```

d) Add the Roles header to `ADMIN_TAB_HEADERS`:
```ts
const ADMIN_TAB_HEADERS: Record<string, string[][]> = {
  [MASTER_SHEET_TABS.TASKS]: [['ID', 'TaskType', 'StartTime', 'EndTime', 'DurationHours', 'RoleRequirements', 'MinRestAfter', 'IsSpecial', 'SpecialDurationDays']],
  [MASTER_SHEET_TABS.CONFIG]: [['Key', 'Value']],
  [MASTER_SHEET_TABS.HISTORY]: [['Timestamp', 'Action', 'EntityType', 'EntityID', 'ChangedBy', 'Details']],
  [MASTER_SHEET_TABS.ROLES]: [['RoleName']],
}
```

**Step 2: Run full suite**

```bash
npx vitest run
```
Expected: all PASS (additive change, no existing tests break)

**Step 3: Commit**

```bash
git add src/services/masterDataService.ts
git commit -m "feat: MasterDataService.roles — RolesService field, Roles tab header on creation"
```

---

### Task 3: SoldierRole → string, remove role validation

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/utils/validation.ts`
- Modify: `src/utils/validation.test.ts`

**Background:** Widening `SoldierRole` from a union type to `string` is backwards-compatible — existing code assigning `'Driver' as SoldierRole` still compiles. The `ROLES` array is kept in this task (components still import it); it will be removed in Task 9 once all components are updated. The role check in `validateSoldier` is removed because role options come from a UI dropdown that only shows valid roles.

**Step 1: Change SoldierRole type in `src/constants/index.ts`**

Replace:
```ts
export type SoldierRole = typeof ROLES[number]
```
With:
```ts
export type SoldierRole = string
```

(Keep `ROLES` array unchanged for now.)

**Step 2: Write failing test for validation change**

In `src/utils/validation.test.ts`, find the test that checks for a role error (something like `it('returns error when role is invalid', ...)`). Delete it or change it to confirm the role is no longer validated:

```ts
it('does not return a role error for any non-empty role string', () => {
  const input = { id: '1234567', name: 'Yoni', role: 'UnknownRole', serviceStart: '2026-01-01', serviceEnd: '2026-12-31' }
  const errors = validateSoldier(input)
  expect(errors?.role).toBeUndefined()
})
```

**Step 3: Run to confirm fails**

```bash
npx vitest run src/utils/validation.test.ts
```
Expected: FAIL — `validateSoldier` still rejects unknown roles

**Step 4: Remove role check from validateSoldier**

In `src/utils/validation.ts`, remove the block:
```ts
if (!input.role || !ROLES.includes(input.role as any)) {
  errors.role = 'Invalid role'
}
```
Also remove `ROLES` from the import line (since it's no longer used in this file).

**Step 5: Run tests**

```bash
npx vitest run src/utils/validation.test.ts
```
Expected: all PASS

**Step 6: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 7: Commit**

```bash
git add src/constants/index.ts src/utils/validation.ts src/utils/validation.test.ts
git commit -m "feat: SoldierRole widens to string, remove hardcoded role validation"
```

---

### Task 4: Thread roles through App.tsx

**Files:**
- Modify: `src/App.tsx`

**Background:** `AppContent` loads tasks and config on login via a `Promise.all`. Add `masterDs.roles.list()` to that call. `UnitApp` gets a new `roles: string[]` prop passed from AppContent and forwards it to components. `AdminPanel` manages roles internally (already has `masterDs`), so no change to AdminPanel's props here.

**Step 1: Modify App.tsx**

a) Add `roles` state in `AppContent` (after `configData`):
```ts
const [roles, setRoles] = useState<string[]>([])
```

b) In the `useEffect`, update the `Promise.all` call:
```ts
return Promise.all([master.tasks.list(), master.config.read(), master.roles.list()])
```

c) In the `.then(result => ...)` block, destructure the third element:
```ts
const [loadedTasks, loadedConfig, loadedRoles] = result
setTasks(loadedTasks ?? [])
setConfigData(loadedConfig)
setRoles(loadedRoles ?? [])
```

d) Add `roles` to `UnitAppProps` interface:
```ts
interface UnitAppProps {
  spreadsheetId: string
  tabPrefix: string
  unitName: string
  masterDs: MasterDataService | null
  tasks: Task[]
  configData: AppConfig | null
  roles: string[]
  onBackToAdmin?: () => void
}
```

e) Pass `roles` from AppContent to UnitApp:
```tsx
<UnitApp
  spreadsheetId={activeUnit?.spreadsheetId ?? ''}
  tabPrefix={activeUnit?.tabPrefix || activeUnit?.name || ''}
  unitName={activeUnit?.name ?? ''}
  masterDs={masterDs}
  tasks={tasks}
  configData={configData}
  roles={roles}
  onBackToAdmin={...}
/>
```

f) In `UnitApp` function signature, destructure `roles` from props.

g) Pass `roles` to `SoldiersPage`, `TasksPage`, and `SchedulePage` in the JSX:
```tsx
{section === 'soldiers' && (
  <SoldiersPage ... roles={roles} />
)}
{section === 'tasks' && (
  <TasksPage tasks={tasks} onAddTask={handleAddTask} roles={roles} />
)}
{section === 'schedule' && (
  <SchedulePage ... roles={roles} />
)}
```

**Step 2: Run full suite**

```bash
npx vitest run
```
Expected: TypeScript may warn about missing `roles` props on components not yet updated, but tests should pass (vitest uses esbuild which skips type errors). If any tests fail, check what changed.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: load roles from masterDs, thread as prop into UnitApp and components"
```

---

### Task 5: Update SoldiersPage — roles prop

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Background:** Currently `SoldiersPage` imports `ROLES` from constants and uses it in three places: the add form role select, the edit form role select, and the role filter select. Replace with a `roles?: string[]` prop. When `roles` is empty, dropdowns show no options (graceful empty state). The add form's initial `role` changes from `'Driver'` to the first available role or `''`.

**Step 1: Write failing tests**

In `src/components/SoldiersPage.test.tsx`, add these tests (after existing ones):

```tsx
it('renders role options from the roles prop in add form', async () => {
  render(<SoldiersPage soldiers={[]} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} roles={['Alpha', 'Beta']} />)
  await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
  expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
})

it('shows no role options in add form when roles is empty', async () => {
  render(<SoldiersPage soldiers={[]} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} roles={[]} />)
  await userEvent.click(screen.getByRole('button', { name: /add soldier/i }))
  const selects = screen.getAllByRole('combobox')
  const roleSelect = selects.find(s => s.getAttribute('aria-label') === 'Role')
  expect(roleSelect?.querySelectorAll('option')).toHaveLength(0)
})
```

Also update ALL existing tests that render `<SoldiersPage>` — add `roles={['Driver', 'Medic']}` (or whatever roles the test needs) to each render call. The `SOLDIERS` fixture has `role: 'Driver'` and `role: 'Medic'`, so pass `roles={['Driver', 'Medic']}`.

**Step 2: Run to confirm fails**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: FAIL — `roles` prop not recognized yet

**Step 3: Update SoldiersPage.tsx**

a) Remove `import { ROLES } from '../constants'`

b) Add `roles?: string[]` to `SoldiersPageProps` interface.

c) Destructure `roles = []` in the function signature.

d) Change `EMPTY_FORM`:
```ts
const EMPTY_FORM: CreateSoldierInput = {
  id: '',
  name: '',
  role: '',
  serviceStart: '',
  serviceEnd: '',
}
```

e) In the "Add Soldier" button handler, pre-select the first role:
```ts
// Change the onClick for the Add Soldier button:
onClick={() => {
  setForm({ ...EMPTY_FORM, role: roles[0] ?? '' })
  setShowForm(s => !s)
}}
```

f) Change the `editForm` initial state from `role: 'Driver' as SoldierRole` to `role: '' as SoldierRole`.

g) Replace all three `ROLES.map(r => ...)` occurrences with `roles.map(r => ...)`:
- Add form role select (line ~217)
- Edit form role select (line ~376)
- Role filter select (line ~150):
  ```tsx
  {roles.map(r => <option key={r} value={r}>{r}</option>)}
  ```

**Step 4: Run tests**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: all PASS

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: SoldiersPage — roles from prop instead of constant"
```

---

### Task 6: Update TasksPage — roles prop

**Files:**
- Modify: `src/components/TasksPage.tsx`
- Modify: `src/components/TasksPage.test.tsx` (if it exists)

**Background:** `TasksPage` has a locally-defined `FORM_ROLES` array (hardcoded, does not import from constants). Replace with a `roles: string[]` prop. The task role requirement dropdown uses `[...roles, 'Any']`.

**Step 1: Read TasksPage.tsx and its test file** (if exists) to understand the current structure before editing.

**Step 2: Add `roles: string[]` to `TasksPageProps`**

In `src/components/TasksPage.tsx`:

a) Add to the props interface:
```ts
interface TasksPageProps {
  tasks: Task[]
  onAddTask?: (input: CreateTaskInput) => void
  onUpdateTask?: (input: UpdateTaskInput) => void
  roles: string[]
}
```

b) Destructure `roles` in the function signature.

c) Remove the hardcoded `FORM_ROLES` constant at the top of the file.

d) Replace with a derived value inside the component:
```ts
const formRoles: Array<string> = [...roles, 'Any']
```

e) Replace all `FORM_ROLES.map(...)` → `formRoles.map(...)`

f) Remove `import type { SoldierRole } from '../constants'` if it is now unused.

**Step 3: Update TasksPage tests** (if `src/components/TasksPage.test.tsx` exists)

Add `roles={['Driver', 'Medic']}` to all `<TasksPage>` renders that lack a `roles` prop.

**Step 4: Run tests**

```bash
npx vitest run src/components/TasksPage.test.tsx
```
Expected: all PASS (or PASS if no test file)

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 6: Commit**

```bash
git add src/components/TasksPage.tsx src/components/TasksPage.test.tsx
git commit -m "feat: TasksPage — roles from prop instead of hardcoded array"
```

---

### Task 7: Update SchedulePage — roles prop

**Files:**
- Modify: `src/components/SchedulePage.tsx`
- Modify: `src/components/SchedulePage.test.tsx` (if it exists)

**Background:** `SchedulePage` imports `ROLES` from constants and uses it for `ASSIGNMENT_ROLES` (= `[...ROLES, 'Any']`) and for the initial value of `manualRole` state. Replace with a `roles: string[]` prop.

**Step 1: Modify SchedulePage.tsx**

a) Remove `import { ROLES } from '../constants'` and `import type { SoldierRole } from '../constants'` (if present; check if `SoldierRole` is still needed — it's used as a type annotation on `manualRole` and `onManualAssign`).

b) Change `SoldierRole` annotations on `manualRole` state and `onManualAssign` to `string`.

c) Add `roles: string[]` to the props interface.

d) Destructure `roles` in the function signature.

e) Replace the module-level constant:
```ts
// Remove: const ASSIGNMENT_ROLES: Array<SoldierRole | 'Any'> = [...ROLES, 'Any'] as Array<SoldierRole | 'Any'>
```

f) Add inside the component:
```ts
const assignmentRoles: string[] = [...roles, 'Any']
```

g) Change the `useState` for `manualRole`:
```ts
const [manualRole, setManualRole] = useState<string>(roles[0] ?? '')
```

h) Replace `ASSIGNMENT_ROLES` with `assignmentRoles` and `ROLES[0]` with `roles[0] ?? ''` in all JSX.

**Step 2: Update SchedulePage tests** (if they exist)

Add `roles={['Driver', 'Medic']}` to all renders.

**Step 3: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 4: Commit**

```bash
git add src/components/SchedulePage.tsx src/components/SchedulePage.test.tsx
git commit -m "feat: SchedulePage — roles from prop instead of constant"
```

---

### Task 8: Admin Panel — Roles tab

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Modify: `src/components/AdminPanel.test.tsx`

**Background:** Add a "Roles" tab to AdminPanel between Commanders and Tasks. The tab lists current roles, allows adding a new role by name, and allows deleting any role. AdminPanel already holds `masterDs` and manages its own data loading in `reload()` — add roles to that same pattern. Also pass `roles` to `<TasksPage>` which now requires it.

**Step 1: Write failing test**

In `src/components/AdminPanel.test.tsx`, find how tabs are tested. Add:

```tsx
it('shows a Roles tab', () => {
  render(<AdminPanel masterDs={mockMasterDs} currentAdminEmail="admin@test.com" onEnterUnit={vi.fn()} />)
  expect(screen.getByRole('button', { name: /roles/i })).toBeInTheDocument()
})
```

Note: you will need to ensure `mockMasterDs` has a `roles` field with `list`, `create`, `delete` methods mocked. Read the existing test file to see how `mockMasterDs` is set up, then add `roles: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) }`.

**Step 2: Run to confirm fails**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```
Expected: FAIL — no Roles tab button

**Step 3: Update AdminPanel.tsx**

a) Add `'roles'` to the `AdminTab` type:
```ts
type AdminTab = 'admins' | 'units' | 'commanders' | 'roles' | 'tasks' | 'config'
```

b) Add state:
```ts
const [roles, setRoles] = useState<string[]>([])
const [newRoleName, setNewRoleName] = useState('')
```

c) In `reload()`, add `masterDs.roles.list()` to the Promise.all:
```ts
const [a, u, c, t, cfg, r] = await Promise.all([
  masterDs.admins.list(),
  masterDs.units.list(),
  masterDs.commanders.list(),
  masterDs.tasks.list(),
  masterDs.config.read(),
  masterDs.roles.list(),
])
setAdmins(a); setUnits(u); setCommanders(c); setTasks(t); setConfigData(cfg); setRoles(r)
```

d) Add handlers:
```ts
async function handleAddRole() {
  if (!newRoleName.trim()) return
  setError(null)
  try {
    await masterDs.roles.create(newRoleName.trim())
    setNewRoleName('')
    await reload()
  } catch {
    setError('Failed to add role')
  }
}

async function handleDeleteRole(name: string) {
  setError(null)
  try {
    await masterDs.roles.delete(name)
    await reload()
  } catch {
    setError('Failed to delete role')
  }
}
```

e) Add the Roles tab button in the tab bar (between Commanders and Tasks):
```tsx
<button
  onClick={() => setActiveTab('roles')}
  className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'roles' ? 'border-olive-700 text-olive-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
>
  Roles
</button>
```

f) Add the Roles tab panel (after the Commanders panel):
```tsx
{activeTab === 'roles' && (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-olive-800">Roles</h3>
    {roles.length === 0 && (
      <p className="text-sm text-gray-400">No roles configured. Add one below.</p>
    )}
    {roles.length > 0 && (
      <ul className="space-y-1">
        {roles.map(r => (
          <li key={r} className="flex items-center justify-between px-3 py-2 bg-white rounded border border-olive-100">
            <span className="text-sm">{r}</span>
            <button
              onClick={() => handleDeleteRole(r)}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    )}
    <div className="flex gap-2">
      <input
        placeholder="New role name"
        value={newRoleName}
        onChange={e => setNewRoleName(e.target.value)}
        className="flex-1 border rounded px-3 py-1.5 text-sm"
      />
      <button
        onClick={handleAddRole}
        disabled={!newRoleName.trim()}
        className="px-3 py-1.5 text-sm bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
      >
        Add Role
      </button>
    </div>
  </div>
)}
```

g) Pass `roles` to `<TasksPage>` in the Tasks tab panel:
```tsx
<TasksPage tasks={tasks} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} roles={roles} />
```

**Step 4: Run tests**

```bash
npx vitest run src/components/AdminPanel.test.tsx
```
Expected: all PASS

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 6: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.test.tsx
git commit -m "feat: Admin panel Roles tab — list, add, delete roles"
```

---

### Task 9: Remove ROLES constant + update SUMMARY.md

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/constants/index.test.ts`
- Modify: `SUMMARY.md`

**Background:** By this point no component imports `ROLES` from constants anymore. The array can be safely deleted. `SoldierRole` is already `string`. The constants test that checked `ROLES.toHaveLength(6)` must be removed.

**Step 1: Verify no imports remain**

```bash
grep -r "import.*ROLES.*constants" src/
```
Expected: no output (all components removed their ROLES imports in Tasks 5-7)

**Step 2: Remove ROLES from constants**

In `src/constants/index.ts`, delete:
```ts
export const ROLES = [
  'Driver',
  'Radio Operator',
  'Medic',
  'Squad Leader',
  'Operations Room',
  'Weapons Specialist',
] as const
```

**Step 3: Remove ROLES tests from constants.test.ts**

In `src/constants/index.test.ts`, remove the import of `ROLES` and any test cases that reference it (the ones checking `toHaveLength(6)`, `toContain('Driver')`, etc.).

**Step 4: Run full suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 5: Update SUMMARY.md**

- Add to **Recent changes (2026-03-05)**:
  - `ROLES` constant removed from `src/constants/index.ts`; `SoldierRole` is now `string`
  - New `Roles` tab in admin spreadsheet (`RoleName` column); auto-created empty on first run
  - `RolesService` added: `src/services/rolesService.ts` — `list()`, `create(name)`, `delete(name)`
  - `MasterDataService.roles: RolesService` field added
  - Admin panel has new **Roles** tab to add/delete roles
  - `SoldiersPage`, `TasksPage`, `SchedulePage` now accept `roles: string[]` prop

- Update test count once you know the new count after running the suite.

**Step 6: Commit**

```bash
git add src/constants/index.ts src/constants/index.test.ts SUMMARY.md
git commit -m "refactor: remove hardcoded ROLES constant, update SUMMARY.md"
```
