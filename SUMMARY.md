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
| **Task** | `id`, `taskType`, `startTime` (ISO), `endTime` (ISO), `durationHours`, `roleRequirements[]`, `minRestAfter`, `isSpecial`, `specialDurationDays?` |
| **LeaveRequest** | `id`, `soldierId`, `startDate`, `endDate`, `leaveType`, `priority`, `status` ('Pending'/'Approved'/'Denied') |
| **Unit** | `id`, `name`, `spreadsheetId`, `tabPrefix`, `createdAt`, `createdBy` |

---

## Recent Status (2026-03-08 to 2026-03-11)

### Implemented ✅
- Soldier names split into `firstName`/`lastName` with case-insensitive header matching
- Approve/deny leave requests with robust ID column lookup
- Task scheduling requires full ISO datetimes
- 80-day schedule period (until May 25)
- GitHub Pages deployment with CI/CD
- Responsive design for mobile/tablet
- 536 passing tests

### Known Issues ⚠️
1. **Tasks:** Old tasks in spreadsheet with just times (e.g., `"08:00"`) won't appear in calendar. Users must create NEW tasks from app.
2. **Schedule display:** Tasks only show if:
   - Task has full ISO datetime (date + time)
   - Soldier's service period overlaps the task date
   - At least one soldier is assigned to the task
3. **Responsive design:** Mobile UI is improved but may still need refinement on very small screens
4. **Test suite:** Tests are expensive; focus on integration tests for critical paths (task creation → scheduling → display)

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
           ├─ SchedulePage (calendar + generate)
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

1. **Verify schedule generator works:** Create test task with full ISO datetime, generate schedule, check calendar
2. **Debug responsive design:** Test on multiple screen sizes; may need further refinement
3. **Optimize tests:** Replace expensive component tests with focused integration tests
4. **Improve soldier service dates:** Add validation to prevent scheduling soldiers outside their service period
5. **Fix: Date input for tasks should default to today's date** to prevent user confusion
