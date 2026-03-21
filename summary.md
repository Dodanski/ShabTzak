# ShabTzak — IDF Shift Scheduling App

Shabbat shift-scheduling web app for IDF units. Admins manage units/tasks, commanders schedule soldiers and leave. **Deployed to GitHub Pages.**

---

## Current State (as of 2026-03-20)

### Last commits
```
1d55fb8 merge: resolve conflict with origin/main - keep multi-role display in TasksPage
6afdd61 feat: implement mobile responsive design
29de591 feat: implement multi-unit scheduling & alternative role requirements
```

### Test status
- **535 passing, 1 failing**
- Failing test: `src/components/Dashboard.test.tsx` — `'shows pending leave request count'`
- Root cause: The mobile responsive redesign renamed the stat label from "Pending Leave" to **"Pending Requests"** in `Dashboard.tsx:42`. The test still searches for `/pending leave/i`.
- Fix: In `Dashboard.test.tsx` line 45, change `screen.getByText(/pending leave/i)` to `screen.getByText(/pending requests/i)`.

### Immediate next action
Fix the one failing test described above. Then run `npm test -- --run` to confirm all 536 pass before doing anything else.

---

## Quick Start

```bash
npm run dev      # Dev server
npm run deploy   # Build & deploy to GitHub Pages
npm run build    # TypeScript + Vite build check
npm test -- --run  # Run all tests once
```

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Google Sheets (database), Google OAuth

---

## Architecture: Two-Spreadsheet Model

**Admin Sheet** (`VITE_SPREADSHEET_ID`) — `MasterDataService`
- Tabs: `Admins`, `Units`, `Commanders`, `Tasks`, `Config`, `History`, `Roles`

**Per-Unit Sheet** (ID from Units tab) — `DataService`
- `{tabPrefix}` — Soldiers (15 cols: ID, FirstName, LastName, Role, Unit, ServiceStart, ServiceEnd, InitialFairness, CurrentFairness, Status, HoursWorked, WeekendLeavesCount, MidweekLeavesCount, AfterLeavesCount, InactiveReason)
- `{tabPrefix}_TaskSchedule` — Task assignments
- `{tabPrefix}_LeaveRequests` — Leave requests
- `{tabPrefix}_LeaveSchedule` — Leave assignments

**Critical:** Soldiers live in unit-named tab (e.g., `"א'"`) NOT `{prefix}_Soldiers`.
**Critical:** Soldiers now have 15 columns (Unit added at index 4). Old spreadsheets with 14 columns parse safely — Unit defaults to `undefined`.

---

## Data Models

| Type | Key Fields |
|------|-----------|
| **Soldier** | `id`, `firstName`, `lastName`, `role`, `unit?` (new), `serviceStart/End`, `status`, fairness/hours/leave counts |
| **Task** | `id`, `taskType`, `startTime/endTime` (ISO), `durationHours`, `roleRequirements[]`, `minRestAfter`, `isSpecial` |
| **RoleRequirement** | `roles: string[]` (array, not single role), `count: number` — backward compat: old `role?: string` field normalized to `roles[]` in parsers |
| **LeaveRequest** | `id`, `soldierId`, `startDate/endDate`, `leaveType`, `priority`, `status` |
| **LeaveAssignment** | `id`, `soldierId`, dates, `leaveType`, `isWeekend`, `requestId` |
| **AppConfig** | `leaveRatioDaysInBase`, `leaveRatioDaysHome`, `leaveBaseExitHour`, `leaveBaseReturnHour`, `minBasePresenceByRole`, `weekendDays`, others |
| **AvailabilityStatus** | `'available' \| 'on-leave' \| 'on-task' \| 'on-way-home' \| 'on-way-to-base'` — `buildAvailabilityMatrix` returns `CellData` objects (not raw strings) |

---

## Key Features

### Mobile Responsive Design (added 2026-03-19)
- **Breakpoint:** `< 640px` = mobile, `>= 640px` = desktop (Tailwind `sm:`)
- **`useIsMobile` hook:** `src/hooks/useIsMobile.ts` — listens to `window.resize`, returns boolean
- **`BottomNav` component:** `src/components/BottomNav.tsx` — fixed bottom nav bar, `sm:hidden`, supports a "More" overflow menu
- **Card layouts on mobile:** SoldierCard, LeaveRequestCard components replace table rows
- **Pages with mobile layouts:** SoldiersPage, TasksPage, LeaveRequestsPage, HistoryPage, AdminPanel (admins/units/commanders tabs)
- **ScheduleCalendar on mobile:** Shows a soldier selector dropdown; renders only the selected soldier's row instead of the full grid

### Alternative Role Requirements
- Tasks accept ANY of multiple roles per slot: `{ roles: ["Driver", "Fighter", "Squad leader"], count: 2 }`
- Backward compatible: old `{ role: "Driver", count: 1 }` shape normalized to `roles[]` in `parsers.ts`
- TasksPage UI: multi-select checkboxes when adding/editing role requirements
- Scheduler picks best available soldier matching ANY of the acceptable roles

### Multi-Unit Scheduling
- **Soldier Pool:** All soldiers from all units available for task assignment
- **Global Fairness:** Fairness tracked across ALL soldiers, not per-unit
- **Unit Affinity:** Scheduler prefers same-unit soldiers when fairness scores are equal; fills from other units if needed
- **Task Completion Priority:** Tasks are filled 100% before leave scheduling runs
- **Unit Tracking:** `TaskAssignment.assignedUnitId` records which unit each assigned soldier belongs to
- **View:** Commanders see only their unit; Admin sees all units

### Smart Cyclical Leaves
- **Role-based capacity:** Only generates leaves when `minBasePresenceByRole` is maintained per role
- **Pattern:** N days in base + M days at home (10:4 default, configurable in Config tab)
- **Per-soldier phase offset:** Soldiers are staggered — not all going on leave simultaneously
- **Exit/Return times:** Partial-day transitions use `leaveBaseExitHour` / `leaveBaseReturnHour`
- **Transition days:** Day before leave = "on-way-home", day after = "on-way-to-base" (affects task availability)
- **Manual leaves override** cyclical pattern

### Schedule Generation (Priority Hierarchy)
1. **Tasks (100% fill)** — All task role slots must be filled with available soldiers
2. **Cyclical leaves** — Auto-generated respecting `minBasePresenceByRole`
3. **Manual leave requests** — Override cyclical; processed by priority order
4. **Unit Affinity** — Secondary tiebreaker in task assignment

---

## Schedule Generation Flow

```
1. calculateSchedulePeriod() → min(soldier.serviceStart) to max(soldier.serviceEnd)
2. expandRecurringTasks() → 1 task definition becomes N daily instances (_day0, _day1, ...)
3. generateLeaveSchedule():
   a. generateCyclicalLeaves() → respecting minBasePresenceByRole capacity, per-soldier phase offsets
   b. scheduleLeave() → processes manual requests (override cyclical)
   c. Batch-create leave assignments (50/batch, 2s delay)
4. generateTaskSchedule():
   a. scheduleTasks() → greedy, unit affinity, global fairness sort
   b. Batch-create task assignments (20/batch, 1s delay)
5. applyLeaveAssignment() loop → update soldier fairness (1s delay every 5 updates)
```

---

## Key Algorithms

**`calculateLeaveCapacityPerRole()`** — `src/algorithms/leaveCapacityCalculator.ts`
- For each role: `capacity = total_active_of_role - minBasePresence[role]`

**`scheduleTasks()`** — `src/algorithms/taskScheduler.ts`
1. For each role requirement: get `roles[]` array (or normalize legacy `role` field)
2. Filter eligible soldiers: active, role in `roles[]`, rest period met, within service dates, not on leave
3. Determine task's unit (majority unit of already-assigned soldiers on this task)
4. Sort by: unit affinity first, then global fairness ascending
5. Assign up to required count; record `assignedUnitId`

**`generateCyclicalLeaves()`** — `src/algorithms/cyclicalLeaveScheduler.ts`
1. Group soldiers by role
2. Each soldier gets a phase offset (staggered start in the N+M cycle)
3. For each date, if capacity > 0 for that role: assign soldiers in cycle order
4. Exit day / full days / return day handled with partial-day timestamps

**`buildAvailabilityMatrix()`** — `src/algorithms/availabilityMatrix.ts`
- Returns `CellData` objects (not raw strings) — `{ status, label? }`
- Statuses: `available`, `on-leave`, `on-task`, `on-way-home`, `on-way-to-base`
- Service date filtering: cells outside `serviceStart/End` render as gray `'-'`

**`isTaskAvailable()`** — `src/algorithms/taskAvailability.ts`
- Checks: active status, role match, within service dates, rest period met, not on this task, not on leave, not on conflicting transition day

---

## Rate Limiting & Batching

- **Sheets API:** Exponential backoff retry (3 retries, base 500ms, caps at 429)
- **Leave assignments:** Batch 50 per call, 2s delay between batches
- **Task assignments:** Batch 20 per call, 1s delay between batches
- **Fairness updates:** 1s delay every 5 updates (in `App.tsx` after schedule generation)
- **Progress tracking:** Update every 60 assignments, auto-reload at 14-day milestones

---

## File Structure (Key Files)

```
src/
  algorithms/
    taskScheduler.ts           # Greedy assignment, unit affinity, global fairness
    leaveScheduler.ts          # Manual leave request processing
    cyclicalLeaveScheduler.ts  # Auto-generate staggered cyclical leaves
    leaveCapacityCalculator.ts # Role-based capacity: total - minBasePresence
    taskAvailability.ts        # Availability rules (status, role, rest, transition days)
    availabilityMatrix.ts      # Builds CellData matrix for calendar display

  components/
    SchedulePage.tsx               # Calendar page, controls schedule generation
    ScheduleCalendar.tsx           # Soldier mode grid (80+ days); mobile: soldier selector
    TaskModeCalendar.tsx           # Task mode weekly calendar (06:00-23:59)
    AdminDashboard.tsx             # Admin dashboard orchestrator
    AdminDashboardPieChart.tsx     # Soldier status pie chart with expandable lists
    AdminWeeklyTaskCalendar.tsx    # Weekly task view across all units
    AdminPanel.tsx                 # Admin management tabs; mobile card views for tables
    Dashboard.tsx                  # Commander dashboard; stat labels: "Active Soldiers",
                                   #   "Pending Requests", "Task Assignments", "Conflicts"
    SoldiersPage.tsx               # Soldiers list; mobile: SoldierCard layout
    TasksPage.tsx                  # Tasks list; mobile: card layout; multi-role UI
    LeaveRequestsPage.tsx          # Leave requests; mobile: LeaveRequestCard layout
    HistoryPage.tsx                # History log; mobile: card layout
    SoldierCard.tsx                # Mobile card component for soldiers
    LeaveRequestCard.tsx           # Mobile card component for leave requests
    BottomNav.tsx                  # Mobile bottom navigation bar (sm:hidden)
    AppShell.tsx                   # App layout; includes BottomNav on mobile

  hooks/
    useIsMobile.ts             # Returns true if window.innerWidth < 640px
    useDataService.ts          # Data loading hook

  services/
    scheduleService.ts         # Orchestrates schedule generation
    googleSheets.ts            # API client with backoff retry
    masterDataService.ts       # Admin spreadsheet access
    taskAssignmentRepository.ts  # createBatch (20/call)
    leaveAssignmentRepository.ts # createBatch (50/call)
    parsers.ts                 # Normalizes old role? field → roles[] array
    serializers.ts             # 15-column soldier serialization (includes Unit at index 4)

  models/
    Soldier.ts                 # Includes optional `unit?: string` field
    Task.ts                    # RoleRequirement uses `roles: string[]` not `role: string`
```

---

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
VITE_SPREADSHEET_ID=1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM
VITE_ADMIN_EMAIL=guy.moshk@gmail.com
```

---

## Time Format Handling

- **Tasks:** Stored as `HH:MM:SS` (no date) for recurring tasks; `YYYY-MM-DDTHH:MM:SS` for pillbox
- **Dates:** ISO format `YYYY-MM-DD`
- **Day boundary:** 06:00–05:59 (06:00 starts new day in calendar display)
- **Time picker:** Custom 24-hour input — no AM/PM

---

## Known Issues / Pending Work

1. **Failing test (fix first):** `src/components/Dashboard.test.tsx:45` — change `/pending leave/i` to `/pending requests/i`
2. **REFACTOR_PLAN.md exists** (`REFACTOR_PLAN.md`) — describes moving to a single shared `TaskSchedule` / `LeaveSchedule` in the Admin/Master sheet instead of per-unit sheets. Not yet implemented. Read it before making architectural changes.
3. **`act()` warnings in AdminPanel tests** — not failures, just React testing warnings about state updates outside `act()`. Non-blocking.
