# Soldier Full Edit + Known Issues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full inline soldier field editing (ID, name, role, service dates in dd/mm/yy, hours) and fix three known issues: hardcoded `changedBy`, empty HistoryPage, orphaned SetupPage.

**Architecture:** Four independent tasks. Service layer gets `updateFields()`. SoldiersPage replaces the ID-only inline edit with a full edit panel. App.tsx gets `changedBy` fixed everywhere, history wired, and `handleEditId` removed. SetupPage deleted.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

---

## Context: Key File Paths

| File | Purpose |
|------|---------|
| `src/services/soldierService.ts` | Business logic — add `updateFields()` here |
| `src/services/soldierService.test.ts` | Service tests |
| `src/components/SoldiersPage.tsx` | Main soldiers UI — replace ID-only edit with full edit panel |
| `src/components/SoldiersPage.test.tsx` | Component tests |
| `src/App.tsx` | Wire `handleUpdateSoldier`, fix `changedBy`, load history |
| `src/components/SetupPage.tsx` | Delete — orphaned |
| `src/components/SetupPage.test.tsx` | Delete — orphaned |
| `src/models/Soldier.ts` | `UpdateSoldierInput` already has all needed fields |
| `src/utils/dateUtils.ts` | `formatDisplayDate(iso)` → `dd/mm/yy`; `parseDisplayDateInput(display)` → ISO |

---

### Task 1: SoldierService.updateFields()

**Files:**
- Modify: `src/services/soldierService.ts`
- Modify: `src/services/soldierService.test.ts`

**Background:** `UpdateSoldierInput` (in `src/models/Soldier.ts`) already has all fields: `newId?, name?, role?, serviceStart?, serviceEnd?, hoursWorked?`. The repo's `update()` handles them all. The service just needs an orchestrating method.

**Step 1: Write failing tests**

In `src/services/soldierService.test.ts`, add inside `describe('SoldierService')`:

```ts
it('updateFields() calls repo.update and logs history', async () => {
  await service.updateFields('1234567', { name: 'New Name', role: 'Medic' as const }, 'admin@test.com')
  expect(repo.update).toHaveBeenCalledWith({ id: '1234567', name: 'New Name', role: 'Medic' })
  expect(history.append).toHaveBeenCalledWith('UPDATE_FIELDS', 'Soldier', '1234567', 'admin@test.com', expect.any(String))
})

it('updateFields() uses newId for history entity when ID is changed', async () => {
  await service.updateFields('1234567', { newId: '9999999' }, 'admin@test.com')
  expect(repo.update).toHaveBeenCalledWith({ id: '1234567', newId: '9999999' })
  expect(history.append).toHaveBeenCalledWith('UPDATE_FIELDS', 'Soldier', '9999999', 'admin@test.com', expect.any(String))
})
```

**Step 2: Run to confirm fails**

```bash
npx vitest run src/services/soldierService.test.ts
```
Expected: FAIL — `service.updateFields is not a function`

**Step 3: Implement**

In `src/services/soldierService.ts`, add `UpdateSoldierInput` to the import:

```ts
import type { Soldier, CreateSoldierInput, SoldierStatus, UpdateSoldierInput } from '../models'
```

Then add after `updateStatus`:

```ts
async updateFields(id: string, input: Omit<UpdateSoldierInput, 'id'>, changedBy: string): Promise<void> {
  await this.repo.update({ id, ...input })
  const entityId = input.newId ?? id
  await this.history.append('UPDATE_FIELDS', 'Soldier', entityId, changedBy, `Updated fields for soldier ${entityId}`)
}
```

**Step 4: Run tests**

```bash
npx vitest run src/services/soldierService.test.ts
```
Expected: all PASS

**Step 5: Commit**

```bash
git add src/services/soldierService.ts src/services/soldierService.test.ts
git commit -m "feat: SoldierService.updateFields() for full soldier data editing"
```

---

### Task 2: SoldiersPage — full inline edit panel

**Files:**
- Modify: `src/components/SoldiersPage.tsx`
- Modify: `src/components/SoldiersPage.test.tsx`

**Background:**
- The current "Edit" button opens a single ID-input row (`editingIdFor` / `editIdValue` state, `onEditId` prop). Replace all of this with a full edit panel.
- Date inputs use `dd/mm/yy` text format (same as the add form). Pre-fill via `formatDisplayDate(isoDate)`. Parse on save via `parseDisplayDateInput(displayDate)`.
- The `onUpdateSoldier` prop replaces `onEditId`. Existing tests that pass `onEditId` will need updating.
- `SOLDIERS` fixture in the test has `serviceStart: '2026-01-01'` → displays as `'01/01/26'` and `serviceEnd: '2026-12-31'` → `'31/12/26'`.

**Step 1: Write failing tests**

In `src/components/SoldiersPage.test.tsx`, add after the existing tests:

```tsx
it('shows full edit form when Edit button is clicked', async () => {
  render(<SoldiersPage soldiers={SOLDIERS} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  expect(screen.getByDisplayValue('David Cohen')).toBeInTheDocument()
  expect(screen.getByDisplayValue('1111111')).toBeInTheDocument()
  expect(screen.getByDisplayValue('24')).toBeInTheDocument()
})

it('pre-fills dates in dd/mm/yy format', async () => {
  render(<SoldiersPage soldiers={SOLDIERS} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  expect(screen.getByDisplayValue('01/01/26')).toBeInTheDocument()
  expect(screen.getByDisplayValue('31/12/26')).toBeInTheDocument()
})

it('calls onUpdateSoldier with updated fields on Save', async () => {
  const onUpdateSoldier = vi.fn()
  render(<SoldiersPage soldiers={SOLDIERS} onUpdateSoldier={onUpdateSoldier} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  const nameInput = screen.getByDisplayValue('David Cohen')
  await userEvent.clear(nameInput)
  await userEvent.type(nameInput, 'David Levi')
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
  expect(onUpdateSoldier).toHaveBeenCalledWith(expect.objectContaining({ id: '1111111', name: 'David Levi' }))
})

it('closes edit form on Cancel', async () => {
  render(<SoldiersPage soldiers={SOLDIERS} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  expect(screen.getByDisplayValue('David Cohen')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
  expect(screen.queryByDisplayValue('David Cohen')).not.toBeInTheDocument()
})

it('disables Save when end date is before start date in edit form', async () => {
  render(<SoldiersPage soldiers={SOLDIERS} onUpdateSoldier={vi.fn()} onUpdateStatus={vi.fn()} onAddSoldier={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  const endInput = screen.getByDisplayValue('31/12/26')
  await userEvent.clear(endInput)
  await userEvent.type(endInput, '01/01/20')
  expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
})
```

Also update any existing test that passes `onEditId` — replace it with `onUpdateSoldier={vi.fn()}`.

**Step 2: Run to confirm fails**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: FAIL — no `onUpdateSoldier` prop, edit panel only shows ID field

**Step 3: Update SoldiersPage.tsx**

a) Add `UpdateSoldierInput` to the models import:

```ts
import type { Soldier, CreateSoldierInput, UpdateSoldierInput, SoldierRole, SoldierStatus, AppConfig, LeaveAssignment } from '../models'
```

b) In the props interface, replace `onEditId` with `onUpdateSoldier`:

```ts
interface SoldiersPageProps {
  soldiers: Soldier[]
  loading?: boolean
  onUpdateStatus: (soldierId: string, status: SoldierStatus, reason?: string) => void
  onAddSoldier: (input: CreateSoldierInput) => void
  onUpdateSoldier?: (input: UpdateSoldierInput) => void
  onAdjustFairness?: (soldierId: string, delta: number, reason: string) => void
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
}
```

c) In the function signature, replace `onEditId` with `onUpdateSoldier`.

d) Replace the `editingIdFor` / `editIdValue` state declarations with:

```ts
const [editingFor, setEditingFor] = useState<string | null>(null)
const [editForm, setEditForm] = useState({
  newId: '', name: '', role: 'Driver' as SoldierRole,
  serviceStart: '', serviceEnd: '', hoursWorked: '',
})
```

e) Add derived validation (after the add-form `endBeforeStart` line):

```ts
const editStartISO = parseDisplayDateInput(editForm.serviceStart)
const editEndISO = parseDisplayDateInput(editForm.serviceEnd)
const editEndBeforeStart = editStartISO && editEndISO && editEndISO <= editStartISO
```

f) Remove the `handleEditIdOpen` and `handleEditIdSave` functions. Add these instead:

```ts
function handleEditOpen(s: Soldier) {
  setEditingFor(s.id)
  setEditForm({
    newId: s.id,
    name: s.name,
    role: s.role,
    serviceStart: formatDisplayDate(s.serviceStart),
    serviceEnd: formatDisplayDate(s.serviceEnd),
    hoursWorked: String(s.hoursWorked),
  })
}

function handleEditSave(originalId: string) {
  if (editEndBeforeStart) return
  const startISO = parseDisplayDateInput(editForm.serviceStart)
  const endISO = parseDisplayDateInput(editForm.serviceEnd)
  if (!startISO || !endISO) return
  onUpdateSoldier?.({
    id: originalId,
    ...(editForm.newId !== originalId && { newId: editForm.newId }),
    name: editForm.name,
    role: editForm.role,
    serviceStart: startISO,
    serviceEnd: endISO,
    hoursWorked: parseInt(editForm.hoursWorked) || 0,
  })
  setEditingFor(null)
}
```

g) In the table row action cell, replace the Edit button:

```tsx
{onUpdateSoldier && (
  <button
    onClick={() => editingFor === s.id ? setEditingFor(null) : handleEditOpen(s)}
    className="text-xs text-olive-700 hover:text-olive-800"
  >
    Edit
  </button>
)}
```

h) Replace the `{editingIdFor === s.id && ...}` block entirely with:

```tsx
{editingFor === s.id && (
  <tr className="bg-olive-50 border-t">
    <td colSpan={configData ? 10 : 9} className="px-4 py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-olive-600 mb-1">Army ID</label>
          <input
            type="text"
            value={editForm.newId}
            onChange={e => setEditForm(f => ({ ...f, newId: e.target.value }))}
            className="w-full border rounded px-2 py-1 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-olive-600 mb-1">Name</label>
          <input
            type="text"
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border rounded px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-olive-600 mb-1">Role</label>
          <select
            value={editForm.role}
            onChange={e => setEditForm(f => ({ ...f, role: e.target.value as SoldierRole }))}
            className="w-full border rounded px-2 py-1 text-xs"
            aria-label="Role"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-olive-600 mb-1">Service start (dd/mm/yy)</label>
          <input
            type="text"
            placeholder="dd/mm/yy"
            value={editForm.serviceStart}
            onChange={e => setEditForm(f => ({ ...f, serviceStart: e.target.value }))}
            className="w-full border rounded px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-olive-600 mb-1">Service end (dd/mm/yy)</label>
          <input
            type="text"
            placeholder="dd/mm/yy"
            value={editForm.serviceEnd}
            onChange={e => setEditForm(f => ({ ...f, serviceEnd: e.target.value }))}
            className={`w-full border rounded px-2 py-1 text-xs ${editEndBeforeStart ? 'border-red-400' : ''}`}
          />
          {editEndBeforeStart && <p className="text-xs text-red-600 mt-1">End must be after start</p>}
        </div>
        <div>
          <label className="block text-xs text-olive-600 mb-1">Hours worked</label>
          <input
            type="number"
            min="0"
            value={editForm.hoursWorked}
            onChange={e => setEditForm(f => ({ ...f, hoursWorked: e.target.value }))}
            className="w-full border rounded px-2 py-1 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => handleEditSave(s.id)}
          disabled={!!editEndBeforeStart}
          className="px-2 py-1 text-xs bg-olive-700 text-white rounded hover:bg-olive-800 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => setEditingFor(null)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </td>
  </tr>
)}
```

**Step 4: Run tests**

```bash
npx vitest run src/components/SoldiersPage.test.tsx
```
Expected: all PASS

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx src/components/SoldiersPage.test.tsx
git commit -m "feat: full inline soldier edit panel (id, name, role, dates, hours)"
```

---

### Task 3: App.tsx wiring + changedBy fixes + history + delete SetupPage

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/SetupPage.tsx`
- Delete: `src/components/SetupPage.test.tsx`

**Step 1: Delete orphaned SetupPage**

```bash
git rm src/components/SetupPage.tsx src/components/SetupPage.test.tsx
```

**Step 2: Apply all changes to App.tsx**

a) Add `HistoryEntry` import:
```ts
import type { HistoryEntry } from './services/historyService'
```

b) Add `UpdateSoldierInput` to the models import:
```ts
import type { CreateLeaveRequestInput, CreateSoldierInput, UpdateSoldierInput, CreateTaskInput, Unit, Task, AppConfig } from './models'
```

c) In `UnitApp`, add history state after the existing state declarations:
```ts
const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
const [historyLoading, setHistoryLoading] = useState(false)
```

d) Add useEffect for lazy history loading (after the existing `hashchange` useEffect):
```ts
useEffect(() => {
  if (section !== 'history' || !masterDs) return
  setHistoryLoading(true)
  masterDs.history.listAll()
    .then(entries => setHistoryEntries(entries))
    .catch(() => setHistoryEntries([]))
    .finally(() => setHistoryLoading(false))
}, [section, masterDs])
```

e) Remove `handleEditId` function entirely.

f) Add `handleUpdateSoldier` (in its place):
```ts
async function handleUpdateSoldier(input: UpdateSoldierInput) {
  try {
    await ds?.soldierService.updateFields(input.id, input, auth.email ?? 'user')
    reload()
    addToast('Soldier updated', 'success')
  } catch {
    addToast('Failed to update soldier', 'error')
  }
}
```

g) Fix every hardcoded `'user'` changedBy — replace `'user'` with `auth.email ?? 'user'` in:
- `handleAddSoldier`: `ds?.soldierService.create(input, 'user')` → `...create(input, auth.email ?? 'user')`
- `handleAdjustFairness`: `..., 'user')` → `..., auth.email ?? 'user')`
- `handleSubmitLeave`: `..., 'user')` → `..., auth.email ?? 'user')`
- `handleApprove`: `..., 'user')` → `..., auth.email ?? 'user')`
- `handleDeny`: `..., 'user')` → `..., auth.email ?? 'user')`
- `handleAddTask`: `..., 'user')` → `..., auth.email ?? 'user')`
- `handleGenerateSchedule`: two occurrences — both `'user'` → `auth.email ?? 'user'`

h) Update the `SoldiersPage` JSX — replace `onEditId={handleEditId}` with `onUpdateSoldier={handleUpdateSoldier}`.

i) Update the `HistoryPage` JSX:
```tsx
{section === 'history' && (
  <HistoryPage entries={historyEntries} loading={historyLoading} />
)}
```

**Step 3: Run full test suite**

```bash
npx vitest run
```
Expected: all PASS

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: handleUpdateSoldier, HistoryPage wired, changedBy uses auth.email, delete SetupPage"
```

---

### Task 4: Update SUMMARY.md

**Files:**
- Modify: `SUMMARY.md`

**Step 1: Remove resolved items from Known / potential issues**

Delete these bullet points (they are now fixed):
- `changedBy` still `'user'` in other handlers
- `HistoryPage` always renders with empty `entries=[]`
- `SetupPage.tsx` exists but is not reachable

**Step 2: Add to Recent changes section**

Add a new block under `## Recent changes`:

```
## Recent changes (2026-03-05)

1. **Full soldier edit** — inline edit panel per row; editable: ID, name, role, service dates (dd/mm/yy), hours worked; `SoldierService.updateFields()` added
2. **changedBy** — all handlers in `App.tsx` now use `auth.email ?? 'user'`
3. **HistoryPage** — lazy-loads from `masterDs.history.listAll()` when history section is opened
4. **SetupPage deleted** — orphaned component removed
```

**Step 3: Commit**

```bash
git add SUMMARY.md
git commit -m "docs: update SUMMARY.md after soldier edit and fixes"
```
