# ShabTzak — IDF Shift Scheduling App

Shabbat shift-scheduling web app for IDF units. Admins manage units/tasks, commanders schedule soldiers and leave. **Deployed to GitHub Pages.**

---

## 🚀 AGENT HANDOFF: Next Implementation Phase

**⚠️ FOR THE NEXT AGENT:**

1. **DO NOT use superpowers plugins** - Go directly to implementation
2. **Follow the implementation plan:** `docs/plans/2026-03-12-multi-unit-alt-roles.md`
3. **Execute tasks 1-12 sequentially** with build/test/commit between each
4. **Overview of what you'll implement:**
   - **Alternative Role Requirements:** Tasks can accept ANY of multiple roles (e.g., "Gate Guard" = Driver OR Squad leader OR Fighter)
   - **Multi-Unit Scheduling:** Scheduler uses ALL soldiers from ALL units to fill tasks (fair distribution across organization)
   - **Global Fairness:** Prioritizes fairness across all soldiers, unit affinity is secondary
   - **12 Implementation Tasks:** Data models → Scheduler logic → UI → Testing → Documentation

5. **Key files you'll modify:**
   - Data Models: `src/models/Task.ts`
   - Scheduler: `src/algorithms/taskScheduler.ts`
   - Services: `src/services/scheduleService.ts`, `src/hooks/useDataService.ts`
   - Admin UI: `src/components/TasksPage.tsx`
   - Parsers: `src/services/parsers.ts`, `src/services/serializers.ts`

6. **Build & Deploy after completing all 12 tasks:**
   ```bash
   npm run build   # Verify compilation
   npm run deploy  # Deploy to GitHub Pages
   ```

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

---

## Next Phase: Multi-Unit & Alternative Roles (Planned)

See implementation plan: `docs/plans/2026-03-12-multi-unit-alt-roles.md`

**To be implemented (12 tasks):**
1. Alternative role requirements (tasks can accept ANY of multiple roles)
2. Multi-unit scheduling (scheduler uses all soldiers from all units)
3. Admin Panel UI for multi-role task editing
4. Global fairness tracking across units
5. Full end-to-end testing

**Example use case:** Gate Guard position can be filled by Driver OR Squad leader OR Fighter OR Radio operator OR Operation room staff
