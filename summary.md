# ShabTzak - IDF Soldier Scheduling System

## Overview

Web-based scheduling for IDF units: task assignments, cyclical leave (e.g., 10:4 ratio), multi-unit coordination via Google Sheets.

**Stack:** React 18, TypeScript, Vite 5, Tailwind 3, Vitest, Google Sheets API
**Status:** 555 tests passing, ~313 kB production bundle

---

## Scheduling Algorithm

**Priority order:** Tasks first, then leaves.

```
1. Load all soldiers globally
2. Generate TASK schedule (mandatory, role-based)
3. Generate LEAVE schedule (respects ratio + task conflicts)
   - Deterministic phase offsets per soldier (hash of ID)
   - Capacity: floor(total * leaveRatio) per role per day
   - Soldiers on tasks excluded from leave that day
```

### Key Files

| File | Purpose |
|------|---------|
| `src/algorithms/taskScheduler.ts` | Assigns soldiers to tasks |
| `src/algorithms/cyclicalLeaveScheduler.ts` | Generates cyclical leaves |
| `src/algorithms/leaveCapacityCalculator.ts` | Enforces leave ratio limits |
| `src/algorithms/taskAvailability.ts` | Checks soldier availability (rest, leave, driving hours) |
| `src/services/scheduleService.ts` | Orchestrates generation |

---

## Architecture

```
src/
  algorithms/   - Scheduling logic
  components/   - React UI
  services/     - Google Sheets repositories
  hooks/        - useDataService, useScheduleGenerator
  models/       - TypeScript interfaces
  utils/        - Date handling, validation
```

---

## Commands

```bash
npm run dev       # Dev server
npm run build     # Production build
npm test -- --run # Run tests (CI mode)
npm run deploy    # Deploy to GitHub Pages
```

---

## Notes

- Node 18.16.0 (jsdom v24 pinned for compatibility)
- Tailwind pinned to v3
- Date strings: use `YYYY-MM-DD` or ISO with `Z` suffix
- Driving hours limit enforced for Driver role
