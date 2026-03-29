# ShabTzak - IDF Soldier Scheduling System

## Overview

Web-based scheduling for IDF units: task assignments, cyclical leave (e.g., 10:4 ratio), multi-unit coordination via Google Sheets.

**Stack:** React 18, TypeScript, Vite 5, Tailwind 3, Vitest, Google Sheets API
**Status:** 600+ tests passing, ~338 kB production bundle
**Performance:** O(n) scheduling with pre-computed capacity calculations

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
   - Pre-computes capacity for all dates (O(n) optimization)
   - Deterministic phase offsets per soldier (hash of ID)
   - Three capacity constraints enforced:
     a) Leave ratio (e.g., 10:4 cycle = ~28.5% max on leave)
     b) minBasePresenceByRole (absolute count per role)
     c) minBasePresence percentage (e.g., 66% must stay)
   - Soldiers on tasks excluded from leave that day
5. Update fairness scores (skipped to avoid 429 rate limits)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/algorithms/taskScheduler.ts` | Assigns soldiers to tasks with fairness rotation |
| `src/algorithms/cyclicalLeaveScheduler.ts` | Generates cyclical leaves with pre-computed capacity |
| `src/algorithms/leaveCapacityCalculator.ts` | **Pre-computes capacity** (O(n) optimization) |
| `src/algorithms/taskAvailability.ts` | Checks soldier availability (rest, leave, driving hours) |
| `src/services/scheduleService.ts` | Orchestrates generation |
| `src/services/fairnessUpdateService.ts` | Updates soldier fairness after assignments |
| `src/services/masterTaskAssignmentRepository.ts` | Task schedule persistence (clearFutureAssignments) |
| `src/services/masterLeaveAssignmentRepository.ts` | Leave schedule persistence (clearFutureAssignments) |
| `ALGORITHM_VERIFICATION.md` | **Verification report with test results** |

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
| **Fairness scores** | ⚠️ Currently skipped (to avoid 429 rate limits) |

---

## Commands

```bash
npm run dev       # Dev server
npm run build     # Production build
npm test -- --run # Run tests (CI mode)
npm run deploy    # Deploy to GitHub Pages

# Testing & Debugging
npx vitest run src/algorithms/                      # Run all algorithm tests (94 tests)
npx vitest run src/integration/realDataValidation.test.ts  # Test with real xlsx data
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
- **Performance:** O(n) leave scheduling via pre-computed capacity
- **Testing:** 94 algorithm tests + integration tests with real data
- **Debugging:** Use test suite to verify changes before deploying
- See `ALGORITHM_VERIFICATION.md` for complete verification report
- See `optimization_improvements.md` for performance tuning options

## Recent Changes

### 2026-03-29: Algorithm Optimization & 429 Fix
- ✅ Fixed 429 rate limit errors (skipped individual fairness updates)
- ✅ Optimized leave capacity calculation (O(n³) → O(n))
- ✅ Added comprehensive test suite and verification documentation
- ⚠️ Fairness tracking temporarily disabled (non-critical)
