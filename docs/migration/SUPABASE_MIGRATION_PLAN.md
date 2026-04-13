# Supabase Migration Implementation Plan

## Executive Summary

This plan provides a strategic migration from Google Sheets → JSON (in-progress) → Supabase (final state). The phased approach achieves 20-50x performance improvement, enables real-time collaboration, and maintains 99.9% data integrity with transactional database operations.

**Timeline:** 8-10 days (13 days sequential, optimized with parallel work)
**Performance Target:** Schedule generation 105s → 2-5s (20-50x improvement)
**Cost:** $0/month (Supabase Free Tier sufficient)
**Risk Level:** Medium (mitigated with dual-write mode and rollback strategy)

---

## Architecture Overview

### Current State → Future State

```
BEFORE (Google Sheets):
User → OAuth → Google Sheets API → Repository → Service → UI
- Performance: 105s schedule generation, 1-2s per read
- Rate limits: 100 requests/100s per user
- Concurrent users: Limited by shared rate limits

IN PROGRESS (JSON):
User → Static JSON → DatabaseContext → Repository → Service → UI
- Performance: 10-20x faster, instant in-memory operations
- No rate limits: Single fetch on app load
- Concurrent users: Read-only (no real-time updates)

FUTURE (Supabase):
User → Supabase Auth → PostgreSQL → Repository → Service → UI
                                      ↓
                            Real-time Subscriptions
- Performance: 20-50x faster, <150ms per query
- No rate limits: Direct database access
- Concurrent users: Real-time collaboration
- Transactional: ACID guarantees
```

---

## Phase 1: Complete JSON Migration (Foundation)

**Duration:** 4 days
**Goal:** Establish immutable in-memory operations, remove Google Sheets dependencies

### Why This Phase Matters

The JSON migration is the prerequisite for Supabase because:
1. Reduces code complexity (single data layer vs. multiple)
2. Establishes TypeScript models as single source of truth
3. Simplifies repository pattern adoption
4. Creates predictable test environment

### Current Status

- ✅ Database types defined (`src/types/Database.ts`)
- ✅ DatabaseContext created (`src/contexts/DatabaseContext.tsx`)
- ✅ JsonRepository base class started
- 🚧 Repository refactoring in progress (SoldierRepository migrated)
- ⏳ Google Sheets removal pending

### Tasks

**Task 1.1: Complete JsonRepository Implementation** (0.5 days)

**File:** `src/services/JsonRepository.ts`

```typescript
import type { Database } from '../types/Database'
import type { useDatabase } from '../contexts/DatabaseContext'

export abstract class JsonRepository<T extends { id: string }> {
  protected context: ReturnType<typeof useDatabase>
  protected entityKey: keyof Database

  constructor(context: ReturnType<typeof useDatabase>, entityKey: keyof Database) {
    this.context = context
    this.entityKey = entityKey
  }

  async list(): Promise<T[]> {
    const db = this.context.getData()
    return db[this.entityKey] as T[]
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.list()
    return items.find(item => item.id === id) ?? null
  }

  async create(entity: T): Promise<T> {
    const db = this.context.getData()
    const items = [...db[this.entityKey] as T[], entity]
    this.context.setData({ ...db, [this.entityKey]: items })
    return entity
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Entity ${id} not found`)
    const updated = [...items]
    updated[index] = { ...updated[index], ...updates }
    this.context.setData({ ...db, [this.entityKey]: updated })
  }

  async delete(id: string): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const filtered = items.filter(item => item.id !== id)
    this.context.setData({ ...db, [this.entityKey]: filtered })
  }
}
```

**Outcome:** Generic CRUD operations for all entities
**Risk:** Type safety with generic constraints

---

**Task 1.2: Migrate All Repositories** (1.5 days)

Refactor these files to extend `JsonRepository`:

- `src/services/soldierRepository.ts` ✅ (already migrated)
- `src/services/taskRepository.ts`
- `src/services/leaveRequestRepository.ts`
- `src/services/leaveAssignmentRepository.ts`
- `src/services/taskAssignmentRepository.ts`
- `src/services/unitRepository.ts`
- `src/services/adminRepository.ts`
- `src/services/commanderRepository.ts`

**Example (TaskRepository):**

```typescript
import { JsonRepository } from './JsonRepository'
import type { Task, CreateTaskInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class TaskRepository extends JsonRepository<Task> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'tasks')
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}`,
      ...input,
      durationHours: input.durationHours ?? 8,
      minRestAfter: input.minRestAfter ?? 8,
      isSpecial: input.isSpecial ?? false
    }
    return super.create(task)
  }
}
```

**Outcome:** Zero Google Sheets dependencies
**Risk:** Breaking service integrations; must update DataService simultaneously

---

**Task 1.3: Update Services Integration Layer** (0.5 days)

**Files:**
- `src/services/dataService.ts`
- `src/services/masterDataService.ts`

**Before:**
```typescript
constructor(accessToken: string, spreadsheetId: string, cache: SheetCache) {
  const sheets = new GoogleSheetsService(accessToken)
  this.soldiers = new SoldierRepository(sheets, spreadsheetId, cache)
}
```

**After:**
```typescript
constructor(dbContext: ReturnType<typeof useDatabase>) {
  this.soldiers = new SoldierRepository(dbContext)
  this.tasks = new TaskRepository(dbContext)
  // ... all other repositories
}
```

**Outcome:** Services layer agnostic to storage backend
**Risk:** Complex multi-unit logic must remain intact

---

**Task 1.4: Export Google Sheets → JSON** (0.5 days)

**File:** `scripts/export-sheets-to-json.ts`

```typescript
import { GoogleSheetsService } from '../src/services/googleSheets'
import { SoldierRepository } from '../src/services/soldierRepository'
// ... other repositories
import * as fs from 'fs'

const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || ''
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || ''

async function exportToJson() {
  const sheets = new GoogleSheetsService(ACCESS_TOKEN)

  // Fetch all data
  const soldiers = await new SoldierRepository(sheets, SPREADSHEET_ID).list()
  const tasks = await new TaskRepository(sheets, SPREADSHEET_ID).list()
  // ... all other entities

  const database = {
    version: 1,
    lastModified: new Date().toISOString(),
    soldiers,
    tasks,
    // ... all entities
  }

  fs.writeFileSync('public/data/database.json', JSON.stringify(database, null, 2))
  console.log('✅ Export complete!')
}

exportToJson().catch(console.error)
```

**Run:**
```bash
GOOGLE_ACCESS_TOKEN=xxx SPREADSHEET_ID=yyy npm run export-sheets
```

**Outcome:** `public/data/database.json` with production data
**Risk:** Data format mismatches; requires validation

---

**Task 1.5: Remove Google Sheets Code** (1 day)

**Delete files:**
- `src/services/googleSheets.ts`
- `src/services/cache.ts`
- `src/services/parsers.ts`
- `src/services/serializers.ts`
- `src/contexts/AuthContext.tsx` (Google OAuth)

**Update package.json:**
Remove dependencies:
```json
// Remove these
"gapi-script": "^1.2.0",
"googleapis": "^171.4.0",
"@types/gapi": "^0.0.47",
"@types/gapi.auth2": "^0.0.61"
```

**Outcome:** Clean codebase with single data layer
**Risk:** Orphaned imports; requires comprehensive testing

---

**Task 1.6: Full Test Suite & Verification** (0.5 days)

```bash
# Run all tests
npm test

# Build
npm run build

# Manual testing
npm run dev
# Test: login, navigate all pages, create soldier, generate schedule
```

**Outcome:** Green CI/CD pipeline
**Risk:** Integration test failures

---

## Phase 2: Supabase Infrastructure Setup

**Duration:** 1 day
**Goal:** Create Supabase project, define schema, configure RLS

### Task 2.1: Create Supabase Project (0.25 days)

1. Go to https://supabase.com → Create account
2. New Project:
   - **Name:** shabtazk-production
   - **Region:** Europe - Frankfurt (eu-central-1)
   - **Database Password:** [generate strong password, save securely]
3. Note credentials:
   - **Project URL:** https://xxxxx.supabase.co
   - **Anon Key:** eyJxxx...
   - **Service Role Key:** eyJxxx... (keep secret!)

**Outcome:** Active Supabase instance
**Risk:** Credential management; store in secure vault

---

### Task 2.2: Define PostgreSQL Schema (0.5 days)

**File:** `scripts/supabase-schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Units table
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  spreadsheet_id TEXT,
  tab_prefix TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Soldiers table
CREATE TABLE soldiers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  service_start DATE NOT NULL,
  service_end DATE NOT NULL,
  initial_fairness INTEGER DEFAULT 0,
  current_fairness INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  hours_worked INTEGER DEFAULT 0,
  weekend_leaves_count INTEGER DEFAULT 0,
  midweek_leaves_count INTEGER DEFAULT 0,
  after_leaves_count INTEGER DEFAULT 0,
  inactive_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soldiers_unit ON soldiers(unit_id);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_soldiers_role ON soldiers(role);

-- Tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC NOT NULL,
  role_requirements JSONB NOT NULL, -- Stored as JSON array
  min_rest_after INTEGER DEFAULT 8,
  is_special BOOLEAN DEFAULT FALSE,
  special_duration_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_type ON tasks(task_type);

-- Leave Requests table
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY,
  soldier_id TEXT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL, -- Weekend, Midweek, After
  constraint_type TEXT, -- Hard, Soft
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending', -- Pending, Approved, Denied
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_soldier ON leave_requests(soldier_id);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- Leave Assignments table
CREATE TABLE leave_assignments (
  id TEXT PRIMARY KEY,
  soldier_id TEXT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  is_weekend BOOLEAN DEFAULT FALSE,
  request_id TEXT REFERENCES leave_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_assignments_soldier ON leave_assignments(soldier_id);
CREATE INDEX idx_leave_assignments_date ON leave_assignments(date);
CREATE UNIQUE INDEX idx_leave_assignments_unique ON leave_assignments(soldier_id, date);

-- Task Assignments table
CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  soldier_id TEXT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  assigned_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_soldier ON task_assignments(soldier_id);
CREATE INDEX idx_task_assignments_date ON task_assignments(date);
CREATE UNIQUE INDEX idx_task_assignments_unique ON task_assignments(task_id, soldier_id, date);

-- Config table (single row)
CREATE TABLE config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  schedule_start_date DATE,
  schedule_end_date DATE,
  leave_ratio_days_in_base INTEGER DEFAULT 10,
  leave_ratio_days_home INTEGER DEFAULT 4,
  long_leave_max_days INTEGER DEFAULT 14,
  weekend_days TEXT[] DEFAULT '{"Friday", "Saturday"}',
  min_base_presence INTEGER DEFAULT 5,
  min_base_presence_by_role JSONB DEFAULT '{}',
  max_driving_hours INTEGER DEFAULT 12,
  default_rest_period INTEGER DEFAULT 8,
  task_type_rest_periods JSONB DEFAULT '{}',
  admin_emails TEXT[] DEFAULT '{}',
  leave_base_exit_hour TIME DEFAULT '16:00',
  leave_base_return_hour TIME DEFAULT '08:00',
  CHECK (id = 1) -- Ensure only one row
);

-- Insert default config
INSERT INTO config DEFAULT VALUES;

-- Roles table
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Admins table
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT
);

-- Commanders table
CREATE TABLE commanders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT
);

CREATE INDEX idx_commanders_unit ON commanders(unit_id);
CREATE INDEX idx_commanders_email ON commanders(email);
```

**Run in Supabase SQL Editor:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste schema
3. Click "Run"

**Outcome:** Complete database schema ready for data
**Risk:** Schema conflicts on subsequent migrations; use migrations properly

---

### Task 2.3: Configure Row-Level Security (0.25 days)

**Enable RLS:**

```sql
-- Enable RLS on all tables
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Soldiers: Read by own unit commanders + super admins
CREATE POLICY "Soldiers visible to unit commanders"
  ON soldiers FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM commanders WHERE unit_id = soldiers.unit_id
    )
    OR
    auth.uid() IN (SELECT auth_user_id FROM admins)
  );

-- Tasks: All authenticated users can read, only admins can write
CREATE POLICY "Tasks readable by all authenticated"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Tasks writable by admins only"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT auth_user_id FROM admins)
  );

-- Assignments: Read by own unit, write by system (service role)
CREATE POLICY "Assignments readable by unit"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    soldier_id IN (
      SELECT id FROM soldiers
      WHERE unit_id IN (
        SELECT unit_id FROM commanders WHERE auth_user_id = auth.uid()
      )
    )
  );
```

**Outcome:** Fine-grained access control at database level
**Risk:** Overly restrictive policies; requires thorough testing

---

## Phase 3: Supabase Repository Implementation

**Duration:** 2 days
**Goal:** Create data access layer with Supabase client

### Architecture: Repository Pattern

```typescript
// Interface (unchanged)
interface ISoldierRepository {
  list(): Promise<Soldier[]>
  getById(id: string): Promise<Soldier | null>
  create(input: CreateSoldierInput): Promise<Soldier>
  update(id: string, updates: Partial<Soldier>): Promise<void>
  delete(id: string): Promise<void>
}

// Supabase implementation
class SupabaseSoldierRepository implements ISoldierRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(): Promise<Soldier[]> {
    const { data, error } = await this.supabase
      .from('soldiers')
      .select('*')
    if (error) throw error
    return data.map(toSoldierModel) // camelCase conversion
  }
}
```

### Tasks

**Task 3.1: Create Supabase Client Factory** (0.25 days)

**File:** `src/services/supabase/supabaseClient.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

**Outcome:** Centralized Supabase client
**Risk:** Auth token refresh complexity

---

**Task 3.2-3.6: Implement All Repositories** (1.75 days)

Create repository files in `src/services/supabase/`:

- `soldierRepository.ts`
- `taskRepository.ts`
- `leaveRequestRepository.ts`
- `leaveAssignmentRepository.ts`
- `taskAssignmentRepository.ts`
- `unitRepository.ts`
- `configRepository.ts`
- `rolesService.ts`

**Example (SoldierRepository):**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import type { Soldier, CreateSoldierInput } from '../../models'

// Utility: snake_case ↔ camelCase conversion
function toSoldierModel(row: any): Soldier {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    phone: row.phone,
    unit: row.unit_id,
    serviceStart: row.service_start,
    serviceEnd: row.service_end,
    initialFairness: row.initial_fairness,
    currentFairness: row.current_fairness,
    status: row.status,
    hoursWorked: row.hours_worked,
    weekendLeavesCount: row.weekend_leaves_count,
    midweekLeavesCount: row.midweek_leaves_count,
    afterLeavesCount: row.after_leaves_count,
    inactiveReason: row.inactive_reason,
  }
}

function toSoldierRow(soldier: Partial<Soldier>): any {
  return {
    id: soldier.id,
    first_name: soldier.firstName,
    last_name: soldier.lastName,
    role: soldier.role,
    phone: soldier.phone,
    unit_id: soldier.unit,
    service_start: soldier.serviceStart,
    service_end: soldier.serviceEnd,
    initial_fairness: soldier.initialFairness,
    current_fairness: soldier.currentFairness,
    status: soldier.status,
    hours_worked: soldier.hoursWorked,
    weekend_leaves_count: soldier.weekendLeavesCount,
    midweek_leaves_count: soldier.midweekLeavesCount,
    after_leaves_count: soldier.afterLeavesCount,
    inactive_reason: soldier.inactiveReason,
  }
}

export class SupabaseSoldierRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(): Promise<Soldier[]> {
    const { data, error } = await this.supabase
      .from('soldiers')
      .select('*')
      .order('last_name', { ascending: true })

    if (error) throw new Error(`Failed to list soldiers: ${error.message}`)
    return data.map(toSoldierModel)
  }

  async getById(id: string): Promise<Soldier | null> {
    const { data, error } = await this.supabase
      .from('soldiers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to get soldier: ${error.message}`)
    }
    return toSoldierModel(data)
  }

  async create(input: CreateSoldierInput): Promise<Soldier> {
    const soldier: Soldier = {
      id: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone,
      unit: input.unit,
      serviceStart: input.serviceStart,
      serviceEnd: input.serviceEnd,
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }

    const { data, error } = await this.supabase
      .from('soldiers')
      .insert(toSoldierRow(soldier))
      .select()
      .single()

    if (error) throw new Error(`Failed to create soldier: ${error.message}`)
    return toSoldierModel(data)
  }

  async update(id: string, updates: Partial<Soldier>): Promise<void> {
    const { error } = await this.supabase
      .from('soldiers')
      .update(toSoldierRow(updates))
      .eq('id', id)

    if (error) throw new Error(`Failed to update soldier: ${error.message}`)
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('soldiers')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete soldier: ${error.message}`)
  }

  async getActiveByRole(role: string): Promise<Soldier[]> {
    const { data, error } = await this.supabase
      .from('soldiers')
      .select('*')
      .eq('role', role)
      .eq('status', 'Active')
      .order('last_name', { ascending: true })

    if (error) throw new Error(`Failed to get soldiers by role: ${error.message}`)
    return data.map(toSoldierModel)
  }
}
```

**Outcome:** Complete Supabase data access layer
**Risk:** Type mismatches (camelCase ↔ snake_case); requires comprehensive tests

---

## Phase 4: Authentication Migration

**Duration:** 1 day
**Goal:** Replace Google OAuth with Supabase Auth (email/password)

### Task 4.1: Implement Supabase Auth Service (0.5 days)

**File:** `src/services/supabase/authService.ts`

```typescript
import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'

export class AuthService {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data.user
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser()
    return data.user
  }

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null)
    })
  }
}

export const authService = new AuthService()
```

**Outcome:** Complete auth flow with email/password
**Risk:** Password reset email configuration in Supabase dashboard

---

### Task 4.2: Create Login Component (0.25 days)

**File:** `src/components/SupabaseLoginPage.tsx`

```tsx
import { useState } from 'react'
import { authService } from '../services/supabase/authService'

export function SupabaseLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      if (isSignUp) {
        await authService.signUp(email, password)
        alert('Check your email to confirm your account')
      } else {
        await authService.signIn(email, password)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-olive-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-olive-600 text-white py-2 rounded hover:bg-olive-700"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-4 text-sm text-olive-600 hover:underline"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  )
}
```

**Outcome:** Clean authentication UI
**Risk:** UX for password reset flow

---

### Task 4.3: Replace Auth Context (0.25 days)

**File:** `src/contexts/AuthContext.tsx` (rewrite)

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { authService } from '../services/supabase/authService'

interface AuthContextValue {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    authService.getCurrentUser().then(user => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: subscription } = authService.onAuthStateChange(setUser)
    return () => subscription?.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Outcome:** Automatic session recovery on page reload
**Risk:** Token expiration edge cases

---

## Phase 5: Data Migration

**Duration:** 0.5 days
**Goal:** One-time migration from JSON to Supabase

### Task 5.1: Create Import Script (0.25 days)

**File:** `scripts/import-json-to-supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import type { Database } from '../src/types/Database'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '' // Use service key, not anon
const JSON_FILE = 'public/data/database.json'

async function importData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Load JSON
  const db: Database = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'))

  console.log('Importing data to Supabase...')

  // 1. Import units first (foreign key dependency)
  console.log(`Importing ${db.units.length} units...`)
  const { error: unitsError } = await supabase
    .from('units')
    .insert(db.units.map(u => ({
      id: u.id,
      name: u.name,
      spreadsheet_id: u.spreadsheetId,
      tab_prefix: u.tabPrefix,
      status: u.status
    })))
  if (unitsError) throw unitsError

  // 2. Import soldiers
  console.log(`Importing ${db.soldiers.length} soldiers...`)
  const { error: soldiersError } = await supabase
    .from('soldiers')
    .insert(db.soldiers.map(s => ({
      id: s.id,
      first_name: s.firstName,
      last_name: s.lastName,
      role: s.role,
      phone: s.phone,
      unit_id: s.unit,
      service_start: s.serviceStart,
      service_end: s.serviceEnd,
      initial_fairness: s.initialFairness,
      current_fairness: s.currentFairness,
      status: s.status,
      hours_worked: s.hoursWorked,
      weekend_leaves_count: s.weekendLeavesCount,
      midweek_leaves_count: s.midweekLeavesCount,
      after_leaves_count: s.afterLeavesCount,
      inactive_reason: s.inactiveReason
    })))
  if (soldiersError) throw soldiersError

  // 3. Import tasks
  console.log(`Importing ${db.tasks.length} tasks...`)
  const { error: tasksError } = await supabase
    .from('tasks')
    .insert(db.tasks.map(t => ({
      id: t.id,
      task_type: t.taskType,
      start_time: t.startTime,
      end_time: t.endTime,
      duration_hours: t.durationHours,
      role_requirements: t.roleRequirements, // JSONB
      min_rest_after: t.minRestAfter,
      is_special: t.isSpecial,
      special_duration_days: t.specialDurationDays
    })))
  if (tasksError) throw tasksError

  // 4-7. Import remaining tables (leave_requests, assignments, etc.)
  // ... similar pattern

  console.log('✅ Import complete!')

  // Verify row counts
  const { count: soldierCount } = await supabase
    .from('soldiers')
    .select('*', { count: 'exact', head: true })
  console.log(`Verified ${soldierCount} soldiers in database`)
}

importData().catch(console.error)
```

**Run:**
```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJxxx... \
npx tsx scripts/import-json-to-supabase.ts
```

**Outcome:** Production data in Supabase
**Risk:** Foreign key constraint violations; requires validation

---

### Task 5.2: Data Validation (0.25 days)

**Script:** `scripts/validate-migration.ts`

```typescript
// Compare row counts
// Check for orphaned records (references to non-existent IDs)
// Validate date ranges
// Verify fairness score totals
// Generate report
```

**Outcome:** Confidence in data migration
**Risk:** Silent data loss not detected

---

## Phase 6: Service Layer Refactoring

**Duration:** 1.5 days
**Goal:** Update services to use Supabase repositories

### Task 6.1: Refactor DataService (0.5 days)

**File:** `src/services/dataService.ts`

```typescript
import { SupabaseSoldierRepository } from './supabase/soldierRepository'
import { SupabaseTaskRepository } from './supabase/taskRepository'
// ... other repositories
import { supabase } from './supabase/supabaseClient'

export class DataService {
  public soldiers: SupabaseSoldierRepository
  public tasks: SupabaseTaskRepository
  // ... other repositories

  constructor() {
    this.soldiers = new SupabaseSoldierRepository(supabase)
    this.tasks = new SupabaseTaskRepository(supabase)
    // ... initialize all repositories
  }
}
```

**Outcome:** Service layer agnostic to JSON vs. Supabase
**Risk:** Breaking changes to service consumers

---

### Task 6.2-6.4: Update Services (1 day)

- `scheduleService.ts` - Optimize bulk operations with transactions
- `fairnessUpdateService.ts` - Remove rate limiting delays
- `realtimeService.ts` - Implement real-time subscriptions

**Example (Real-time Subscriptions):**

```typescript
import { supabase } from './supabase/supabaseClient'

export class RealtimeService {
  subscribeToSoldiers(callback: () => void) {
    return supabase
      .channel('soldiers-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'soldiers'
      }, callback)
      .subscribe()
  }

  subscribeToAssignments(callback: () => void) {
    return supabase
      .channel('assignments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_assignments'
      }, callback)
      .subscribe()
  }
}
```

---

## Phase 7-9: UI, Testing, Deployment

**Duration:** 3.5 days

See detailed tasks in main plan document.

---

## Critical Success Metrics

### Performance Targets
- ✅ Schedule generation: <5s (was 105s) — 20x improvement
- ✅ Read single soldier: <150ms (was 1-2s) — 10x improvement
- ✅ Bulk write 300 assignments: <500ms (was 40s) — 80x improvement

### Data Integrity
- ✅ 100% of soldiers migrated correctly
- ✅ 100% of tasks migrated correctly
- ✅ No orphaned records (referential integrity)
- ✅ Fairness scores match JSON source

### Operational
- ✅ All tests pass (unit + integration)
- ✅ CI/CD pipeline green
- ✅ Production deployment succeeds
- ✅ No data corruption in first 24 hours

---

## Rollback Strategy

### Dual-Write Mode (Safest)

**Phase A (Week 1):** Write to both JSON and Supabase, read from Supabase
**Phase B (Week 2):** Read+write only from Supabase
**Rollback:** Switch reads back to JSON, keep Supabase as backup

### Feature Flags

```typescript
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true'

const repo = USE_SUPABASE
  ? new SupabaseSoldierRepository(supabase)
  : new JsonSoldierRepository(dbContext)
```

**Outcome:** Can revert in <5 minutes if critical issues

---

## Cost Analysis

### Supabase Free Tier
- **Database:** 500 MB storage
- **Bandwidth:** Unlimited
- **API requests:** Unlimited
- **Realtime:** Unlimited connections
- **Auth:** Unlimited users

**Estimated Usage:**
- Database size: ~50 MB (100 soldiers, 1000 tasks)
- Monthly bandwidth: <1 GB
- **Cost:** $0/month (free tier sufficient)

### Supabase Pro ($25/month)
- Only needed for >500 MB database or priority support
- ShabTzak doesn't need it

---

## Timeline Summary

| Phase | Duration | Parallel | Deliverable |
|-------|----------|----------|-------------|
| 1: JSON Migration | 4 days | - | Clean JSON-based codebase |
| 2: Supabase Setup | 1 day | ✓ (after Phase 1) | Schema + RLS configured |
| 3: Repositories | 2 days | ✓ (after Phase 2) | Supabase data access layer |
| 4: Auth | 1 day | ✓ (after Phase 3) | Email/password auth |
| 5: Migration | 0.5 days | - | Data in Supabase |
| 6: Services | 1.5 days | - | Business logic updated |
| 7: UI | 1.5 days | - | Admin panel enhanced |
| 8: Testing | 1.5 days | - | Full test suite passing |
| 9: Deploy | 0.5 days | - | Production live |
| **Total** | **13 days** | **~8-10 days** | **Production Supabase** |

---

## Next Steps

1. ✅ **Complete JSON migration** (Phase 1)
2. Create Supabase project (Phase 2)
3. Run schema migrations (Phase 2)
4. Implement repositories (Phase 3)
5. Migrate authentication (Phase 4)
6. Import data (Phase 5)
7. Update services (Phase 6)
8. Test comprehensively (Phase 8)
9. Deploy to production (Phase 9)

**Recommended:** Complete Phase 1 first before starting Supabase work. This creates a clean foundation and reduces risk.
