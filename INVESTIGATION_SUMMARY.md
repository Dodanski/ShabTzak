# ShabTzak Scheduling Algorithm Investigation - Summary Report

## Investigation Overview

This report contains a complete investigation of the scheduling algorithm in the ShabTzak codebase, specifically focusing on:
1. How schedule generation is triggered from AdminDashboard
2. How soldiers from multiple units are loaded and aggregated
3. How the 10:4 leave ratio is enforced
4. How task scheduling selects soldiers across multiple units
5. Critical issues in multi-unit handling

## Key Documents Included

1. **scheduling_investigation.md** - Comprehensive investigation with:
   - Flow diagrams from AdminDashboard to schedule generation
   - Multi-unit soldier loading mechanisms
   - Leave generation and 10:4 ratio enforcement
   - Task scheduler multi-unit logic
   - 5 major issues identified

2. **flow_diagram.txt** - Visual flowcharts showing:
   - Admin Panel flow (multi-unit)
   - Unit App flow (multi-unit)
   - Data flow sources
   - Critical data flow issues

3. **code_snippets_issues.md** - Code evidence for each issue:
   - Exact file locations and line numbers
   - Before/after code comparisons
   - Real-world impact examples

---

## Quick Reference: Architecture Overview

### Data Flow

```
Master Spreadsheet (Admin sees all)
├── Soldiers Tab: All soldiers from all units
├── TaskSchedule Tab: Shared across all units
└── LeaveSchedule Tab: Shared across all units

        ↓ reads from ↑ writes to

Unit A Spreadsheet    Unit B Spreadsheet
├── Soldiers (local)  ├── Soldiers (local)
├── TaskSchedule      ├── TaskSchedule
└── LeaveSchedule     └── LeaveSchedule
```

### Generation Flow

```
AdminPanel.handleGenerateScheduleForAllUnits()
├─ Phase 1: Generate Task Schedule (FIRST)
│  └─ Uses: ALL soldiers from master sheet
│  └─ Supports: Multi-unit ✓
│
└─ Phase 2: Generate Leave Schedule (SECOND)
   └─ Uses: Unit soldiers only (INCOMPLETE!)
   └─ Supports: Multi-unit ✗
```

---

## Critical Findings

### 1. Task Scheduling Works Correctly for Multi-Unit

**Status:** ✓ Working as intended

- `generateTaskSchedule()` accepts `allSoldiers` parameter
- Task scheduler implements unit affinity logic
- Soldiers from multiple units can be assigned to tasks
- Shared master task schedule persisted correctly

**File:** `src/algorithms/taskScheduler.ts` (lines 92-117)
**Logic:** Prefers same unit, then sorts by fairness

---

### 2. Leave Scheduling Broken for Multi-Unit

**Status:** ✗ Critical Issue

**Problem:** `generateLeaveSchedule()` has NO `allSoldiers` parameter

```typescript
// TASK generation (works):
generateTaskSchedule(..., allSoldiers)  // ✓ Has parameter

// LEAVE generation (broken):
generateLeaveSchedule(config, scheduleStart, scheduleEnd, changedBy)
// ✗ No allSoldiers parameter!
```

**Impact:** 
- Leave capacity calculated with incomplete soldier pool
- Only current unit soldiers considered for leave ratio
- minBasePresenceByRole enforced incorrectly for multi-unit

**File:** `src/services/scheduleService.ts` (lines 25-86)

---

### 3. Leave Capacity Based on Incomplete Soldier Pool

**Status:** ✗ Critical Issue

**The Math:**
```
availableForLeave = max(0, totalOfRole - minRequired - alreadyOnLeave)
                         ↑
                    ONLY unit soldiers!
```

**Real-World Scenario:**
```
Config: minBasePresenceByRole.Driver = 8

Unit A alone:
  - Has 5 drivers
  - Calculates: max(0, 5 - 8 - 0) = 0
  - Result: NO drivers can take leave!
  - ✗ WRONG: Should consider all 10 drivers (both units)

Correct:
  - Has 10 drivers total (both units)
  - Should calculate: max(0, 10 - 8 - onLeave) = available slots
  - Result: Up to 2 drivers can take leave
```

**File:** `src/algorithms/leaveCapacityCalculator.ts` (lines 44-50)

---

### 4. Cross-Unit Leave Conflicts Possible

**Status:** ✗ Critical Issue

**Scenario:**
```
Unit A generates leave: 2 drivers on leave
Unit B generates leave: 3 drivers on leave

Each unit checks capacity independently ✓
Both pass their checks ✓

When viewed together:
  Total drivers: 8
  Required at base: 5 (minBasePresenceByRole)
  On leave: 5
  At base: 3 ✗ VIOLATES MINIMUM!
```

**Problem:** No cross-unit synchronization during leave generation

**File:** 
- `src/services/scheduleService.ts` (lines 25-86)
- `src/algorithms/leaveCapacityCalculator.ts`

---

### 5. Task Scheduler Doesn't Know About Other Units' Leaves

**Status:** ✗ Moderate Issue

**When:** Scheduling multi-unit soldiers

**Problem:** Task scheduler only sees current unit's leave assignments

```typescript
scheduleTasks(
  tasks,
  multiUnitSoldiers,      // ✓ Can be multi-unit
  existingAssignments,
  allTasks,
  leaveAssignments,       // ✗ Only current unit!
  config
)
```

**Impact:**
- Could assign Unit B soldier to task
- While that soldier is actually on leave (from Unit B schedule)
- Scheduler doesn't know because it only sees Unit A's leaves

**File:** `src/services/scheduleService.ts` (lines 148)

---

### 6. Task Scheduler Unit Affinity Lock-In

**Status:** ~ Design issue (may be intentional)

**How It Works:**
```typescript
// Task starts empty
taskUnit = null

// First assignment (random): Unit A soldier
taskUnit = "Unit A"  // ← LOCKED

// Remaining assignments: PREFER Unit A
// Even if Unit B soldiers more deserving (fairness)
```

**Issue:** Task bias can form from first random assignment

**Mitigation:** Might be intentional for "keep task in one unit" policy

**File:** `src/algorithms/taskScheduler.ts` (lines 92-105)

---

### 7. Fairness Updates Not Cross-Unit Aware

**Status:** ✗ Issue

**Problem:** Fairness only updated in current unit's spreadsheet

```typescript
// When Unit A commander generates schedule:
ds.fairnessUpdate.applyLeaveAssignment(
  soldierId,      // Could be Unit B soldier!
  ...
)
// ✗ Updates only Unit A's fairness
// ✓ Should update Unit B soldier's fairness in Unit B sheet
```

**Impact:** Fairness scores become inconsistent across units

**File:** `src/App.tsx` (lines 207-227)

---

## Issue Severity Assessment

| Issue | Severity | Impact | Fix Difficulty |
|-------|----------|--------|-----------------|
| Leave generation incomplete | CRITICAL | Soldiers can't take leaves correctly | Medium |
| Leave capacity math wrong | CRITICAL | Violates minBasePresenceByRole | Medium |
| Cross-unit leave conflicts | CRITICAL | Silent constraint violations | Hard |
| Task scheduler missing leaves | MODERATE | Assign soldiers already on leave | Medium |
| Unit affinity lock-in | LOW | Might be intentional | Low |
| Fairness not cross-unit | MODERATE | Consistency issues | Medium |

---

## Code Locations Reference

### Key Files

| File | Purpose | Multi-Unit Support |
|------|---------|-----------------|
| `src/components/AdminPanel.tsx` | Triggers schedule generation | Partial ✗ |
| `src/services/scheduleService.ts` | Orchestrates algorithms | Partial ✗ |
| `src/algorithms/taskScheduler.ts` | Assigns soldiers to tasks | YES ✓ |
| `src/algorithms/cyclicalLeaveScheduler.ts` | Generates cyclical leaves | NO ✗ |
| `src/algorithms/leaveCapacityCalculator.ts` | Calculates leave capacity | NO ✗ |
| `src/App.tsx` | UnitApp schedule generation | Partial ✗ |
| `src/hooks/useDataService.ts` | Loads multi-unit soldiers | YES ✓ |
| `src/hooks/useScheduleGenerator.ts` | Hook for schedule generation | Partial ✗ |

### TODO Comments in Code

**File:** `src/services/scheduleService.ts` (lines 52-55)
```typescript
// TODO: Load leaves from all unit spreadsheets for full multi-unit support
```

**File:** `src/components/AdminPanel.tsx` (line 298)
```typescript
// TODO: load from master.taskAssignments.list()
```

---

## Recommended Fix Priority

### P0 - Must Fix (Breaks Multi-Unit)

1. Add `allSoldiers` parameter to `generateLeaveSchedule()`
   - File: `src/services/scheduleService.ts`
   - Effort: 2-3 hours
   - Impact: Enables multi-unit leave scheduling

2. Pass multi-unit soldiers to `generateCyclicalLeaves()`
   - File: `src/algorithms/cyclicalLeaveScheduler.ts`
   - Effort: 1 hour
   - Impact: Uses complete soldier pool for capacity

### P1 - Should Fix (Correctness)

3. Update `calculateLeaveCapacityPerRole()` to use complete soldier pool
   - File: `src/algorithms/leaveCapacityCalculator.ts`
   - Effort: 1 hour
   - Impact: Correct capacity calculations

4. Pass complete leave assignments to task scheduler
   - File: `src/services/scheduleService.ts`
   - Effort: 1-2 hours
   - Impact: Prevents leave conflicts in task assignment

5. Apply cross-unit fairness updates
   - File: `src/App.tsx`
   - Effort: 2-3 hours
   - Impact: Consistent fairness across units

### P2 - Nice to Have (Polish)

6. Prevent unit affinity lock-in (or document as intentional)
   - File: `src/algorithms/taskScheduler.ts`
   - Effort: 1-2 hours
   - Impact: Fairer task distribution

---

## 10:4 Ratio Explanation

The 10:4 leave ratio is enforced through:

1. **Configuration:** `leaveRatioDaysInBase = 10`, `leaveRatioDaysHome = 4`
2. **Cycle Length:** 14 days (10 + 4)
3. **Phase Offset:** Each soldier randomized starting position (0-13)
4. **Position Calculation:** `(dayNumber + phaseOffset) % 14`
5. **Leave Phase:** Positions 10-13 (days 10-13 of cycle)
6. **Capacity Enforcement:** `calculateLeaveCapacityPerRole()` limits who can go on leave

**File:** `src/algorithms/cyclicalLeaveScheduler.ts` (lines 23, 51-94)

**Works correctly within SINGLE unit** but breaks in multi-unit scenario due to incomplete soldier pool.

---

## Testing Recommendations

### Test Case 1: Multi-Unit Leave Capacity
```
Setup: 2 units, each with 5 drivers
Config: minBasePresenceByRole.Driver = 8
Expected: Should be able to assign 2 drivers to leave each day
Actual: Currently 0 can take leave in each unit (bug)
```

### Test Case 2: Cross-Unit Conflict Detection
```
Setup: Generate leave schedule, then verify across all units
Expected: No date should have >3 drivers on leave
Actual: Could have >5 drivers on leave without detection
```

### Test Case 3: Task-Leave Conflict
```
Setup: Generate task schedule with multi-unit soldiers
Expected: No soldier assigned to task if on leave
Actual: Could assign soldier from other unit who's on leave
```

---

## Summary

The ShabTzak scheduling system has a strong architecture with clear separation of concerns. Task scheduling correctly handles multi-unit soldiers. However, leave scheduling was not fully completed for multi-unit support.

**Key Issue:** Leave generation and capacity calculations only see the current unit's soldiers, not the complete multi-unit pool.

**Result:** When operating across multiple units:
- Leave capacity calculations are wrong (too restrictive)
- Leave assignments don't respect global minBasePresenceByRole
- Task scheduler can assign soldiers who are actually on leave

**Fix Complexity:** Medium (need to pass soldier pool through functions)
**Fix Time Estimate:** 6-8 hours for all P0+P1 issues
**Breaking Change Risk:** Low (backward compatible if done properly)

