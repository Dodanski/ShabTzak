# ShabTzak — IDF Shift Scheduling App

Shabbat shift-scheduling web app for IDF units. Admins manage units/tasks, commanders schedule soldiers and leave. **536 passing tests. Deployed to GitHub Pages.**

## Quick Start

```bash
npm run dev      # Dev server
npm run deploy   # Build & deploy to GitHub Pages
npm test         # Run tests
```

**Stack:** React 18, TypeScript, Vite, Tailwind, Google Sheets (database), Google OAuth

---

## Key Features

- **Daily Recurring Tasks** - Define once, automatically repeats all 80 days
- **Soldier Scheduling** - Greedy algorithm assigns soldiers based on fairness & availability
- **Dual-mode Calendar:**
  - Soldier mode: 80-day grid showing who works when
  - Task mode: Weekly calendar (00:00-23:59) showing tasks, click to see assigned soldiers
- **Leave Management** - Request/approve leave with fairness scoring
- **Plain text IDs** - Manually editable in spreadsheet (format: `task_YYYYMMDD_HHMM_RANDOM`)

---

## Architecture

### Two-Spreadsheet Model

**Admin Sheet** (`VITE_SPREADSHEET_ID`) — Managed by `MasterDataService`
- Tabs: `Admins`, `Units`, `Commanders`, `Tasks`, `Config`, `History`, `Roles`

**Per-Unit Sheet** (ID from Units) — Managed by `DataService`
- `{tabPrefix}` — Soldiers (14 cols: ID, Name, Role, ServiceStart/End, Fairness, Status, Counts, Reason)
- `{tabPrefix}_TaskSchedule` — Task assignments
- `{tabPrefix}_LeaveRequests` — Leave requests
- `{tabPrefix}_LeaveSchedule` — Leave assignments

**Critical:** Soldiers live in unit-named tab (e.g., `"א'"`) NOT `{prefix}_Soldiers`.

### Schedule Generation

**Workflow:**
1. Tasks (base definitions) → Expanded to 80 daily instances
2. `generateLeaveSchedule()` → Processes leave requests, updates fairness
3. `generateTaskSchedule()` → Assigns soldiers via greedy algorithm (fairness + availability)
4. Both must run together for proper fairness updates

**Task Format:** MUST have full ISO datetime: `"2026-03-08T06:00:00"` (not just `"06:00"`)

### Data Models

| Type | Key Fields |
|------|-----------|
| **Soldier** | `id`, `firstName`, `lastName`, `role`, `serviceStart/End`, `status`, fairness/hours/leave counts |
| **Task** | `id`, `taskType`, `startTime/endTime` (ISO), `durationHours`, `roleRequirements[]`, `minRestAfter`, `isSpecial` (pillbox) |
| **LeaveRequest** | `id`, `soldierId`, `startDate/endDate`, `leaveType`, `priority`, `status` |
| **LeaveAssignment** | `id`, `soldierId`, dates, `leaveType`, `isWeekend`, `requestId` |

---

## Implementation Notes

### Task Expansion
`expandRecurringTasks()` in `src/algorithms/taskExpander.ts`:
- **Regular tasks:** Creates daily instance from startDate to scheduleEndDate
- **Pillbox tasks** (isSpecial=true): Creates sequential instances, each after the previous

### Scheduling Algorithm
`scheduleTasks()` in `src/algorithms/taskScheduler.ts`:
- Sorts tasks chronologically
- For each task's role requirements:
  - Filters eligible soldiers (active, right role, rest period met)
  - Ranks by combined fairness score
  - Assigns up to required count

### Rest Period Validation
`isTaskAvailable()` checks:
- Soldier status = 'Active'
- Soldier has required role
- Rest period from previous task (minRestAfter hours) has passed

---

## Known Issues & TODOs

1. **Debug logging** - Remove console.logs from `taskScheduler.ts`, `scheduleService.ts`, `App.tsx`
2. **Mobile responsive** - Task calendar (24hr view) needs mobile refinement
3. **Test updates** - Tests don't account for task expansion (1 task → 80+ instances)
4. **State persistence** - Save user's soldier/task mode preference to localStorage
5. **Soldier validation** - Prevent scheduling outside service dates

---

## Environment Variables

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
VITE_SPREADSHEET_ID=1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM
VITE_ADMIN_EMAIL=guy.moshk@gmail.com
```

Add as GitHub Secrets for CI/CD.
