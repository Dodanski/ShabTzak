# ShabTzak Scheduling Algorithm Investigation

## Executive Summary

This document provides a detailed investigation of the scheduling algorithm flow, multi-unit soldier loading, leave generation, and task scheduling logic in the ShabTzak codebase.

---

## 1. FLOW: AdminDashboard → Schedule Generation

### Entry Point: Admin Panel
**File:** `src/components/AdminPanel.tsx` (lines 48-102)

The scheduling flow is triggered from the Admin Dashboard:

```
AdminDashboard.onGenerateSchedule (button click)
  ↓
handleGenerateScheduleForAllUnits() [AdminPanel.tsx:48-102]
  ↓
Calls masterDs.scheduleService.generateTaskSchedule() [line 70]
  ↓
Calls masterDs.scheduleService.generateLeaveSchedule() [line 83]
```

### Key Sequence (AdminPanel.tsx):

1. **Line 69**: Log "Generating task schedule for all X soldiers..."
2. **Lines 65-77**: Generate task schedule FIRST (tasks have priority)
   - Expands recurring tasks
   - Passes `soldiers` (all soldiers from admin sheet) as the 6th parameter
   - Does NOT pass leave assignments yet (tasks prioritized)
3. **Lines 82-88**: Generate leave schedule SECOND
   - Respects task assignments already made
   - Uses same config and schedule dates

### UnitApp Integration (App.tsx)

When a unit commander generates schedule from unit view:

**File:** `src/App.tsx` (lines 195-234)

```
UnitApp.handleGenerateSchedule()
  ↓
runSchedule() [useScheduleGenerator hook]
  ↓
scheduleService.generateTaskSchedule(expandedTasks, 'user', ..., allSoldiers)
  ↓
scheduleService.generateLeaveSchedule(configData, today, scheduleEnd, ...)
  ↓
Fairness adjustments applied per leave assignment
```

**Critical Detail:** Line 134 of App.tsx passes `allSoldiers` to `useScheduleGenerator`, which is then passed through to `generateTaskSchedule`:

```typescript
const { generate: runSchedule, conflicts, progress } = useScheduleGenerator(
  ds, tasks, configData, scheduleStart, scheduleEnd, 
  allSoldiers  // Multi-unit soldiers passed here
)
```

---

## 2. MULTI-UNIT SOLDIER LOADING

### How Soldiers Are Loaded

**File:** `src/hooks/useDataService.ts` (lines 19-85)

The hook has a `loadAllSoldiers` parameter that triggers multi-unit loading:

```typescript
export function useDataService(
  spreadsheetId: string,
  tabPrefix = '',
  masterDs: MasterDataService | null,
  loadAllSoldiers = false  // NEW parameter
): UseDataServiceResult {
```

**Loading Logic (lines 52-72):**

```typescript
const basePromises = [
  ds.soldiers.list(),          // Unit soldiers only
  ds.leaveRequests.list(),
  ds.taskAssignments.list(),
  ds.leaveAssignments.list(),
]

// NEW: load all soldiers from admin spreadsheet if requested
const allPromises = loadAllSoldiers && masterDs
  ? [...basePromises, masterDs.soldiers.list()]  // Loads ALL soldiers
  : basePromises

Promise.all(allPromises).then((results: any) => {
  const [s, lr, ta, la] = results
  setSoldiers(s)                           // Unit soldiers
  // ...
  if (loadAllSoldiers && masterDs && results.length > 4) {
    setAllSoldiers(results[4] as Soldier[])  // ALL soldiers from admin
  }
})
```

### Where Multi-Unit Loading is Triggered

1. **In UnitApp (App.tsx:86):**
   ```typescript
   const { ds, soldiers, allSoldiers, leaveRequests, taskAssignments, leaveAssignments, loading, error, reload } =
     useDataService(spreadsheetId, tabPrefix, masterDs, true)  // true = load all soldiers
   ```

2. **In AdminPanel (AdminPanel.tsx:113):**
   ```typescript
   // Reload loads all soldiers directly from masterDs
   const [a, u, c, r, t, cfg, s] = await Promise.all([
     // ... other items ...
     masterDs.soldiers.list(),  // Gets ALL soldiers from master
   ])
   setSoldiers(s)
   ```

### Sources of Soldiers in Schedule Generation

**Admin Panel (AdminPanel.tsx:76):**
```typescript
const taskSchedule = await masterDs.scheduleService.generateTaskSchedule(
  expandedTasks,
  currentAdminEmail,
  undefined,
  undefined,
  configData,
  soldiers  // Pass all soldiers from admin sheet
)
```

**Unit App (App.tsx:134):**
```typescript
const { generate: runSchedule, conflicts, progress } = useScheduleGenerator(
  ds, tasks, configData, scheduleStart, scheduleEnd, 
  allSoldiers  // Multi-unit soldiers
)
```

Then passed to scheduleService (useScheduleGenerator.ts:40):
```typescript
const task = await ds.scheduleService.generateTaskSchedule(
  expandedTasks, 'user', (completed, total) => {...},
  undefined, config, 
  allSoldiers  // Multi-unit soldiers passed here
)
```

### How scheduleService Handles Multiple Soldier Sources

**File:** `src/services/scheduleService.ts` (lines 88-149)

```typescript
async generateTaskSchedule(
  tasks: Task[],
  changedBy: string,
  onProgress?: (completed: number, total: number) => void,
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig,
  allSoldiers?: Soldier[]  // NEW: optional all soldiers from all units
): Promise<TaskSchedule> {
  
  // Load local unit soldiers
  const [soldiers, allExisting] = await Promise.all([
    this.soldiers.list(),  // Current unit soldiers only
    this.taskAssignments.list(),
  ])

  // Use allSoldiers if provided and valid (multi-unit scheduling)
  const schedulingSoldiers = (allSoldiers && allSoldiers.length > soldiers.length)
    ? allSoldiers
    : soldiers
```

**The Logic (lines 134-136):**
- If `allSoldiers` parameter is provided AND has more soldiers than unit-only list → use allSoldiers
- Otherwise → use unit soldiers only

---

## 3. LEAVE GENERATION: 10:4 RATIO ENFORCEMENT

### Cyclical Leave Generation Flow

**File:** `src/algorithms/cyclicalLeaveScheduler.ts` (lines 12-152)

The 10:4 ratio (10 days in base, 4 days at home) is enforced through:

1. **Configuration (lines 23):**
   ```typescript
   const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome
   // Default: 10 + 4 = 14 day cycle
   ```

2. **Phase Offset Randomization (lines 51-53):**
   ```typescript
   const phaseOffset = Math.floor(Math.random() * cycleLength)
   soldiersPhaseOffset.set(soldier.id, phaseOffset)
   ```
   - Each soldier gets a random starting position (0-13) in the cycle
   - This staggering prevents all soldiers taking leave simultaneously

3. **Cycle Phase Calculation (lines 91-94):**
   ```typescript
   const phaseOffset = soldiersPhaseOffset.get(soldier.id) ?? 0
   const soldierPosition = (dayNumber + phaseOffset) % cycleLength
   const isInLeavePhase = soldierPosition >= config.leaveRatioDaysInBase
   ```
   - Position in cycle = (current day number + soldier's phase offset) mod 14
   - Leave phase = positions 10-13 (days 10-13 of the 14-day cycle)
   - Base phase = positions 0-9

4. **Capacity Enforcement (lines 72-74):**
   ```typescript
   const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr, result)
   let availableSlots = capacity[role] ?? 0
   ```

### Leave Capacity Calculator

**File:** `src/algorithms/leaveCapacityCalculator.ts` (lines 13-52)

This is the CRITICAL function for multi-unit enforcement:

```typescript
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  _taskAssignments: TaskAssignment[],
  config: AppConfig,
  date: string,
  existingLeaves: LeaveAssignment[] = [],
): Record<string, number> {
  const capacity: Record<string, number> = {}
  const checkDate = parseDate(date)

  // Build a set of soldier IDs already on leave on `date`
  const onLeaveToday = new Set<string>()
  for (const leave of existingLeaves) {
    const start = parseDate(leave.startDate.split('T')[0])
    const end = parseDate(leave.endDate.split('T')[0])
    if (start <= checkDate && checkDate <= end) {
      onLeaveToday.add(leave.soldierId)
    }
  }

  // Group soldiers by role
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Calculate remaining capacity for each role
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const alreadyOnLeave = roleSoldiers.filter(s => onLeaveToday.has(s.id)).length
    const availableForLeave = Math.max(0, totalOfRole - minRequired - alreadyOnLeave)
    capacity[role] = availableForLeave
  }

  return capacity
}
```

**Key Formula (lines 44-50):**
```
availableForLeave = max(0, totalOfRole - minRequired - alreadyOnLeave)
```

Where:
- `totalOfRole` = total active soldiers of that role (across all units)
- `minRequired` = config.minBasePresenceByRole[role] (e.g., 5 for Drivers)
- `alreadyOnLeave` = soldiers of that role already on leave today
- Result = how many MORE soldiers of that role can take leave today

### Critical Issue: Multi-Unit Leave Capacity

The capacity calculation uses the `soldiers` parameter passed in. When called from `generateCyclicalLeaves`:

**File:** `src/services/scheduleService.ts` (lines 25-86)

```typescript
async generateLeaveSchedule(
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
  changedBy: string,
): Promise<LeaveSchedule> {
  let [soldiers, requests, existing, taskAssignments] = await Promise.all([
    this.soldiers.list(),      // Only unit soldiers loaded here!
    this.leaveRequests.list(),
    this.leaveAssignments.list(),
    this.taskAssignments.list(),
  ])

  // ...
  
  const withCyclicalLeaves = generateCyclicalLeaves(
    soldiers,                   // Only unit soldiers!
    existing, 
    taskAssignments, 
    config, 
    scheduleStart, 
    scheduleEnd
  )
```

**NOTE (lines 52-55):**
```typescript
// NOTE: Multi-unit leave assignments are loaded from current unit only.
// In multi-unit scheduling, soldiers from other units won't have their leaves pre-loaded.
// This is acceptable for MVP - their leave data would need to be fetched from their unit's spreadsheet.
// TODO: Load leaves from all unit spreadsheets for full multi-unit support
```

---

## 4. TASK SCHEDULER: Multi-Unit Logic

**File:** `src/algorithms/taskScheduler.ts` (lines 16-166)

### Core Algorithm

```typescript
export function scheduleTasks(
  tasks: Task[],
  soldiers: Soldier[],           // Can be multi-unit soldiers
  existingAssignments: TaskAssignment[],
  allTasksInSystem?: Task[],
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig,
): TaskSchedule
```

### Multi-Unit Unit Affinity Logic (lines 92-117)

This is the key to multi-unit task scheduling:

```typescript
// Determine task's unit based on majority of already-assigned soldiers
const getTaskUnit = () => {
  const assignedUnits = result
    .filter(a => a.taskId === task.id)
    .map(a => soldiers.find(s => s.id === a.soldierId)?.unit)
    .filter(Boolean)

  if (assignedUnits.length === 0) return null
  const unitCounts = new Map<string, number>()
  for (const unit of assignedUnits) {
    unitCounts.set(unit!, (unitCounts.get(unit!) ?? 0) + 1)
  }
  return Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

const taskUnit = getTaskUnit()

// Sort by unit affinity (prefer same unit), then fairness
const ranked = [...eligible].sort((a, b) => {
  if (taskUnit) {
    const aUnit = a.unit === taskUnit ? 0 : 1
    const bUnit = b.unit === taskUnit ? 0 : 1
    if (aUnit !== bUnit) return aUnit - bUnit
  }
  return combinedFairnessScore(a) - combinedFairnessScore(b)
})
```

**Algorithm Breakdown:**

1. **Find Task Unit** (lines 93-105)
   - Look at soldiers ALREADY assigned to this task
   - Find which unit has the MOST assignments so far
   - This becomes the "task's unit"

2. **Rank Candidates** (lines 110-117)
   - Sort eligible soldiers by:
     1. **Primary:** Same unit as task (0 if yes, 1 if no)
     2. **Secondary:** Fairness score (lower = more deserving)

3. **Assign Soldiers** (lines 120-132)
   - Take up to `remaining` soldiers from the ranked list
   - Assign each to the task with their actual role

### Eligibility Filtering (lines 67-79)

```typescript
const eligible = soldiers.filter(s => {
  // Check if soldier's role matches ANY of the acceptable roles
  const matchesRole = rolesAccepted.includes('Any') || rolesAccepted.includes(s.role)
  if (!matchesRole) {
    if (import.meta.env.DEV) console.log(`    - ${s.id}: role mismatch (${s.role} not in ${rolesAccepted})`)
    return false
  }
  const available = isTaskAvailable(s, task, tasksForValidation, result, leaveAssignments, config)
  if (!available && import.meta.env.DEV) {
    console.log(`    - ${s.id}: not available`)
  }
  return available
})
```

Checks:
1. Role match
2. Task availability (rest periods, leave, status, etc.)

---

## 5. OBVIOUS ISSUES WITH MULTI-UNIT HANDLING

### Issue 1: Leave Generation Only Uses Current Unit Soldiers

**File:** `src/services/scheduleService.ts:32-35`

```typescript
let [soldiers, requests, existing, taskAssignments] = await Promise.all([
  this.soldiers.list(),  // ONLY current unit soldiers
  this.leaveRequests.list(),
  this.leaveAssignments.list(),
  this.taskAssignments.list(),
])
```

**Problem:**
- `generateLeaveSchedule()` does NOT accept an `allSoldiers` parameter
- When called from AdminPanel, it uses only the unit's soldiers
- Leave capacity calculations based on incomplete soldier pool

**Example:**
- Unit A has 5 Drivers, Unit B has 3 Drivers
- Admin generates schedule: leave capacity calculated as 8 total, but only 5 counted in Unit A view
- Leave assignments could be inconsistent across units

**Location of note (lines 52-55):**
```typescript
// NOTE: Multi-unit leave assignments are loaded from current unit only.
// In multi-unit scheduling, soldiers from other units won't have their leaves pre-loaded.
// This is acceptable for MVP - their leave data would need to be fetched from their unit's spreadsheet.
// TODO: Load leaves from all unit spreadsheets for full multi-unit support
```

### Issue 2: Task Scheduler Doesn't Know About Other Unit's Leave Assignments

**File:** `src/services/scheduleService.ts:148`

```typescript
const schedule = scheduleTasks(
  tasks, 
  schedulingSoldiers,  // Multi-unit soldiers ✓
  existing, 
  tasks,
  leaveAssignments,    // MISSING: other units' leaves
  config
)
```

**Problem:**
- `leaveAssignments` passed to `scheduleTasks` only contains current unit's leaves
- When scheduling multi-unit soldiers, soldiers from other units might actually be on leave (from their unit's schedule)
- Scheduler won't know about cross-unit leave conflicts

**Impact:**
- Could assign soldiers to tasks when they should be on leave
- Especially problematic when Unit A soldier is on Unit B's generated leave

### Issue 3: No Cross-Unit Leave Synchronization

**Files:** 
- `src/services/scheduleService.ts` (generateLeaveSchedule)
- `src/algorithms/leaveCapacityCalculator.ts`

**Problem:**
- Leave capacity is calculated PER UNIT in isolation
- No validation that total leaves across all units respect global minBasePresenceByRole

**Example:**
- Config: minBasePresenceByRole.Driver = 5 total
- Unit A generates leaves: 2 drivers on leave
- Unit B generates leaves independently: 3 more drivers on leave
- Result: 5 drivers on leave, meets minimum locally but globally:
  - Total drivers = 8
  - Required = 5
  - On leave = 5
  - At base = 3 (violates minimum!)

### Issue 4: Task Unit Affinity Preference

**File:** `src/algorithms/taskScheduler.ts:110-117`

```typescript
const ranked = [...eligible].sort((a, b) => {
  if (taskUnit) {
    const aUnit = a.unit === taskUnit ? 0 : 1
    const bUnit = b.unit === taskUnit ? 0 : 1
    if (aUnit !== bUnit) return aUnit - bUnit
  }
  return combinedFairnessScore(a) - combinedFairnessScore(b)
})
```

**Issue:**
- Task unit affinity is determined by majority of ALREADY-ASSIGNED soldiers
- If task starts with Unit A assignments, all subsequent assignments PREFER Unit A
- Could create unreasonable bias if first assignments happen to be from one unit

**Example:**
- Task needs 5 soldiers
- First assignment (by chance) is Unit A
- Unit affinity now = Unit A
- Next 4 assignments will prefer Unit A soldiers
- Result: Task could be heavily Unit A-biased even if Unit B soldiers were more deserving (fairness-wise)

### Issue 5: Fairness Adjustments Not Multi-Unit Aware

**File:** `src/App.tsx:207-227`

```typescript
const newLeaveAssignments = leaveSchedule.assignments.filter(a => !existingLeaveIds.has(a.id))

// Process fairness updates with delays to avoid API rate limiting
for (let i = 0; i < newLeaveAssignments.length; i++) {
  const assignment = newLeaveAssignments[i]
  try {
    await ds.fairnessUpdate.applyLeaveAssignment(
      assignment.soldierId, assignment.leaveType, assignment.isWeekend, auth.email ?? 'user'
    )
  } catch (e) {
    console.warn('[App] Failed to update fairness for soldier', assignment.soldierId, ':', e)
  }
  // ...
}
```

**Problem:**
- Fairness updates applied only to current unit's DataService
- If multi-unit soldiers from other units are assigned leaves, their fairness won't be updated in their home unit

---

## 6. SUMMARY TABLE: Flow & Data Sources

| Component | Multi-Unit Capable? | Data Source | Issues |
|-----------|-------------------|-------------|--------|
| AdminPanel.handleGenerateScheduleForAllUnits | YES | masterDs.soldiers.list() | Task schedule ✓, Leave schedule ✗ |
| UnitApp.handleGenerateSchedule | YES | allSoldiers (from masterDs) | Only for tasks, not leaves |
| scheduleService.generateTaskSchedule | YES | allSoldiers parameter | Properly handles multi-unit |
| scheduleService.generateLeaveSchedule | NO | this.soldiers.list() (unit only) | TODO: Add allSoldiers parameter |
| leaveCapacityCalculator | NO | soldiers parameter (unit only) | Incomplete soldier pool |
| cyclicalLeaveScheduler | NO | soldiers parameter (unit only) | Incomplete soldier pool |
| taskScheduler | YES | soldiers parameter (multi-unit OK) | Unit affinity works correctly |

---

## 7. KEY FINDINGS

1. **Task scheduling is multi-unit capable** and appears to work correctly with unit affinity sorting
2. **Leave scheduling is NOT multi-unit aware** - only processes current unit soldiers
3. **Leave capacity calculations incomplete** for multi-unit scenarios
4. **Cross-unit leave conflicts possible** - no synchronization between units' leave schedules
5. **Fairness adjustments incomplete** for multi-unit leaves
6. **Admin panel correctly triggers both schedules** but can't pass allSoldiers to leave generation

---

## 8. RECOMMENDATIONS

### Critical Fixes Needed

1. Add `allSoldiers` parameter to `generateLeaveSchedule()`
2. Pass multi-unit soldiers to `generateCyclicalLeaves()`
3. Implement cross-unit leave synchronization in capacity calculations
4. Apply fairness updates across all unit DataServices for multi-unit soldiers

### Design Improvements

1. Consider centralizing fairness calculations at admin level
2. Implement atomic multi-unit schedule generation (all-or-nothing)
3. Add validation that minBasePresenceByRole is met across ALL units, not per-unit
