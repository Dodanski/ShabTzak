# JSON Database Migration Design

**Date:** 2026-03-31
**Status:** Approved
**Migration Type:** Google Sheets → Static JSON File

---

## Overview

Migrate ShabTzak from Google Sheets API backend to a **static JSON file** hosted on GitHub Pages. This eliminates external dependencies, API rate limits, and authentication complexity while maintaining high performance for read operations.

### Key Constraints

- GitHub Pages is static hosting only (no server-side database writes)
- Only Super Admin edits data (no multi-user concurrent writes)
- All users read from the same JSON file
- Manual deployment workflow is acceptable

### Benefits

- **Performance:** 10-20x faster reads (single HTTP request vs multiple Sheets API calls)
- **No rate limits:** Unlimited reads from static CDN
- **No authentication:** Remove Google OAuth complexity
- **Offline-capable:** JSON file can be cached in service worker
- **Version control:** Database changes tracked in git history
- **Zero hosting costs:** GitHub Pages remains free

---

## Architecture

### Data Storage

**File:** `public/data/database.json`

**Structure:**
```json
{
  "version": 1,
  "lastModified": "2026-03-31T10:30:00.000Z",
  "soldiers": [
    {
      "id": "1234567",
      "firstName": "David",
      "lastName": "Cohen",
      "role": "Driver",
      "phone": "050-1234567",
      "unit": "Command",
      "serviceStart": "2024-01-15",
      "serviceEnd": "2027-01-15",
      "initialFairness": 0,
      "currentFairness": 50,
      "status": "Active",
      "hoursWorked": 120,
      "weekendLeavesCount": 5,
      "midweekLeavesCount": 3,
      "afterLeavesCount": 2,
      "inactiveReason": null
    }
  ],
  "tasks": [
    {
      "id": "guard-night",
      "taskType": "Guard",
      "startTime": "22:00",
      "endTime": "06:00",
      "durationHours": 8,
      "roleRequirements": {
        "Driver": 2,
        "Commander": 1
      },
      "minRestAfter": 8,
      "isSpecial": false
    }
  ],
  "units": [
    {
      "id": "unit-command",
      "name": "Command Post",
      "tabPrefix": "א'",
      "spreadsheetId": null
    }
  ],
  "leaveRequests": [
    {
      "id": "lr-001",
      "soldierId": "1234567",
      "startDate": "2026-04-05",
      "endDate": "2026-04-07",
      "leaveType": "Weekend",
      "priority": 5,
      "status": "Approved"
    }
  ],
  "leaveAssignments": [
    {
      "id": "la-001",
      "soldierId": "1234567",
      "date": "2026-04-05",
      "leaveType": "Weekend",
      "isWeekend": true,
      "requestId": "lr-001"
    }
  ],
  "taskAssignments": [
    {
      "id": "ta-001",
      "taskId": "guard-night",
      "soldierId": "1234567",
      "assignedUnitId": "unit-command",
      "date": "2026-04-05",
      "startTime": "2026-04-05T22:00:00.000Z",
      "endTime": "2026-04-06T06:00:00.000Z"
    }
  ],
  "config": {
    "scheduleStartDate": "2026-04-01",
    "scheduleEndDate": "2026-06-30",
    "leaveRatioDaysInBase": 10,
    "leaveRatioDaysHome": 4,
    "leaveBaseExitHour": 16,
    "leaveBaseReturnHour": 8,
    "minBasePresenceByRole": {
      "Driver": 3,
      "Medic": 2,
      "Commander": 1
    },
    "weekendDays": ["Friday", "Saturday"],
    "settings": {}
  },
  "roles": [
    {
      "id": "role-driver",
      "name": "Driver"
    },
    {
      "id": "role-medic",
      "name": "Medic"
    },
    {
      "id": "role-commander",
      "name": "Commander"
    }
  ]
}
```

**Schema Notes:**
- `version`: Integer incremented on each database update (currently unused, reserved for future optimistic locking)
- `lastModified`: ISO 8601 timestamp of last modification
- All arrays use the same TypeScript interfaces as current models
- No schema changes to existing data models

---

## Data Flow

### Read Operations (All Users)

**On app startup:**

1. Fetch `https://your-username.github.io/ShabTzak/data/database.json` via HTTP GET
2. Parse JSON and validate structure
3. Store in React Context (in-memory)
4. All repository classes read from in-memory data (no further HTTP requests)

**Performance:**
- Initial load: 100-500ms (single HTTP request, CDN-cached)
- Subsequent reads: **Instant** (in-memory)
- Compare to Google Sheets: 1-2s per tab, ~10-15 API calls total

**Caching strategy:**
- Session-based: data lives until page refresh (F5)
- No automatic polling for updates
- Users manually refresh to see new data

### Write Operations (Super Admin Only)

**Admin workflow:**

1. Run app locally: `npm run dev`
2. Navigate to `/admin` route (only available in development)
3. Make changes via Admin UI:
   - Import soldiers from Excel/CSV
   - Add/edit/delete individual soldiers
   - Modify tasks, units, config
4. Click "Export Database" → downloads `database.json`
5. Save file to `public/data/database.json` in project
6. Commit changes: `git add public/data/database.json && git commit -m "Update soldiers"`
7. Deploy: `npm run deploy` (pushes to gh-pages branch)
8. All users get updates on next page refresh

**No concurrent writes:** Only Super Admin modifies data, so no locking/conflict resolution needed.

---

## Admin UI Components

### Route Structure

**`/admin`** - Admin panel (only accessible in development mode)
- Subroutes:
  - `/admin/soldiers` - Soldier management
  - `/admin/tasks` - Task management
  - `/admin/units` - Unit management
  - `/admin/config` - Config editor
  - `/admin/import` - Bulk import from spreadsheet
  - `/admin/export` - Export database.json

### Soldier Management UI

**List View (`/admin/soldiers`):**

- Table with columns: ID, Name, Role, Unit, Status, Actions
- Search bar: filter by name, ID, role
- Filters: Status dropdown (All, Active, Inactive, Discharged), Role dropdown, Unit dropdown
- Sort: clickable column headers
- Actions per row:
  - "Edit" button → opens edit form
  - "Delete" button → confirmation modal → removes soldier
- "Add New Soldier" button (top right)
- "Import from Spreadsheet" button (top left)
- "Export Database" button (top right)

**Add/Edit Form:**

Modal or dedicated page with fields:
- **ID** (text input, required) - Army ID number
- **First Name** (text input, required)
- **Last Name** (text input, required)
- **Role** (dropdown, required) - options from roles table
- **Unit** (dropdown, required) - options from units table
- **Phone** (text input, optional) - format: 050-1234567
- **Service Start** (date picker, required)
- **Service End** (date picker, required)
- **Status** (dropdown, required) - Active, Inactive, Discharged
- **Inactive Reason** (text input, conditional) - shown only if Status = Inactive

Buttons:
- "Save" - validates and adds/updates soldier in memory
- "Cancel" - closes form without saving

**Validation:**
- ID must be unique
- Service End must be after Service Start
- Phone format: optional, but if provided must match pattern
- All required fields must be filled

### Import from Spreadsheet

**UI Flow:**

1. **File Upload Screen:**
   - Drag-and-drop area or "Choose File" button
   - Accepted formats: `.csv`, `.xlsx`, `.xls`
   - Max file size: 10MB

2. **Preview & Mapping Screen:**
   - Shows first 10 rows of uploaded file
   - Column mapping dropdowns:
     - "Army ID" → maps to `id`
     - "First Name" → maps to `firstName`
     - "Last Name" → maps to `lastName`
     - "Role" → maps to `role`
     - etc.
   - Auto-detect common column names (case-insensitive)
   - Show row count: "Found 45 soldiers to import"

3. **Validation Screen:**
   - List of errors/warnings:
     - ❌ Row 5: Missing required field "Service Start"
     - ⚠️ Row 12: Duplicate ID "1234567"
     - ⚠️ Row 20: Unknown role "Chef" (not in roles table)
   - Option to "Skip invalid rows" or "Fix manually"
   - "Import Valid Rows" button (disabled if critical errors)

4. **Confirmation:**
   - "Successfully imported 43 soldiers (2 skipped)"
   - Returns to soldier list view

**Parsing Libraries:**
- CSV: Use `papaparse` (lightweight, robust)
- Excel: Use `xlsx` (SheetJS)

### Export Database

**UI:**
- Single button: "Export Database"
- Clicking downloads `database.json` to user's Downloads folder
- Filename: `database-YYYY-MM-DD-HHmmss.json` (timestamped)
- Show success toast: "Database exported successfully"

**Optional: Save to Project**
- Advanced feature: "Save to Project" button
- Uses File System Access API (Chrome 86+)
- Prompts user to select `public/data/` folder
- Directly writes `database.json` (skips download step)
- Fallback to download if API not supported

---

## Repository Layer Refactoring

### Current Structure

All repositories extend from Google Sheets base class:
- `SoldierRepository` - reads/writes `Soldiers` tab
- `TaskRepository` - reads/writes `Tasks` tab
- `LeaveRequestRepository` - reads/writes `LeaveRequests` tab
- etc.

Each repository:
- Uses `GoogleSheetsService` to make API calls
- Parses rows via `parsers.ts`
- Serializes data via `serializers.ts`
- Caches results in `SheetCache`

### New Structure

Replace Google Sheets backend with JSON backend:

**New base class:** `JsonRepository<T>`

```typescript
abstract class JsonRepository<T> {
  constructor(
    private dataContext: DatabaseContext,
    private entityKey: keyof Database
  ) {}

  async list(): Promise<T[]> {
    return this.dataContext.getData()[this.entityKey]
  }

  async getById(id: string): Promise<T | null> {
    const items = await this.list()
    return items.find(item => item.id === id) ?? null
  }

  async create(entity: T): Promise<T> {
    const items = await this.list()
    items.push(entity)
    this.dataContext.setData({
      ...this.dataContext.getData(),
      [this.entityKey]: items
    })
    return entity
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    const items = await this.list()
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Entity ${id} not found`)
    items[index] = { ...items[index], ...updates }
    this.dataContext.setData({
      ...this.dataContext.getData(),
      [this.entityKey]: items
    })
  }

  async delete(id: string): Promise<void> {
    const items = await this.list()
    const filtered = items.filter(item => item.id !== id)
    this.dataContext.setData({
      ...this.dataContext.getData(),
      [this.entityKey]: filtered
    })
  }
}
```

**Concrete repositories:**

```typescript
export class SoldierRepository extends JsonRepository<Soldier> {
  constructor(dataContext: DatabaseContext) {
    super(dataContext, 'soldiers')
  }

  // Add soldier-specific methods if needed
  async getActiveByRole(role: SoldierRole): Promise<Soldier[]> {
    const soldiers = await this.list()
    return soldiers.filter(s => s.role === role && s.status === 'Active')
  }
}
```

**Benefits:**
- Same interface as current repositories (minimal changes to consuming code)
- No Google Sheets API calls (all operations are in-memory)
- No parsers/serializers needed (JSON is already structured)
- No caching needed (data already in memory)
- Simpler, faster, fewer dependencies

### Database Context

**React Context for database state:**

```typescript
interface DatabaseContextValue {
  database: Database | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  getData: () => Database
  setData: (db: Database) => void
}

const DatabaseContext = createContext<DatabaseContextValue>(null!)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [database, setDatabase] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/data/database.json')
      if (!response.ok) throw new Error('Failed to load database')
      const data = await response.json()
      setDatabase(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const getData = () => {
    if (!database) throw new Error('Database not loaded')
    return database
  }

  const setData = (db: Database) => {
    setDatabase(db)
  }

  return (
    <DatabaseContext.Provider value={{ database, loading, error, reload, getData, setData }}>
      {children}
    </DatabaseContext.Provider>
  )
}

export const useDatabase = () => useContext(DatabaseContext)
```

**Usage in components:**

```typescript
function SoldiersPage() {
  const { database, loading, error } = useDatabase()
  const soldierRepo = useMemo(
    () => new SoldierRepository(useDatabase()),
    [database]
  )

  const [soldiers, setSoldiers] = useState<Soldier[]>([])

  useEffect(() => {
    if (database) {
      soldierRepo.list().then(setSoldiers)
    }
  }, [database])

  if (loading) return <Spinner>Loading database...</Spinner>
  if (error) return <ErrorMessage>Error: {error}</ErrorMessage>

  return <SoldierTable soldiers={soldiers} />
}
```

---

## Migration from Google Sheets

### Step 1: Export Current Data

**Option A: Manual Export**
1. Open Google Sheet
2. For each tab: File → Download → Comma Separated Values (.csv)
3. Save files: `soldiers.csv`, `tasks.csv`, etc.

**Option B: Script Export (Recommended)**
- Run a one-time migration script that:
  - Uses current Google Sheets API code
  - Fetches all data from all tabs
  - Converts to JSON structure
  - Writes `public/data/database.json`

**Migration script:** `scripts/export-sheets-to-json.ts`

```typescript
import { GoogleSheetsService } from '../src/services/googleSheets'
import { SoldierRepository } from '../src/services/soldierRepository'
// ... import other repositories
import fs from 'fs'

async function exportToJson() {
  const sheets = new GoogleSheetsService(/* credentials */)
  const soldierRepo = new SoldierRepository(sheets, SPREADSHEET_ID, cache)
  // ... initialize other repos

  const database = {
    version: 1,
    lastModified: new Date().toISOString(),
    soldiers: await soldierRepo.list(),
    tasks: await taskRepo.list(),
    units: await unitRepo.list(),
    leaveRequests: await leaveRequestRepo.list(),
    leaveAssignments: await leaveAssignmentRepo.list(),
    taskAssignments: await taskAssignmentRepo.list(),
    config: await configRepo.get(),
    roles: await roleRepo.list(),
  }

  fs.writeFileSync(
    'public/data/database.json',
    JSON.stringify(database, null, 2)
  )

  console.log('✅ Exported to public/data/database.json')
}

exportToJson()
```

Run once: `npx tsx scripts/export-sheets-to-json.ts`

### Step 2: Update Codebase

**Files to modify:**

1. **Remove Google Sheets dependencies:**
   - Delete `src/services/googleSheets.ts`
   - Delete `src/services/parsers.ts` (no longer needed)
   - Delete `src/services/serializers.ts` (no longer needed)
   - Delete `src/services/cache.ts` (no longer needed)
   - Remove from `package.json`: `@googleapis/sheets`, `gapi`

2. **Create JSON infrastructure:**
   - Add `src/contexts/DatabaseContext.tsx` (database provider)
   - Add `src/services/JsonRepository.ts` (base class)
   - Update all `*Repository.ts` files to extend `JsonRepository`

3. **Update App.tsx:**
   - Remove `GoogleAuthProvider`
   - Add `DatabaseProvider`
   - Remove OAuth initialization

4. **Remove authentication:**
   - Delete login page (no auth needed)
   - Remove OAuth token logic
   - Remove `.env.local` Google credentials

5. **Update deployment:**
   - Ensure `public/data/database.json` is committed
   - Update `.gitignore` to NOT ignore `public/data/`

### Step 3: Test Locally

1. Run `npm run dev`
2. Verify app loads soldiers from JSON
3. Test all CRUD operations in admin panel
4. Export database and verify file is correct
5. Test import from spreadsheet

### Step 4: Deploy

1. Commit all changes: `git add . && git commit -m "Migrate from Google Sheets to JSON"`
2. Deploy: `npm run deploy`
3. Verify production site loads data correctly
4. Share URL with users: "Please refresh (F5) to see new version"

---

## Error Handling

### File Not Found (404)

**Cause:** `database.json` doesn't exist or wrong path

**Handling:**
```typescript
if (response.status === 404) {
  setError('Database not found. Please contact the administrator.')
}
```

**UI:**
- Show error screen: "Database not initialized"
- Contact admin message
- No further action available

### Invalid JSON

**Cause:** Corrupted file, manual edit error

**Handling:**
```typescript
try {
  const data = await response.json()
} catch (err) {
  setError('Database is corrupted. Please contact the administrator.')
  console.error('JSON parse error:', err)
}
```

**UI:**
- Show error screen: "Database is corrupted"
- Log full error to console for debugging
- No graceful fallback (data is critical)

### Network Errors

**Cause:** Offline, DNS failure, CDN down

**Handling:**
```typescript
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1s

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  try {
    return await fetch(url)
  } catch (err) {
    if (retries > 0) {
      await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1)) // exponential backoff
      return fetchWithRetry(url, retries - 1)
    }
    throw err
  }
}
```

**UI:**
- Show loading spinner with retry count: "Loading... (attempt 2/3)"
- After all retries fail: "Cannot connect to database. Check your internet connection."
- "Retry" button to manually trigger reload

### Empty Database

**Cause:** Fresh install, no data imported yet

**Handling:**
```typescript
if (database.soldiers.length === 0) {
  // Don't error, just show empty state
}
```

**UI:**
- Empty state message: "No soldiers found."
- If admin: "Go to /admin to import data."
- If regular user: "Contact administrator to add soldiers."

### Schema Version Mismatch

**Cause:** Database structure changed (future-proofing)

**Handling:**
```typescript
const CURRENT_SCHEMA_VERSION = 1

if (database.version !== CURRENT_SCHEMA_VERSION) {
  setError(`Database schema mismatch. Expected v${CURRENT_SCHEMA_VERSION}, got v${database.version}`)
}
```

**UI:**
- Show error: "Database needs migration. Contact administrator."
- Prevents crashes from using old schema

---

## Performance Characteristics

### Load Times

| Operation | Google Sheets | JSON Database | Improvement |
|-----------|--------------|---------------|-------------|
| Initial app load | 5-8s (OAuth + 10+ API calls) | 0.5-1s (single fetch) | **5-8x faster** |
| Read 100 soldiers | 1-2s (API call) | Instant (in-memory) | **∞x faster** |
| Read all tasks | 1-2s (API call) | Instant (in-memory) | **∞x faster** |
| Schedule generation | 105s (rate limits) | 2-5s (no API calls) | **20-50x faster** |
| Concurrent users | Shared rate limit | No rate limit | **No contention** |

### File Size

**Estimated sizes (100 soldiers, 300 tasks, 600 assignments):**
- `database.json`: ~200-500 KB uncompressed
- Gzipped (served by GitHub Pages): ~50-100 KB
- Load time on 4G: ~200-300ms
- Load time on WiFi: ~50-100ms

**Scaling:**
- 500 soldiers: ~1-2 MB (250-500 KB gzipped)
- 1000 soldiers: ~2-4 MB (500 KB - 1 MB gzipped)

Still fast enough for single HTTP request. No pagination needed.

### Browser Memory

**In-memory storage:**
- Database object: ~500 KB - 2 MB in heap
- Negligible for modern browsers (typical heap: 100+ MB available)
- No IndexedDB needed (data reloads on each session)

---

## Security & Access Control

### Read Access

**Current state:** Anyone with the URL can read the database

**Implications:**
- Soldier names, IDs, phone numbers are public
- Schedule data is public
- No authentication required

**If privacy is needed:**
- Option 1: Add basic HTTP auth to gh-pages (not supported natively)
- Option 2: Deploy to Vercel/Netlify with password protection
- Option 3: Encrypt sensitive fields (e.g., phone numbers) in JSON, decrypt in app with shared key

**Assumption:** Data is not sensitive, or URL is not widely shared

### Write Access

**Secured by deployment workflow:**
- Only Super Admin has access to local development environment
- Only Super Admin can commit to git repository
- Only Super Admin can deploy to gh-pages

**No write API exposed to browser**, so no risk of unauthorized edits.

---

## Future Enhancements

### Version History

**Track changes over time:**
- Store multiple versions: `database-v1.json`, `database-v2.json`
- Keep last 10 versions for rollback
- Admin UI shows history: "Restore to version 5 (2 days ago)"

**Implementation:**
- On export, copy current `database.json` to `database-v{n}.json`
- Add `versions.json` manifest with timestamps
- "Restore" button fetches old version and exports it

### Differential Updates

**Problem:** Large database (1 MB+) causes slow reloads

**Solution:** Publish a `changes.json` file with incremental updates

```json
{
  "fromVersion": 5,
  "toVersion": 6,
  "changes": {
    "soldiers": {
      "updated": [{"id": "123", "status": "Discharged"}],
      "added": [],
      "deleted": []
    }
  }
}
```

App checks `version`, fetches `changes.json` if available, applies diff instead of full reload.

### Conflict Detection

**If multiple admins edit simultaneously:**
- Add `version` field validation
- Before export, check if GitHub file has newer version
- If conflict: show diff and merge UI

**Not needed for single admin**, but enables future multi-admin workflows.

### Offline Support

**Service Worker caching:**
- Cache `database.json` in service worker
- App works offline after first load
- On reconnect, check for updates and reload

**Implementation:**
- Use Vite PWA plugin
- Cache `database.json` with "network-first" strategy

---

## Deployment Checklist

### Pre-Migration

- [ ] Export current Google Sheets data to JSON
- [ ] Test import flow with exported data
- [ ] Verify all soldiers, tasks, assignments are present
- [ ] Test schedule generation with JSON data
- [ ] Backup Google Sheets (just in case)

### Code Changes

- [ ] Create `DatabaseContext.tsx`
- [ ] Create `JsonRepository.ts` base class
- [ ] Update all `*Repository.ts` files
- [ ] Remove Google Sheets dependencies
- [ ] Remove OAuth/authentication code
- [ ] Create Admin UI routes
- [ ] Implement import/export functionality
- [ ] Add error handling and retries
- [ ] Test locally end-to-end

### Deployment

- [ ] Commit `public/data/database.json`
- [ ] Deploy to gh-pages: `npm run deploy`
- [ ] Verify production site loads correctly
- [ ] Test on multiple devices/browsers
- [ ] Notify users to refresh their browsers

### Post-Migration

- [ ] Monitor for errors in production
- [ ] Archive old Google Sheets (read-only)
- [ ] Update documentation (README.md)
- [ ] Remove Google API credentials from `.env.local`

---

## Risks & Mitigations

### Risk: Large file size slows down load

**Likelihood:** Low (500 soldiers = ~500 KB gzipped)

**Mitigation:**
- Monitor file size as data grows
- If exceeds 2 MB, consider splitting by unit
- Lazy-load non-critical data (e.g., history)

### Risk: Users work with stale data

**Likelihood:** Medium (no auto-refresh)

**Mitigation:**
- Add "Last updated" timestamp in UI
- Add "Check for updates" button
- Consider polling every 5 minutes for version change

### Risk: Admin makes mistake in manual edit

**Likelihood:** Medium (manual JSON edit is error-prone)

**Mitigation:**
- Always use Admin UI (don't edit JSON directly)
- Add JSON schema validation on export
- Keep version history for rollback

### Risk: GitHub Pages goes down

**Likelihood:** Very low (99.9% uptime)

**Mitigation:**
- No real mitigation needed (GitHub Pages is reliable)
- If critical: mirror to second CDN (Cloudflare Pages, Netlify)

---

## Success Criteria

- ✅ App loads in <1 second (vs 5-8s with Google Sheets)
- ✅ No API rate limit errors (429)
- ✅ No authentication required for regular users
- ✅ Schedule generation completes in <5 seconds (vs ~105s)
- ✅ Admin can import soldiers from spreadsheet in <1 minute
- ✅ Admin can add/edit individual soldiers via UI
- ✅ All existing features work identically (no regressions)
- ✅ Zero hosting costs (GitHub Pages free tier)

---

## Timeline Estimate

- **Export current data:** 30 minutes
- **Implement DatabaseContext:** 1 hour
- **Refactor repositories:** 2-3 hours
- **Build Admin UI (import/export):** 4-6 hours
- **Build Admin UI (soldier CRUD):** 3-4 hours
- **Remove Google Sheets code:** 1 hour
- **Testing & bug fixes:** 2-3 hours
- **Deployment & verification:** 1 hour

**Total:** 14-19 hours (2-3 days of focused work)

---

## Conclusion

Migrating to a static JSON database eliminates Google Sheets' performance bottlenecks, rate limits, and authentication complexity. The single-admin write model fits naturally with GitHub Pages' static hosting, while the read-only access for regular users is instant and unlimited.

The Admin UI provides an easy workflow for importing and managing soldiers without requiring direct JSON editing. The migration is straightforward, low-risk, and delivers immediate performance improvements.
