# Supabase Migration Design

**Date:** 2026-03-30
**Status:** Design Approved
**Estimated Effort:** 4-5 days

---

## Problem Statement

ShabTzak currently uses Google Sheets as its database, which causes significant performance and scalability issues:

- **Rate limiting:** 100 requests/100s per user causes 429 errors and 1-16s exponential backoff delays
- **Slow operations:** Schedule generation takes 105 seconds, reads take 1-2 seconds
- **Write bottlenecks:** Batch writes take 30-40s due to API limits
- **Concurrent user conflicts:** Multiple commanders hit shared rate limits
- **No real-time sync:** Manual refresh required to see others' changes
- **Complex batching logic:** Custom retry/backoff code throughout repositories

**Scale:** Medium deployment (3-5 units, 50-150 soldiers, 5-10 concurrent users)

---

## Goals

1. **Performance:** 20-50x faster operations (schedule gen: 105s → 2-5s)
2. **Free hosting:** Must stay on $0/month tier
3. **Human editable:** Commanders can manually edit data without code
4. **Simple setup:** Limited technical expertise, need easy configuration
5. **User management:** Super admin can manage user accounts and passwords
6. **Bulk editing:** Export/import via Excel for mass updates

---

## Solution: Migrate to Supabase + Table Editor UI

### Architecture Overview

**Current State:**
```
React App → GoogleSheetsService → Google Sheets API → Spreadsheet
              (1-2s reads, 30-40s batch writes)
```

**New State:**
```
React App → SupabaseRepository → Supabase Client → PostgreSQL
              (50-150ms reads, 200-500ms bulk writes)
                ↓
          Excel Export/Import (for bulk edits)
```

### Why Supabase?

- ✅ **PostgreSQL backend:** Full SQL, transactions, complex queries
- ✅ **Free tier:** 500MB database, unlimited API requests, 2GB bandwidth/month
- ✅ **Built-in auth:** Email/password authentication with security best practices
- ✅ **Real-time capable:** Can add live collaboration later
- ✅ **Open source:** No vendor lock-in, can self-host if needed
- ✅ **Simple setup:** Click-and-go project creation
- ✅ **Row-level security:** Fine-grained permissions built into database

---

## Database Schema

### Core Tables

**units**
```sql
CREATE TABLE units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tab_prefix TEXT NOT NULL,
  spreadsheet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**soldiers**
```sql
CREATE TABLE soldiers (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  service_start DATE NOT NULL,
  service_end DATE NOT NULL,
  initial_fairness INT DEFAULT 0,
  current_fairness INT DEFAULT 0,
  status TEXT DEFAULT 'Active',
  hours_worked INT DEFAULT 0,
  weekend_leaves_count INT DEFAULT 0,
  midweek_leaves_count INT DEFAULT 0,
  after_leaves_count INT DEFAULT 0,
  inactive_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soldiers_unit ON soldiers(unit_id);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_soldiers_role ON soldiers(role);
```

**tasks**
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL NOT NULL,
  role_requirements JSONB NOT NULL,
  min_rest_after INT DEFAULT 8,
  is_special BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**leave_requests**
```sql
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  priority INT DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**leave_assignments**
```sql
CREATE TABLE leave_assignments (
  id TEXT PRIMARY KEY,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  is_weekend BOOLEAN DEFAULT FALSE,
  request_id TEXT REFERENCES leave_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_assignments_soldier ON leave_assignments(soldier_id);
CREATE INDEX idx_leave_assignments_date ON leave_assignments(date);
```

**task_assignments**
```sql
CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  assigned_unit_id TEXT REFERENCES units(id),
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_assignments_soldier ON task_assignments(soldier_id);
CREATE INDEX idx_task_assignments_date ON task_assignments(date);
CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
```

**config**
```sql
CREATE TABLE config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  schedule_start_date DATE,
  schedule_end_date DATE,
  leave_ratio_days_in_base INT DEFAULT 10,
  leave_ratio_days_home INT DEFAULT 4,
  leave_base_exit_hour INT DEFAULT 16,
  leave_base_return_hour INT DEFAULT 8,
  min_base_presence_by_role JSONB,
  weekend_days JSONB DEFAULT '["Friday", "Saturday"]',
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**roles**
```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### User Management Tables

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'commander'
  unit_id TEXT REFERENCES units(id),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Note:** Passwords stored in Supabase `auth.users` table (automatic, hashed, secure)

---

## Authentication & Authorization

### Authentication Method: Email + Password

**Why not Google OAuth?**
- Simpler setup (no Google Cloud Console configuration)
- Works with any email domain
- Supabase handles all security automatically

**User Experience:**
1. Sign up: Enter email + password → receive verification email → click link → active
2. Login: Enter email + password → logged in
3. Forgot password: Enter email → receive reset link → set new password

### User Roles & Permissions

**Super Admin**
- View/edit all data across all units
- Manage units, tasks, roles, config
- **View all users** (commanders, admins, super admins)
- **Reset/change passwords** for any user
- Create/delete user accounts

**Admin**
- View/edit all data across all units
- Manage units, tasks, roles, config
- Cannot manage users or passwords

**Commander**
- View/edit soldiers in their unit only
- View/edit leave requests for their unit only
- View/edit schedules (task/leave assignments) for their unit only
- **Change their own password only**

### Password Management

**Commander: Change Own Password**

Location: Settings/Profile screen

```typescript
// Implementation
const { error } = await supabase.auth.updateUser({
  password: newPassword
})
```

UI Flow:
1. Navigate to Profile/Settings
2. Enter current password
3. Enter new password + confirm
4. Click "Update Password"
5. Password changed, notification shown

**Super Admin: Reset User Password**

Location: Admin Panel → Users tab

```typescript
// Implementation (Supabase Admin API)
const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  { password: newPassword }
)
```

UI Flow:
1. Super admin views user list
2. Click "Reset Password" for target user
3. Modal opens, enter new password
4. Optionally email new password to user
5. Click "Reset" → password updated

---

## Table Editor UI Component

### Design Goals

- Feels like Google Sheets (click-to-edit cells)
- Simple for non-technical commanders
- Keyboard navigation (Tab, Enter, arrow keys)
- Copy/paste support
- Inline validation

### Component API

```tsx
<DataTable
  data={soldiers}
  columns={[
    { key: 'id', label: 'ID', editable: false },
    { key: 'firstName', label: 'First Name', editable: true, required: true },
    { key: 'lastName', label: 'Last Name', editable: true, required: true },
    { key: 'role', label: 'Role', editable: true, type: 'select', options: roles },
    { key: 'phone', label: 'Phone', editable: true },
    { key: 'serviceStart', label: 'Service Start', editable: true, type: 'date' },
    { key: 'serviceEnd', label: 'Service End', editable: true, type: 'date' },
    { key: 'status', label: 'Status', editable: true, type: 'select',
      options: ['Active', 'Inactive'] }
  ]}
  onSave={handleSave}
  onDelete={handleDelete}
  onAdd={handleAdd}
/>
```

### Features

- Click cell to edit (inline editing)
- Tab/Enter to move between cells
- "Add Row" button at bottom
- Delete row with confirmation
- Auto-save on blur or Ctrl+S
- Validation errors shown inline (red border)
- Search/filter toolbar at top
- Pagination for large datasets (50 rows per page)
- Export to Excel button
- Import from Excel button

### UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [Table Name]                          [+ Add Row] [Export] [Import]
├─────────────────────────────────────────────────────────────────┤
│ Search: [________]  Filter by: [All ▼]                          │
├────┬───────────┬──────────┬─────────┬──────────┬───────────────┤
│ ID │ First Name│ Last Name│  Role   │  Phone   │ Service Start │
├────┼───────────┼──────────┼─────────┼──────────┼───────────────┤
│ s1 │ [David__] │ [Cohen_] │ Driver▼ │ 050-1234 │ [2024-01-15] │
│ s2 │ Yossi     │ Levi     │ Fighter │ 052-5678 │  2024-02-10   │
│ s3 │ Michael   │ Green    │ Driver  │ 053-9012 │  2024-03-05   │
├────┴───────────┴──────────┴─────────┴──────────┴───────────────┤
│                                             Showing 1-50 of 123 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Access by Role

**Commanders see:**
- Soldiers table (their unit only)
- Leave Requests table (their unit only)
- Task Assignments (scheduled tasks for their unit)
- Leave Assignments (scheduled leaves for their unit)
- Schedule Calendar view (existing UI, their unit only)

**Admins see:**
- All tables (Soldiers, Tasks, Units, Roles, Config)
- All schedules across all units

**Super Admin sees:**
- Everything above
- Users table (manage accounts and passwords)

---

## Excel Export/Import Feature

### Export Flow

**Trigger:** Click "Export to Excel" button on any table

**Process:**
1. Fetch current table data from Supabase
2. Generate `.xlsx` file with proper headers
3. Filename format: `{table}_{unit}_{date}.xlsx` (e.g., `soldiers_unit_alef_2026-03-30.xlsx`)
4. Browser downloads file immediately

**File Format:**
```
| ID | First Name | Last Name | Role    | Phone    | Service Start | Service End | Status |
|----|------------|-----------|---------|----------|---------------|-------------|--------|
| s1 | David      | Cohen     | Driver  | 050-1234 | 2024-01-15    | 2025-01-15  | Active |
| s2 | Yossi      | Levi      | Fighter | 052-5678 | 2024-02-10    | 2025-02-10  | Active |
```

**Implementation:**
```typescript
import * as XLSX from 'xlsx'

function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  XLSX.writeFile(workbook, filename)
}
```

### Import Flow

**Trigger:** Click "Import from Excel" button

**Process:**
1. File picker opens → user selects `.xlsx` file
2. Parse Excel file, extract rows
3. **Validate data:**
   - Required fields present (firstName, lastName, role, etc.)
   - Dates in valid format (YYYY-MM-DD)
   - Roles exist in system
   - No duplicate IDs
   - Foreign keys valid (unit_id, soldier_id, etc.)
4. **Show preview modal:**
   ```
   Ready to import:
   - Add: 15 new records
   - Update: 10 existing records
   - Total: 25 records

   [Cancel] [Confirm Import]
   ```
5. User confirms → batch upsert to Supabase
6. Show success message with counts

**Validation Error Display:**
```
⚠️ Import Issues Found (3 errors):

Row 15: Missing required field "First Name"
Row 23: Invalid date format "32/13/2024" (expected YYYY-MM-DD)
Row 45: Unknown role "Pilot" (valid: Driver, Fighter, Squad leader, Radio operator, Operation room)

Fix these issues in Excel and try again.
```

**Implementation:**
```typescript
import * as XLSX from 'xlsx'

async function importFromExcel(file: File) {
  // Parse file
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(worksheet)

  // Validate
  const errors = validateRows(rows)
  if (errors.length > 0) {
    showValidationErrors(errors)
    return
  }

  // Show preview
  const confirmed = await showImportPreview(rows)
  if (!confirmed) return

  // Batch upsert
  const { data, error } = await supabase
    .from('soldiers')
    .upsert(rows, { onConflict: 'id' })

  if (error) throw error
  showSuccess(`Imported ${rows.length} records`)
}
```

### Use Cases

- Bulk add 50 new soldiers (faster than UI)
- Update phone numbers from external list
- Year-end service date updates
- Backup data locally (periodic exports)
- Share data with external systems

---

## Code Migration Strategy

### File Structure Changes

**New files:**
```
src/services/supabase/
  ├── supabaseClient.ts         # Supabase client initialization
  ├── soldierRepository.ts      # Soldier CRUD operations
  ├── taskRepository.ts         # Task CRUD operations
  ├── leaveRepository.ts        # Leave request/assignment operations
  ├── assignmentRepository.ts   # Task assignment operations
  ├── configRepository.ts       # Config CRUD operations
  ├── userRepository.ts         # User management (NEW)
  └── authService.ts            # Authentication (NEW)

src/services/excel/
  ├── excelExport.ts            # Export tables to xlsx
  └── excelImport.ts            # Import xlsx to Supabase

src/components/
  ├── DataTable.tsx             # Table editor component
  ├── UserManagement.tsx        # Super admin user panel
  ├── ProfileSettings.tsx       # Commander change password
  └── ExcelImportExport.tsx     # Export/import buttons
```

**Files to replace:**
```
src/services/
  ├── googleSheets.ts                    → DELETE (replaced by supabaseClient.ts)
  ├── soldierRepository.ts               → REPLACE (new Supabase version)
  ├── taskRepository.ts                  → REPLACE
  ├── leaveAssignmentRepository.ts       → REPLACE
  ├── taskAssignmentRepository.ts        → REPLACE
  ├── configRepository.ts                → REPLACE
  ├── masterSoldierRepository.ts         → REPLACE
  ├── masterTaskAssignmentRepository.ts  → REPLACE
  ├── masterLeaveAssignmentRepository.ts → REPLACE
```

**Files unchanged:**
```
src/algorithms/
  ├── taskScheduler.ts          # No changes (business logic stays same)
  ├── leaveScheduler.ts         # No changes
  ├── cyclicalLeaveScheduler.ts # No changes
  ├── leaveCapacityCalculator.ts # No changes
  └── taskAvailability.ts       # No changes

src/components/
  ├── ScheduleCalendar.tsx      # No changes (uses repository layer)
  ├── TaskModeCalendar.tsx      # No changes
  ├── AdminDashboard.tsx        # No changes
  └── (all other components)    # No changes
```

### Example Repository Transformation

**Before (Google Sheets):**
```typescript
// src/services/soldierRepository.ts
import { googleSheets } from './googleSheets'

export async function listSoldiers(unitId: string): Promise<Soldier[]> {
  const spreadsheetId = getSpreadsheetIdForUnit(unitId)
  const tabPrefix = getTabPrefixForUnit(unitId)
  const range = `${tabPrefix}!A2:N`

  const rows = await googleSheets.getValues(spreadsheetId, range)
  return rows.map(row => ({
    id: row[0],
    firstName: row[1],
    lastName: row[2],
    role: row[3],
    phone: row[4],
    serviceStart: row[5],
    serviceEnd: row[6],
    initialFairness: parseInt(row[7]),
    currentFairness: parseInt(row[8]),
    status: row[9],
    hoursWorked: parseInt(row[10]),
    weekendLeavesCount: parseInt(row[11]),
    midweekLeavesCount: parseInt(row[12]),
    afterLeavesCount: parseInt(row[13])
  }))
}

export async function createSoldier(soldier: Soldier): Promise<void> {
  const spreadsheetId = getSpreadsheetIdForUnit(soldier.unitId)
  const tabPrefix = getTabPrefixForUnit(soldier.unitId)
  const range = `${tabPrefix}!A:N`

  const row = [
    soldier.id,
    soldier.firstName,
    soldier.lastName,
    soldier.role,
    soldier.phone,
    soldier.serviceStart,
    soldier.serviceEnd,
    soldier.initialFairness,
    soldier.currentFairness,
    soldier.status,
    soldier.hoursWorked,
    soldier.weekendLeavesCount,
    soldier.midweekLeavesCount,
    soldier.afterLeavesCount
  ]

  await googleSheets.appendValues(spreadsheetId, range, [row])
}
```

**After (Supabase):**
```typescript
// src/services/supabase/soldierRepository.ts
import { supabase } from './supabaseClient'

export async function listSoldiers(unitId: string): Promise<Soldier[]> {
  const { data, error } = await supabase
    .from('soldiers')
    .select('*')
    .eq('unit_id', unitId)

  if (error) throw error
  return data
}

export async function createSoldier(soldier: Soldier): Promise<void> {
  const { error } = await supabase
    .from('soldiers')
    .insert(soldier)

  if (error) throw error
}
```

**Key improvements:**
- ✅ Simpler code (no row mapping, no batching logic)
- ✅ Type-safe (Supabase auto-generates TypeScript types)
- ✅ Faster (no network overhead, no rate limiting)
- ✅ No retry logic needed (Supabase handles failures)
- ✅ No cache layer needed (fast enough without it)

### Environment Variables

**Add to `.env.local`:**
```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Keep existing (for migration scripts)
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_API_KEY=...
VITE_SPREADSHEET_ID=...
```

---

## Migration Process

### Phase 1: Setup Supabase (1 hour)

**Step 1: Create Project**
1. Go to https://supabase.com
2. Sign up with email
3. Click "New Project"
4. Enter:
   - Name: `shabtazk-production`
   - Database password: (generate strong password, save securely)
   - Region: Europe - Frankfurt (closest to Israel)
5. Wait 2 minutes for provisioning

**Step 2: Get Credentials**
1. Dashboard → Settings → API
2. Copy:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon/Public key: `eyJhbGc...`
3. Add to `.env.local`

**Step 3: Create Schema**
1. Dashboard → SQL Editor
2. Paste full schema SQL (from earlier section)
3. Click "Run"
4. Verify: Dashboard → Table Editor → see all tables

**Step 4: Configure Auth**
1. Dashboard → Authentication → Settings
2. Enable email provider
3. Configure email templates (optional customization)
4. Set site URL: `https://yourusername.github.io/ShabTzak`

### Phase 2: Data Export & Import (30 minutes)

**Export from Google Sheets:**
```bash
# Create export script
npm run create-export-script

# Run export
npm run export-sheets-data
```

Creates:
```
data-export/
  ├── soldiers.json          (all soldiers from all units)
  ├── tasks.json             (all task definitions)
  ├── leave_requests.json
  ├── leave_assignments.json
  ├── task_assignments.json
  ├── units.json
  ├── config.json
  └── roles.json
```

**Import to Supabase:**
```bash
# Create import script
npm run create-import-script

# Run import
npm run import-to-supabase
```

Output:
```
Importing units...     ████████████ 100% (5/5)
Importing soldiers...  ████████████ 100% (245/245)
Importing tasks...     ████████████ 100% (18/18)
Importing roles...     ████████████ 100% (8/8)
Importing config...    ████████████ 100% (1/1)
Importing leave_requests... ████████████ 100% (132/132)
Importing leave_assignments... ████████████ 100% (587/587)
Importing task_assignments...  ████████████ 100% (1203/1203)

✅ Import complete!
   Total records: 2199
   Errors: 0
```

**Verification:**
1. Dashboard → Table Editor → browse each table
2. Spot-check sample records
3. Verify counts match Google Sheets

### Phase 3: Code Migration (2-3 days)

**Day 1: Repository Layer**
- Install dependencies: `npm install @supabase/supabase-js xlsx`
- Create `supabaseClient.ts`
- Replace all repository files
- Update imports throughout codebase
- Remove `googleSheets.ts` and related files

**Day 2: UI Components**
- Create `DataTable.tsx` component
- Create `ExcelImportExport.tsx` component
- Update existing pages to use DataTable
- Test inline editing, add/delete rows

**Day 3: Auth & User Management**
- Create `authService.ts` (Supabase auth)
- Create `ProfileSettings.tsx` (change password)
- Create `UserManagement.tsx` (super admin panel)
- Update login/signup flow
- Test password reset flow

### Phase 4: Testing (1 day)

**Test Checklist:**

**Authentication:**
- [ ] Sign up with email/password
- [ ] Receive verification email, verify account
- [ ] Login with credentials
- [ ] Logout
- [ ] Forgot password flow (request reset, receive email, set new password)

**Commander Role:**
- [ ] View soldiers table (only their unit)
- [ ] Edit soldier inline
- [ ] Add new soldier
- [ ] Delete soldier (with confirmation)
- [ ] Export soldiers to Excel
- [ ] Edit Excel file, import back
- [ ] View leave requests (only their unit)
- [ ] View task assignments (only their unit)
- [ ] View leave assignments (only their unit)
- [ ] Generate schedule (verify same algorithm results as before)
- [ ] View schedule calendar
- [ ] Change own password in profile settings

**Admin Role:**
- [ ] View all units' data
- [ ] Manage tasks (create, edit, delete)
- [ ] Manage config settings
- [ ] View all schedules
- [ ] Cannot access user management

**Super Admin Role:**
- [ ] All admin capabilities
- [ ] View users table
- [ ] Add new user (commander, admin, super admin)
- [ ] Reset user password
- [ ] View user list with roles and units

**Performance:**
- [ ] Soldier list loads in <500ms
- [ ] Schedule generation completes in <10s
- [ ] No rate limit errors (429)
- [ ] Excel export completes in <1s
- [ ] Excel import with 50 rows completes in <2s

**Multi-user:**
- [ ] Two commanders edit simultaneously (no conflicts)
- [ ] Commander A adds soldier, Commander B refreshes and sees it
- [ ] No blocking/throttling between users

### Phase 5: Deployment (1 hour)

**Step 1: Create Branch**
```bash
git checkout -b feature/supabase-migration
git add .
git commit -m "feat: migrate from Google Sheets to Supabase

- Replace Google Sheets API with Supabase PostgreSQL
- Add table editor UI for in-app data editing
- Add Excel export/import for bulk operations
- Implement email/password authentication
- Add user management (super admin can reset passwords)
- Performance: 20-50x faster (schedule gen 105s → 2-5s)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 2: Deploy**
```bash
npm run build
npm run deploy
```

**Step 3: Create First Super Admin**

In Supabase Dashboard → Authentication → Users:
1. Click "Add user"
2. Email: `your-email@idf.il`
3. Password: (auto-generate, copy it)
4. Confirm password

In SQL Editor:
```sql
INSERT INTO users (id, email, role, full_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your-email@idf.il'),
  'your-email@idf.il',
  'super_admin',
  'Your Name'
);
```

**Step 4: Login & Create Other Users**
1. Login as super admin
2. Navigate to Admin Panel → Users
3. Add commander accounts
4. Add admin accounts
5. Email credentials to each user

**Step 5: Announcement to Team**

Email template:
```
Subject: ShabTzak Database Upgrade - Action Required

Hi team,

We've upgraded ShabTzak to use a new database system that's 20-50x faster.

Key changes:
1. New login: Email + password (no more Google Sign-In)
2. In-app editing: You can edit soldiers directly in the app (like spreadsheets)
3. Bulk editing: Export to Excel, edit, re-import
4. Much faster: Schedule generation now takes 5 seconds instead of 2 minutes

Your login credentials:
Email: [commander-email@idf.il]
Password: [temporary-password]

First login:
1. Go to https://yourusername.github.io/ShabTzak
2. Login with credentials above
3. Go to Profile → Change Password (set your own password)

Questions? Reply to this email.

Training video: [link to 5-minute walkthrough]
Quick start guide: [link to PDF]
```

### Rollback Plan

If critical issues arise:

**Immediate rollback (2 minutes):**
```bash
git checkout main
npm run deploy
```

**Data is safe:**
- Google Sheets still exists (untouched)
- Supabase has copy of data
- Can export from Supabase to Excel anytime

**Troubleshooting period:**
- Keep both systems running in parallel for 1 week
- Monitor for issues
- If Supabase works well → delete Google Sheets API code from main branch
- If issues arise → revert and debug in branch

---

## Performance Comparison

### Before vs After

| Operation | Google Sheets | Supabase | Improvement |
|-----------|--------------|----------|-------------|
| Load 100 soldiers | 1-2 seconds | 50-150ms | **10-20x faster** |
| Add 1 soldier | 500ms-1s | 50ms | **10-20x faster** |
| Update soldier | 500ms-1s | 50ms | **10-20x faster** |
| Load 300 task assignments | 1-2 seconds | 100-200ms | **10-15x faster** |
| Generate full schedule | 105 seconds | 2-5 seconds | **20-50x faster** |
| Export 100 soldiers to Excel | N/A | 200-500ms | ✨ **New feature** |
| Concurrent users | Shared rate limit | Independent | ✨ **Unlimited** |

### Real-World Impact

**Weekly Schedule Generation:**
- Before: Commander waits 1-2 minutes, staring at loading spinner
- After: Commander clicks "Generate" → sees results in 3-5 seconds ✅

**Multiple Commanders Working:**
- Before: Commander A generates schedule → hits rate limit → Commander B's page freezes for 30 seconds
- After: Both commanders work independently, no interference ✅

**Bulk Soldier Updates:**
- Before: Click soldier → wait 1s → edit → save → wait 1s → repeat 50 times = 2-3 minutes
- After: Export → edit in Excel → import → done in 30 seconds ✅

---

## Risk Mitigation

### Risk 1: Supabase Free Tier Limits

**Limit:** 500MB database, 2GB bandwidth/month

**Current data estimate:**
- 250 soldiers × 1KB = 250KB
- 300 task assignments/week × 52 weeks × 1KB = 15MB/year
- Total: ~20-30MB for first year

**Mitigation:**
- You're well under 500MB limit (16x headroom) ✅
- Archive old schedules after 2 years (delete assignments older than 24 months)
- If you grow beyond 500MB → upgrade to Pro ($25/mo) or archive aggressively

**Verdict:** Safe for 5+ years at current scale

### Risk 2: Supabase Service Downtime

**What if Supabase goes down?**

**Mitigation:**
1. **Daily auto-export backup**
   - Cron job exports all data to Google Drive as Excel files
   - Can import to new Supabase project in 10 minutes
2. **Supabase reliability**
   - 99.9% uptime SLA (Pro tier)
   - Built on AWS infrastructure
   - Better than Google Sheets API (which also has outages)
3. **Self-hosting option**
   - Supabase is open source
   - Can deploy to own server if needed

**Verdict:** Lower risk than Google Sheets API ✅

### Risk 3: Learning Curve for Commanders

**What if commanders struggle with new UI?**

**Mitigation:**
1. **Table editor looks like Google Sheets**
   - Same click-to-edit behavior
   - Same keyboard navigation (Tab, Enter)
   - Familiar visual design
2. **Excel export/import as fallback**
   - Commanders comfortable with Excel
   - Can do bulk edits in familiar tool
3. **Training materials**
   - 5-minute video walkthrough
   - PDF quick-start guide
   - Side-by-side comparison: "old way vs new way"

**Verdict:** Minimal retraining needed ✅

### Risk 4: Data Loss During Migration

**What if migration fails and data is corrupted?**

**Mitigation:**
1. **Google Sheets stays untouched**
   - Original data preserved
   - Can revert instantly
2. **Migration branch**
   - Test thoroughly before merging to main
   - Rollback is one command: `git checkout main`
3. **Validation checks**
   - Import script verifies all data before writing
   - Shows diff: "Importing 245 soldiers, 0 errors"
4. **Manual verification**
   - Export from Supabase after import
   - Compare with original Google Sheets export
   - Row-by-row validation

**Verdict:** Zero risk of data loss ✅

### Risk 5: Cost Escalation

**What if free tier isn't enough and costs spiral?**

**Mitigation:**
1. **Free tier is generous**
   - 500MB database (you need <50MB for 5 years)
   - Unlimited API requests
   - 2GB bandwidth/month (you'll use <100MB)
2. **Pricing transparency**
   - If you outgrow free: Pro tier is $25/mo (fixed price)
   - No surprise charges
   - Can set spending alerts
3. **Self-hosting option**
   - Supabase is open source
   - Can self-host on free AWS/Google Cloud VM if needed
4. **PostgreSQL portability**
   - Standard SQL, no vendor lock-in
   - Can migrate to any PostgreSQL host (Azure, DigitalOcean, etc.)

**Verdict:** Cost controlled and predictable ✅

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

## Timeline

| Phase | Duration | Who |
|-------|----------|-----|
| Setup Supabase project | 1 hour | Developer |
| Export current data | 30 minutes | Developer (automated) |
| Code migration | 2-3 days | Developer |
| Testing | 1 day | Developer + Team |
| Deployment | 1 hour | Developer |
| **Total** | **4-5 days** | |

---

## Open Questions

None - design approved and ready for implementation.

---

## Appendices

### Appendix A: Supabase Client Setup

```typescript
// src/services/supabase/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Appendix B: Row-Level Security Policies

```sql
-- Commanders can only see their unit's soldiers
CREATE POLICY "Commanders see own unit soldiers"
ON soldiers FOR SELECT
USING (
  unit_id IN (
    SELECT unit_id FROM users
    WHERE id = auth.uid() AND role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Commanders can only edit their unit's soldiers
CREATE POLICY "Commanders edit own unit soldiers"
ON soldiers FOR UPDATE
USING (
  unit_id IN (
    SELECT unit_id FROM users
    WHERE id = auth.uid() AND role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Only super admins can view users table
CREATE POLICY "Super admins view users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Only super admins can manage users
CREATE POLICY "Super admins manage users"
ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
```

### Appendix C: TypeScript Types (Auto-generated by Supabase)

```typescript
// src/types/database.types.ts (generated by Supabase CLI)
export type Database = {
  public: {
    Tables: {
      soldiers: {
        Row: {
          id: string
          unit_id: string
          first_name: string
          last_name: string
          role: string
          phone: string | null
          service_start: string
          service_end: string
          initial_fairness: number
          current_fairness: number
          status: string
          hours_worked: number
          weekend_leaves_count: number
          midweek_leaves_count: number
          after_leaves_count: number
          inactive_reason: string | null
          created_at: string
        }
        Insert: {
          id: string
          unit_id: string
          first_name: string
          last_name: string
          role: string
          phone?: string | null
          service_start: string
          service_end: string
          initial_fairness?: number
          current_fairness?: number
          status?: string
          hours_worked?: number
          weekend_leaves_count?: number
          midweek_leaves_count?: number
          after_leaves_count?: number
          inactive_reason?: string | null
        }
        Update: {
          id?: string
          unit_id?: string
          first_name?: string
          last_name?: string
          role?: string
          phone?: string | null
          service_start?: string
          service_end?: string
          initial_fairness?: number
          current_fairness?: number
          status?: string
          hours_worked?: number
          weekend_leaves_count?: number
          midweek_leaves_count?: number
          after_leaves_count?: number
          inactive_reason?: string | null
        }
      }
      // ... other tables
    }
  }
}
```

---

## Conclusion

Migrating from Google Sheets to Supabase will deliver:

1. **20-50x performance improvement** (schedule gen: 105s → 2-5s)
2. **Zero cost** (free tier sufficient for years)
3. **Human-editable data** (table editor UI + Excel export/import)
4. **Simple setup** (click-and-go project creation)
5. **User management** (super admin controls accounts and passwords)
6. **Better reliability** (no rate limits, no concurrent user conflicts)

All business logic (scheduling algorithms) remains unchanged. Only the data layer is replaced with a faster, more reliable foundation.

Ready to implement in 4-5 days.
