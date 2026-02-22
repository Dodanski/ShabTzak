# ShabTzak Implementation Progress

## Project
Web-based soldier scheduling system — React SPA + Google Sheets API + OAuth.
**Stack:** React 18, TypeScript, Vite 5, Tailwind CSS v3, Vitest, Google Sheets API v4
**Node version:** 18.16.0 (affects some package compatibility — see adaptations below)

---

## Environment Notes (for new agent)
- Node 18.16.0 — several "latest" packages require Node 20+
- Use `vitest --run` (not `vitest`) in non-interactive contexts
- jsdom pinned to `^24` (v28 breaks on Node 18 — ESM-only dependency issue)
- jsdom v24 does NOT have `navigator.clipboard` — use `Object.defineProperty(navigator, 'clipboard', ...)` in tests
- Tailwind pinned to `v3` (v4 has breaking API changes)
- Datetime strings passed to algorithm functions must be UTC (`Z` suffix) for correct timezone math
- `tsconfig.app.json` excludes `*.test.ts(x)` — test files are not type-checked during `npm run build`
- Google type declarations (`TokenClient`, etc.) are in `src/types/google.d.ts` inside `declare global {}`
- `models/index.ts` re-exports domain type aliases (`SoldierRole`, `ConstraintType`, etc.) from constants
- Production build: `npm run build` → `tsc -b && vite build` (✅ passing)
- `Array.prototype.at()` is not in ES2020 lib — use bracket notation `arr[arr.length - 1]` instead

---

## Overall Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| 1. Project Setup & Infrastructure | 1–10 | ✅ Complete |
| 2. Data Layer & Google Sheets Integration | 11–25 | ✅ Complete |
| 3. Core Domain Services / Algorithms | 26–40 | ✅ Complete |
| 4. Scheduling Algorithms (advanced) | 41–60 | 🔄 In Progress (2/20) |
| 5. UI Components | 61–85 | 🔄 In Progress (19/25) |
| 6. Export & Multi-User Features | 86–95 | 🔄 In Progress (3/10) |
| 7. Polish & Production Ready | 96–100 | 🔄 In Progress (1/5) |

**Test suite: 304 tests, 48 files, all passing**
**Production build: ✅ passing (162 kB JS bundle)**

---

## Completed Tasks

### Batches 1–8 (Tasks 1–25) — Phases 1 & 2 ✅
All infrastructure, data models, constants, utilities, Google Sheets integration, all repositories, DataService facade — complete.

### Batch 9–12 (Tasks 26–41) — Phase 3 + Phase 4 start ✅
Fairness calculator, availability checkers, presence validator, leave/task schedulers, conflict detectors, domain services (SoldierService, TaskService, LeaveRequestService, ScheduleService, FairnessUpdateService), buildAvailabilityMatrix, checkDrivingHoursLimit.

### Batch 13 (Tasks 42–46) — Phase 5: Core UI ✅
AuthContext + useAuth, LoginPage, AppShell, SoldiersPage, LeaveRequestForm.

### Batch 14 (Tasks 47–49) — Phase 5: More UI + App Wiring ✅
ScheduleCalendar (availability grid), Dashboard (stats), App.tsx hash-based routing.

### Batch 15 (Tasks 50–59) — Hooks, Export, Pages, Build ✅
- ✅ **Task 50** — `useDataService` hook: initializes DataService when OAuth token available, loads all data
- ✅ **Task 51** — `LeaveRequestsPage`: list with approve/deny buttons, status badges
- ✅ **Task 52** — `SchedulePage`: ScheduleCalendar + conflict list + Generate Schedule button
- ✅ **Task 53** — `formatScheduleAsText`: formats leave assignments as WhatsApp-friendly text
- ✅ **Task 54** — `exportToPdf`: triggers browser print dialog
- ✅ **Task 55** — `ConflictList`: conflict items with type badge, message, suggestions
- ✅ **Task 56** — `ErrorBoundary`: class-based React error boundary with retry button
- ✅ **Task 57** — App.tsx full wiring: useDataService + ErrorBoundary + real handlers (discharge, addSoldier, approve, deny, generateSchedule)
- ✅ **Task 58** — Export buttons on SchedulePage: "Copy for WhatsApp" + "Print"
- ✅ **Task 59** — Production build: fixed TS errors, build passes cleanly

---

## Next Up

### Batch 16 (Tasks 60–69) — Multi-User + E2E + Polish
- 🔲 **Task 60** — `VersionConflictBanner`: detects stale data via VersionService, shows reload prompt
- 🔲 **Task 61** — `useScheduleGenerator` hook: wraps ScheduleService, exposes loading/conflict state
- 🔲 **Task 62** — `TasksPage` component: list tasks with add/delete
- 🔲 **Task 63** — Wire TasksPage into App.tsx (add `#tasks` hash route)
- 🔲 **Task 64** — History snapshot view: show last N history entries
- 🔲 **Task 65** — `useLoadingToast` hook: simple in-app toast for async operation feedback
- 🔲 **Task 66** — Add VITE_SPREADSHEET_ID to `.env.local` example and README
- 🔲 **Task 67** — E2E smoke test setup with Playwright
- 🔲 **Task 68** — E2E: login → navigate → generate schedule flow
- 🔲 **Task 69** — Final review: lighthouse score, bundle size, deploy instructions

---

## Architecture

```
src/
  constants/        — ROLES, LEAVE_TYPES, FAIRNESS_WEIGHTS, DEFAULT_CONFIG
  models/           — Soldier, Task, Leave, Schedule, Config + re-exports from constants
  utils/            — dateUtils, validation, exportUtils
  config/           — env.ts (VITE_GOOGLE_CLIENT_ID, VITE_SPREADSHEET_ID)
  types/            — google.d.ts (GIS global type declarations)
  algorithms/       — fairness, availability, schedulers, conflict detectors, availabilityMatrix
  services/         — GoogleSheets, repositories, domain services, DataService facade
  context/          — AuthContext (Google OAuth)
  hooks/            — useDataService
  components/       — LoginPage, AppShell, ErrorBoundary, Dashboard, SoldiersPage,
                      LeaveRequestForm, LeaveRequestsPage, ScheduleCalendar,
                      SchedulePage, ConflictList
  App.tsx           — AuthProvider + ErrorBoundary + hash routing
```

## Git Log (recent)
```
3154c45 feat: add hooks, export utils, new pages, error boundary, build fix (Batch 15)
2c72d5b feat: add ScheduleCalendar, Dashboard, and wire App.tsx (Batch 14)
01e927b feat: add React UI components (Batch 13)
a7fb6f9 feat: add fairness updates, availability matrix, and driving hour limit check
4603ab2 feat: add domain services for soldier, task, leave request, and schedule generation
```
