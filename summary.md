# ShabTzak Implementation Progress

## Project
Web-based soldier scheduling system — React SPA + Google Sheets API + OAuth.
**Stack:** React 18, TypeScript, Vite 5, Tailwind CSS v3, Vitest, Google Sheets API v4
**Node version:** 18.16.0 (affects some package compatibility — see adaptations below)

---

## Environment Notes (for new agent)
- Node 18.16.0 is installed — several "latest" packages require Node 20+
- Use `vitest --run` (not `vitest`) in non-interactive contexts
- jsdom pinned to `^24` (v28 breaks on Node 18 — ESM-only dependency issue)
- Tailwind pinned to `v3` (v4 has breaking API changes — no `tailwindcss init`)
- Vite scaffolded at v5 (`create-vite@8` requires Node 20+)
- `.env.local` is gitignored via `*.local` rule
- Datetime strings passed to algorithm functions must be UTC (`Z` suffix) for correct timezone math

---

## Overall Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Project Setup & Infrastructure | 1–10 | ✅ Complete |
| 2. Data Layer & Google Sheets Integration | 11–25 | ✅ Complete |
| 3. Core Domain Services / Algorithms | 26–40 | ✅ Complete |
| 4. Scheduling Algorithms (advanced) | 41–60 | 🔄 In Progress (1/20) |
| 5. UI Components | 61–85 | 🔄 In Progress (9/25) |
| 6. Export & Multi-User Features | 86–95 | ⏳ Pending |
| 7. Polish & Production Ready | 96–100 | ⏳ Pending |

**Test suite: 266 tests, 42 files, all passing**

---

## Completed Tasks

### Batches 1–8 (Tasks 1–25) — Phases 1 & 2 ✅
All infrastructure, data models, constants, utilities, Google Sheets integration,
all repositories (Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment),
ConfigRepository, HistoryService, VersionService, DataService facade — complete.

### Batch 9–10 (Tasks 26–33) — Phase 3: Algorithms & Schedulers ✅
- Fairness calculator, leave/task availability checkers, base presence validator
- Leave scheduler (greedy), leave conflict detector
- Task scheduler (greedy), task conflict detector

### Batch 11 (Tasks 34–37) — Phase 3: Domain Services ✅
- SoldierService, TaskService, LeaveRequestService
- ScheduleService (orchestrates schedulers + persists + history)

### Batch 12 (Tasks 38–41) — Phase 3 finish + Phase 4 start ✅
- ✅ **Task 38** — FairnessUpdateService: applyTaskAssignment, applyLeaveAssignment
- ✅ **Task 39** — DataService wiring: all domain services exposed on facade
- ✅ **Task 40** — buildAvailabilityMatrix: per-day per-soldier availability for UI
- ✅ **Task 41** — checkDrivingHoursLimit: prevents Driver from exceeding daily limit

### Batch 13 (Tasks 42–46) — Phase 5: React UI Components ✅
- ✅ **Task 42** — `AuthContext` + `useAuth` hook (Google OAuth state)
- ✅ **Task 43** — `LoginPage` component (Google Sign-In button)
- ✅ **Task 44** — `AppShell` component (header, nav, auth guard)
- ✅ **Task 45** — `SoldiersPage` component (list/add/discharge)
- ✅ **Task 46** — `LeaveRequestForm` component (submit with validation)

### Batch 14 (Tasks 47–49) — Phase 5: More UI + App Wiring ✅
- ✅ **Task 47** — `ScheduleCalendar` component (availability grid, color-coded cells)
- ✅ **Task 48** — `Dashboard` component (stats: active soldiers, pending requests, conflicts)
- ✅ **Task 49** — `App.tsx` wired (AuthProvider + AppShell + hash-based routing: dashboard/soldiers/leave/schedule)

---

## Next Up

### Batch 15 (Tasks 50–53) — Phase 5: Data Integration + Export
The UI shell is complete. Next: connect the UI to the real DataService + Google Sheets, and implement export features.

- 🔲 **Task 50** — `useDataService` hook: initializes DataService with OAuth token, exposes loading state
- 🔲 **Task 51** — Wire `AppContent` in App.tsx to load real data (soldiers, leaveRequests, tasks, assignments) via useDataService
- 🔲 **Task 52** — PDF export: `exportScheduleToPdf(schedule, soldiers)` using browser print API
- 🔲 **Task 53** — WhatsApp text export: `formatScheduleAsText(schedule, soldiers)` → clipboard copy

---

## Architecture Overview

```
src/
  constants/        — ROLES, LEAVE_TYPES, FAIRNESS_WEIGHTS, DEFAULT_CONFIG
  models/           — Soldier, Task, Leave, Schedule, Config interfaces
  utils/            — dateUtils, validation
  config/           — env.ts (Vite env vars)
  types/            — google.d.ts (GIS type declarations)
  algorithms/       — fairness, leaveAvailability, taskAvailability,
                      presenceValidator, leaveScheduler, leaveConflictDetector,
                      taskScheduler, taskConflictDetector,
                      availabilityMatrix, checkDrivingHoursLimit
  services/         — GoogleSheets, SheetCache, OptimisticUpdater,
                      Repositories (Soldier/Task/Leave/TaskAssignment/Config),
                      HistoryService, VersionService, DataService (facade),
                      SoldierService, TaskService, LeaveRequestService,
                      ScheduleService, FairnessUpdateService
  context/          — AuthContext (Google OAuth state + useAuth hook)
  components/       — LoginPage, AppShell, SoldiersPage, LeaveRequestForm,
                      ScheduleCalendar, Dashboard
  App.tsx           — AuthProvider + hash-based routing (dashboard/soldiers/leave/schedule)
```

## Git Log (recent)
```
2c72d5b feat: add ScheduleCalendar, Dashboard, and wire App.tsx (Batch 14)
01e927b feat: add React UI components (Batch 13)
a7fb6f9 feat: add fairness updates, availability matrix, and driving hour limit check
4603ab2 feat: add domain services for soldier, task, leave request, and schedule generation
4cdbdb6 feat: add leave and task scheduling algorithms with conflict detectors
```
