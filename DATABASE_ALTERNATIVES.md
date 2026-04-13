# Database Alternatives for ShabTzak Performance

## Current State: Google Sheets

**Pros:**
- ✅ Zero backend infrastructure
- ✅ Built-in UI for manual edits
- ✅ Easy to share/inspect data
- ✅ OAuth already integrated
- ✅ No server hosting costs

**Cons:**
- ❌ API rate limits (100 requests/100s per user)
- ❌ Batch write latency (~30-100s for full schedule)
- ❌ 1-16s exponential backoff on 429 errors
- ❌ 60s cache causing stale data
- ❌ No transactions (partial writes on error)
- ❌ No complex queries (client-side filtering)
- ❌ Network latency for every read/write

**Current Performance:**
- Schedule generation: ~105s for 300 tasks + 600 leaves
- Read operations: 500ms-2s per tab
- 299 API calls across codebase

---

## Alternative 1: **Supabase (PostgreSQL + Real-time)**

### Overview
Open-source Firebase alternative with PostgreSQL backend, built-in auth, and real-time subscriptions.

### Architecture Changes
```typescript
// Before (Google Sheets)
const soldiers = await sheetsService.getValues(spreadsheetId, 'Soldiers!A:P')

// After (Supabase)
const { data: soldiers } = await supabase
  .from('soldiers')
  .select('*')
  .eq('unit_id', unitId)
```

### Performance Impact
| Operation | Google Sheets | Supabase | Improvement |
|-----------|--------------|----------|-------------|
| Read 100 soldiers | 1-2s | 50-150ms | **10-20x faster** |
| Write 300 tasks | 30-40s (batched) | 200-500ms (bulk insert) | **60-150x faster** |
| Full schedule gen | ~105s | 2-5s | **20-50x faster** |
| Concurrent users | Shared rate limit | Independent | **No contention** |

### Migration Effort
- **Code changes:** MEDIUM (replace all repository classes)
- **Data migration:** LOW (one-time SQL import from xlsx)
- **Auth migration:** LOW (Supabase supports Google OAuth)
- **Hosting:** FREE tier (500MB database, 2GB bandwidth/month)

### Schema Example
```sql
CREATE TABLE soldiers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  unit_id TEXT REFERENCES units(id),
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
```

### Real-time Benefits
```typescript
// Live updates for all connected users
supabase
  .channel('schedule_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'task_assignments'
  }, (payload) => {
    // UI updates automatically
    refreshCalendar()
  })
  .subscribe()
```

### Cost
- **Free tier:** 500MB DB, unlimited API requests, 2GB bandwidth
- **Pro ($25/mo):** 8GB DB, 50GB bandwidth, daily backups
- **Team ($599/mo):** 100GB DB, 250GB bandwidth, priority support

**Recommendation:** FREE tier sufficient for 1-5 units, Pro tier for 10+ units

---

## Alternative 2: **Firebase Firestore (NoSQL)**

### Overview
Google's serverless NoSQL database with real-time sync and tight Google integration.

### Architecture Changes
```typescript
// Before (Google Sheets)
await sheetsService.appendValues(spreadsheetId, range, rows)

// After (Firestore)
const batch = db.batch()
soldiers.forEach(soldier => {
  const ref = db.collection('soldiers').doc(soldier.id)
  batch.set(ref, soldier)
})
await batch.commit() // Atomic, ~200ms
```

### Performance Impact
| Operation | Google Sheets | Firestore | Improvement |
|-----------|--------------|-----------|-------------|
| Read 100 soldiers | 1-2s | 100-300ms | **5-10x faster** |
| Write 300 tasks | 30-40s | 500ms-1s | **30-60x faster** |
| Full schedule gen | ~105s | 3-8s | **15-35x faster** |
| Real-time updates | None | Built-in | **Instant sync** |

### Migration Effort
- **Code changes:** MEDIUM-HIGH (different data model paradigm)
- **Data migration:** MEDIUM (denormalization required for NoSQL)
- **Auth migration:** TRIVIAL (already using Google OAuth)
- **Hosting:** FREE tier (1GB storage, 50K reads/day)

### Schema Example
```typescript
// Firestore collections
/units/{unitId}/soldiers/{soldierId}
/units/{unitId}/tasks/{taskId}
/units/{unitId}/taskAssignments/{assignmentId}
/units/{unitId}/leaveAssignments/{assignmentId}

// Denormalized for performance
{
  id: "s1",
  firstName: "David",
  role: "Driver",
  unit: { id: "u1", name: "Command Post" }, // Embedded
  currentAssignments: ["a1", "a2"], // Denormalized for quick lookups
}
```

### Pros Over Sheets
- ✅ Sub-second reads/writes
- ✅ Real-time sync across devices
- ✅ Offline support (local cache)
- ✅ Atomic batch operations
- ✅ Security rules in database
- ✅ No rate limits (50K reads/day free)

### Cons vs Supabase
- ❌ No SQL queries (must denormalize)
- ❌ Limited aggregations
- ❌ More expensive at scale
- ❌ Vendor lock-in (Google only)

### Cost
- **Spark (FREE):** 1GB storage, 50K reads, 20K writes/day
- **Blaze (Pay-as-you-go):** $0.18/GB storage, $0.06/100K reads
- **Estimated for 5 units:** ~$5-15/month

---

## Alternative 3: **IndexedDB (Client-Side Only)**

### Overview
Browser-native database with no backend required. Data stored locally, synced via exports.

### Architecture Changes
```typescript
// IndexedDB with Dexie.js wrapper
import Dexie from 'dexie'

const db = new Dexie('ShabTzak')
db.version(1).stores({
  soldiers: 'id, role, unit, status',
  tasks: 'id, taskType, startTime',
  assignments: 'id, soldierId, taskId, date'
})

// Ultra-fast queries (no network)
const drivers = await db.soldiers
  .where('role').equals('Driver')
  .and(s => s.status === 'Active')
  .toArray()
```

### Performance Impact
| Operation | Google Sheets | IndexedDB | Improvement |
|-----------|--------------|-----------|-------------|
| Read 100 soldiers | 1-2s | **5-20ms** | **100-400x faster** |
| Write 300 tasks | 30-40s | **50-200ms** | **150-800x faster** |
| Full schedule gen | ~105s | **0.5-2s** | **50-200x faster** |
| Offline support | ❌ No | ✅ Full | **100% uptime** |

### Migration Effort
- **Code changes:** MEDIUM (replace repositories with IndexedDB)
- **Data migration:** LOW (import/export via JSON/xlsx)
- **Auth migration:** TRIVIAL (OAuth only for export/sharing)
- **Multi-user sync:** HIGH (need custom solution)

### Pros
- ✅ **Fastest possible** (local storage)
- ✅ Offline-first
- ✅ Zero hosting costs
- ✅ No rate limits
- ✅ No network dependency
- ✅ Privacy (data stays on device)

### Cons
- ❌ No built-in multi-user sync
- ❌ Data per-device (must export/import)
- ❌ No server-side validation
- ❌ Manual backup required
- ❌ Limited to browser storage (usually <500MB)

### Multi-User Sync Options
```typescript
// Option 1: Export/Import via Cloud Storage
await exportToGoogleDrive(db.export())
const data = await importFromGoogleDrive()
await db.import(data)

// Option 2: Hybrid with Firestore sync
const changes = await db.getChangesSince(lastSync)
await firestore.collection('sync').doc(userId).set(changes)

// Option 3: WebRTC P2P sync (advanced)
const peer = new Peer()
peer.on('data', syncData => db.import(syncData))
```

### Best For
- Single user / small team (1-3 people)
- Poor internet connectivity
- Privacy-sensitive deployments
- Proof-of-concept/MVP

---

## Alternative 4: **Cloudflare Workers + D1 (SQLite)**

### Overview
Edge-deployed SQLite database with global distribution and Cloudflare's free tier.

### Performance Impact
| Operation | Google Sheets | Cloudflare D1 | Improvement |
|-----------|--------------|---------------|-------------|
| Read 100 soldiers | 1-2s | 100-200ms (edge) | **5-10x faster** |
| Write 300 tasks | 30-40s | 500ms-1s | **30-60x faster** |
| Full schedule gen | ~105s | 2-5s | **20-50x faster** |
| Global latency | US-based | <50ms worldwide | **Global edge** |

### Migration Effort
- **Code changes:** HIGH (need Workers backend API)
- **Data migration:** MEDIUM (SQL schema, migrations)
- **Auth migration:** MEDIUM (custom JWT validation)
- **Hosting:** FREE tier generous

### Pros
- ✅ True SQL with transactions
- ✅ Edge deployment (low latency globally)
- ✅ Very generous free tier
- ✅ Built on SQLite (simple, reliable)
- ✅ Workers can do server-side logic

### Cons
- ❌ Requires backend API development
- ❌ Newer product (less mature)
- ❌ No built-in real-time sync
- ❌ 10GB storage limit on free tier

### Cost
- **Free tier:** 100K reads/day, 10GB storage, 1M Workers requests
- **Paid ($5/mo):** 25M reads, 100GB storage

---

## Alternative 5: **Keep Google Sheets + Optimize**

### Quick Wins (No Migration)

#### 1. Reduce Exponential Backoff
**File:** `src/services/googleSheets.ts`
```typescript
// Current: 1s, 2s, 4s, 8s, 16s = ~31s worst case
const BASE_DELAY_MS = 1000
const MAX_RETRIES = 5

// Optimized: 100ms, 200ms, 400ms = ~700ms worst case
const BASE_DELAY_MS = 100
const MAX_RETRIES = 3
```
**Impact:** 30s → 1s for rate limit recovery

#### 2. Increase Batch Sizes
**Files:** `masterTaskAssignmentRepository.ts`, `masterLeaveAssignmentRepository.ts`
```typescript
// Current
const TASK_BATCH_SIZE = 15
const LEAVE_BATCH_SIZE = 30

// Optimized
const TASK_BATCH_SIZE = 35
const LEAVE_BATCH_SIZE = 50
```
**Impact:** 105s → ~65s for full schedule

#### 3. Tier Cache TTL
**File:** `src/services/cache.ts`
```typescript
const CACHE_TTL = {
  soldiers: 5 * 60_000,    // 5 min (rarely changes)
  tasks: 5 * 60_000,       // 5 min (static config)
  assignments: 10_000,     // 10s (changes frequently)
  leaveRequests: 30_000,   // 30s (moderate changes)
}
```
**Impact:** Fewer redundant API calls

#### 4. Request Deduplication
```typescript
// Cache in-flight requests
const pendingRequests = new Map()

async function getValues(spreadsheetId, range) {
  const key = `${spreadsheetId}:${range}`
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }

  const promise = this._getValues(spreadsheetId, range)
  pendingRequests.set(key, promise)

  try {
    return await promise
  } finally {
    pendingRequests.delete(key)
  }
}
```
**Impact:** Eliminate duplicate concurrent API calls

#### 5. Preload Critical Data
```typescript
// On app load, warm cache
async function warmCache() {
  await Promise.all([
    this.soldiers.list(),
    this.tasks.list(),
    this.config.get(),
  ])
}
```

### Expected Performance After Optimization
- Schedule generation: **105s → 40-50s** (2-3x faster)
- Read operations: **1-2s → 200-500ms** (4-5x faster with cache)
- Concurrent users: Still limited by shared rate limits

### Pros
- ✅ Zero migration effort
- ✅ Keep all existing integrations
- ✅ Still no hosting costs
- ✅ Quick deployment (code-only changes)

### Cons
- ❌ Still constrained by API rate limits
- ❌ Diminishing returns (can't get below ~30s)
- ❌ No real-time sync
- ❌ Concurrent users still bottleneck

---

## Decision Matrix

| Solution | Performance | Migration Effort | Cost/Month | Multi-User | Real-time | Offline |
|----------|-------------|------------------|------------|------------|-----------|---------|
| **Keep Sheets + Optimize** | 2-3x faster | None | $0 | Limited | ❌ | ❌ |
| **Supabase (PostgreSQL)** | 20-50x faster | Medium | $0-25 | ✅ Excellent | ✅ Yes | ⚠️ Limited |
| **Firebase Firestore** | 15-35x faster | Medium-High | $0-15 | ✅ Excellent | ✅ Yes | ✅ Yes |
| **IndexedDB (Local)** | 50-200x faster | Medium | $0 | ❌ Manual | ❌ | ✅ Yes |
| **Cloudflare D1** | 20-50x faster | High | $0-5 | ✅ Good | ❌ | ❌ |

---

## Recommended Path

### **Phase 1: Optimize Current Google Sheets (Week 1)**
**Effort:** 2-4 hours
**Performance gain:** 2-3x (105s → 40-50s)

Apply quick wins:
1. Reduce exponential backoff delays
2. Increase batch sizes
3. Implement request deduplication
4. Tier cache TTL by data type

**When to stop here:**
- Small deployment (1-2 units, <50 soldiers)
- Infrequent schedule generation (once/week)
- Low concurrent users (<5)
- No budget for hosting

---

### **Phase 2: Migrate to Supabase (Week 2-3)**
**Effort:** 2-3 days
**Performance gain:** 20-50x (105s → 2-5s)

**Why Supabase over others:**
- ✅ Full SQL power (transactions, complex queries)
- ✅ PostgreSQL is proven at scale
- ✅ Real-time subscriptions built-in
- ✅ Generous free tier ($0 for small deployments)
- ✅ Row-level security (fine-grained permissions)
- ✅ Open source (no vendor lock-in, can self-host)
- ✅ Built-in auth with Google OAuth
- ✅ Automatic backups on Pro tier

**Migration Steps:**
1. Create Supabase project (5 min)
2. Define PostgreSQL schema (1 hour)
3. Import data from xlsx (30 min)
4. Replace repository layer (1 day)
5. Update auth to use Supabase (2 hours)
6. Test and deploy (1 day)

**When to do this:**
- Medium-large deployment (3+ units, 100+ soldiers)
- Frequent schedule changes (daily/multiple times per day)
- Multiple concurrent commanders
- Need real-time collaboration
- Want professional-grade reliability

---

### **Phase 3: Add Real-time Sync (Week 4)**
**Effort:** 1 day (on top of Supabase)

Add live collaboration:
```typescript
supabase
  .channel('schedule')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'task_assignments',
    filter: `unit_id=eq.${unitId}`
  }, (payload) => {
    // Commander A creates task → Commander B sees it instantly
    updateCalendar(payload.new)
  })
  .subscribe()
```

**Benefits:**
- Multiple commanders can work simultaneously
- Changes visible instantly across devices
- Optimistic UI updates with server reconciliation

---

## Implementation Priority

### Immediate (Today): Fix Soldiers Tab
1. Run the restore script to fix current Google Sheet
2. Verify data integrity

### Short-term (This Week): Optimize Google Sheets
**Estimated Impact:** 2-3x performance improvement
**Files to modify:**
1. `src/services/googleSheets.ts` - Reduce backoff delays
2. `src/services/masterTaskAssignmentRepository.ts` - Increase batch size
3. `src/services/masterLeaveAssignmentRepository.ts` - Increase batch size
4. `src/services/cache.ts` - Tier TTL by data type

### Medium-term (Next 2-3 Weeks): Migrate to Supabase
**Estimated Impact:** 20-50x performance improvement
**Prerequisites:**
- Export all data from Google Sheets to SQL
- Set up Supabase project
- Implement repository pattern with Supabase client
- Migrate auth to Supabase (keep Google OAuth)

### Long-term (1+ Months): Add Real-time Features
- Live collaboration
- Optimistic UI updates
- Conflict resolution
- Mobile app support

---

## My Recommendation

**Start with Phase 1 (Optimize Sheets)** - Get quick wins with minimal effort.

**Then evaluate:**
- If performance is acceptable (schedule gen <1 minute), stop here
- If still slow OR need real-time collaboration OR have 5+ concurrent users → **Migrate to Supabase (Phase 2)**

**Supabase is the best long-term choice** because:
1. Proven PostgreSQL reliability
2. True relational data (your domain is highly relational)
3. Real-time without sacrificing query power
4. Free tier is generous for your scale
5. Easy migration path (similar concepts to current repositories)
6. Can self-host if needed (open source)

Avoid Firebase (vendor lock-in, NoSQL complexity) and IndexedDB (no multi-user) unless you have specific constraints.
