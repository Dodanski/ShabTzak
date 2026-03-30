# Supabase Migration - Project Context

**Date:** 2026-03-30
**Status:** In Progress - Manual Setup Phase
**Branch:** `feature/supabase-migration` (to be created)

---

## What We're Doing

Migrating **ShabTzak** (IDF shift scheduling app) from **Google Sheets** to **Supabase PostgreSQL** for massive performance improvements while maintaining free tier and human-editable data.

---

## The Problem

ShabTzak currently uses Google Sheets as its database, causing:

- **Rate limiting:** 100 requests/100s causes 429 errors and exponential backoff delays (1-16s)
- **Slow operations:** Schedule generation takes **105 seconds**
- **Read bottlenecks:** Loading data takes **1-2 seconds**
- **Write bottlenecks:** Batch writes take **30-40 seconds**
- **Concurrent user conflicts:** Multiple commanders hit shared rate limits
- **No real-time sync:** Manual refresh required
- **Complex batching logic:** Custom retry/backoff code throughout

**Current scale:** 3-5 units, 50-150 soldiers, 5-10 concurrent users

---

## The Solution

**Migrate to Supabase (PostgreSQL + Auth) + Build Table Editor UI**

### Performance Goals
- **20-50x faster operations** (schedule gen: 105s → 2-5s)
- **10-20x faster reads** (1-2s → 50-150ms)
- **30-60x faster writes** (30-40s → 200-500ms)
- **Unlimited concurrent users** (no shared rate limits)

### Key Features
1. **Email/password authentication** (simpler than Google OAuth)
2. **Table editor UI** (in-app spreadsheet-like editing)
3. **Excel export/import** (for bulk operations)
4. **User management** (super admin can manage accounts & reset passwords)
5. **Row-level security** (role-based access: super_admin, admin, commander)
6. **Free tier** ($0/month, sufficient for 5+ years at current scale)

---

## Architecture Overview

### Before (Google Sheets)
```
React App → GoogleSheetsService → Google Sheets API → Spreadsheet
              (1-2s reads, 30-40s batch writes, rate limited)
```

### After (Supabase)
```
React App → SupabaseRepository → Supabase Client → PostgreSQL
              (50-150ms reads, 200-500ms bulk writes, unlimited)
                ↓
          Excel Export/Import (for bulk edits)
```

### Database Schema
- **9 tables:** units, soldiers, tasks, leave_requests, leave_assignments, task_assignments, config, roles, users
- **Row-level security (RLS):** Commanders see only their unit, admins see all
- **JSONB fields:** For complex data (roleRequirements, minBasePresenceByRole, settings)
- **Foreign keys:** Proper relational constraints with CASCADE deletes

---

## Authentication & Authorization

### Authentication: Email + Password
- Supabase handles all security (hashing, sessions, tokens)
- Built-in features: password reset, email verification, account recovery
- No Google OAuth setup needed

### User Roles
1. **Super Admin**
   - View/edit all data across all units
   - Manage units, tasks, roles, config
   - **View all users** (commanders, admins, super admins)
   - **Reset/change passwords** for any user
   - Create/delete user accounts

2. **Admin**
   - View/edit all data across all units
   - Manage units, tasks, roles, config
   - Cannot manage users or passwords

3. **Commander**
   - View/edit soldiers in their unit only
   - View/edit schedules (task/leave assignments) for their unit only
   - **Change their own password only**

---

## Implementation Plan

**Total:** 26 tasks (Task 0-25), estimated 4-5 days

### Phase 1: Setup & Infrastructure (Tasks 0-3)
- ✅ **Task 0:** Create feature branch `feature/supabase-migration`
- ✅ **Task 1:** Install dependencies (@supabase/supabase-js, xlsx)
- 🔄 **Task 2:** Setup Supabase project (MANUAL - see SUPABASE_SETUP.md)
- 🔄 **Task 3:** Create database schema (MANUAL - run SQL in Supabase Dashboard)

### Phase 2: Core Services (Tasks 4-14)
- **Task 4:** Supabase client initialization
- **Task 5:** Authentication service (signup, login, password management)
- **Task 6:** Soldier repository
- **Task 7:** Task repository
- **Task 8:** Leave request repository
- **Task 9:** Leave assignment repository
- **Task 10:** Task assignment repository
- **Task 11:** Config repository
- **Task 12:** Unit repository
- **Task 13:** Roles service
- **Task 14:** User repository (NEW - for user management)

### Phase 3: Excel & UI (Tasks 15-20)
- **Task 15:** Excel export service
- **Task 16:** Excel import service
- **Task 17:** DataTable component (spreadsheet-like table editor)
- **Task 18:** UserManagement component (super admin panel)
- **Task 19:** ProfileSettings component (change password)
- **Task 20:** SupabaseLoginPage component (email/password login)

### Phase 4: Integration & Migration (Tasks 21-23)
- **Task 21:** Update scheduleService to use Supabase repositories
- **Task 22:** Export script (Google Sheets → JSON)
- **Task 23:** Import script (JSON → Supabase)

### Phase 5: Testing & Deployment (Tasks 24-26)
- **Task 24:** Integration testing
- **Task 25:** Create first super admin user
- **Task 26:** Final testing & deployment

---

## Current Status

### ✅ Completed
1. **Design spec created** (`docs/superpowers/specs/2026-03-30-supabase-migration-design.md`)
   - Complete architecture and requirements
   - Database schema defined
   - User flows documented
   - Risk mitigation plans

2. **Implementation plan created** (`docs/superpowers/plans/2026-03-30-supabase-migration.md`)
   - 26 tasks with full TDD detail
   - 3,844 lines of step-by-step instructions
   - Each task: write test → run (fail) → implement → run (pass) → commit

3. **Documentation created**
   - `SUPABASE_SETUP.md` - Step-by-step manual setup guide
   - `SUPABASE_MIGRATION_CONTEXT.md` - This file (project context)

### 🔄 In Progress
- **Manual Supabase setup** (Tasks 2-3)
  - User needs to create Supabase account/project
  - User needs to run SQL schema in Supabase Dashboard
  - See `SUPABASE_SETUP.md` for detailed instructions

### ⏳ Next Steps
1. **User completes manual setup** (follow SUPABASE_SETUP.md)
2. **Verify setup:**
   - `.env.local` has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   - Supabase Dashboard → Table Editor shows 9 tables
3. **Begin code implementation** (dispatch subagents for Tasks 0-1, 4-26)

---

## Technical Details

### Tech Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth)
- **Libraries:** @supabase/supabase-js, xlsx (Excel operations)
- **Testing:** Vitest, Testing Library

### Key Files Created (After Migration)

**New files:**
```
src/services/supabase/
  ├── supabaseClient.ts          # Initialize Supabase client
  ├── authService.ts              # Email/password auth
  ├── soldierRepository.ts        # Soldier CRUD
  ├── taskRepository.ts           # Task CRUD
  ├── leaveRequestRepository.ts   # Leave request CRUD
  ├── leaveAssignmentRepository.ts # Leave assignment CRUD
  ├── taskAssignmentRepository.ts # Task assignment CRUD
  ├── configRepository.ts         # Config CRUD
  ├── unitRepository.ts           # Unit CRUD
  ├── rolesService.ts             # Roles CRUD
  └── userRepository.ts           # User management (NEW)

src/services/excel/
  ├── excelExport.ts              # Export to .xlsx
  └── excelImport.ts              # Import from .xlsx

src/components/
  ├── DataTable.tsx               # Table editor component
  ├── DataTableCell.tsx           # Editable cell
  ├── ExcelImportExport.tsx       # Import/export buttons
  ├── UserManagement.tsx          # Super admin user panel
  ├── ProfileSettings.tsx         # Password change
  └── SupabaseLoginPage.tsx       # Email/password login

scripts/
  ├── export-sheets-data.ts       # Export Google Sheets → JSON
  └── import-to-supabase.ts       # Import JSON → Supabase

src/models/
  └── User.ts                     # User model (NEW)
```

**Files to delete (after migration):**
```
src/services/googleSheets.ts
src/services/googleSheets.test.ts
src/services/cache.ts
src/services/cache.test.ts
```

**Files to modify:**
```
src/services/scheduleService.ts  # Update imports to Supabase repos
src/components/LoginPage.tsx     # Replace with SupabaseLoginPage
src/components/AppShell.tsx      # Update auth context
src/components/SoldiersPage.tsx  # Use DataTable component
src/components/AdminPanel.tsx    # Add Users tab
package.json                     # Add dependencies
.env.local                       # Add Supabase credentials
```

---

## Business Logic (UNCHANGED)

**All scheduling algorithms remain exactly the same:**
- ✅ `taskScheduler.ts` - Greedy assignment with unit affinity
- ✅ `leaveScheduler.ts` - Manual leave request processing
- ✅ `cyclicalLeaveScheduler.ts` - Auto-generate cyclical leaves
- ✅ `leaveCapacityCalculator.ts` - Role-based capacity checking
- ✅ `taskAvailability.ts` - Availability rules

**Only the data layer changes** (repositories replace Google Sheets API with Supabase queries)

---

## Key Design Decisions

### Why Supabase (vs other options)?
1. **PostgreSQL backend** - Full SQL, transactions, complex queries
2. **Free tier** - 500MB database, unlimited API requests (we need ~20-30MB)
3. **Built-in auth** - Email/password with security best practices
4. **Row-level security** - Fine-grained permissions built into database
5. **Real-time capable** - Can add live collaboration later
6. **Open source** - No vendor lock-in, can self-host if needed

### Why Email/Password (vs Google OAuth)?
1. **Simpler setup** - No Google Cloud Console configuration
2. **Works with any email** - Not just Gmail
3. **Supabase handles security** - Hashing, sessions, tokens automatic
4. **User preference** - Requested by user for easier management

### Why Table Editor UI (vs just Excel)?
1. **Commanders prefer in-app editing** - No context switching
2. **Real-time validation** - Catch errors immediately
3. **Role-based access** - Built into UI (commanders see only their unit)
4. **Excel as fallback** - For bulk operations (50+ changes at once)

---

## Success Criteria

After migration is complete, verify:

**Performance:**
- ✅ Schedule generation: <10 seconds (currently 105s)
- ✅ Page loads: <500ms (currently 1-2s)
- ✅ No rate limit errors (currently frequent 429s)
- ✅ No exponential backoff delays (currently 1-16s)

**Usability:**
- ✅ Commanders edit soldiers in-app without switching tools
- ✅ Bulk edits via Excel export/import work smoothly
- ✅ Super admin can manage user accounts and reset passwords
- ✅ Commanders can change their own passwords

**Reliability:**
- ✅ Multiple commanders work simultaneously without conflicts
- ✅ No stale data issues
- ✅ Data persists correctly across sessions

**Cost:**
- ✅ $0/month on Supabase free tier
- ✅ No Google Cloud Console setup needed
- ✅ No API quota concerns

---

## Risk Mitigation

### Risk 1: Supabase Free Tier Limits
**Limit:** 500MB database, 2GB bandwidth/month

**Current data:** ~20-30MB for first year

**Mitigation:**
- Well under limit (16x headroom)
- Archive old schedules after 2 years
- Upgrade to Pro ($25/mo) if needed

**Verdict:** Safe for 5+ years ✅

### Risk 2: Data Loss During Migration
**Mitigation:**
- Google Sheets stays untouched (original data preserved)
- Migration in feature branch (can revert: `git checkout main`)
- Validation checks before writing
- Manual verification after import

**Verdict:** Zero risk ✅

### Risk 3: Learning Curve
**Mitigation:**
- Table editor looks like Google Sheets (familiar)
- Excel export/import as fallback
- 5-minute training video + PDF guide

**Verdict:** Minimal retraining ✅

---

## For Next Agent/Session

### Prerequisites Before Continuing
1. **Supabase setup complete:**
   - [ ] Supabase account created
   - [ ] Project `shabtazk-production` created
   - [ ] `.env.local` has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   - [ ] Database schema created (9 tables visible in Table Editor)

2. **Git setup:**
   - [ ] Feature branch `feature/supabase-migration` created and checked out
   - [ ] Working directory clean (`git status`)

### How to Continue

**If manual setup is complete:**
```
Agent, please continue the Supabase migration:
1. Read SUPABASE_MIGRATION_CONTEXT.md for full context
2. Read docs/superpowers/plans/2026-03-30-supabase-migration.md for implementation plan
3. Use superpowers:subagent-driven-development to execute Tasks 0-1, 4-26
4. Skip Tasks 2-3 (manual setup already done)
```

**If manual setup is NOT complete:**
```
Agent, please guide me through Supabase setup:
1. Read SUPABASE_SETUP.md
2. Help me complete the manual setup steps
3. Verify setup is correct before proceeding
```

### Important Notes for Next Agent
- ⚠️ **Work in feature branch** `feature/supabase-migration` (NOT main)
- ⚠️ **Follow TDD** for all code tasks (test → implement → commit)
- ⚠️ **Use two-stage review** after each task (spec compliance + code quality)
- ⚠️ **Business logic unchanged** - Only data layer changes
- ⚠️ **Free tier requirement** - Must stay on $0/month
- ⚠️ **Human-editable data** - Table editor UI + Excel export/import essential

---

## References

- **Design Spec:** `docs/superpowers/specs/2026-03-30-supabase-migration-design.md`
- **Implementation Plan:** `docs/superpowers/plans/2026-03-30-supabase-migration.md`
- **Setup Guide:** `SUPABASE_SETUP.md`
- **This Context:** `SUPABASE_MIGRATION_CONTEXT.md`

---

## Questions? Issues?

**Common issues:**
1. **Can't find Supabase credentials** → Check Supabase Dashboard → Settings → API
2. **SQL schema errors** → Make sure you copied the ENTIRE SQL from SUPABASE_SETUP.md
3. **Tables not visible** → Refresh Supabase Dashboard, check Table Editor on left sidebar
4. **Rate limit errors still happening** → Migration not complete yet, still using Google Sheets
5. **Tests failing** → Make sure `.env.local` has correct Supabase credentials

**Need help?**
- Take screenshot of error
- Note which task you're on
- Provide error message
- Agent can troubleshoot
