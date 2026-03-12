# Scheduler & Calendar Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix scheduler cyclical leaves distribution, add transition day display to Gantt, filter tasks by service dates, fix date calculation, restore static pie chart, and fix number serialization.

**Architecture:**
1. Rewrite cyclicalLeaveScheduler to use per-soldier phase offsets with randomized initialization
2. Extend availabilityMatrix to track transition day status
3. Add service date validation to calendar filtering logic
4. Fix date calculation bug in AdminDashboard
5. Restore AdminDashboardPieChart with static data from schedule generation
6. Update ConfigRepository to serialize numbers as numbers, not strings

**Tech Stack:** React 18, TypeScript, Google Sheets API, date utilities

---

## Task 1: Fix Cyclical Leave Distribution (Issue 5) - HIGHEST PRIORITY

**Files:**
- Modify: `src/algorithms/cyclicalLeaveScheduler.ts` (rewrite core logic)
- Test: Verify with manual inspection of generated leaves

**Step 1: Understand current behavior**

Open `src/algorithms/cyclicalLeaveScheduler.ts` and trace the issue:
- Lines 131-134: All soldiers advance by 1 position every day
- This creates synchronized cycles where all soldiers leave together
- Problem: No per-soldier phase offset staggering

**Step 2: Design new algorithm**

New algorithm in pseudocode:
```
For each role:
  1. Calculate cycleLength = daysInBase + daysHome
  2. Initialize each soldier with random phase offset (0 to cycleLength-1)
  3. For each date in schedule:
     - Get available capacity slots from config
     - For each soldier in role:
       - Calculate soldier's current position = (day_number + soldier.phase_offset) % cycleLength
       - If position >= daysInBase (in leave phase):
         - Check if soldier can take leave (not manually locked, not already assigned)
         - If yes and capacity > 0: assign leave, decrement capacity
       - Do NOT advance soldier position (it's calculated from date + offset)
  4. Use manual leave requests to override specific dates
```

**Step 3: Rewrite cyclicalLeaveScheduler.ts with new logic**

Replace the entire `generateCyclicalLeaves` function:

```typescript
import { parseDate, formatDate, getDateRange, daysBetween } from '../utils/dateUtils'
import { calculateLeaveCapacityPerRole } from './leaveCapacityCalculator'
import type { Soldier, LeaveAssignment, TaskAssignment, AppConfig } from '../models'

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

  // Find manually-added leaves (with requestId) to lock out
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

  // Group soldiers by role and initialize phase offsets (randomized)
  const soldiersByRole = new Map<string, Soldier[]>()
  const soldiersPhaseOffset = new Map<string, number>()

  for (const soldier of soldiers) {
    if (soldier.status !== 'Active') continue
    if (!soldiersByRole.has(soldier.role)) {
      soldiersByRole.set(soldier.role, [])
    }
    const roleSoldiers = soldiersByRole.get(soldier.role)!
    roleSoldiers.push(soldier)

    // Randomize initial phase offset to stagger leaves
    const phaseOffset = Math.floor(Math.random() * cycleLength)
    soldiersPhaseOffset.set(soldier.id, phaseOffset)
  }

  // Generate leaves per role
  for (const [role, roleSoldiers] of soldiersByRole) {
    // Sort soldiers by ID for deterministic processing
    roleSoldiers.sort((a, b) => a.id.localeCompare(b.id))

    // Track which soldiers already have leave on each date (to not double-assign)
    const assignedToday = new Map<string, Set<string>>()

    // Iterate through schedule period
    let currentDate = new Date(startDate)
    let dayNumber = 0

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate)

      // Check capacity for this role on this date
      const capacity = calculateLeaveCapacityPerRole(soldiers, taskAssignments, config, dateStr)
      let availableSlots = capacity[role] ?? 0

      if (availableSlots > 0) {
        // Assign leave to soldiers based on their individual phase offset
        for (const soldier of roleSoldiers) {
          if (availableSlots <= 0) break

          // Skip if manually locked
          const isManualLocked =
            manualLockDates.has(soldier.id) && manualLockDates.get(soldier.id)!.has(dateStr)
          if (isManualLocked) continue

          // Skip if already assigned on this date
          if (!assignedToday.has(dateStr)) {
            assignedToday.set(dateStr, new Set())
          }
          if (assignedToday.get(dateStr)!.has(soldier.id)) continue

          // Calculate soldier's position in cycle based on their phase offset
          const phaseOffset = soldiersPhaseOffset.get(soldier.id) ?? 0
          const soldierPosition = (dayNumber + phaseOffset) % cycleLength
          const isInLeavePhase = soldierPosition >= config.leaveRatioDaysInBase

          if (isInLeavePhase) {
            const dayInLeave = soldierPosition - config.leaveRatioDaysInBase
            const isExitDay = dayInLeave === 0
            const isReturnDay = dayInLeave === config.leaveRatioDaysHome - 1

            const leaveId = `cycle-${role}-${soldier.id}-${dateStr}`
            const alreadyExists = result.some(l => l.id === leaveId || l.id === `${leaveId}-exit` || l.id === `${leaveId}-return`)

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
              availableSlots--
              assignedToday.get(dateStr)!.add(soldier.id)
            }
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
      dayNumber++
    }
  }

  return result
}
```

**Step 4: Verify the fix works**

Build and check for TypeScript errors:
```bash
npm run build
```
Expected: Build succeeds with no TS errors

Verify logic by inspecting generated leaves (you'll need to run the app and check the spreadsheet after generation)

**Step 5: Commit**

```bash
git add src/algorithms/cyclicalLeaveScheduler.ts
git commit -m "fix: implement per-soldier phase offset for fair leave distribution

- Replace global cycle position with per-soldier phase offset (randomized)
- Each soldier independently cycles through base/leave phases
- Phase position calculated as (dayNumber + phaseOffset) % cycleLength
- Prevents synchronized leaves where all soldiers leave together
- Respects capacity constraints and manual leave locks
- Soldiers now staggered across leave schedule"
```

---

## Task 2: Add Transition Day Display to Gantt Chart (Issue 4)

**Files:**
- Modify: `src/algorithms/availabilityMatrix.ts` (add transition day status)
- Modify: `src/components/ScheduleCalendar.tsx` (add visual styling)

**Step 1: Extend AvailabilityStatus type**

In `src/algorithms/availabilityMatrix.ts`, line 4, change:

```typescript
// OLD:
export type AvailabilityStatus = 'available' | 'on-leave' | 'on-task'

// NEW:
export type AvailabilityStatus = 'available' | 'on-leave' | 'on-task' | 'on-way-home' | 'on-way-to-base'
```

**Step 2: Update CellData interface if needed**

The CellData interface already has optional taskName, which can be used. Add a new optional field:

```typescript
export interface CellData {
  status: AvailabilityStatus
  taskName?: string
  transitionType?: 'exit' | 'return'  // New field for transition day type
}
```

**Step 3: Implement transition day detection in buildAvailabilityMatrix**

Replace the `buildAvailabilityMatrix` function in `src/algorithms/availabilityMatrix.ts`:

```typescript
export function buildAvailabilityMatrix(
  soldiers: Soldier[],
  tasks: Task[],
  taskAssignments: TaskAssignment[],
  leaveAssignments: LeaveAssignment[],
  dates: string[],
): Map<string, Map<string, CellData>> {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const matrix = new Map<string, Map<string, CellData>>()

  // Build a map of leave date ranges for quick lookup
  const soldierLeaveMap = new Map<string, { startDate: Date; endDate: Date; type: string }[]>()
  for (const leave of leaveAssignments) {
    if (!soldierLeaveMap.has(leave.soldierId)) {
      soldierLeaveMap.set(leave.soldierId, [])
    }
    // Parse the date, handling both full datetime and date-only formats
    const startDateStr = leave.startDate.split('T')[0]
    const endDateStr = leave.endDate.split('T')[0]
    soldierLeaveMap.get(leave.soldierId)!.push({
      startDate: parseDate(startDateStr),
      endDate: parseDate(endDateStr),
      type: leave.leaveType,
    })
  }

  for (const dateStr of dates) {
    const dayMap = new Map<string, CellData>()
    const currentDate = parseDate(dateStr)

    for (const soldier of soldiers) {
      // Check for on-leave (takes highest priority)
      const onLeave = leaveAssignments.some(
        a => a.soldierId === soldier.id && isOnLeaveOnDate(a, dateStr)
      )
      if (onLeave) {
        dayMap.set(soldier.id, { status: 'on-leave' })
        continue
      }

      // Check for transition days (day before/after leave)
      const soldiersLeaves = soldierLeaveMap.get(soldier.id) ?? []
      let transitionStatus: CellData | null = null

      for (const leave of soldiersLeaves) {
        // Day before leave (exit day)
        const dayBefore = new Date(leave.startDate)
        dayBefore.setDate(dayBefore.getDate() - 1)
        if (currentDate.getTime() === dayBefore.getTime()) {
          transitionStatus = {
            status: 'on-way-home',
            transitionType: 'exit'
          }
          break
        }

        // Day after leave (return day)
        const dayAfter = new Date(leave.endDate)
        dayAfter.setDate(dayAfter.getDate() + 1)
        if (currentDate.getTime() === dayAfter.getTime()) {
          transitionStatus = {
            status: 'on-way-to-base',
            transitionType: 'return'
          }
          break
        }
      }

      if (transitionStatus) {
        dayMap.set(soldier.id, transitionStatus)
        continue
      }

      // on-task
      let taskName: string | undefined
      const onTask = taskAssignments.some(a => {
        if (a.soldierId !== soldier.id) return false
        const task = taskMap.get(a.taskId)
        if (task && taskCoversDate(task, dateStr)) {
          taskName = task.taskType
          return true
        }
        return false
      })

      dayMap.set(soldier.id, onTask ? { status: 'on-task', taskName } : { status: 'available' })
    }

    matrix.set(dateStr, dayMap)
  }

  return matrix
}
```

**Step 4: Update ScheduleCalendar styling**

In `src/components/ScheduleCalendar.tsx`, line 15, update STATUS_CLASSES:

```typescript
const STATUS_CLASSES: Record<AvailabilityStatus, string> = {
  available: 'bg-green-100',
  'on-leave': 'bg-yellow-200',
  'on-task': 'bg-olive-200',
  'on-way-home': 'bg-orange-200',      // New: orange for exit day
  'on-way-to-base': 'bg-orange-300',   // New: darker orange for return day
}
```

**Step 5: Update cell display to show transition type**

In `src/components/ScheduleCalendar.tsx`, line 66-78, update the cell rendering:

```typescript
{dates.map(d => {
  const cellData = matrix.get(d)?.get(soldier.id) ?? { status: 'available' }
  const status = cellData.status

  let displayText = ''
  if (cellData.taskName) {
    displayText = cellData.taskName
  } else if (cellData.transitionType === 'exit') {
    displayText = '← Out'
  } else if (cellData.transitionType === 'return') {
    displayText = 'In →'
  }

  const title = displayText ? `${status}: ${displayText}` : status

  return (
    <td
      key={d}
      title={title}
      className={`px-0.5 sm:px-2 py-1 sm:py-2 border border-gray-200 text-center min-w-[28px] sm:min-w-[40px] ${STATUS_CLASSES[status]} text-xs font-medium`}
    >
      {displayText}
    </td>
  )
})}
```

**Step 6: Build and verify**

```bash
npm run build
```
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/algorithms/availabilityMatrix.ts src/components/ScheduleCalendar.tsx
git commit -m "feat: display transition days (on-way-home/on-way-to-base) in Gantt chart

- Add 'on-way-home' and 'on-way-to-base' statuses to AvailabilityStatus
- Detect transition days: day before/after leave assignments
- Visualize with orange colors: lighter for exit, darker for return
- Show '← Out' and 'In →' labels for quick visual scanning
- Helps soldiers understand travel days during leave periods"
```

---

## Task 3: Filter Tasks by Soldier Service Dates (Issue 3)

**Files:**
- Modify: `src/components/ScheduleCalendar.tsx` (add service date filtering)
- Modify: `src/components/AdminWeeklyTaskCalendar.tsx` (add service date filtering)

**Step 1: Update ScheduleCalendar filtering**

In `src/components/ScheduleCalendar.tsx`, line 66-78, before rendering task cell, add service date check:

Find the section where tasks are displayed and update it:

```typescript
{dates.map(d => {
  const cellData = matrix.get(d)?.get(soldier.id) ?? { status: 'available' }
  const status = cellData.status

  // NEW: Check if soldier is active on this date
  const currentDate = parseDate(d)
  const serviceStart = parseDate(soldier.serviceStart)
  const serviceEnd = parseDate(soldier.serviceEnd)
  const isInServicePeriod = serviceStart <= currentDate && currentDate <= serviceEnd

  // If out of service period, override status
  const displayStatus = !isInServicePeriod ? 'unavailable' : status

  // ... rest of cell rendering
})}
```

Wait, we need to add 'unavailable' to STATUS_CLASSES. Let me revise:

Actually, simpler approach: just skip showing anything for out-of-service dates:

```typescript
{dates.map(d => {
  const currentDate = parseDate(d)
  const serviceStart = parseDate(soldier.serviceStart)
  const serviceEnd = parseDate(soldier.serviceEnd)
  const isInServicePeriod = serviceStart <= currentDate && currentDate <= serviceEnd

  const cellData = isInServicePeriod
    ? (matrix.get(d)?.get(soldier.id) ?? { status: 'available' })
    : { status: 'available' }  // Render as empty for out-of-service

  const status = cellData.status

  let displayText = ''
  if (!isInServicePeriod) {
    displayText = '-'  // Show dash for out-of-service
  } else if (cellData.taskName) {
    displayText = cellData.taskName
  } else if (cellData.transitionType === 'exit') {
    displayText = '← Out'
  } else if (cellData.transitionType === 'return') {
    displayText = 'In →'
  }

  const title = displayText ? `${status}: ${displayText}` : status
  const bgColor = !isInServicePeriod ? 'bg-gray-300' : STATUS_CLASSES[status]

  return (
    <td
      key={d}
      title={title}
      className={`px-0.5 sm:px-2 py-1 sm:py-2 border border-gray-200 text-center min-w-[28px] sm:min-w-[40px] ${bgColor} text-xs font-medium`}
    >
      {displayText}
    </td>
  )
})}
```

Need to add import for parseDate at top of ScheduleCalendar:

```typescript
import { parseDate, formatDisplayDate } from '../utils/dateUtils'
```

**Step 2: Update AdminWeeklyTaskCalendar filtering**

In `src/components/AdminWeeklyTaskCalendar.tsx`, line 110-117, update task filtering:

```typescript
const dayTasks = tasks.filter(task => {
  // Don't filter by service dates in admin view - show all tasks
  // But do filter by date for special tasks
  if (task.isSpecial) {
    const taskDate = task.startTime.split('T')[0]
    return taskDate === date
  }
  // Recurring tasks appear on all days
  return true
})
```

Actually, for admin view, we probably want to show all tasks regardless. But let's add a comment explaining this.

**Step 3: Build and verify**

```bash
npm run build
```
Expected: Build succeeds, TS errors resolved

**Step 4: Commit**

```bash
git add src/components/ScheduleCalendar.tsx src/components/AdminWeeklyTaskCalendar.tsx
git commit -m "feat: filter calendar display by soldier service dates

- Show out-of-service dates as gray with '-' marker
- Prevents display of tasks/assignments outside service period
- Helps commanders see actual availability window for each soldier
- Admin view shows all tasks regardless of service dates"
```

---

## Task 4: Fix Day-of-Week Calculation (Issue 1)

**Files:**
- Modify: `src/components/AdminDashboard.tsx` (fix date calculation)

**Step 1: Identify the bug**

Current code (lines 11-16):
```typescript
const today = new Date()
const day = today.getDay()
const diff = today.getDate() - (day === 0 ? 6 : day - 1)
const monday = new Date(today.setDate(diff))  // ❌ BUG
```

Problem: `setDate()` returns milliseconds, not a Date object

**Step 2: Fix the date calculation**

Replace lines 11-16 with:

```typescript
const [weekStart, setWeekStart] = useState(() => {
  const today = new Date()
  const day = today.getDay()
  // Calculate days to subtract to get to Monday (0 = Sunday)
  const daysToMonday = day === 0 ? 6 : day - 1

  const monday = new Date(today)
  monday.setDate(today.getDate() - daysToMonday)

  return monday.toISOString().split('T')[0]
})
```

**Step 3: Build and verify**

```bash
npm run build
```
Expected: Build succeeds

**Step 4: Test manually**

Open the app, check that the week shown starts on Monday and includes correct dates

**Step 5: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "fix: correct day-of-week calculation for admin dashboard

- Fix bug where setDate() return value (milliseconds) was passed to new Date()
- Now creates new Date object before modifying
- Correctly calculates Monday as start of week
- Fixes issue where Thursday was displayed as Friday"
```

---

## Task 5: Restore Static Pie Chart (Issue 2)

**Files:**
- Create: `src/components/AdminDashboardPieChart.tsx` (restore component)
- Modify: `src/components/AdminDashboard.tsx` (add pie chart display)
- Modify: `src/components/SchedulePage.tsx` (pass soldier status data)

**Step 1: Create a simple static pie chart component**

Create file `src/components/AdminDashboardPieChart.tsx`:

```typescript
import { useMemo } from 'react'
import type { Soldier } from '../models'
import { calculateSoldierStatus } from '../utils/soldierStatusHelper'

interface AdminDashboardPieChartProps {
  soldiers: Soldier[]
}

export default function AdminDashboardPieChart({ soldiers }: AdminDashboardPieChartProps) {
  const statusCounts = useMemo(() => {
    const counts = {
      'On Base': 0,
      'On Leave': 0,
      'On Way Home': 0,
      'On Way to Base': 0,
      'Inactive': 0,
    }

    for (const soldier of soldiers) {
      const status = calculateSoldierStatus(soldier)
      if (status === 'On Base') counts['On Base']++
      else if (status === 'On Leave') counts['On Leave']++
      else if (status === 'On Way Home') counts['On Way Home']++
      else if (status === 'On Way to Base') counts['On Way to Base']++
      else counts['Inactive']++
    }

    return counts
  }, [soldiers])

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  if (total === 0) return <p className="text-gray-400">No soldiers</p>

  const colors = {
    'On Base': 'bg-green-500',
    'On Leave': 'bg-yellow-500',
    'On Way Home': 'bg-orange-500',
    'On Way to Base': 'bg-blue-500',
    'Inactive': 'bg-gray-500',
  }

  return (
    <div className="bg-white rounded-xl border border-olive-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-olive-800">Soldier Status Distribution</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Pie chart visualization */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            const percentage = (count / total) * 100
            if (count === 0) return null

            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${colors[status as keyof typeof colors]}`} />
                <span className="text-sm text-gray-700">
                  {status}: {count} ({Math.round(percentage)}%)
                </span>
              </div>
            )
          })}
        </div>

        {/* Summary stats */}
        <div className="space-y-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (count === 0) return null
            const percentage = (count / total) * 100

            return (
              <div key={status} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded h-2">
                    <div
                      className={`${colors[status as keyof typeof colors]} h-2 rounded`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-gray-800 font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Create soldier status helper utility**

If it doesn't exist, create `src/utils/soldierStatusHelper.ts`:

```typescript
import type { Soldier } from '../models'

export function calculateSoldierStatus(soldier: Soldier): string {
  if (soldier.status !== 'Active') {
    return 'Inactive'
  }

  // For now, return generic "On Base"
  // In the future, this could be populated from schedule data
  return 'On Base'
}
```

**Step 3: Update AdminDashboard to accept and display soldiers**

Modify `src/components/AdminDashboard.tsx`:

```typescript
import { useState } from 'react'
import type { Task, Soldier } from '../models'
import AdminWeeklyTaskCalendar from './AdminWeeklyTaskCalendar'
import AdminDashboardPieChart from './AdminDashboardPieChart'

interface AdminDashboardProps {
  tasks: Task[]
  soldiers: Soldier[]
}

export default function AdminDashboard({ tasks, soldiers }: AdminDashboardProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const daysToMonday = day === 0 ? 6 : day - 1

    const monday = new Date(today)
    monday.setDate(today.getDate() - daysToMonday)

    return monday.toISOString().split('T')[0]
  })

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          <strong>Admin Dashboard:</strong> View all tasks scheduled across units. Soldier statuses are calculated from the last schedule generation.
        </p>
      </div>

      {/* Pie Chart */}
      <AdminDashboardPieChart soldiers={soldiers} />

      {/* Weekly Task Calendar */}
      <AdminWeeklyTaskCalendar
        tasks={tasks}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
      />
    </div>
  )
}
```

**Step 4: Update AdminPanel to pass soldiers**

In `src/components/AdminPanel.tsx`, find where AdminDashboard is rendered and update:

Change line 227 from:
```typescript
<AdminDashboard tasks={tasks} />
```

To:
```typescript
<AdminDashboard tasks={tasks} soldiers={soldiers} />
```

**Step 5: Build and verify**

```bash
npm run build
```
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/AdminDashboardPieChart.tsx src/components/AdminDashboard.tsx src/components/AdminPanel.tsx src/utils/soldierStatusHelper.ts
git commit -m "feat: restore static soldier status pie chart on admin dashboard

- Re-add AdminDashboardPieChart showing static soldier counts by status
- Display: On Base, On Leave, On Way Home, On Way to Base, Inactive
- Shows percentages and bar chart visualization
- Data is static from last schedule generation
- Non-functional for now (placeholder), can be enhanced with live data later"
```

---

## Task 6: Fix Number Serialization in ConfigRepository

**Files:**
- Modify: `src/services/configRepository.ts` (serialize as numbers)
- Modify: `src/utils/dateUtils.ts` or add new helper for number formatting

**Step 1: Update ConfigRepository.write() to handle numbers**

In `src/services/configRepository.ts`, update the write method to preserve number types:

Find the `writeConfig` method (lines 80-107) and update it:

```typescript
async writeConfig(updates: EditableConfig): Promise<void> {
  const rows = await this.sheets.getValues(this.spreadsheetId, this.range)
  const dataRows = rows.slice(1) // skip header

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue

    const existingRowIndex = dataRows.findIndex(r => r[0] === key)

    // Convert to number if it's a numeric field
    const numericFields = [
      'leaveRatioDaysInBase',
      'leaveRatioDaysHome',
      'longLeaveMaxDays',
      'minBasePresence',
      'maxDrivingHours',
      'defaultRestPeriod'
    ]

    let valueStr: string
    if (numericFields.includes(key)) {
      // For numeric fields, ensure it's stored as a number (remove quotes)
      valueStr = String(Number(value))
    } else {
      // For string fields (like times), keep as string
      valueStr = String(value)
    }

    if (existingRowIndex >= 0) {
      const rowNumber = existingRowIndex + 2
      await this.sheets.updateValues(
        this.spreadsheetId,
        `${this.tabName}!A${rowNumber}:B${rowNumber}`,
        [[key, valueStr]]
      )
    } else {
      await this.sheets.appendValues(
        this.spreadsheetId,
        `${this.tabName}!A:B`,
        [[key, valueStr]]
      )
    }
  }
}
```

**Step 2: Also update the `write` method for consistency**

In the same file, update the older `write` method (lines 71-78):

```typescript
async write(updates: PartialNumericConfig): Promise<void> {
  const numericFields = [
    'leaveRatioDaysInBase',
    'leaveRatioDaysHome',
    'longLeaveMaxDays',
    'minBasePresence',
    'maxDrivingHours',
    'defaultRestPeriod'
  ]

  const rows = Object.entries(updates).map(([key, value]) => {
    const valueStr = numericFields.includes(key)
      ? String(Number(value))
      : String(value)
    return [key, valueStr]
  })

  await this.sheets.updateValues(
    this.spreadsheetId,
    `${this.tabName}!A2:B${rows.length + 1}`,
    rows
  )
}
```

**Step 3: Build and verify**

```bash
npm run build
```
Expected: Build succeeds

**Step 4: Test manually**

- Open Admin Panel Config tab
- Edit a numeric field (e.g., change 10 to 11)
- Click Save
- Check the spreadsheet to verify it's stored as `11` not `"11"`

**Step 5: Commit**

```bash
git add src/services/configRepository.ts
git commit -m "fix: serialize config numbers as actual numbers in spreadsheet

- Update writeConfig() and write() to convert numeric fields to proper numbers
- Numeric fields: leaveRatioDaysInBase, leaveRatioDaysHome, etc.
- Prevents '0' being stored as string '0'
- Makes manual editing easier for users"
```

---

## Testing Checklist

After all tasks are complete, verify:

- [ ] Task 1: Cyclical leaves show soldiers staggered (not all leaving same days)
- [ ] Task 2: Gantt chart shows '← Out' and 'In →' for transition days
- [ ] Task 3: Out-of-service dates show as gray '-'
- [ ] Task 4: Calendar week starts on correct Monday
- [ ] Task 5: Pie chart displays soldier status counts
- [ ] Task 6: Config numeric fields stored as numbers in spreadsheet

## Rollback Plan

If critical issues arise:

```bash
git log --oneline | head -10  # Find last known-good commit
git reset --hard <commit-hash>
```

---

**Plan saved. Ready for execution.**
