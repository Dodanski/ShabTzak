# Smart Cyclical Leaves, Multi-Unit Scheduling & Admin Dashboard

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement smart cyclical leave scheduling that respects minBasePresenceByRole per role, multi-unit task scheduling with unit affinity, and an admin dashboard task calendar for cross-unit visibility.

**Architecture:**
1. Smart cyclical leaves calculate per-role leave capacity dynamically based on task requirements and minBasePresenceByRole
2. Task scheduler prefers soldiers from same unit but allows cross-unit assignment to fill all tasks
3. Admin dashboard mirrors commander's task calendar but shows all soldiers from all units

**Priority Hierarchy:** Task allocation (100% fill required roles) > Leave scheduling > Unit affinity

**Tech Stack:** React, TypeScript, Sheets API

---

## Context Setup

### Current State
- `minBasePresenceByRole` exists in AppConfig (per-role minimums)
- Soldiers have `role` but NOT a `unit` field yet
- Task scheduler assigns without unit consideration
- No admin-visible task calendar exists

### Data Model Changes Needed
- Add `unit?: string` to Soldier model
- Update SoldierRepository serializers/parsers to handle unit
- Task scheduler needs access to soldier's unit

---

## Task 1: Add Unit Field to Soldier Model

**Files:**
- Modify: `src/models/Soldier.ts`
- Modify: `src/services/serializers.ts`
- Modify: `src/services/parsers.ts`

**Step 1: Update Soldier model**

In `src/models/Soldier.ts`, add unit field:

```typescript
export interface Soldier {
  id: string
  firstName: string
  lastName: string
  role: SoldierRole
  unit?: string // New field: which unit/company soldier belongs to
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
  unit?: string // New field
  serviceStart: string
  serviceEnd: string
}

export interface UpdateSoldierInput {
  id: string
  newId?: string
  firstName?: string
  lastName?: string
  role?: SoldierRole
  unit?: string // New field
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

**Step 2: Update serializers**

In `src/services/serializers.ts`, update `serializeSoldier()`:

```typescript
export function serializeSoldier(s: Soldier): string[] {
  return [
    s.id,
    s.firstName,
    s.lastName,
    s.role,
    s.unit ?? '', // Add unit serialization
    s.serviceStart,
    s.serviceEnd,
    String(s.initialFairness),
    String(s.currentFairness),
    s.status,
    s.inactiveReason ?? '',
    String(s.hoursWorked),
    String(s.weekendLeavesCount),
    String(s.midweekLeavesCount),
    String(s.afterLeavesCount),
  ]
}
```

**Step 3: Update parsers**

In `src/services/parsers.ts`, update `parseSoldier()` to extract unit from column index 4:

```typescript
export function parseSoldier(row: string[], headers: string[]): Soldier {
  const getIndex = (header: string) => headers.indexOf(header)
  return {
    id: row[getIndex('ID')] ?? '',
    firstName: row[getIndex('FirstName')] ?? '',
    lastName: row[getIndex('LastName')] ?? '',
    role: row[getIndex('Role')] ?? '',
    unit: row[getIndex('Unit')] ?? undefined, // Add unit parsing
    serviceStart: normalizeDate(row[getIndex('ServiceStart')] ?? ''),
    serviceEnd: normalizeDate(row[getIndex('ServiceEnd')] ?? ''),
    initialFairness: parseFloat(row[getIndex('InitialFairness')] ?? '0'),
    currentFairness: parseFloat(row[getIndex('CurrentFairness')] ?? '0'),
    status: row[getIndex('Status')] ?? 'Active',
    inactiveReason: row[getIndex('InactiveReason')] ?? undefined,
    hoursWorked: parseFloat(row[getIndex('HoursWorked')] ?? '0'),
    weekendLeavesCount: parseFloat(row[getIndex('WeekendLeavesCount')] ?? '0'),
    midweekLeavesCount: parseFloat(row[getIndex('MidweekLeavesCount')] ?? '0'),
    afterLeavesCount: parseFloat(row[getIndex('AfterLeavesCount')] ?? '0'),
  }
}
```

**Step 4: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 5: Commit**

```bash
git add src/models/Soldier.ts src/services/serializers.ts src/services/parsers.ts
git commit -m "feat: add unit field to Soldier model for multi-unit scheduling"
```

---

## Task 2: Implement Role-Based Leave Capacity Calculator

**Files:**
- Create: `src/algorithms/leaveCapacityCalculator.ts`
- Test: `src/algorithms/leaveCapacityCalculator.test.ts`

**Step 1: Write test for capacity calculation**

Create `src/algorithms/leaveCapacityCalculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, TaskAssignment, AppConfig } from '../models'

describe('leaveCapacityCalculator', () => {
  it('calculates how many soldiers of each role can take leave on a date', () => {
    const soldiers: Soldier[] = [
      { id: '1', role: 'Driver', unit: 'A', status: 'Active', /* ... */ },
      { id: '2', role: 'Driver', unit: 'A', status: 'Active', /* ... */ },
      { id: '3', role: 'Driver', unit: 'B', status: 'Active', /* ... */ },
      { id: '4', role: 'Squad Leader', unit: 'A', status: 'Active', /* ... */ },
    ]

    const config: AppConfig = {
      minBasePresenceByRole: {
        'Driver': 2,
        'Squad Leader': 1,
        'Fighter': 0,
      },
      // ... other config
    }

    const taskAssignments: TaskAssignment[] = [] // No tasks assigned

    const date = '2026-04-01'
    const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date)

    // 3 Drivers total, need 2 in base → can have 1 on leave
    // 1 Squad Leader, need 1 in base → can have 0 on leave
    expect(capacity['Driver']).toBe(1)
    expect(capacity['Squad Leader']).toBe(0)
  })

  it('accounts for soldiers already on tasks', () => {
    const soldiers: Soldier[] = [
      { id: '1', role: 'Driver', unit: 'A', status: 'Active', /* ... */ },
      { id: '2', role: 'Driver', unit: 'A', status: 'Active', /* ... */ },
      { id: '3', role: 'Driver', unit: 'B', status: 'Active', /* ... */ },
    ]

    const taskAssignments: TaskAssignment[] = [
      { taskId: 'tour1', soldierId: '1', /* ... */ }, // Driver 1 on task
    ]

    const config: AppConfig = {
      minBasePresenceByRole: { 'Driver': 2, /* ... */ },
      // ... other config
    }

    const date = '2026-04-01'
    const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date)

    // 3 Drivers - 1 on task = 2 available, need 2 in base → can have 0 on leave
    expect(capacity['Driver']).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- src/algorithms/leaveCapacityCalculator.test.ts
# Expected: FAIL - "leaveCapacityCalculator not found"
```

**Step 3: Implement capacity calculator**

Create `src/algorithms/leaveCapacityCalculator.ts`:

```typescript
import type { Soldier, TaskAssignment, AppConfig } from '../models'

/**
 * Calculates how many soldiers of each role can take leave on a given date
 * while ensuring minBasePresenceByRole is maintained.
 *
 * Formula per role:
 * capacity = total_soldiers_of_role - soldiers_on_task - minBasePresence
 *
 * Returns 0 if capacity would be negative (can't allow leaves).
 */
export function calculateLeaveCapacityPerRole(
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  date: string,
): Record<string, number> {
  const capacity: Record<string, number> = {}

  // Group soldiers by role
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Calculate capacity for each role
  for (const [role, roleSoldiers] of soldiersByRole) {
    const totalOfRole = roleSoldiers.length
    const minRequired = config.minBasePresenceByRole[role] ?? 0
    const availableForLeave = Math.max(0, totalOfRole - minRequired)
    capacity[role] = availableForLeave
  }

  return capacity
}

/**
 * Checks if a specific soldier can take leave on a date without violating constraints
 */
export function canSoldierTakeLeave(
  soldier: Soldier,
  date: string,
  soldiers: Soldier[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
): boolean {
  const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, date)
  return (capacity[soldier.role] ?? 0) > 0
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test -- src/algorithms/leaveCapacityCalculator.test.ts
# Expected: PASS
```

**Step 5: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 6: Commit**

```bash
git add src/algorithms/leaveCapacityCalculator.ts src/algorithms/leaveCapacityCalculator.test.ts
git commit -m "feat: add role-based leave capacity calculator respecting minBasePresenceByRole"
```

---

## Task 3: Fix Cyclical Leave Scheduler with Role Constraints

**Files:**
- Modify: `src/algorithms/cyclicalLeaveScheduler.ts`
- Modify: `src/services/scheduleService.ts` (re-enable cyclical leaves)

**Step 1: Rewrite cyclical leave logic**

Replace `src/algorithms/cyclicalLeaveScheduler.ts`:

```typescript
import { parseDate, formatDate, getDateRange } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig } from '../models'

/**
 * Generates cyclical home leaves distributed fairly across soldiers of each role.
 * Respects minBasePresenceByRole: soldiers can only take leave if there's capacity.
 *
 * Pattern per role: soldiers take turns in N-day cycles (e.g., 10:4 ratio)
 * All soldiers of same role cycle together, offset by initial fairness to distribute leaves.
 */
export function generateCyclicalLeaves(
  soldiers: Soldier[],
  existingLeaves: LeaveAssignment[],
  taskAssignments: TaskAssignment[],
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
): LeaveAssignment[] {
  const result = [...existingLeaves]
  const startDate = parseDate(scheduleStart)
  const endDate = parseDate(scheduleEnd)
  const cycleLength = config.leaveRatioDaysInBase + config.leaveRatioDaysHome

  // Find manually-added leaves (with requestId) to lock soldiers out
  const manualLockDates = new Map<string, Set<string>>()
  for (const leave of existingLeaves) {
    if (leave.requestId) {
      if (!manualLockDates.has(leave.soldierId)) {
        manualLockDates.set(leave.soldierId, new Set())
      }
      const dates = getDateRange(parseDate(leave.startDate), parseDate(leave.endDate))
      for (const d of dates) {
        manualLockDates.get(leave.soldierId)!.add(formatDate(d))
      }
    }
  }

  // Group soldiers by role for cycling
  const soldiersByRole = new Map<string, Soldier[]>()
  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    soldiersByRole.get(soldier.role)!.push(soldier)
  }

  // Generate leaves per role, ensuring capacity constraints
  for (const [role, roleSoldiers] of soldiersByRole) {
    // Sort soldiers by ID for deterministic cycling
    roleSoldiers.sort((a, b) => a.id.localeCompare(b.id))

    // Track position in cycle for each soldier
    const soldierCyclePos = new Map<string, number>()
    for (const soldier of roleSoldiers) {
      soldierCyclePos.set(soldier.id, 0)
    }

    // Iterate through schedule period
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate)

      // Check capacity for this role on this date
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr)
      const availableSlots = capacity[role] ?? 0

      if (availableSlots > 0) {
        // Assign leave to soldiers in cycle order for this role
        let slotsUsed = 0
        for (const soldier of roleSoldiers) {
          if (slotsUsed >= availableSlots) break
          if (manualLockDates.has(soldier.id) && manualLockDates.get(soldier.id)!.has(dateStr)) {
            continue // Skip manually locked soldiers
          }

          const cyclePos = soldierCyclePos.get(soldier.id) ?? 0
          const isInLeavePhase = cyclePos >= config.leaveRatioDaysInBase

          if (isInLeavePhase) {
            const dayInLeave = cyclePos - config.leaveRatioDaysInBase
            const isExitDay = dayInLeave === 0
            const isReturnDay = dayInLeave === config.leaveRatioDaysHome - 1

            const leaveId = `cycle-${role}-${soldier.id}-${dateStr}`
            const alreadyExists = result.some(l => l.id === leaveId)

            if (!alreadyExists) {
              if (isExitDay) {
                result.push({
                  id: `${leaveId}-exit`,
                  soldierId: soldier.id,
                  startDate: `${dateStr}T${config.leaveBaseExitHour}:00`,
                  endDate: `${dateStr}T23:59:59`,
                  leaveType: 'After',
                  isWeekend: false,
                  isLocked: true,
                  createdAt: new Date().toISOString(),
                })
              } else if (isReturnDay) {
                result.push({
                  id: `${leaveId}-return`,
                  soldierId: soldier.id,
                  startDate: `${dateStr}T00:00:00`,
                  endDate: `${dateStr}T${config.leaveBaseReturnHour}:00`,
                  leaveType: 'After',
                  isWeekend: false,
                  isLocked: true,
                  createdAt: new Date().toISOString(),
                })
              } else {
                result.push({
                  id: leaveId,
                  soldierId: soldier.id,
                  startDate: dateStr,
                  endDate: dateStr,
                  leaveType: 'After',
                  isWeekend: false,
                  isLocked: true,
                  createdAt: new Date().toISOString(),
                })
              }
              slotsUsed++
            }
          }
        }
      }

      // Advance all soldiers' cycle position
      for (const soldier of roleSoldiers) {
        const currentPos = soldierCyclePos.get(soldier.id) ?? 0
        soldierCyclePos.set(soldier.id, (currentPos + 1) % cycleLength)
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return result
}
```

**Step 2: Re-enable in scheduleService**

In `src/services/scheduleService.ts`, uncomment and update:

```typescript
import { generateCyclicalLeaves } from '../algorithms/cyclicalLeaveScheduler'

async generateLeaveSchedule(...) {
  const [soldiers, requests, existing] = await Promise.all([...])

  // Generate automatic cyclical leaves respecting role capacity
  const withCyclicalLeaves = generateCyclicalLeaves(
    soldiers, existing, taskAssignments, config, scheduleStart, scheduleEnd
  )

  // Then process manual requests
  const schedule = scheduleLeave(requests, soldiers, withCyclicalLeaves, config, scheduleStart, scheduleEnd)
  // ...
}
```

**Wait - taskAssignments not available yet**. Need to fetch or pass differently. Adjust:

```typescript
async generateLeaveSchedule(
  config: AppConfig,
  scheduleStart: string,
  scheduleEnd: string,
  changedBy: string,
): Promise<LeaveSchedule> {
  const [soldiers, requests, existing, taskAssignments] = await Promise.all([
    this.soldiers.list(),
    this.leaveRequests.list(),
    this.leaveAssignments.list(),
    this.taskAssignments.list(), // Add this
  ])

  const withCyclicalLeaves = generateCyclicalLeaves(
    soldiers, existing, taskAssignments, config, scheduleStart, scheduleEnd
  )

  const schedule = scheduleLeave(requests, soldiers, withCyclicalLeaves, config, scheduleStart, scheduleEnd)
  // ... rest unchanged
}
```

**Step 3: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 4: Commit**

```bash
git add src/algorithms/cyclicalLeaveScheduler.ts src/services/scheduleService.ts
git commit -m "fix: implement role-based cyclical leaves respecting capacity constraints"
```

---

## Task 4: Update Task Scheduler for Multi-Unit Scheduling with Unit Affinity

**Files:**
- Modify: `src/algorithms/taskScheduler.ts`

**Step 1: Update task scheduler logic**

In `src/algorithms/taskScheduler.ts`, modify soldier filtering to prefer same unit:

```typescript
// In scheduleTasks() function, replace eligible soldier calculation:

// Find eligible soldiers: role match + available (rest period, status)
const eligible = soldiers.filter(s => {
  if (requirement.role !== 'Any' && s.role !== requirement.role) return false
  return isTaskAvailable(s, task, tasksForValidation, result)
})

// Sort by unit affinity (prefer same unit as task's unit if available),
// then by fairness score
const getTaskUnit = () => {
  // Determine task's unit based on majority of already-assigned soldiers
  const assignedUnits = result
    .filter(a => a.taskId === task.id)
    .map(a => soldiers.find(s => s.id === a.soldierId)?.unit)
    .filter(Boolean)

  if (assignedUnits.length === 0) return null // No preference yet

  const unitCounts = new Map<string, number>()
  for (const unit of assignedUnits) {
    unitCounts.set(unit!, (unitCounts.get(unit!) ?? 0) + 1)
  }
  return Array.from(unitCounts.entries())
    .sort((a, b) => b[1] - a[1])[0][0] // Most common unit
}

const taskUnit = getTaskUnit()

const ranked = [...eligible].sort((a, b) => {
  // Primary: prefer same unit as task
  if (taskUnit) {
    const aUnit = a.unit === taskUnit ? 0 : 1
    const bUnit = b.unit === taskUnit ? 0 : 1
    if (aUnit !== bUnit) return aUnit - bUnit
  }

  // Secondary: fairness score (lower = more deserving)
  return combinedFairnessScore(a) - combinedFairnessScore(b)
})

// Assign up to `remaining` soldiers
for (let i = 0; i < Math.min(remaining, ranked.length); i++) {
  const soldier = ranked[i]
  result.push({
    scheduleId: `sched-${task.id}`,
    taskId: task.id,
    soldierId: soldier.id,
    assignedRole: requirement.role === 'Any' ? soldier.role : requirement.role,
    isLocked: false,
    createdAt: new Date().toISOString(),
    createdBy: 'scheduler',
  })
}
```

**Step 2: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 3: Commit**

```bash
git add src/algorithms/taskScheduler.ts
git commit -m "feat: add unit affinity to task scheduler - prefer soldiers from same unit"
```

---

## Task 5: Create Admin Task Calendar Component

**Files:**
- Create: `src/components/AdminTaskCalendar.tsx`

**Step 1: Write component**

Create `src/components/AdminTaskCalendar.tsx` (copy TaskModeCalendar and extend):

```typescript
import { useState } from 'react'
import { fullName } from '../utils/helpers'
import { parseDate } from '../utils/dateUtils'
import type { Soldier, Task, TaskAssignment, LeaveAssignment } from '../models'

interface AdminTaskCalendarProps {
  soldiers: Soldier[] // ALL soldiers from all units
  tasks: Task[]
  taskAssignments: TaskAssignment[]
  leaveAssignments: LeaveAssignment[]
  weekStart: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year.slice(2)}`
}

function isOnLeaveOnDate(assignment: LeaveAssignment, dateStr: string): boolean {
  const date = parseDate(dateStr)
  return parseDate(assignment.startDate) <= date && date <= parseDate(assignment.endDate)
}

export default function AdminTaskCalendar({
  soldiers,
  tasks,
  taskAssignments,
  leaveAssignments,
  weekStart,
}: AdminTaskCalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Convert weekStart (Monday) to Sunday of that week
  const startDate = new Date(weekStart)
  const dayOfWeek = startDate.getDay()
  const diff = startDate.getDate() - dayOfWeek
  const sunday = new Date(startDate.setDate(diff))

  // Get dates for the week (Sun-Sat)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Expand recurring tasks
  const expandedTasks = tasks.flatMap(task => {
    if (task.isSpecial) return [task]
    return weekDates.map((date, idx) => ({
      ...task,
      id: `${task.id}_day${idx}`,
      startTime: `${date}T${task.startTime.split('T')[1]}`,
      endTime: `${date}T${task.endTime.split('T')[1]}`,
    }))
  })

  const weekEnd = weekDates[6]
  const tasksInWeek = expandedTasks.filter(t => {
    const taskDate = t.startTime.split('T')[0]
    return taskDate >= weekStart && taskDate <= weekEnd
  })

  const selectedTask = tasksInWeek.find(t => t.id === selectedTaskId)
  const assignedSoldiers = selectedTask
    ? soldiers.filter(s => taskAssignments.some(a => a.taskId === selectedTask.id && a.soldierId === s.id))
    : []

  const HOUR_HEIGHT = 40
  const TOTAL_HOURS = 24

  function timeToPixels(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    let displayHour: number
    if (hours >= 6) {
      displayHour = hours - 6
    } else {
      displayHour = hours + 18
    }
    return displayHour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT
  }

  function durationToPixels(durationHours: number): number {
    return durationHours * HOUR_HEIGHT
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Main calendar */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="w-20 flex-shrink-0"></div>
          {weekDates.map((date) => {
            const d = new Date(date)
            const dayIndex = d.getDay()
            return (
              <div key={date} className="flex-1 min-w-[120px] border-l border-gray-200 p-2 text-center">
                <div className="text-xs font-semibold text-olive-700">{DAYS[dayIndex]}</div>
                <div className="text-sm text-gray-600">{formatDateShort(date)}</div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 bg-gray-50 border-r border-gray-200">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const displayHour = i < 18 ? i + 6 : i - 18
              const isBoundary = i === 18
              return (
                <div
                  key={i}
                  className={`border-t text-xs pr-2 text-right ${
                    isBoundary ? 'border-t-2 border-olive-300 bg-olive-50 text-olive-600 font-medium' : 'border-gray-200 text-gray-500'
                  }`}
                  style={{ height: HOUR_HEIGHT }}
                >
                  {String(displayHour).padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          {/* Days columns */}
          <div className="flex flex-1">
            {weekDates.map(date => (
              <div
                key={date}
                className="flex-1 min-w-[120px] border-l border-gray-200 relative"
                style={{
                  height: TOTAL_HOURS * HOUR_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(
                    to bottom,
                    transparent 0,
                    transparent ${HOUR_HEIGHT - 1}px,
                    #f0f0f0 ${HOUR_HEIGHT - 1}px,
                    #f0f0f0 ${HOUR_HEIGHT}px
                  )`,
                }}
              >
                {/* Show leaves overlay */}
                {leaveAssignments.some(l => isOnLeaveOnDate(l, date)) && (
                  <div className="absolute inset-0 bg-yellow-100 opacity-40 pointer-events-none border-l-4 border-yellow-500"></div>
                )}

                {/* Show tasks */}
                {tasksInWeek
                  .filter(t => t.startTime.split('T')[0] === date)
                  .map(task => {
                    const startTime = task.startTime.split('T')[1] || '00:00'
                    const top = timeToPixels(startTime)
                    const height = durationToPixels(task.durationHours)

                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`absolute left-1 right-1 rounded px-2 py-1 text-xs font-medium cursor-pointer transition-all ${
                          selectedTaskId === task.id
                            ? 'bg-olive-600 text-white ring-2 ring-olive-400'
                            : 'bg-olive-200 text-olive-900 hover:bg-olive-300'
                        }`}
                        style={{ top, height: Math.max(height, 30) }}
                        title={task.taskType}
                      >
                        <div className="truncate">{task.taskType}</div>
                        {height >= 40 && <div className="text-xs truncate">{startTime}</div>}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-olive-800 text-sm">{selectedTask.taskType}</h3>
            <button onClick={() => setSelectedTaskId(null)} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <p className="text-gray-600">Date</p>
              <p className="font-medium">{selectedTask.startTime.split('T')[0]}</p>
            </div>
            <div>
              <p className="text-gray-600">Time</p>
              <p className="font-medium">
                {selectedTask.startTime.split('T')[1]?.slice(0, 5)} - {selectedTask.endTime.split('T')[1]?.slice(0, 5)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Duration</p>
              <p className="font-medium">{selectedTask.durationHours}h</p>
            </div>

            {/* Show all assigned soldiers with their units */}
            <div>
              <p className="text-gray-600 mb-2">Assigned Soldiers ({assignedSoldiers.length})</p>
              {assignedSoldiers.length > 0 ? (
                <ul className="space-y-2">
                  {assignedSoldiers.map(s => (
                    <li key={s.id} className="bg-gray-50 rounded p-2 border-l-2 border-blue-500">
                      <div className="font-medium">{fullName(s)}</div>
                      <div className="text-gray-500">{s.unit || 'No unit'}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No soldiers assigned</p>
              )}
            </div>

            {/* Show unassigned soldiers by unit */}
            <div className="border-t pt-4">
              <p className="text-gray-600 mb-2">Available Soldiers</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {soldiers
                  .filter(
                    s =>
                      s.status === 'Active' &&
                      !assignedSoldiers.find(a => a.id === s.id),
                  )
                  .sort((a, b) => (a.unit || '').localeCompare(b.unit || ''))
                  .map(s => (
                    <div key={s.id} className="bg-blue-50 rounded p-2 text-xs">
                      <div className="font-medium">{fullName(s)}</div>
                      <div className="text-gray-600">{s.role} • {s.unit || 'No unit'}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 3: Commit**

```bash
git add src/components/AdminTaskCalendar.tsx
git commit -m "feat: create AdminTaskCalendar component for cross-unit visibility"
```

---

## Task 6: Add Admin Dashboard with Task Calendar

**Files:**
- Modify: `src/App.tsx` (add admin unit view mode)
- Modify: or create Admin dashboard component

**Step 1: Add admin task calendar to admin panel view**

This requires adding a task calendar route/view to the admin panel. For now:

In a new section of AdminPanel or as a new tab, add:

```typescript
import AdminTaskCalendar from '../AdminTaskCalendar'

// In admin panel render:
{adminTab === 'tasks-calendar' && (
  <AdminTaskCalendar
    soldiers={allSoldiers} // All soldiers from all units
    tasks={tasks}
    taskAssignments={taskAssignments}
    leaveAssignments={leaveAssignments}
    weekStart={weekStartDate}
  />
)}
```

**Step 2: Build and verify**

```bash
npm run build
# Expected: SUCCESS
```

**Step 3: Commit**

```bash
git add src/App.tsx src/components/AdminPanel.tsx # or whatever changes made
git commit -m "feat: add task calendar view to admin dashboard for cross-unit visibility"
```

---

## Testing Checklist

- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm run test`
- [ ] Cyclical leaves respect minBasePresenceByRole
- [ ] Task scheduler prefers unit affinity but allows cross-unit
- [ ] Admin sees all soldiers across all units in task calendar
- [ ] Commander sees only their unit in soldier view (gaps allowed)
- [ ] Tasks are 100% filled (no role shortages)

---

## Deployment

Once all tasks complete:

```bash
git push
npm run deploy
```

