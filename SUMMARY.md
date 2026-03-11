# ShabTzak — Project Summary

> **For the next agent:** Read this first. App is deployed to GitHub Pages with 536 passing tests. **Critical:** Tasks must have full ISO datetimes (e.g., `2026-03-08T08:00:00`) to appear in the schedule calendar. Old tasks with just times (e.g., `"08:00"`) are ignored.

---

## What This App Does

Shabbat shift-scheduling web app for IDF units. Admins manage units, commanders, and tasks. Commanders manage soldiers, leave requests, and generate duty schedules.

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Vitest, Google Sheets (database)
**Deploy:** GitHub Pages via CI/CD (`.github/workflows/ci.yml`)
**Auth:** Google OAuth (access token in `AuthContext`)

---

## Architecture

### Two-spreadsheet Model

**Admin spreadsheet** (`VITE_SPREADSHEET_ID` env var) — managed by `MasterDataService`:
- `Admins`, `Units`, `Commanders`, `Tasks`, `Config`, `History`, `Roles` tabs

**Per-unit spreadsheet** (ID in Units row) — managed by `DataService`:
- `{tabPrefix}` — Soldier list (14 columns: ID, First Name, Last Name, Role, ServiceStart, ServiceEnd, InitialFairness, CurrentFairness, Status, HoursWorked, WeekendLeavesCount, MidweekLeavesCount, AfterLeavesCount, InactiveReason)
- `{tabPrefix}_TaskSchedule` — Task assignments
- `{tabPrefix}_LeaveRequests` — Leave requests
- `{tabPrefix}_LeaveSchedule` — Leave assignments

> **Key:** Soldiers live in a tab named exactly like the unit (e.g., `"א'"`) NOT `{prefix}_Soldiers`.

### Key Services

**`MasterDataService`** — Manages admin data, roles, units, commanders, tasks, config
- `initialize(firstAdminEmail)` — Idempotent: creates missing tabs, seeds first admin
- `resolveRole(email)` — Returns admin/commander/null

**`DataService`** — Manages unit-specific data (soldiers, leave, schedules)
- `soldierService`, `leaveRequestService`, `scheduleService`, `fairnessUpdate`

**`ScheduleService`** — Generates schedules
- `generateLeaveSchedule()` — Processes pending leave requests with fairness scoring
- `generateTaskSchedule()` — Assigns soldiers to tasks based on fairness and availability
- **Both must be called together** for proper fairness updates

### Critical: Task Time Format

**Tasks MUST have full ISO datetimes to be scheduled:**
- ✅ Valid: `"2026-03-08T08:00:00"` and `"2026-03-08T14:00:00"`
- ❌ Invalid: `"08:00"` and `"14:00"` (no date)

Old tasks with just times are silently skipped in the schedule calendar (see `availabilityMatrix.ts`). Users must create NEW tasks from the app, which automatically adds proper datetimes via `buildInput()` in TasksPage.tsx.

---

## Models

| Type | Fields |
|------|--------|
| **Soldier** | `id` (army number), `firstName`, `lastName`, `role`, `serviceStart`, `serviceEnd`, `status` ('Active'/'Inactive'), `inactiveReason?`, fairness/hours/leave counts |
| **Task** | `id`, `taskType`, `startTime` (ISO), `endTime` (ISO), `durationHours`, `roleRequirements[]`, `minRestAfter`, `isSpecial`, `specialDurationDays?`, `recurrence?` ('daily'/'pillbox'), `recurrenceEndDate?` |
| **LeaveRequest** | `id`, `soldierId`, `startDate`, `endDate`, `leaveType`, `priority`, `status` ('Pending'/'Approved'/'Denied') |
| **Unit** | `id`, `name`, `spreadsheetId`, `tabPrefix`, `createdAt`, `createdBy` |

---

## Recent Status (2026-03-08 to 2026-03-11)

### Implemented ✅
- Soldier names split into `firstName`/`lastName` with case-insensitive header matching
- Approve/deny leave requests with robust ID column lookup
- Task scheduling requires full ISO datetimes
- **Task schedule generation now working** - soldiers assigned to tasks via greedy algorithm
- **Recurring daily tasks** - Tasks can recur every day throughout the 80-day schedule period
  - Define once, automatically expands to all 80 days
  - Pillbox tasks recur sequentially (one after another)
  - UI selector for recurrence type in TasksPage
- **Weekly Task Calendar view** - Time-based calendar showing tasks with soldier assignments
  - Toggle "Soldier/Task Mode" button on Schedule page
  - Click task to see assigned soldiers in side panel
  - Week navigation with Previous/Next buttons and date picker
  - **24/7 display** with day boundary at 06:00 (next day start)
- **Plain text IDs** for manual spreadsheet editing
  - Task IDs: `task_YYYYMMDD_HHMM_RANDOM`
  - Schedule IDs: `sched_YYYYMMDD_HHMM_RANDOM`
  - Leave assignment IDs: `leave_YYYYMMDD_HHMM_RANDOM`
- **24-hour time format** throughout (no AM/PM)
- 80-day schedule period (until May 25)
- GitHub Pages deployment with CI/CD
- Responsive design for mobile/tablet
- 536 passing tests

### Known Issues ⚠️
1. **Legacy tasks:** Old tasks in spreadsheet with just times (e.g., `"08:00"`) won't appear in calendar. Users must create NEW recurring tasks from app.
2. **Recurring task expansion:** When tasks are set to recur, they expand at schedule generation time. Current UI shows only 3 base tasks, but calendar should show all 80+ expanded instances.
3. **Responsive design:** Mobile UI is improved but may still need refinement on very small screens, especially the 24-hour task calendar
4. **Debug logging:** Console logs remain for task scheduling diagnosis (can be removed after verification)

---

## Component Tree

```
App
└─ AppContent
   ├─ LoginPage (not authenticated)
   ├─ AccessDeniedPage (no role)
   ├─ AdminPanel (admin, no unit selected)
   │   └─ TasksPage (edit + create tasks)
   └─ UnitApp (commander or admin in unit)
       └─ AppShell (header nav + main)
           ├─ Dashboard
           ├─ SoldiersPage (inline editing)
           ├─ TasksPage (read-only for commanders)
           ├─ LeaveRequestsPage (approve/deny)
           ├─ SchedulePage (dual-mode calendar + generate)
           │   ├─ ScheduleCalendar (soldier mode - daily grid)
           │   └─ TaskModeCalendar (task mode - weekly calendar)
           └─ HistoryPage (audit log)
```

---

## Dev Commands

```bash
npm run dev                    # Vite dev server
npm test                       # Run 536 tests (skip on each change)
npm run build                  # Build for production
npm run deploy                 # Push to GitHub Pages
```

---

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=...                                        # OAuth client ID
VITE_GOOGLE_API_KEY=...                                           # Google Sheets API key
VITE_SPREADSHEET_ID=1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM # Admin spreadsheet
VITE_ADMIN_EMAIL=guy.moshk@gmail.com                              # Initial admin
```

Add these as GitHub Secrets for CI/CD deployment.

---

## Next Steps for New Agent

1. **Test recurring tasks:** Verify that daily tasks expand properly and schedule all 80 days worth of soldiers
2. **Remove debug logging:** Clean up console.log statements in taskScheduler.ts, scheduleService.ts, and App.tsx once scheduling is verified stable
3. **Optimize tests:** Update tests to account for recurring task expansion; add integration tests for task scheduling
4. **Add task mode state persistence:** Save user's preferred view mode (soldier/task) to localStorage
5. **Improve mobile responsive design:** Test task calendar on mobile; may need redesign for small screens
6. **Validate soldier service periods:** Add validation to prevent scheduling soldiers outside their service dates
