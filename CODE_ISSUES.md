# Multi-Unit Scheduling Issues - Code Evidence

## Issue 1: Leave Generation Missing Multi-Unit Support

### Where the Issue Occurs

**File:** `/home/e173165/testDir/ShabTzak/src/services/scheduleService.ts`
**Lines:** 25-86

```typescript
async generateLeaveSchedule(
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
  changedBy: string,
): Promise<LeaveSchedule> {
  // Load data - use Promise.all for parallelism
  let [soldiers, requests, existing, taskAssignments] = await Promise.all([
    this.soldiers.list(),              // ❌ ONLY unit soldiers!
    this.leaveRequests.list(),
    this.leaveAssignments.list(),
    this.taskAssignments.list(),
  ])

  // ... later ...
  
  const withCyclicalLeaves = generateCyclicalLeaves(
    soldiers,                           // ❌ Still only unit soldiers
    existing, 
    taskAssignments, 
    config, 
    scheduleStart, 
    scheduleEnd
  )
```

### Compare with Task Generation (Which Works)

**File:** `/home/e173165/testDir/ShabTzak/src/services/scheduleService.ts`
**Lines:** 88-149

```typescript
async generateTaskSchedule(
  tasks: Task[],
  changedBy: string,
  onProgress?: (completed: number, total: number) => void,
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig,
  allSoldiers?: Soldier[]  // ✓ HAS multi-unit support!
): Promise<TaskSchedule> {
  
  const [soldiers, allExisting] = await Promise.all([
    this.soldiers.list(),
    this.taskAssignments.list(),
  ])

  // Use allSoldiers if provided and valid (multi-unit scheduling)
  const schedulingSoldiers = (allSoldiers && allSoldiers.length > soldiers.length)
    ? allSoldiers  // ✓ Use multi-unit soldiers
    : soldiers
```

### What Admin Panel Passes

**File:** `/home/e173165/testDir/ShabTzak/src/components/AdminPanel.tsx`
**Lines:** 48-102

```typescript
async function handleGenerateScheduleForAllUnits() {
  // ... setup ...
  
  // TASK SCHEDULE - has allSoldiers support ✓
  const taskSchedule = await masterDs.scheduleService.generateTaskSchedule(
    expandedTasks,
    currentAdminEmail,
    undefined,
    undefined,  
    configData,
    soldiers  // ✓ Passes all soldiers from admin sheet
  )

  // LEAVE SCHEDULE - NO allSoldiers parameter ❌
  const leaveSchedule = await masterDs.scheduleService.generateLeaveSchedule(
    configData,
    today,
    scheduleEnd,
    currentAdminEmail
    // ❌ No soldiers parameter at all!
  )
}
```

### The Note in Code (Acknowledging the Issue)

**File:** `/home/e173165/testDir/ShabTzak/src/services/scheduleService.ts`
**Lines:** 52-55

```typescript
// NOTE: Multi-unit leave assignments are loaded from current unit only.
// In multi-unit scheduling, soldiers from other units won't have their leaves pre-loaded.
// This is acceptable for MVP - their leave data would need to be fetched from their unit's spreadsheet.
// TODO: Load leaves from all unit spreadsheets for full multi-unit support
```

---

## Issue 2: Incomplete Leave Capacity Calculation

### The Capacity Calculator

**File:** `/home/e173165/testDir/ShabTzak/src/algorithms/leaveCapacityCalculator.ts`
**Lines:** 13-52

```typescript
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],                    // ⚠️ Incomplete pool
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
    const totalOfRole = roleSoldiers.length        // ⚠️ From incomplete soldiers array
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const alreadyOnLeave = roleSoldiers.filter(s => onLeaveToday.has(s.id)).length
    const availableForLeave = Math.max(0, totalOfRole - minRequired - alreadyOnLeave)
    capacity[role] = availableForLeave
  }

  return capacity
}
```

### How It's Called from Cyclical Scheduler

**File:** `/home/e173165/testDir/ShabTzak/src/algorithms/cyclicalLeaveScheduler.ts`
**Lines:** 56-74

```typescript
export function generateCyclicalLeaves(
  soldiers: Soldier[],                    // ⚠️ UNIT SOLDIERS ONLY
  existingLeaves: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
): LeaveAssignment[] {
  const result = [...existingLeaves]
  // ...
  
  // Generate leaves per role
  for (const [role, roleSoldiers] of soldiersByRole) {
    // ...
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate)

      // Check capacity for this role on this date
      const capacity = calculateLeaveCapacityPerRole(
        soldiers,                    // ⚠️ Still only unit soldiers
        taskAssignments, 
        config, 
        dateStr, 
        result
      )
      let availableSlots = capacity[role] ?? 0
```

### Real-World Impact Example

Scenario: 2 units, each has Drivers role

```
Unit A: 5 Drivers total
  Config: minBasePresenceByRole.Driver = 8 (for all units)
  
  When Unit A generates leaves alone:
    totalOfRole = 5
    minRequired = 8
    availableForLeave = max(0, 5 - 8 - 0) = 0
    Result: NO drivers from Unit A can take leave!
    
    ✗ WRONG! Should check total of 10 drivers (Unit A + Unit B)
    ✗ Should allow 2 drivers to take leave

Unit B: 5 Drivers total
  Same calculation:
    availableForLeave = max(0, 5 - 8 - 0) = 0
    Result: NO drivers from Unit B can take leave!
    
    ✗ WRONG!

Correct calculation (if both units included):
  totalOfRole = 10 (both units)
  minRequired = 8
  availableForLeave = max(0, 10 - 8 - onLeave) = 2
  Result: 2 drivers can take leave
```

---

## Issue 3: Task Scheduler Using Incomplete Leave Data

### The Problem

**File:** `/home/e173165/testDir/ShabTzak/src/services/scheduleService.ts`
**Lines:** 88-149

```typescript
async generateTaskSchedule(
  tasks: Task[],
  changedBy: string,
  onProgress?: (completed: number, total: number) => void,
  leaveAssignments?: LeaveAssignment[],
  config?: AppConfig,
  allSoldiers?: Soldier[]
): Promise<TaskSchedule> {
  // Load local unit soldiers
  const [soldiers, allExisting] = await Promise.all([
    this.soldiers.list(),
    this.taskAssignments.list(),
  ])

  // Use allSoldiers if provided
  const schedulingSoldiers = (allSoldiers && allSoldiers.length > soldiers.length)
    ? allSoldiers
    : soldiers

  // ...
  
  // Call task scheduler with multiUnitSoldiers but unitOnly leaves
  const schedule = scheduleTasks(
    tasks, 
    schedulingSoldiers,  // ✓ Multi-unit soldiers
    existing, 
    tasks,
    leaveAssignments,    // ❌ ONLY current unit's leaves!
    config
  )
```

### Task Scheduler's Expectation vs Reality

**File:** `/home/e173165/testDir/ShabTzak/src/algorithms/taskScheduler.ts`
**Lines:** 67-79

```typescript
const eligible = soldiers.filter(s => {
  const matchesRole = rolesAccepted.includes('Any') || rolesAccepted.includes(s.role)
  if (!matchesRole) {
    if (import.meta.env.DEV) console.log(`    - ${s.id}: role mismatch`)
    return false
  }
  // Check if available (considers leaves!)
  const available = isTaskAvailable(
    s, 
    task, 
    tasksForValidation, 
    result, 
    leaveAssignments,      // ⚠️ Incomplete leave list
    config
  )
  if (!available && import.meta.env.DEV) {
    console.log(`    - ${s.id}: not available`)
  }
  return available
})
```

### Real-World Conflict

```
Unit A generates schedule:
  - leaveAssignments = only Unit A leaves
  - Creates taskSchedule with all 180 soldiers
  
Unit B soldier "S102" status:
  - Currently on leave in Unit B schedule
  - But this leave is NOT in leaveAssignments (Unit A only)
  - Scheduler sees: S102 is available (not in leaves)
  - Assigns S102 to critical task
  
Result: ✗ Soldier assigned to task while actually on leave!
```

---

## Issue 4: Task Scheduler Unit Affinity Lock-In

### The Algorithm

**File:** `/home/e173165/testDir/ShabTzak/src/algorithms/taskScheduler.ts`
**Lines:** 92-117

```typescript
// For EACH role requirement of EACH task:

for (const requirement of task.roleRequirements) {
  // ...
  
  // Determine task's unit based on ALREADY-ASSIGNED soldiers
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
    // Returns MAJORITY unit
    return Array.from(unitCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0]
  }

  const taskUnit = getTaskUnit()  // ⚠️ Locked to first unit!

  // Sort by unit affinity FIRST, then fairness
  const ranked = [...eligible].sort((a, b) => {
    if (taskUnit) {
      const aUnit = a.unit === taskUnit ? 0 : 1
      const bUnit = b.unit === taskUnit ? 0 : 1
      if (aUnit !== bUnit) return aUnit - bUnit  // ⚠️ Unit affinity before fairness!
    }
    return combinedFairnessScore(a) - combinedFairnessScore(b)
  })

  // Assign up to `remaining` soldiers
  for (let i = 0; i < Math.min(remaining, ranked.length); i++) {
    const soldier = ranked[i]
    // ⚠️ If taskUnit is locked, strongly biased toward that unit
    result.push({
      // ... assignment ...
    })
  }
}
```

### Real-World Bias

```
Task "Guard" needs 4 soldiers from roles: [Fighter, Medic]
All soldiers available from both units

Role requirement: 2 Fighters
  First assignment (random): Fighter from Unit A
    → taskUnit = "Unit A"
  Second assignment (affinity preference):
    - Unit A fighters preferred (0)
    - Unit B fighters penalized (1)
    Even if Unit B fighter more deserving (lower fairness score)
    → Unit A fighter assigned

Result: Heavy Unit A bias even though all were equally deserving
```

---

## Issue 5: Fairness Updates Not Cross-Unit Aware

### The Problem

**File:** `/home/e173165/testDir/ShabTzak/src/App.tsx`
**Lines:** 207-227

```typescript
async function handleGenerateSchedule() {
  if (!ds || !configData) return
  try {
    await runSchedule(() => {
      reload()
    })

    // Update fairness for newly created leave assignments
    const existingLeaveIds = new Set(leaveAssignments.map(a => a.id))
    const leaveSchedule = await ds.scheduleService.generateLeaveSchedule(
      configData, today, scheduleEnd, auth.email ?? 'user'
    )
    const newLeaveAssignments = leaveSchedule.assignments
      .filter(a => !existingLeaveIds.has(a.id))

    // ⚠️ Updates ONLY go to current unit's DataService
    for (let i = 0; i < newLeaveAssignments.length; i++) {
      const assignment = newLeaveAssignments[i]
      try {
        // ⚠️ Updates THIS unit's soldier fairness only
        await ds.fairnessUpdate.applyLeaveAssignment(
          assignment.soldierId,           // Could be from another unit!
          assignment.leaveType,
          assignment.isWeekend,
          auth.email ?? 'user'
        )
      } catch (e) {
        console.warn('[App] Failed to update fairness for soldier', assignment.soldierId, ':', e)
      }
      // Rate limit: 1 per second
      if (i < newLeaveAssignments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    reload()
    addToast('Schedule generated and distributed', 'success')
  } catch (e) {
    console.error('[App] Schedule generation failed:', e)
    addToast('Failed to generate schedule', 'error')
  }
}
```

### The Issue

```
Scenario: Unit A commander generates schedule with multi-unit soldiers

leaveSchedule.assignments includes:
  - 10 leaves for Unit A soldiers
  - 8 leaves for Unit B soldiers (passed through allSoldiers)

Fairness updates:
  ds.fairnessUpdate.applyLeaveAssignment()
  ↓
  Updates Unit A DataService only
  ↓
  Unit A soldier fairness: UPDATED ✓
  Unit B soldier fairness: NOT UPDATED ❌
  
  Why? Because ds = DataService for Unit A only
  Unit B soldiers' fairness records are in Unit B's spreadsheet

Result: Fairness scores become inconsistent across units!
```

---

## Summary Table: Where Multi-Unit Breaks Down

| Function | Parameter | Accepts Multi? | Should Accept? | Status |
|----------|-----------|---|---|---|
| `generateTaskSchedule()` | `allSoldiers` | YES | YES | ✓ Correct |
| `generateLeaveSchedule()` | `allSoldiers` | NO | YES | ❌ Missing |
| `scheduleTasks()` | `soldiers` | YES (if passed) | YES | ✓ OK |
| `generateCyclicalLeaves()` | `soldiers` | NO (only unit) | YES | ❌ Incomplete |
| `calculateLeaveCapacityPerRole()` | `soldiers` | NO (only unit) | YES | ❌ Incomplete |
| `applyLeaveAssignment()` (fairness) | (implicit) | NO | YES | ❌ Unit-only |

---

## Files That Need Changes

1. **`src/services/scheduleService.ts`**
   - Add `allSoldiers` parameter to `generateLeaveSchedule()`
   - Pass it to `generateCyclicalLeaves()`

2. **`src/algorithms/cyclicalLeaveScheduler.ts`**
   - Accept `allSoldiers` parameter
   - Use complete soldier pool in capacity calculations

3. **`src/algorithms/leaveCapacityCalculator.ts`**
   - Accept `allSoldiers` parameter or make soldiers pool complete
   - Use complete pool for capacity math

4. **`src/App.tsx`**
   - Apply fairness updates across all unit DataServices for multi-unit soldiers
   - Or centralize fairness updates to admin level

5. **`src/components/AdminPanel.tsx`**
   - Consider passing multi-unit leave data to leave schedule generation

