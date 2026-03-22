# ShabTzak — IDF Shift Scheduling App

Shabbat shift-scheduling web app for IDF units. Admins manage units/tasks, commanders schedule soldiers and leave. **Deployed to GitHub Pages.**

---

## Quick Start

```bash
npm run dev      # Dev server
npm run deploy   # Build & deploy to GitHub Pages
npm run build    # TypeScript + Vite
```

**Stack:** React 18, TypeScript, Vite, Tailwind, Google Sheets (database), Google OAuth

---

## Architecture: Two-Spreadsheet Model

**Admin Sheet** (`VITE_SPREADSHEET_ID`) — `MasterDataService`
- Tabs: `Admins`, `Units`, `Commanders`, `Tasks`, `Config`, `History`, `Roles`

**Per-Unit Sheet** (ID from Units tab) — `DataService`
- `{tabPrefix}` — Soldiers (14 cols: ID, FirstName, LastName, Role, ServiceStart, ServiceEnd, InitialFairness, CurrentFairness, Status, HoursWorked, WeekendLeavesCount, MidweekLeavesCount, AfterLeavesCount, InactiveReason)
- `{tabPrefix}_TaskSchedule` — Task assignments
- `{tabPrefix}_LeaveRequests` — Leave requests
- `{tabPrefix}_LeaveSchedule` — Leave assignments

**Critical:** Soldiers live in unit-named tab (e.g., `"א'"`) NOT `{prefix}_Soldiers`.

---

## Data Models

| Type | Key Fields |
|------|-----------|
| **Soldier** | `id`, `firstName`, `lastName`, `role`, `unit?`, `serviceStart/End`, `status`, fairness/hours/leave counts |
| **Task** | `id`, `taskType`, `startTime/endTime` (ISO), `durationHours`, `roleRequirements[]`, `minRestAfter`, `isSpecial` |
| **LeaveRequest** | `id`, `soldierId`, `startDate/endDate`, `leaveType`, `priority`, `status` |
| **LeaveAssignment** | `id`, `soldierId`, dates, `leaveType`, `isWeekend`, `requestId` |
| **AppConfig** | `scheduleStartDate`, `scheduleEndDate`, `leaveRatioDaysInBase`, `leaveRatioDaysHome`, `leaveBaseExitHour`, `leaveBaseReturnHour`, `minBasePresenceByRole`, `weekendDays`, others |

---

## Key Features

### Calendar Displays
- **Soldier Mode:** 80+ day grid, 06:00-05:59 day boundary, shows task names per soldier
- **Task Mode:** Weekly calendar (06:00-23:59), click task to see assigned soldiers, shows leaves overlay
- **Admin Dashboard:** Pie chart showing soldier status distribution (On Base, On Leave, On Way Home/Base, Inactive) with expandable lists
- **Admin Weekly Calendar:** All tasks per day across units with expandable soldier assignments, week navigation

### Schedule Generation (Priority Hierarchy)
1. **Tasks (100% fill)** — All task roles must be filled with available soldiers
2. **Leaves** — Generated from: (a) manual requests, (b) smart cyclical pattern
3. **Unit Affinity** — Task scheduler prefers same-unit soldiers but allows cross-unit

### Smart Cyclical Leaves
- **Role-based capacity:** Only generate leaves when `minBasePresenceByRole` maintained
- **Pattern:** N days in base + M days at home (10:4 default, configurable)
- **Exit/Return times:** `leaveBaseExitHour` / `leaveBaseReturnHour` for partial-day transitions
- **Cycles independently** per role; all soldiers same role follow same cycle
- **Manual leaves override** automatic pattern
- **Transition day handling:** Automatically calculated for day before/after leave
  - Day before: soldier cannot start tasks before exitHour (partial availability)
  - Day after: soldier cannot end tasks after returnHour (partial availability)

### Alternative Role Requirements
- Tasks can accept ANY of multiple acceptable roles for a single slot
- Example: Gate Guard can be filled by Driver, Squad leader, Fighter, Radio operator, or Operation room staff
- Defined as: `{ roles: ["Driver", "Squad leader", "Fighter", ...], count: 1 }`
- Scheduler picks best available soldier from acceptable roles
- Backward compatible: old single-role format converted to new roles array format
- Makes staffing more flexible, reduces scheduling conflicts

### Multi-Unit Scheduling
- **Soldier Pool:** All soldiers from all units available for task assignment (loaded from admin spreadsheet)
- **Fairness Priority:** Fairness calculated globally across ALL soldiers, not per-unit
- **Unit Affinity:** Scheduler prefers same-unit soldiers when fairness scores are equal
- **Task Completion:** Algorithm ensures task completion even if requiring cross-unit assignments
- **Unit Tracking:** Task assignments include `assignedUnitId` to track which unit each soldier belongs to
- **Commanders:** See only their unit soldiers (gaps acceptable if no coverage)
- **Admin:** Sees all soldiers across all units

### Task/Soldier Management
- Tasks: Define once, auto-expand to daily instances for schedule period
- Pillbox tasks (`isSpecial=true`): Sequential instances, each after previous
- Soldiers: Status (Active/Inactive), role, service dates, fairness tracking
- Batch processing: Leave assignments (50/batch, 2s delay), task assignments (20/batch, 1s delay)

---

## Schedule Generation Flow

```
1. calculateSchedulePeriod() → config.scheduleStartDate/EndDate if set, otherwise min/max soldier service dates
2. expandRecurringTasks() → 1 task becomes N daily instances
3. generateLeaveSchedule():
   a. generateCyclicalLeaves() → respecting minBasePresenceByRole capacity
   b. scheduleLeave() → processes manual requests (override cyclical)
   c. Batch-create leave assignments
4. generateTaskSchedule():
   a. scheduleTasks() → greedy algorithm with unit affinity
   b. Batch-create task assignments
5. applyLeaveAssignment() loop → update soldier fairness (with delays to avoid 429)
```

---

## Key Algorithms

**`calculateLeaveCapacityPerRole()`** — For each role: `total - minBasePresence = available_slots`

**`scheduleTasks()`** — For each task:
1. For each role requirement:
   - Get list of acceptable roles (roles array from requirement, or role field for backward compat)
   - Filter eligible soldiers: active, matches ANY acceptable role, rest met, within service dates, available
2. Determine task's unit (majority unit of already-assigned soldiers)
3. Sort by: unit affinity (prefer same unit), then fairness (ascending, global across all soldiers)
4. Assign up to required count
5. Track assignedUnitId for each soldier assignment

**`generateCyclicalLeaves()`** — For each role independently:
1. Track cycle position per soldier (0 to cycleLength-1)
2. For each date: if capacity > 0 for role, assign soldiers in cycle order to leave days
3. Exit day (time-based), full days, return day (time-based)

**`isTaskAvailable()`** — Check: active, role match, within service dates, rest period met, not already on this task, not on leave, not on conflicting transition days

---

## Rate Limiting & Batching

- **Sheets API:** Exponential backoff retry (3 retries, base 500ms, caps at 429)
- **Leave assignments:** Batch 50 per call, 2s delay between batches
- **Task assignments:** Batch 20 per call, 1s delay between batches
- **Fairness updates:** 1s delay every 5 updates (in App.tsx after schedule generation)
- **Progress tracking:** Update every 60 assignments, auto-reload at 14-day milestones

---

## Example: Multi-Unit Gate Guard Task

### Task Definition
```json
{
  "id": "gate-guard-task",
  "taskType": "Gate Guard",
  "startTime": "06:00:00",
  "endTime": "18:00:00",
  "durationHours": 12,
  "roleRequirements": [
    {
      "roles": ["Driver", "Squad leader", "Fighter", "Radio operator", "Operation room"],
      "count": 5
    }
  ],
  "minRestAfter": 8,
  "isSpecial": false
}
```

### Scheduling Flow
1. **Requirement analysis:** Task needs 5 soldiers from EITHER Driver, Squad leader, Fighter, Radio op, or Ops room role
2. **Soldier pool:** System loads all soldiers from all units (e.g., Unit 1, 2, 3)
3. **Filtering:** Check each soldier:
   - Is soldier active? ✓
   - Is soldier's role in acceptable list? ✓
   - Does soldier meet rest period from previous task? ✓
   - Is soldier within service dates? ✓
   - Is soldier not on leave? ✓
4. **Sorting & Assignment:**
   - Sort eligible soldiers by: unit affinity (prefer same unit as majority), then fairness (lowest first)
   - Pick 5 soldiers
5. **Result:** 5 soldiers from potentially 3 different units, each assigned their actual role, with assignedUnitId tracked

### Result Example
```
Assignment 1: Soldier A (Driver, Unit 1) → Gate Guard task
Assignment 2: Soldier B (Squad leader, Unit 2) → Gate Guard task
Assignment 3: Soldier C (Fighter, Unit 1) → Gate Guard task
Assignment 4: Soldier D (Radio op, Unit 3) → Gate Guard task
Assignment 5: Soldier E (Operation room, Unit 2) → Gate Guard task
```

---

## Time Format Handling

- **Tasks:** Store as `HH:MM:SS` (no date) for recurring tasks
- **Dates:** ISO format `YYYY-MM-DD`
- **Full datetime:** `YYYY-MM-DDTHH:MM:SS` only when needed
- **Day boundary:** 06:00-05:59 (06:00 starts new day in display)
- **Time picker:** Custom 24-hour input (no AM/PM)

---


## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
VITE_SPREADSHEET_ID=1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM
VITE_ADMIN_EMAIL=guy.moshk@gmail.com
```

---

## File Structure (Key Files)

```
src/
  algorithms/
    taskScheduler.ts          # Greedy assignment with unit affinity
    leaveScheduler.ts         # Manual leave request processing
    cyclicalLeaveScheduler.ts # Auto-generate cyclical leaves
    leaveCapacityCalculator.ts # Role-based capacity checking
    taskAvailability.ts       # Availability rules (status, role, rest, dates)

  components/
    SchedulePage.tsx              # Displays calendar, controls generation
    ScheduleCalendar.tsx          # Soldier mode (80+ day grid)
    TaskModeCalendar.tsx          # Task mode (weekly 06:00-23:59)
    AdminDashboard.tsx            # Main admin dashboard orchestrator
    AdminDashboardPieChart.tsx    # Soldier status pie chart with expandable lists
    AdminWeeklyTaskCalendar.tsx   # Weekly task view across all units
    AdminPanel.tsx                # Admin management tabs (now includes editable config)

  services/
    scheduleService.ts        # Orchestrates schedule generation
    googleSheets.ts           # API client with backoff retry
    taskAssignmentRepository.ts # Batch create (20/call)
    leaveAssignmentRepository.ts # Batch create (50/call)

  models/Soldier.ts           # Includes optional `unit` field
```

---

## Current Features (Completed Sessions)

### ✅ Scheduler & Fairness
- Per-soldier cyclical leaves with randomized phase offsets (soldiers staggered across leave dates)
- Global fairness scoring across all soldiers
- Transition day detection (day before/after leave marked as partial availability)
- Service date validation (soldiers only scheduled during active service period)
- Config-driven exit/return hours for travel days

### ✅ Calendar Displays
- Soldier mode: 80+ day Gantt grid with task assignments
- Task mode: Weekly calendar view with leave overlay
- Admin dashboard: Soldier status pie chart and weekly task calendar across all units
- Transition day indicators: "← Out" (exit day), "In →" (return day)

### ✅ Admin Management
- Editable config with immediate spreadsheet persistence
- Task creation/editing in admin panel
- Unit and commander management
- Role management system

### ✅ Performance Optimizations
- O(n) → O(1) leave availability lookup using pre-indexed soldierLeaveMap
- Batch processing for Google Sheets API (avoid 429 rate limiting)
- Efficient fairness calculations

### ✅ Multi-Unit Scheduling & Alternative Roles (Recently Completed)
- Alternative role requirements: Tasks accept ANY of multiple acceptable roles
- Multi-unit scheduling: Scheduler uses ALL soldiers from all units
- Admin Panel UI: Multi-select checkboxes for role requirements
- Global fairness: Tracked across all soldiers, not per-unit
- Unit tracking: Task assignments include assignedUnitId field
- Example: Gate Guard can be filled by Driver OR Squad leader OR Fighter OR Radio operator OR Operation room staff
