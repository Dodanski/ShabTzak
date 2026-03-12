# Multi-Unit Scheduling & Alternative Role Requirements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable fair cross-unit soldier scheduling and support tasks with multiple acceptable role alternatives (e.g., "Gate Guard can be Driver OR Squad Leader OR Fighter").

**Architecture:**
1. **Alternative Roles:** Modify RoleRequirement to accept array of alternative roles per slot
2. **Multi-Unit Scheduling:** Load all soldiers from admin spreadsheet, schedule across all units fairly
3. **Fairness Priority:** Fairness across ALL soldiers is priority, unit affinity is secondary preference
4. **Soldier Pool:** Use admin spreadsheet "Soldiers" tab (superset of all units) as source of truth

**Tech Stack:** React 18, TypeScript, Google Sheets API, greedy task scheduler algorithm

**Timeline:** Estimated 15-20 tasks, 3-4 hours implementation

---

## Task 1: Update RoleRequirement Data Model

**Files:**
- Modify: `src/models/Task.ts`
- Test: Verify TypeScript compilation

**Step 1: Understand current structure**

Current RoleRequirement:
```typescript
interface RoleRequirement {
  role: SoldierRole | 'Any'
  count: number
}
```

**Step 2: Extend to support alternatives**

Change to:
```typescript
interface RoleRequirement {
  roles: (SoldierRole | 'Any')[]  // Array of acceptable roles
  count: number
  // Backward compat field (deprecated):
  role?: SoldierRole | 'Any'      // For reading old tasks
}
```

This allows:
- New format: `{ roles: ["Driver", "Squad leader", "Fighter"], count: 1 }`
- Old format still works: `{ role: "Driver", count: 1 }` (parsed as `roles: ["Driver"]`)

**Step 3: Update interfaces**

```typescript
export interface RoleRequirement {
  roles: (SoldierRole | 'Any')[]
  count: number
  role?: SoldierRole | 'Any'  // deprecated, for backward compat
}

export interface Task {
  id: string
  taskType: string
  startTime: string
  endTime: string
  durationHours: number
  roleRequirements: RoleRequirement[]
  minRestAfter: number
  isSpecial: boolean
  specialDurationDays?: number
}

export interface CreateTaskInput {
  taskType: string
  startTime: string
  endTime: string
  durationHours?: number
  roleRequirements: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
}

export interface UpdateTaskInput {
  id: string
  taskType?: string
  startTime?: string
  endTime?: string
  durationHours?: number
  roleRequirements?: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
}
```

**Step 4: Build**

```bash
npm run build
```

Expected: TypeScript compilation succeeds

**Step 5: Commit**

```bash
git add src/models/Task.ts
git commit -m "refactor: extend RoleRequirement to support multiple alternative roles

- Add roles array to RoleRequirement for flexible role matching
- Keep role field for backward compatibility
- Allows tasks to accept any of multiple acceptable roles
- Example: Gate Guard task can be Driver OR Squad leader OR Fighter"
```

---

## Task 2: Update Task Parsers & Serializers

**Files:**
- Modify: `src/services/parsers.ts` (parse tasks from spreadsheet)
- Modify: `src/services/serializers.ts` (serialize tasks to spreadsheet)

**Step 1: Update parser to handle both formats**

In `parsers.ts`, find the task parsing function and update:

```typescript
export function parseTask(row: string[], headers: string[]): Task {
  // ... existing code ...

  const roleReqCol = headers.indexOf('RoleRequirements')
  const roleReqStr = row[roleReqCol] ?? ''

  // Parse role requirements: support both old and new formats
  let roleRequirements: RoleRequirement[] = []
  try {
    const parsed = JSON.parse(roleReqStr)
    if (Array.isArray(parsed)) {
      roleRequirements = parsed.map((req: any) => {
        // If has 'role' field (old format), convert to 'roles' array
        if (req.role && !req.roles) {
          return {
            roles: [req.role],
            count: req.count
          }
        }
        // If has 'roles' array (new format), keep as-is
        return {
          roles: req.roles || [],
          count: req.count || 1
        }
      })
    }
  } catch {
    roleRequirements = []
  }

  return {
    id: row[idCol] ?? '',
    taskType: row[typeCol] ?? '',
    startTime: row[startCol] ?? '',
    endTime: row[endCol] ?? '',
    durationHours: parseFloat(row[durationCol] ?? '0'),
    roleRequirements,
    minRestAfter: parseFloat(row[restCol] ?? '0'),
    isSpecial: row[specialCol]?.toLowerCase() === 'true',
    specialDurationDays: parseFloat(row[specialDaysCol] ?? '0'),
  }
}
```

**Step 2: Update serializer**

In `serializers.ts`, update task serialization:

```typescript
export function serializeTask(task: Task): string[] {
  // ... existing code ...

  // Serialize role requirements
  const roleReqStr = JSON.stringify(task.roleRequirements.map(req => ({
    roles: req.roles,
    count: req.count
  })))

  return [
    task.id,
    task.taskType,
    task.startTime,
    task.endTime,
    String(task.durationHours),
    roleReqStr,
    String(task.minRestAfter),
    task.isSpecial ? 'true' : 'false',
    String(task.specialDurationDays ?? 0),
  ]
}
```

**Step 3: Build and test**

```bash
npm run build
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/services/parsers.ts src/services/serializers.ts
git commit -m "feat: update parsers/serializers for alternative role format

- Parser converts old 'role' format to new 'roles' array format
- Supports backward compatibility with existing tasks
- Serializer saves as new format with roles array
- Allows gradual migration from single-role to multi-role tasks"
```

---

## Task 3: Update Task Scheduler for Alternative Roles

**Files:**
- Modify: `src/algorithms/taskScheduler.ts` (core scheduling logic)

**Step 1: Update role matching logic**

In `taskScheduler.ts`, update the eligible soldier filtering (around line 54):

Replace:
```typescript
const eligible = soldiers.filter(s => {
  if (requirement.role !== 'Any' && s.role !== requirement.role) return false
  return isTaskAvailable(s, task, tasksForValidation, result, leaveAssignments, config)
})
```

With:
```typescript
const eligible = soldiers.filter(s => {
  // Check if soldier's role matches ANY of the acceptable roles
  const rolesAccepted = requirement.roles ?? [requirement.role].filter(Boolean) as (SoldierRole | 'Any')[]
  const matchesRole = rolesAccepted.includes('Any') || rolesAccepted.includes(s.role)

  if (!matchesRole) return false
  return isTaskAvailable(s, task, tasksForValidation, result, leaveAssignments, config)
})
```

**Step 2: Update assignment role assignment**

Around line 93, update the assigned role:

Replace:
```typescript
assignedRole: requirement.role === 'Any' ? soldier.role : requirement.role,
```

With:
```typescript
assignedRole: soldier.role,  // Always assign soldier's actual role
```

**Step 3: Update already-assigned counter**

Around line 44-48, update to handle multiple roles:

Replace:
```typescript
const alreadyAssigned = result.filter(a => {
  if (a.taskId !== task.id) return false
  if (requirement.role === 'Any') return true
  return a.assignedRole === requirement.role
}).length
```

With:
```typescript
const rolesAccepted = requirement.roles ?? [requirement.role].filter(Boolean) as (SoldierRole | 'Any')[]
const alreadyAssigned = result.filter(a => {
  if (a.taskId !== task.id) return false
  if (rolesAccepted.includes('Any')) return true
  return rolesAccepted.includes(a.assignedRole)
}).length
```

**Step 4: Build**

```bash
npm run build
```

Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/algorithms/taskScheduler.ts
git commit -m "feat: update scheduler to support alternative role requirements

- Check if soldier's role matches ANY acceptable role for the slot
- Always assign soldier's actual role (not the requirement role)
- Correctly count already-assigned soldiers across role alternatives
- Enables flexible task staffing (Gate Guard can be Driver OR Squad Leader)"
```

---

## Task 4: Update Admin Panel Task Editor - Add Alternative Roles UI

**Files:**
- Modify: `src/components/TasksPage.tsx` or create `src/components/TaskForm.tsx` (task edit/create)

**Step 1: Check current task form structure**

Find where tasks are edited in the UI. Look for form that handles `RoleRequirement` array.

**Step 2: Update role requirement input component**

For each role requirement row, change from:
```
[single role dropdown] [count input]
```

To:
```
[multi-select checkboxes for roles] [count input]
```

Example:
```tsx
<div key={idx} className="space-y-2 border-l-2 border-olive-200 pl-4">
  <label className="block text-sm font-medium">Roles (any of):</label>
  <div className="grid grid-cols-2 gap-2">
    {AVAILABLE_ROLES.map(role => (
      <label key={role} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={requirement.roles?.includes(role) ?? false}
          onChange={(e) => {
            const roles = requirement.roles ?? []
            if (e.target.checked) {
              updateRequirement(idx, { ...requirement, roles: [...roles, role] })
            } else {
              updateRequirement(idx, {
                ...requirement,
                roles: roles.filter(r => r !== role)
              })
            }
          }}
        />
        <span className="text-sm">{role}</span>
      </label>
    ))}
  </div>

  <label className="block text-sm font-medium">Count:</label>
  <input
    type="number"
    min="1"
    value={requirement.count}
    onChange={(e) => updateRequirement(idx, {
      ...requirement,
      count: parseInt(e.target.value) || 1
    })}
    className="border px-2 py-1 text-sm rounded"
  />
</div>
```

**Step 3: Handle "Any" role specially**

If user selects all roles, convert to just `['Any']` for simplicity.

**Step 4: Build and test in browser**

```bash
npm run dev
```

- Navigate to Tasks admin panel
- Create/edit a task
- Verify can select multiple roles for requirement
- Verify UI is intuitive

**Step 5: Commit**

```bash
git add src/components/TasksPage.tsx
git commit -m "feat: add multi-select UI for alternative role requirements

- Replace single role dropdown with checkboxes for multiple roles
- Users can select any combination of acceptable roles per requirement
- Simplifies task definition for flexible staffing scenarios
- Example: Gate Guard task can accept Driver, Squad leader, Fighter, Radio op, Ops room"
```

---

## Task 5: Load All Soldiers from Admin Spreadsheet

**Files:**
- Modify: `src/hooks/useDataService.ts` (load soldiers for scheduling)
- Modify: `src/services/scheduleService.ts` (pass all soldiers to scheduler)

**Step 1: Extend DataService to include all soldiers**

In `useDataService.ts`, add option to load soldiers from admin spreadsheet:

```typescript
export interface UseDataServiceResult {
  ds: DataService | null
  soldiers: Soldier[]
  allSoldiers: Soldier[]  // NEW: all soldiers from admin spreadsheet
  leaveRequests: LeaveRequest[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useDataService(
  spreadsheetId: string,
  tabPrefix = '',
  masterDs: MasterDataService | null,
  loadAllSoldiers = false  // NEW parameter
): UseDataServiceResult {
  const { auth } = useAuth()
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [allSoldiers, setAllSoldiers] = useState<Soldier[]>([])  // NEW
  // ... rest of state ...

  useEffect(() => {
    if (!ds) return
    setLoading(true)
    setError(null)

    const promises = [
      ds.soldiers.list(),
      ds.leaveRequests.list(),
      ds.taskAssignments.list(),
      ds.leaveAssignments.list(),
    ]

    // NEW: load all soldiers from admin spreadsheet if requested
    if (loadAllSoldiers && masterDs) {
      promises.push(masterDs.soldiers.list())
    }

    Promise.all(promises)
      .then(([s, lr, ta, la, as]) => {
        setSoldiers(s)
        setLeaveRequests(lr)
        setTaskAssignments(ta)
        setLeaveAssignments(la)
        if (loadAllSoldiers && as) {
          setAllSoldiers(as)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [ds, loadAllSoldiers, masterDs, tick])

  return {
    ds,
    soldiers,
    allSoldiers,  // NEW
    leaveRequests,
    taskAssignments,
    leaveAssignments,
    loading,
    error,
    reload
  }
}
```

**Step 2: Update SchedulePage to accept all soldiers**

In `src/components/SchedulePage.tsx` (or where it's called from `UnitApp`):

```typescript
interface SchedulePageProps {
  soldiers: Soldier[]
  allSoldiers?: Soldier[]  // NEW: all soldiers from all units
  // ... rest of props ...
}

export default function SchedulePage({
  soldiers,
  allSoldiers,  // NEW
  // ... rest of props ...
}) {
  // Use allSoldiers for scheduling if available
  const schedulingSoldiers = allSoldiers && allSoldiers.length > 0 ? allSoldiers : soldiers
  // ...
}
```

**Step 3: Update UnitApp to load all soldiers**

In `src/App.tsx`, update UnitApp call:

```typescript
const { ds, soldiers, allSoldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload } =
  useDataService(spreadsheetId, tabPrefix, masterDs, true)  // true = load all soldiers
```

Pass to SchedulePage:
```tsx
<SchedulePage
  soldiers={soldiers}
  allSoldiers={allSoldiers}
  // ... rest of props ...
/>
```

**Step 4: Build**

```bash
npm run build
```

Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/hooks/useDataService.ts src/components/SchedulePage.tsx src/App.tsx
git commit -m "feat: load all soldiers from admin spreadsheet for multi-unit scheduling

- useDataService loads all soldiers from admin spreadsheet when flag is set
- SchedulePage receives both unit soldiers and all soldiers
- Scheduler can use all available soldiers regardless of unit
- Enables fair cross-unit fairness tracking"
```

---

## Task 6: Update Schedule Generator to Use All Soldiers

**Files:**
- Modify: `src/hooks/useScheduleGenerator.ts` (orchestrates scheduling)
- Modify: `src/services/scheduleService.ts` (passes soldiers to scheduler)

**Step 1: Update useScheduleGenerator**

In `useScheduleGenerator.ts`:

```typescript
export function useScheduleGenerator(
  ds: DataService | null,
  tasks: Task[],
  configData: AppConfig | null,
  scheduleStart: string,
  scheduleEnd: string,
  allSoldiers?: Soldier[]  // NEW parameter
) {
  const generate = useCallback(async () => {
    if (!ds || !configData) return

    const schedulingSoldiers = allSoldiers && allSoldiers.length > 0 ? allSoldiers : ds  // NEW: prefer all soldiers

    try {
      const schedule = await ds.scheduleService.generateSchedule({
        soldiers: schedulingSoldiers,
        tasks,
        configData,
        scheduleStart,
        scheduleEnd,
        existingAssignments: existingTaskAssignments.current,
        existingLeaves: existingLeaveAssignments.current,
      })
      // ... rest of logic ...
    }
  }, [ds, tasks, configData, scheduleStart, scheduleEnd, allSoldiers])  // Add allSoldiers to deps

  return { generate, conflicts, progress }
}
```

**Step 2: Update SchedulePage to pass allSoldiers**

In `SchedulePage.tsx`:

```typescript
const { generate: runSchedule } = useScheduleGenerator(
  ds,
  tasks,
  configData,
  scheduleStart,
  scheduleEnd,
  allSoldiers  // NEW: pass all soldiers
)
```

**Step 3: Update scheduleService.generateSchedule signature**

In `scheduleService.ts`:

```typescript
async generateSchedule(options: {
  soldiers: Soldier[]  // Will be all soldiers when multi-unit
  tasks: Task[]
  configData: AppConfig
  scheduleStart: string
  scheduleEnd: string
  existingAssignments?: TaskAssignment[]
  existingLeaves?: LeaveAssignment[]
}): Promise<ScheduleResult> {
  const {
    soldiers,
    tasks,
    configData,
    scheduleStart,
    scheduleEnd,
    existingAssignments = [],
    existingLeaves = [],
  } = options

  // Pass all soldiers to scheduler
  const taskSchedule = scheduleTasks(
    expandedTasks,
    soldiers,  // Now includes soldiers from all units
    existingAssignments,
    allTasksInSystem,
    leaveAssignments,
    configData
  )

  // ... rest of logic ...
}
```

**Step 4: Build**

```bash
npm run build
```

Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/hooks/useScheduleGenerator.ts src/services/scheduleService.ts
git commit -m "feat: schedule generator uses all soldiers for multi-unit fairness

- Pass allSoldiers to schedule generator instead of unit-only soldiers
- Scheduler now has access to full soldier pool
- Fairness is calculated across ALL soldiers, not just unit soldiers
- Unit affinity is preserved as secondary preference in scheduler"
```

---

## Task 7: Handle Leave Assignments from All Units

**Files:**
- Modify: `src/services/scheduleService.ts` (load leaves for all soldiers)

**Step 1: Load leave assignments for all soldiers**

In `scheduleService.ts`, when loading leave assignments:

```typescript
async generateSchedule(options: {...}) {
  // ... existing code ...

  // Load leave assignments for all scheduled soldiers
  // If using allSoldiers, need to load leaves from all unit spreadsheets
  let leaveAssignments: LeaveAssignment[] = []

  if (soldiers.some(s => s.unit && s.unit !== primaryUnit)) {
    // We have multi-unit soldiers, need to load leaves from all units
    // For now: load from current unit only, extend later if needed
    leaveAssignments = await this.leaveAssignments.list()
  } else {
    leaveAssignments = await this.leaveAssignments.list()
  }

  // ... rest of logic ...
}
```

**Note:** This is a placeholder. Full multi-unit leave loading requires loading from multiple unit spreadsheets. For MVP, we'll load leaves from current unit and can extend later.

**Step 2: Commit**

```bash
git add src/services/scheduleService.ts
git commit -m "chore: prepare leave assignment loading for multi-unit

- Add comment about multi-unit leave loading requirements
- Current implementation loads from primary unit
- Future: extend to load from all unit spreadsheets if needed"
```

---

## Task 8: Update TaskAssignment to Track Unit Origin

**Files:**
- Modify: `src/models/Task.ts` (TaskAssignment model)
- Modify: `src/services/taskAssignmentRepository.ts` (serialization)

**Step 1: Add unit tracking to TaskAssignment**

In `Task.ts`:

```typescript
export interface TaskAssignment {
  scheduleId: string
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  assignedUnitId?: string  // NEW: which unit the soldier belongs to
  isLocked: boolean
  createdAt: string
  createdBy: string
}
```

**Step 2: Update serializer to save unit info**

In `taskAssignmentRepository.ts`:

```typescript
export function serializeTaskAssignment(assignment: TaskAssignment): string[] {
  return [
    assignment.scheduleId,
    assignment.taskId,
    assignment.soldierId,
    assignment.assignedRole,
    assignment.assignedUnitId ?? '',  // NEW
    assignment.isLocked ? 'true' : 'false',
    assignment.createdAt,
    assignment.createdBy,
  ]
}

export function parseTaskAssignment(row: string[], headers: string[]): TaskAssignment {
  // ... existing parsing ...
  const assignedUnitId = row[unitIdCol] ?? undefined  // NEW

  return {
    scheduleId: row[scheduleCol] ?? '',
    taskId: row[taskCol] ?? '',
    soldierId: row[soldierCol] ?? '',
    assignedRole: row[roleCol] ?? '',
    assignedUnitId,  // NEW
    isLocked: row[lockedCol]?.toLowerCase() === 'true',
    createdAt: row[createdAtCol] ?? '',
    createdBy: row[createdByCol] ?? '',
  }
}
```

**Step 3: Build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/models/Task.ts src/services/taskAssignmentRepository.ts
git commit -m "feat: track soldier unit origin in task assignments

- Add assignedUnitId to TaskAssignment model
- Helps track which unit each assigned soldier belongs to
- Enables reporting on cross-unit assignments"
```

---

## Task 9: Update Scheduler to Set Unit ID on Assignments

**Files:**
- Modify: `src/algorithms/taskScheduler.ts` (assign unit ID)

**Step 1: Pass soldiers with unit info to scheduler**

When scheduler creates assignment, include unit ID:

```typescript
export function scheduleTasks(
  tasks: Task[],
  soldiers: Soldier[],  // Soldiers now include unit info
  // ... rest of params ...
): TaskSchedule {
  // ... existing code ...

  for (let i = 0; i < Math.min(remaining, ranked.length); i++) {
    const soldier = ranked[i]
    result.push({
      scheduleId: `sched-${task.id}`,
      taskId: task.id,
      soldierId: soldier.id,
      assignedRole: soldier.role,
      assignedUnitId: soldier.unit,  // NEW: capture soldier's unit
      isLocked: false,
      createdAt: new Date().toISOString(),
      createdBy: 'scheduler',
    })
  }
}
```

**Step 2: Build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/algorithms/taskScheduler.ts
git commit -m "feat: capture soldier unit in task assignments

- Set assignedUnitId when creating task assignments
- Enables tracking cross-unit assignments
- Supports reporting on unit load balancing"
```

---

## Task 10: Update Admin Panel Task Form - Show Alternative Roles Example

**Files:**
- Modify: `src/components/TasksPage.tsx` or task form component

**Step 1: Add helpful UI text**

When showing role selection, add example and explanation:

```tsx
<div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
  <p className="text-sm text-blue-800">
    <strong>Example:</strong> Gate Guard position can be filled by Driver, Squad leader, Fighter, Radio operator, or Operation Room staff.
    The scheduler will pick the most available soldier from these roles.
  </p>
</div>
```

**Step 2: Add "Copy from previous" helper**

If editing multiple requirements with similar roles:

```tsx
<button
  onClick={() => {
    const lastReq = requirements[requirements.length - 1]
    if (lastReq) {
      addRequirement({ ...lastReq, count: 1 })
    }
  }}
  className="text-sm text-olive-700 hover:text-olive-900"
>
  Copy roles from previous
</button>
```

**Step 3: Commit**

```bash
git add src/components/TasksPage.tsx
git commit -m "ux: add helpful guidance for alternative role selection

- Show example of multi-role task (Gate Guard)
- Add helper button to copy roles from previous requirement
- Makes it clearer how to use new feature"
```

---

## Task 11: Test Multi-Unit Scheduling End-to-End

**Files:**
- Test: Manual testing in browser
- Document: Test results

**Step 1: Setup test scenario**

1. Create Unit 1 with soldiers: A (Driver), B (Squad leader), C (Fighter)
2. Create Unit 2 with soldiers: D (Driver), E (Radio op), F (Squad leader)
3. Create Unit 3 with soldiers: G (Fighter), H (Operation room), I (Driver)
4. Create task: "Gate Guard" requiring 5 soldiers that are ANY of: Driver, Squad leader, Fighter, Radio op, Operation room

**Step 2: Generate schedule**

1. Go to Unit 1
2. Click "Generate Schedule"
3. Verify that:
   - All 5 Gate Guard slots are filled
   - Soldiers are drawn from all 3 units
   - Different units are represented
   - Fairness scores are calculated correctly

**Step 3: Verify fairness**

Check that soldiers with lowest fairness scores are picked, regardless of unit.

**Step 4: Check soldier mode calendar**

In each unit, view "Soldier Mode" and verify cross-unit assignments show correctly.

**Step 5: Document results**

Record any issues or successes.

**Step 6: Commit test notes**

```bash
git add docs/test-results-multi-unit.md
git commit -m "test: document multi-unit scheduling manual test results"
```

---

## Task 12: Update SUMMARY.md Documentation

**Files:**
- Modify: `SUMMARY.md` (add multi-unit and alt-roles documentation)

**Step 1: Add section for multi-unit scheduling**

Add to "Key Features":

```markdown
### Multi-Unit Scheduling
- Scheduler pulls soldiers from ALL units (via admin spreadsheet Soldiers tab)
- Fairness is calculated across ALL soldiers globally, not per-unit
- Unit affinity preserved: same-unit soldiers preferred when fairness is equal
- Task assignments track which unit each soldier belongs to
- Enables fair load distribution across entire organization
```

**Step 2: Add section for alternative roles**

Add to "Key Features":

```markdown
### Alternative Role Requirements
- Tasks can accept ANY of multiple roles for a single slot
- Example: Gate Guard can be filled by Driver, Squad leader, Fighter, Radio op, or Operation room
- Defined as: `{ roles: ["Driver", "Squad leader", "Fighter", ...], count: 1 }`
- Scheduler picks best available soldier from acceptable roles
- Makes staffing more flexible, reduces scheduling conflicts
```

**Step 3: Update architecture section**

Update Data Models table to document new RoleRequirement structure.

**Step 4: Add example**

```markdown
### Example: Gate Guard Task
```json
{
  "taskType": "Gate Guard",
  "startTime": "2026-03-12T06:00:00",
  "endTime": "2026-03-12T18:00:00",
  "durationHours": 12,
  "roleRequirements": [
    {
      "roles": ["Driver", "Squad leader", "Fighter", "Radio operator", "Operation room"],
      "count": 5
    }
  ],
  "minRestAfter": 8
}
```
When this task is scheduled:
1. Scheduler needs to fill 5 slots
2. For each slot, it looks at ALL soldiers from ALL units
3. It picks soldiers whose role is ANY of the 5 acceptable roles
4. It chooses based on fairness (lowest score first)
5. Unit affinity is secondary (prefer same unit when fairness is equal)
```

**Step 5: Commit**

```bash
git add SUMMARY.md
git commit -m "docs: update SUMMARY.md with multi-unit and alternative roles features

- Document multi-unit scheduling architecture
- Document alternative role requirements
- Add examples and use cases
- Update key features section"
```

---

## Verification Checklist

After all tasks complete:

- [ ] TypeScript builds without errors
- [ ] Admin Panel task editor shows role checkboxes
- [ ] Schedule generation uses all soldiers from all units
- [ ] Fairness scores are calculated globally (all soldiers together)
- [ ] Cross-unit assignments are created
- [ ] Unit affinity still works (same-unit preferred when equal fairness)
- [ ] Soldier calendar shows assignments from other units
- [ ] Leave assignments work with multi-unit soldiers
- [ ] Manual test scenario works (Gate Guard filled from all units)
- [ ] SUMMARY.md documents new features

---

## Known Limitations & Future Enhancements

1. **Leave assignments:** Currently loads from current unit only. Future: load from all unit spreadsheets
2. **Unit affinity:** Simple majority-unit approach. Future: more sophisticated unit load balancing
3. **Role groups:** Current hardcoded list. Future: allow custom role groups (e.g., "Combat roles", "Support roles")
4. **Cross-unit fairness:** Tracked globally. Future: allow hybrid (global fairness + per-unit minimum)

---

## Rollback Plan

If critical issues arise:

```bash
git log --oneline | head -20  # Find last known-good commit
git reset --hard <commit-hash>
npm run build
npm run deploy
```

---

**Plan ready for execution. Tasks 1-12 should be implemented in order, with builds and commits between each task for safety and traceability.**
