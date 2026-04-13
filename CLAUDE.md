# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ShabTzak** is a soldier scheduling system for managing weekend duty assignments, leave requests, and task allocations. The system is **migrating from Google Sheets to a static JSON database** for improved performance (10-20x faster) and simplified architecture. Both data stores are currently supported during the transition.

### Core Features
- Soldier management (roles, availability, fairness tracking)
- Task scheduling with role requirements and alternative roles
- Leave request approval workflow
- Automated fair scheduling algorithm with rotation
- Multi-unit support (cross-unit task assignments)
- History/audit logging
- Calendar view and schedule export

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS v3
- **Authentication**: Google Identity Services (OAuth2) — *being phased out in JSON migration*
- **Backend**:
  - **Legacy**: Google Sheets API v4 (being phased out)
  - **Current**: Static JSON database (`public/data/database.json`)
- **Testing**: Vitest + Testing Library
- **Deployment**: GitHub Pages (via `npm run deploy`)

## Common Commands

```bash
# Development
npm run dev              # Start dev server on http://localhost:5173

# Testing
npm test                 # Run tests in watch mode
npm run test:ui          # Run tests with Vitest UI
npx vitest run          # Run all tests once (used in CI)

# Building
npm run build           # TypeScript compile + Vite build to dist/
npm run preview         # Preview production build locally

# Linting
npm run lint            # Run ESLint

# Deployment
npm run deploy          # Build and deploy to GitHub Pages

# Utilities
npm run export-sheets   # Export Google Sheets data to JSON (migration tool)

# Single Test Execution
npx vitest run <filename>          # Run specific test file once
npm test -- <filename>             # Run specific test file in watch mode
```

## Environment Variables

Required variables in `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
VITE_SPREADSHEET_ID=your-master-spreadsheet-id
VITE_ADMIN_EMAIL=admin@example.com  # Optional: restricts admin access
```

## Architecture

### JSON Database Migration (In Progress)

The system is **actively migrating** from Google Sheets to a static JSON database:

**New Architecture (Current)**:
- Single JSON file: `public/data/database.json`
- Loaded once at app startup into React Context (`DatabaseContext`)
- All operations in-memory (instant, no network calls)
- Updates via admin UI → export → commit → deploy workflow
- 10-20x faster than Google Sheets API

**Migration Status**:
- ✅ `DatabaseContext` - React Context for database state management
- ✅ `JsonRepository` - Base class for JSON-based data access
- ✅ Export script - `npm run export-sheets` to migrate existing data
- 🚧 Repository refactoring - SoldierRepository migrated, others in progress
- ⏳ Remove Google Sheets dependencies - planned after migration complete

See `docs/superpowers/plans/2026-03-31-json-database-migration.md` for the full migration plan.

### Multi-Unit Data Model (Legacy - Google Sheets)

The legacy Google Sheets architecture supported a **hierarchical multi-unit model**:

1. **Master Spreadsheet** (admin-level):
   - Contains all soldiers from all units (with `Unit` column)
   - Stores unit configurations
   - Manages commanders and roles
   - Shared admin data accessible across units

2. **Unit Spreadsheets** (per-unit):
   - Each unit has its own spreadsheet (referenced in master `Units` tab)
   - Contains unit-specific tasks, leave requests, and assignments
   - Can have a `tabPrefix` for organizational purposes

See `docs/MULTI_UNIT_ARCHITECTURE.md` for detailed setup instructions (legacy).

### Data Flow

**Current (JSON Database)**:
```
App Startup
    ↓
fetch('/data/database.json')
    ↓
DatabaseContext (in-memory)
    ↓
JsonRepository classes (soldiers, tasks, etc.)
    ↓
Services (soldierService, scheduleService, fairnessUpdate)
    ↓
Components (React UI)
    ↓
[Admin Only] Export → Save → Commit → Deploy
```

**Legacy (Google Sheets)**:
```
User Authentication (Google OAuth)
    ↓
MasterDataService (admin spreadsheet)
    ↓
DataService per unit (unit spreadsheets)
    ↓
Repositories (soldiers, tasks, leaveRequests, assignments)
    ↓
Services (soldierService, scheduleService, fairnessUpdate)
    ↓
Components (React UI)
```

### Key Directories

- **`src/algorithms/`** - Core scheduling logic
  - `taskScheduler.ts` - Greedy task assignment with rotation and fairness
  - `leaveScheduler.ts` - Leave assignment algorithm
  - `fairness.ts` - Fairness scoring and calculation
  - `*Availability.ts` - Availability matrices and conflict detection
  - `*ConflictDetector.ts` - Validation logic for overlaps

- **`src/services/`** - Data access and business logic
  - `JsonRepository.ts` - **NEW**: Base class for JSON-based repositories
  - `dataService.ts` - Main per-unit data service orchestrator
  - `masterDataService.ts` - Admin-level data service
  - `googleSheets.ts` - **LEGACY**: Google Sheets API wrapper (being removed)
  - `parsers.ts` - **LEGACY**: Row-to-object parsing (removed in JSON migration)
  - `serializers.ts` - **LEGACY**: Object-to-row serialization (removed in JSON migration)
  - `cache.ts` - **LEGACY**: In-memory caching layer (not needed for JSON)
  - `*Repository.ts` - Data access layers for each entity (refactoring to extend JsonRepository)
  - `scheduleService.ts` - High-level scheduling orchestration
  - `fairnessUpdateService.ts` - Fairness score updates

- **`src/contexts/`** - React Context providers
  - `DatabaseContext.tsx` - **NEW**: Provides JSON database to entire app
  - `AuthContext.tsx` - **LEGACY**: Google OAuth (being removed)

- **`src/components/`** - React UI components
  - `App.tsx` - Main application with routing and state
  - `AppShell.tsx` - Layout wrapper with navigation
  - `*Page.tsx` - Top-level page components
  - `*Calendar.tsx` - Calendar grid views
  - `*Card.tsx` - Individual entity cards

- **`src/models/`** - TypeScript data models (Soldier, Task, Leave, etc.)
- **`src/types/`** - Shared TypeScript type definitions
  - `Database.ts` - **NEW**: TypeScript interface for database structure
- **`src/hooks/`** - React hooks (useDataService, useScheduleGenerator, etc.)
- **`src/utils/`** - Utility functions (date handling, validation, export)
- **`src/constants/`** - Enums and constant values (roles, statuses)
- **`src/config/`** - Environment configuration

- **`public/data/`** - Static data files
  - `database.json` - **NEW**: Single-file JSON database

- **`scripts/`** - Utility scripts
  - `export-sheets-to-json.ts` - **NEW**: One-time migration from Google Sheets
  - `restore-soldiers-data.js` - Data restoration helper
  - `update-soldiers-sheet.js` - Google Sheets update helper

## Core Concepts

### Fairness Algorithm

The scheduling algorithm prioritizes fairness through a **combined fairness score**:
- Tracks hours worked and leave counts per soldier
- Uses time-slot multipliers (weekends, nights, holidays)
- Applies task difficulty multipliers
- Balances workload across soldiers during scheduling sessions
- See `src/algorithms/fairness.ts` for implementation

### Task Scheduling with Alternative Roles

Tasks can specify **alternative roles** via `RoleRequirements`:
```typescript
RoleRequirements = [
  {"roles": ["Driver", "Squad leader"], "count": 2},
  {"roles": ["Fighter"], "count": 3}
]
```

The scheduler assigns soldiers based on:
1. Role eligibility (exact match or alternative)
2. Availability (no leave, no conflicting tasks)
3. Fairness score (lower is better = fewer recent assignments)
4. Rotation tracking (deprioritize recently assigned soldiers)
5. Rest period validation (24h between tasks)
6. Driving hours limit (8h per day for drivers)

See `src/algorithms/taskScheduler.ts` for the greedy assignment implementation.

### Multi-Unit Scheduling

When scheduling across multiple units:
1. All soldiers are loaded from the master spreadsheet
2. Scheduler assigns soldiers from any unit to tasks
3. Assignments are written to the requesting unit's spreadsheet
4. Fairness scores are updated across all units (rate-limited to 1/sec to avoid 429 errors)

**Known Limitation**: Currently, assignments are only saved to the generating unit's spreadsheet. For other units to see their soldiers' assignments, either manually copy data or implement programmatic sync (see `MULTI_UNIT_ARCHITECTURE.md` for proposed solutions).

## Testing Approach

- **Unit tests** for algorithms, services, and utilities
- **Integration tests** in `src/integration/` for full scheduling workflows
- Use Vitest with `globals: true` and `jsdom` environment
- Test files co-located with source files (`.test.ts` or `.test.tsx`)
- Mock Google Sheets API calls in tests using in-memory data

## Google Sheets Schema

Each spreadsheet contains tabs (prefixed by `tabPrefix` if configured):

- **Soldiers**: ID, First Name, Last Name, Role, Unit, ServiceStart, ServiceEnd, InitialFairness, CurrentFairness, Status, HoursWorked, WeekendLeavesCount, MidweekLeavesCount, AfterLeavesCount, InactiveReason
- **Tasks**: ID, Name, Day, StartTime, EndTime, DurationHours, RoleRequirements (JSON), RecurringPattern (JSON), Status
- **LeaveRequests**: ID, SoldierID, StartDate, EndDate, Reason, Status, SubmittedAt, Priority
- **LeaveAssignments**: ID, SoldierID, Date, Type
- **TaskAssignments**: ID, TaskID, SoldierID, Date
- **Config**: Key, Value (JSON)
- **History**: Timestamp, UserEmail, Action, Entity, EntityID, Details (JSON)
- **Version**: Version (integer, used for conflict detection)

The master spreadsheet also contains:
- **Units**: Name, SpreadsheetID, TabPrefix, Status
- **Commanders**: Email, Units (JSON array)
- **Roles**: Name, Priority, IsActive

## Development Guidelines

### When Working with the JSON Database Migration

1. **Check migration status** - Review `docs/superpowers/plans/2026-03-31-json-database-migration.md` for current progress
2. **Use JsonRepository pattern** - New repositories should extend `JsonRepository<T>`
3. **Test with DatabaseContext** - Mock the `useDatabase` context in tests
4. **Preserve backward compatibility** - Don't remove Google Sheets code until migration is complete
5. **Update immutably** - Always use `setData({ ...db, ... })` to trigger React re-renders
6. **Run single test files** - Use `npx vitest run <filename>` for faster iteration during development

### When Modifying Scheduling Logic

1. **Read existing implementation first** - The scheduler is complex with many edge cases already handled
2. **Update tests** - Both unit tests and integration tests in `src/integration/`
3. **Verify fairness** - Check that fairness scores are calculated and updated correctly
4. **Test multi-unit scenarios** - Ensure cross-unit assignments work properly
5. **Check for rate limiting** - *(Legacy Google Sheets concern)* Google Sheets API has rate limits; batch operations and add delays as needed

### When Adding New Features

1. **Check multi-unit compatibility** - Will this work across units?
2. **Add history logging** - Use `historyService` for audit trail
3. **Handle empty states** - New features should work on day 1 with zero data
4. **Update types** - Keep TypeScript models in `src/models/` up to date
5. **Consider caching** - Use `cache.ts` for frequently accessed data

### Code Style

- Use TypeScript strict mode
- Prefer functional programming patterns
- Use descriptive variable names (avoid abbreviations)
- Add JSDoc comments for complex algorithms
- Keep components small and focused
- Extract reusable logic into hooks or utilities

### Git Workflow

- CI runs on push/PR to main/master branches
- CI runs: `npm ci` → `npx vitest run` → `npm run build` → deploy to GitHub Pages
- All tests must pass before merge
- Deployment is automatic on push to main/master

## Key Implementation Details

### JSON Database Architecture

The new JSON database architecture provides several benefits:
- **Performance**: 10-20x faster than Google Sheets (single fetch vs multiple API calls)
- **Simplicity**: No authentication, rate limits, or network errors
- **Offline-capable**: Can cache JSON file for offline use
- **Version controlled**: Database changes tracked in git
- **Zero cost**: No API quotas or hosting fees

**Read operations** (all users):
1. App startup fetches `/data/database.json`
2. Data stored in React Context (in-memory)
3. All subsequent operations are instant

**Write operations** (admin only):
1. Make changes in admin UI
2. Export database (downloads JSON)
3. Save to `public/data/database.json`
4. Commit and deploy: `npm run deploy`
5. Users get updates on next page refresh

**Repository pattern**:
```typescript
// All repositories extend JsonRepository
class SoldierRepository extends JsonRepository<Soldier> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'soldiers')  // 'soldiers' is key in database.json
  }

  // Custom methods can be added
  async getActiveByRole(role: SoldierRole): Promise<Soldier[]> {
    const soldiers = await this.list()
    return soldiers.filter(s => s.role === role && s.status === 'Active')
  }
}
```

### Rate Limiting (Legacy - Google Sheets)

**Note**: This section applies only to the legacy Google Sheets implementation.

When updating fairness scores for many soldiers, the system includes delays (500ms-2000ms) to avoid Google Sheets API 429 errors. If you see rate limit errors:
- Increase delays in `App.tsx` `handleGenerateSchedule()`
- Current config: 1 update per second for fairness
- See `MULTI_UNIT_ARCHITECTURE.md` for tuning guidance

### Tab Prefixing

Units can have optional `tabPrefix` to organize their spreadsheet:
- Prefix applied to tab names: `{prefix}Soldiers`, `{prefix}Tasks`, etc.
- Handled automatically by repositories via `src/utils/tabPrefix.ts`
- See `docs/plans/2026-03-02-tab-prefix-*` for implementation details

### Task Expansion

Recurring tasks (daily, weekly) are expanded to individual task instances:
- `src/algorithms/taskExpander.ts` handles expansion
- Expanded tasks get IDs like `{baseId}_day1`, `{baseId}_day2`
- Scheduler works with expanded instances

### Leave Quota Calculation

Soldiers have leave quotas based on service duration and leave ratio:
- Calculated in `src/utils/leaveQuota.ts`
- Accounts for partial service periods
- Displayed in UI alongside actual leave counts

## Relevant Documentation

- `README.md` - Setup instructions and prerequisites
- `SUMMARY.md` - Quick reference for architecture and key features
- `prd.md` - Original product requirements (in Hebrew)
- `docs/superpowers/plans/2026-03-31-json-database-migration.md` - **Active migration plan**
- `docs/MULTI_UNIT_ARCHITECTURE.md` - Multi-unit setup and architecture (legacy Google Sheets)
- `DATABASE_ALTERNATIVES.md` - Analysis of database options (Supabase, Firestore, IndexedDB, etc.)
- `docs/plans/*.md` - Feature implementation plans and designs
- `REFACTOR_PLAN.md` - Historical refactoring notes
- Various `*_ANALYSIS.md`, `*_SUMMARY.md` - Performance and investigation docs

## Important Notes

- **No destructive operations without confirmation** - Always check before deleting soldiers, tasks, or assignments
- **Fairness is critical** - The fairness algorithm is the core value proposition; preserve it when making changes
- **Migration in progress** - System supports both Google Sheets and JSON database during transition
  - New code should use `DatabaseContext` and `JsonRepository`
  - Legacy Google Sheets code marked with comments, will be removed post-migration
- **JSON is the source of truth** - All data in `public/data/database.json`; app is stateless
- **Multi-unit is partially implemented** - Cross-unit scheduling works but assignment distribution is limited (see MULTI_UNIT_ARCHITECTURE.md)
- **Hebrew text support** - System supports Hebrew names and text in various fields
- **Immutable updates required** - Always create new objects when updating database context to trigger React re-renders
