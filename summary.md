# ShabTzak - IDF Soldier Scheduling System

## Overview

Web-based scheduling for IDF units: task assignments, cyclical leave (e.g., 10:4 ratio), multi-unit coordination via Google Sheets.

**Stack:** React 18, TypeScript, Vite 5, Tailwind 3, Vitest, Google Sheets API
**Status:** 600+ tests passing, ~338 kB production bundle

---

## Scheduling Algorithm

**Priority order:** Tasks first, then leaves.

```
1. Load all soldiers globally (from master Soldiers sheet)
2. Clear FUTURE assignments only (preserves historical data)
3. Generate TASK schedule (mandatory, role-based)
   - Fairness-based rotation (tracks hoursWorked per soldier)
   - Rest periods enforced between tasks
   - Driving hours limit for Driver role
4. Generate LEAVE schedule (respects ratio + task conflicts)
   - Deterministic phase offsets per soldier (hash of ID)
   - Three capacity constraints enforced:
     a) Leave ratio (e.g., 10:4 cycle = ~28.5% max on leave)
     b) minBasePresenceByRole (absolute count per role)
     c) minBasePresence percentage (e.g., 66% must stay)
   - Soldiers on tasks excluded from leave that day
5. Update fairness scores (hoursWorked, currentFairness)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/algorithms/taskScheduler.ts` | Assigns soldiers to tasks with fairness rotation |
| `src/algorithms/cyclicalLeaveScheduler.ts` | Generates cyclical leaves |
| `src/algorithms/leaveCapacityCalculator.ts` | Enforces leave ratio + presence limits |
| `src/algorithms/taskAvailability.ts` | Checks soldier availability (rest, leave, driving hours) |
| `src/services/scheduleService.ts` | Orchestrates generation |
| `src/services/fairnessUpdateService.ts` | Updates soldier fairness after assignments |
| `src/services/masterTaskAssignmentRepository.ts` | Task schedule persistence (clearFutureAssignments) |
| `src/services/masterLeaveAssignmentRepository.ts` | Leave schedule persistence (clearFutureAssignments) |

---

## Architecture

```
src/
  algorithms/   - Scheduling logic (task, leave, fairness, capacity)
  components/   - React UI
  services/     - Google Sheets repositories + business logic
  hooks/        - useDataService, useScheduleGenerator
  models/       - TypeScript interfaces
  utils/        - Date handling, validation
```

### Data Flow

```
Master Spreadsheet (Admin)
├── Soldiers      - All soldiers across units
├── Tasks         - Task definitions
├── Config        - leaveRatio, minBasePresence, etc.
├── TaskSchedule  - Generated task assignments
├── LeaveSchedule - Generated leave assignments
└── LeaveRequests - Soldier leave requests (preserved)

Unit Spreadsheets (per unit)
└── Unit-specific views (read from master)
```

---

## Schedule Regeneration

When regenerating schedules:

| Data | Behavior |
|------|----------|
| **TaskSchedule** | Clears future only, preserves past |
| **LeaveSchedule** | Clears future only, preserves past |
| **LeaveRequests** | Never deleted, always preserved |
| **Fairness scores** | Updated for all soldiers (via masterDs) |

---

## Commands

```bash
npm run dev       # Dev server
npm run build     # Production build
npm test -- --run # Run tests (CI mode)
npm run deploy    # Deploy to GitHub Pages
```

---

## Configuration (Config sheet)

| Key | Description | Example |
|-----|-------------|---------|
| `leaveRatioDaysInBase` | Days in base per cycle | 10 |
| `leaveRatioDaysHome` | Days home per cycle | 4 |
| `minBasePresence` | % of soldiers that must stay | 66 |
| `minBasePresenceByRole` | Min count per role | `{"Driver": 2}` |
| `maxDrivingHours` | Daily limit for drivers | 8 |
| `defaultRestPeriod` | Hours rest after task | 6 |

---

## Notes

- Node 18.16.0 (jsdom v24 pinned for compatibility)
- Tailwind pinned to v3
- Date strings: use `YYYY-MM-DD` or ISO with `Z` suffix
- Driving hours limit enforced for Driver role
- Fairness updates use master spreadsheet (all units)
- See `optimization_improvements.md` for performance tuning options
