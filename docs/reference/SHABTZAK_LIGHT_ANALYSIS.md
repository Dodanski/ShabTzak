# Shabtzak_light Reference Implementation Analysis

This document provides a comprehensive analysis of the Shabtzak_light reference implementation, documenting its Supabase integration, Vercel deployment, and architectural patterns for use in migrating Shabtzak_full.

**Source:** `/home/e173165/testDir/ShabTzak/Shabtzak_light`
**Analysis Date:** 2026-04-12
**Status:** Production-ready reference implementation

---

## Executive Summary

Shabtzak_light is a **production-ready** IDF scheduling system built with:
- **Database:** PostgreSQL via Supabase (21 tables, full RLS)
- **Framework:** Next.js 16 (App Router) with TypeScript
- **Deployment:** Vercel (automatic deployments from Git)
- **Auth:** Supabase Auth (email/password)
- **UI:** Mobile-first, Hebrew RTL, dark mode
- **Cost:** $0/month (Free tiers sufficient)

**Key Metrics:**
- 21 database tables with multi-tenant isolation
- 470+ Hebrew UI strings (fully localized)
- Complete fairness algorithm with transparent scoring
- One-click deployment (setup time: 40-50 minutes)

---

## 1. Supabase Integration

### 1.1 Environment Variables

**File:** `.env.local.example`

```env
# Supabase Core
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # Server-side only (kept secret)

# Optional Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BJ8xXy...
VAPID_PRIVATE_KEY=Ld9pQ...
VAPID_SUBJECT=mailto:your@email.com
```

### 1.2 Client Initialization

**Browser Client (Client Components):**
```typescript
// File: src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server Client (API Routes & Server Components):**
```typescript
// File: src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Ignore in Server Components */ }
        },
      },
    }
  )
}
```

**Service Role Client (Bypass RLS):**
```typescript
// File: src/app/api/register/route.ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS
)
```

### 1.3 Authentication Middleware

**File:** `src/middleware.ts`

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Protected Routes:**
- All routes require authentication EXCEPT:
  - `/` (login page)
  - `/register` (registration)
  - `/shared` (password-protected public view)

---

## 2. Database Schema

### 2.1 Core Tables (21 Total)

**Multi-Tenant Architecture:**
- All tables scoped by `platoon_id` (UUID)
- Row Level Security (RLS) enforces isolation
- Owner-only, member, or public access patterns

**Key Tables:**

| Table | Purpose | RLS Pattern |
|-------|---------|-------------|
| `platoon` | Workspace/organization | Owner only |
| `soldier` | Service members | Platoon members |
| `position` | Guard posts/roles | Platoon members |
| `assignment` | Soldier → Position at time | Owner + assigned soldiers |
| `fairness_ledger` | Points tracking | Owner + soldier |
| `leave` | Time-off periods | Owner + soldier |
| `swap_request` | Shift swap workflow | Owner + involved soldiers |
| `audit_log` | Change tracking | Owner only |
| `holiday_cache` | Jewish calendar | Public (all can read) |
| `schedule_version` | History snapshots | Owner only |

### 2.2 Complete Schema

**File:** `ALL_MIGRATIONS_COMBINED.sql` (689 lines)

```sql
-- Example: Soldiers table
CREATE TABLE soldier (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platoon_id UUID NOT NULL REFERENCES platoon(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  personal_number TEXT,
  role TEXT,
  unit_id UUID REFERENCES unit(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active',
  special_case TEXT,
  excluded_positions TEXT[] DEFAULT '{}',
  qualifications TEXT[] DEFAULT '{}',
  UNIQUE(platoon_id, personal_number)
);

-- RLS Policies
ALTER TABLE soldier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platoon members can read soldiers"
  ON soldier FOR SELECT
  USING (
    platoon_id IN (SELECT id FROM platoon WHERE owner_id = auth.uid())
  );
```

### 2.3 Key Indexes

```sql
-- Performance indexes (from migrations)
CREATE INDEX idx_soldier_platoon ON soldier(platoon_id);
CREATE INDEX idx_assignment_platoon_date ON assignment(platoon_id, date);
CREATE INDEX idx_assignment_soldier ON assignment(soldier_id, date);
CREATE INDEX idx_fairness_ledger_soldier ON fairness_ledger(soldier_id, date);
```

### 2.4 JSONB Fields

```sql
-- Flexible data structures
time_block_template.blocks JSONB  -- Array of time blocks
soldier.excluded_positions TEXT[]  -- Array of position UUIDs
schedule_version.snapshot JSONB   -- Full assignment state
```

---

## 3. Query Patterns

### 3.1 Basic Query (List Soldiers)

```typescript
// File: src/app/soldiers/page.tsx
const { data, error } = await supabase
  .from('soldier')
  .select('*')
  .eq('platoon_id', platoonId)
  .order('last_name')
```

### 3.2 Query with Joins (Schedule View)

```typescript
// File: src/app/schedule/new/page.tsx
const { data, error } = await supabase
  .from('assignment')
  .select(`
    *,
    soldier:soldier_id(id, first_name, last_name),
    position:position_id(id, name, difficulty_rating)
  `)
  .eq('platoon_id', platoonId)
  .eq('date', date)
```

### 3.3 Insert with Nested Select

```typescript
// File: src/app/schedule/new/page.tsx
const { data, error } = await supabase
  .from('assignment')
  .insert({
    platoon_id: platoonId,
    soldier_id: soldierId,
    position_id: positionId,
    date,
    start_time: block.start,
    end_time: block.end,
    status: 'draft',
  })
  .select(`
    *,
    soldier:soldier_id(id, first_name, last_name),
    position:position_id(id, name, difficulty_rating)
  `)
  .single()
```

### 3.4 Custom Hook (usePlatoonId)

```typescript
// File: src/lib/supabase/hooks.ts
export function usePlatoonId() {
  const [platoonId, setPlatoonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('platoon')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
      if (data) setPlatoonId(data.id)
      setLoading(false)
    }
    fetch()
  }, [])

  return { platoonId, loading }
}
```

---

## 4. Authentication Flow

### 4.1 Registration

**File:** `src/app/register/page.tsx`

```typescript
async function handleRegister(e: React.FormEvent) {
  e.preventDefault()

  // 1. Create auth user (Supabase Auth)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  })

  if (authError || !authData.user) {
    setError(authError?.message)
    return
  }

  // 2. Create platoon via API route (uses service role to bypass RLS)
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: authData.user.id, fullName, role }),
  })

  if (!res.ok) {
    setError('Failed to create workspace')
    return
  }

  router.push('/setup')
}
```

**API Route (Service Role):**

```typescript
// File: src/app/api/register/route.ts
export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS
  )

  const { userId, fullName, role } = await request.json()
  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data, error } = await supabaseAdmin
    .from('platoon')
    .insert({
      name: '',
      owner_id: userId,
      join_code: joinCode,
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

### 4.2 Login

**File:** `src/app/page.tsx`

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})

if (error) {
  setError('Invalid email or password')
  return
}

router.push('/dashboard')
```

---

## 5. Fairness Algorithm

### 5.1 Points Calculation

**Formula:**
```
points = hours × difficulty_multiplier × time_slot_multiplier × (1 + consecutive_penalty)
```

**File:** `src/lib/fairness/calculator.ts`

```typescript
export function calculatePoints(
  hours: number,
  difficulty: number,
  timeSlotMultiplier: number,
  consecutivePenalty: number = 0
): number {
  const difficultyMultiplier = getDifficultyMultiplier(difficulty)
  return hours * difficultyMultiplier * timeSlotMultiplier * (1 + consecutivePenalty)
}
```

### 5.2 Difficulty Multiplier

**Scale:** 1 (easy) → 5 (very hard)

```typescript
// File: src/lib/fairness/multipliers.ts
const DIFFICULTY_MULTIPLIERS = {
  1: 1.0,   // Easy
  2: 1.5,
  3: 2.0,   // Medium
  4: 2.5,   // Hard
  5: 3.0    // Very hard
}
```

### 5.3 Time Slot Multiplier

**Priority:** custom > holiday > shabbat+night > night > shabbat > weekday

```typescript
// File: src/lib/fairness/multipliers.ts
export function getTimeSlotMultiplier(
  date: string,
  startTime: string,
  endTime: string,
  holidays: Map<string, { isYomTov: boolean; isShabbat: boolean }>,
  customOverrides: Map<string, number>
): number {
  // 1. Custom override (highest priority)
  if (customOverrides.has(date)) {
    return customOverrides.get(date)!
  }

  // 2. Holiday
  const holiday = holidays.get(date)
  if (holiday?.isYomTov) return 2.5

  // 3. Shabbat + Night (18:00 Friday - 06:00 Sunday)
  const isShabbat = holiday?.isShabbat
  const isNight = startTime >= '22:00' || endTime <= '06:00'
  if (isShabbat && isNight) return 2.0

  // 4. Night only
  if (isNight) return 1.8

  // 5. Shabbat only
  if (isShabbat) return 1.5

  // 6. Weekday
  return 1.0
}
```

### 5.4 Consecutive Hard Penalty

```typescript
// +50% for 2+ difficulty≥4 shifts in a row
if (currentShiftDifficulty >= 4 && previousShiftWasHard) {
  consecutivePenalty = 0.5
}
```

### 5.5 Ranking Algorithm

```typescript
// File: src/lib/fairness/calculator.ts
export function rankSoldiers(allEntries: FairnessEntry[]): SoldierScore[] {
  // Group by soldier_id
  const bySoldier = new Map<string, FairnessEntry[]>()
  allEntries.forEach((e) => {
    const list = bySoldier.get(e.soldier_id) || []
    list.push(e)
    bySoldier.set(e.soldier_id, list)
  })

  // Calculate totals
  const scores = Array.from(bySoldier.entries()).map(([soldier_id, entries]) => ({
    soldier_id,
    total_points: getTotalPoints(entries),
    total_hours: entries.reduce((sum, e) => sum + e.hours, 0),
    assignment_count: entries.length,
  }))

  // Sort by points ascending (lowest = should get next assignment)
  return scores.sort((a, b) => a.total_points - b.total_points)
}
```

---

## 6. Vercel Deployment

### 6.1 Configuration

**File:** `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Minimal config - Vercel handles the rest
}

export default nextConfig
```

**No vercel.json needed** - Next.js auto-configuration works out of the box.

### 6.2 Deployment Workflow

1. **Push to GitHub**
2. **Connect repo in Vercel Dashboard:**
   - Go to vercel.com/new
   - Import GitHub repository
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

3. **Configure Environment Variables:**
   - Add in Vercel Project Settings → Environment Variables
   - Apply to all environments (Production, Preview, Development)

4. **Deploy:**
   - Automatic on every `git push origin main`
   - Preview deployments on every PR

### 6.3 Required Environment Variables

```
Production Environment Variables (in Vercel Dashboard):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Optional (for push notifications):
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT
```

### 6.4 Production Optimizations

**Root Layout:**
```typescript
// File: src/app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body>
        {children}
        <SpeedInsights />  {/* Vercel performance monitoring */}
      </body>
    </html>
  )
}
```

---

## 7. Next.js App Router Structure

### 7.1 File Organization

```
src/app/
├── layout.tsx              # Root layout (RTL, Hebrew, dark)
├── page.tsx                # Login page
├── register/
│   └── page.tsx            # Registration
├── setup/
│   └── page.tsx            # Platoon setup wizard
├── dashboard/
│   └── page.tsx            # Main dashboard
├── schedule/
│   ├── page.tsx            # View schedules
│   ├── new/
│   │   └── page.tsx        # Create schedule
│   └── [date]/
│       └── page.tsx        # Edit specific date
├── soldiers/
│   ├── page.tsx            # List soldiers
│   ├── new/
│   │   └── page.tsx        # Add soldier
│   └── [id]/
│       └── page.tsx        # Soldier profile
├── positions/
│   └── page.tsx            # List positions
├── fairness/
│   └── page.tsx            # Fairness dashboard
├── leave/
│   └── page.tsx            # Leave management
├── settings/
│   └── page.tsx            # Platoon settings
└── api/
    ├── register/
    │   └── route.ts        # Create platoon (service role)
    ├── holidays/
    │   └── route.ts        # Jewish holidays
    └── notifications/
        └── push/
            └── route.ts    # Send push notifications
```

### 7.2 Key Patterns

**Server Components (Default):**
```typescript
// No 'use client' directive = Server Component
// Can fetch data directly, no useEffect needed
export default async function SoldiersPage() {
  const supabase = await createClient() // Server client
  const { data } = await supabase.from('soldier').select('*')
  return <div>{/* Render soldiers */}</div>
}
```

**Client Components (Interactive):**
```typescript
'use client'  // Required for useState, useEffect, event handlers

export default function InteractiveForm() {
  const [value, setValue] = useState('')
  const supabase = createClient() // Browser client

  const handleSubmit = async () => {
    await supabase.from('soldier').insert({ name: value })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## 8. Hebrew & RTL Implementation

### 8.1 String Management

**All UI strings in single file:**

**File:** `src/locale/he.ts` (470+ lines)

```typescript
const he = {
  app: {
    name: 'שבצ\'ק',
    tagline: 'שבצ"ק הוגן. פשוט.',
  },
  auth: {
    login: 'כניסה',
    register: 'הרשמה',
    email: 'אימייל',
    password: 'סיסמה',
    loginError: 'אימייל או סיסמה שגויים',
  },
  soldiers: {
    title: 'חיילים',
    addSoldier: 'הוסף חייל',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    // ... hundreds more
  },
  // ... all categories
}

export default he
```

**Usage:**
```typescript
import he from '@/locale/he'

<button>{he.soldiers.addSoldier}</button>
```

### 8.2 RTL Configuration

```typescript
// File: src/app/layout.tsx
<html lang="he" dir="rtl" className="dark">
  <body className={`${heebo.variable} font-sans`}>
    {children}
  </body>
</html>
```

### 8.3 RTL-Aware Components

**Flex direction auto-reverses:**
```tsx
<div className="flex items-center gap-4">
  <Icon />  {/* Appears on right in RTL */}
  <Text />  {/* Appears on left in RTL */}
</div>
```

**Force LTR for specific fields:**
```tsx
<input
  type="email"
  dir="ltr"  // Force LTR for email/password
  className="..."
/>
```

---

## 9. Comparison: Shabtzak_light vs Shabtzak_full

### 9.1 Data Storage

| Aspect | Shabtzak_light (Supabase) | Shabtzak_full (Google Sheets) |
|--------|---------------------------|--------------------------------|
| Storage | PostgreSQL + RLS | Spreadsheet cells |
| Multi-Tenancy | Automatic (per platoon) | Manual workbooks |
| Data Integrity | UNIQUE, FK constraints | Manual validation |
| Concurrency | Built-in | Manual (WhatsApp coordination) |
| Version History | schedule_version table | Sheet revision history |
| Audit Trail | Full audit_log table | None |

### 9.2 Performance

| Operation | Shabtzak_light | Shabtzak_full |
|-----------|----------------|----------------|
| List 100 soldiers | <150ms | 1-2s (API call) |
| Create assignment | <100ms | 500ms-1s (rate limited) |
| Bulk 300 assignments | <500ms | 30-40s (batched API) |
| Schedule generation | ~2-5s | ~105s |

### 9.3 Functionality

| Feature | Shabtzak_light | Shabtzak_full |
|---------|----------------|----------------|
| Fairness Algorithm | Deterministic ledger | Manual calculations |
| Auto-Fill | Greedy algorithm | Manual/formulas |
| Swap Requests | Dedicated workflow | Manual |
| Leave Management | leave table + rotation groups | Separate sheet |
| Real-Time Updates | Polling (future: subscriptions) | Manual refresh |
| Push Notifications | Web push via VAPID | None |

---

## 10. Migration Path: Google Sheets → Supabase

### 10.1 Data Export

**From Shabtzak_full:**
1. Export soldiers from Google Sheets → CSV
2. Export positions → CSV
3. Export historical assignments → CSV
4. Export fairness scores → CSV
5. Export leave data → CSV

### 10.2 Data Import

**To Shabtzak_light:**
1. Import soldiers CSV → `soldier` table
2. Import positions CSV → `position` table
3. Import assignments CSV → `assignment` table
4. Recalculate fairness → `fairness_ledger` table
5. Import leave CSV → `leave` table

### 10.3 Transformation Script

```typescript
// scripts/migrate-sheets-to-supabase.ts
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrate() {
  // 1. Load JSON from Google Sheets export
  const data = JSON.parse(fs.readFileSync('export.json', 'utf-8'))

  // 2. Transform soldiers (camelCase → snake_case)
  const soldiers = data.soldiers.map(s => ({
    id: s.id,
    platoon_id: PLATOON_ID,
    first_name: s.firstName,
    last_name: s.lastName,
    role: s.role,
    // ... all fields
  }))

  // 3. Insert in batches
  const { error } = await supabase.from('soldier').insert(soldiers)
  if (error) throw error

  // 4. Repeat for all tables
  // ...

  console.log('✅ Migration complete')
}

migrate().catch(console.error)
```

---

## 11. Key Takeaways for Shabtzak_full Migration

### 11.1 What to Adopt

✅ **Database Schema:** 21-table structure with RLS
✅ **Auth Flow:** Registration → Platoon creation via service role
✅ **Query Patterns:** Supabase client with nested selects
✅ **Fairness Algorithm:** Deterministic scoring with ledger
✅ **Deployment:** Vercel auto-deployments from Git
✅ **Localization:** Single he.ts file with 470+ strings

### 11.2 What to Avoid

❌ **Don't hardcode Hebrew strings** → Use localization file
❌ **Don't forget RLS policies** → Every table needs isolation
❌ **Don't use realtime initially** → Start with polling
❌ **Don't store times in local timezone** → Always UTC in DB
❌ **Don't rely on Google Sheets API** → Move to deterministic logic

### 11.3 Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Supabase setup | 20 min | Project + migrations |
| Vercel deployment | 15 min | Auto-deploy configured |
| Data migration | 1-2 hours | Historical data imported |
| Repository refactor | 2 days | Supabase repos implemented |
| Auth migration | 1 day | Email/password auth |
| Testing | 1-2 days | Full test suite passing |
| **Total** | **4-5 days** | **Production ready** |

---

## 12. Critical Files Reference

| What | File Path | Purpose |
|------|-----------|---------|
| Supabase browser client | `/src/lib/supabase/client.ts` | Factory for client-side |
| Supabase server client | `/src/lib/supabase/server.ts` | Factory for SSR/API |
| Auth middleware | `/src/lib/supabase/middleware.ts` | Session management |
| Custom hooks | `/src/lib/supabase/hooks.ts` | usePlatoonId() |
| Fairness calculator | `/src/lib/fairness/calculator.ts` | Core scoring |
| Fairness multipliers | `/src/lib/fairness/multipliers.ts` | Time/difficulty |
| Database schema | `/ALL_MIGRATIONS_COMBINED.sql` | 21 tables + RLS |
| Login page | `/src/app/page.tsx` | Auth entry point |
| Register page | `/src/app/register/page.tsx` | Sign-up flow |
| Register API | `/src/app/api/register/route.ts` | Platoon creation |
| Dashboard | `/src/app/dashboard/page.tsx` | Main view |
| Schedule creator | `/src/app/schedule/new/page.tsx` | Grid UI |
| Hebrew locale | `/src/locale/he.ts` | All UI strings |
| Root layout | `/src/app/layout.tsx` | RTL + dark mode |

---

## Conclusion

Shabtzak_light provides a **complete reference implementation** demonstrating:
- Production-ready Supabase integration with RLS
- Vercel deployment with automatic CI/CD
- Deterministic fairness algorithm with transparent scoring
- Mobile-first Hebrew RTL interface
- Cost-effective free tier hosting

All patterns, components, and configurations can be directly adapted to migrate Shabtzak_full from Google Sheets to a modern web application.

**Next Steps:**
1. Review this analysis
2. Execute Supabase migration plan (docs/migration/SUPABASE_MIGRATION_PLAN.md)
3. Execute Vercel deployment plan (docs/migration/VERCEL_MIGRATION_PLAN.md)
4. Test with production data
5. Deploy to production
