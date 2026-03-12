# ShabTzak — IDF Shift Scheduling App

Shabbat shift-scheduling web app for IDF units. Admins manage units/tasks, commanders schedule soldiers and leave. **Deployed to GitHub Pages.**

## Quick Start

```bash
npm run dev      # Dev server
npm run deploy   # Build & deploy to GitHub Pages
npm test         # Run tests
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
| **AppConfig** | `leaveRatioDaysInBase`, `leaveRatioDaysHome`, `leaveBaseExitHour`, `leaveBaseReturnHour`, `minBasePresenceByRole`, `weekendDays`, others |

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

### Multi-Unit Scheduling
- All soldiers from all units available for task assignment
- Task scheduler algorithm prefers unit affinity but ensures task completion
- Commanders see only their unit soldiers (gaps acceptable if no coverage)
- Admin sees all soldiers across all units

### Task/Soldier Management
- Tasks: Define once, auto-expand to daily instances for schedule period
- Pillbox tasks (`isSpecial=true`): Sequential instances, each after previous
- Soldiers: Status (Active/Inactive), role, service dates, fairness tracking
- Batch processing: Leave assignments (50/batch, 2s delay), task assignments (20/batch, 1s delay)

---

## Schedule Generation Flow

```
1. calculateSchedulePeriod() → min(soldier.serviceStart) to max(soldier.serviceEnd)
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
1. Filter eligible soldiers (active, right role, rest met, within service dates)
2. Determine task's unit (majority unit of already-assigned soldiers)
3. Sort by: unit affinity (prefer same), then fairness (ascending)
4. Assign up to required count

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

## Time Format Handling

- **Tasks:** Store as `HH:MM:SS` (no date) for recurring tasks
- **Dates:** ISO format `YYYY-MM-DD`
- **Full datetime:** `YYYY-MM-DDTHH:MM:SS` only when needed
- **Day boundary:** 06:00-05:59 (06:00 starts new day in display)
- **Time picker:** Custom 24-hour input (no AM/PM)

---

## Known Issues & TODOs

1. **Unit column in spreadsheet** — Currently parsed if exists, not serialized (backward compat)
   - Add "Unit" column header to soldiers tab when ready to persist unit data
2. **Service date validation** — Implemented in `isTaskAvailable()`, double-check soldiers don't schedule outside serviceStart/End
3. **Cyclical leave debugging** — Verify all soldiers receiving fair leave distribution per role
4. **Admin calendar integration** — AdminTaskCalendar created, needs UI integration in admin panel
5. **Test coverage** — Tests don't fully account for multi-unit, cyclical leaves, capacity constraints

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

## Recent Changes (Latest Session)

### Admin Dashboard
- ✅ Added Admin Dashboard tab (default view) with soldier status pie chart
- ✅ Created pie chart showing distribution across: On Base, On Leave, On Way Home, On Way to Base, Inactive
- ✅ Pie chart segments are clickable with expandable soldier lists per status
- ✅ Implemented weekly task calendar with week navigation, expandable task assignments
- ✅ Date format: dd/mm/yy; current day is highlighted

### Transition Day Leave Handling
- ✅ Implemented automatic transition day detection (day before/after leave)
- ✅ Updated `isTaskAvailable()` to check for transition days
- ✅ Day before leave: soldier cannot START tasks before `leaveBaseExitHour` (default 06:00)
- ✅ Day after leave: soldier cannot END tasks after `leaveBaseReturnHour` (default 22:00)
- ✅ Modified scheduler to pass leave assignments to task scheduler for availability checking
- ✅ Reordered schedule generation: leave first, then tasks with leave data

### Config Management
- ✅ Made all config fields editable from Admin Panel Config tab
- ✅ Editable fields: leave days (in base/home), constraints, exit/return hours
- ✅ Time fields (exit/return) now configurable with HH:MM format
- ✅ Save/Reset buttons for config changes
- ✅ All changes persist to spreadsheet immediately
- ✅ Extended ConfigRepository with `writeConfig()` method for all field types

### Bug Fixes
- ✅ Fixed Advanced Command Post 400 error (missing InactiveReason column in soldiers tab)
