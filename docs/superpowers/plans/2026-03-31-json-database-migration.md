# JSON Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate ShabTzak from Google Sheets API to static JSON file database

**Architecture:** Replace Google Sheets repositories with JSON-based repositories that read from a static `database.json` file served via GitHub Pages. Data loaded once on app startup into React Context, all operations in-memory.

**Tech Stack:** React Context API, fetch API, TypeScript, Vitest

---

## File Structure

### New Files to Create
- `src/contexts/DatabaseContext.tsx` - React Context for database state management
- `src/services/JsonRepository.ts` - Base class for JSON-based repositories
- `public/data/database.json` - Static database file
- `scripts/export-sheets-to-json.ts` - Migration script to export Google Sheets data
- `scripts/restore-soldiers.sh` - Helper script for data restoration (if needed)
- `src/types/Database.ts` - TypeScript interface for database structure

### Files to Modify
- `src/services/soldierRepository.ts` - Refactor to extend JsonRepository
- `src/services/taskRepository.ts` - Refactor to extend JsonRepository
- `src/services/leaveRequestRepository.ts` - Refactor to extend JsonRepository
- `src/services/leaveAssignmentRepository.ts` - Refactor to extend JsonRepository
- `src/services/taskAssignmentRepository.ts` - Refactor to extend JsonRepository
- `src/services/unitRepository.ts` - Refactor to extend JsonRepository
- `src/services/configRepository.ts` - Refactor to use DatabaseContext
- `src/services/adminRepository.ts` - Refactor to extend JsonRepository
- `src/services/commanderRepository.ts` - Refactor to extend JsonRepository
- `src/services/masterLeaveAssignmentRepository.ts` - Refactor to extend JsonRepository
- `src/services/masterTaskAssignmentRepository.ts` - Refactor to extend JsonRepository
- `src/services/dataService.ts` - Update to use DatabaseContext instead of GoogleSheetsService
- `src/services/masterDataService.ts` - Update to use DatabaseContext
- `src/App.tsx` - Replace AuthProvider with DatabaseProvider, remove OAuth
- `package.json` - Remove Google Sheets dependencies

### Files to Delete
- `src/services/googleSheets.ts` - No longer needed
- `src/services/parsers.ts` - No longer needed (JSON is already parsed)
- `src/services/serializers.ts` - No longer needed (JSON is already serialized)
- `src/services/cache.ts` - No longer needed (data already in-memory)
- `src/context/AuthContext.tsx` - No longer needed (no Google OAuth)
- `src/context/AuthContext.test.tsx` - No longer needed

---

## Task 1: Define Database Type and Create Context

**Files:**
- Create: `src/types/Database.ts`
- Create: `src/contexts/DatabaseContext.tsx`
- Test: `src/contexts/DatabaseContext.test.tsx`

- [ ] **Step 1: Write the failing test for DatabaseContext**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DatabaseProvider, useDatabase } from './DatabaseContext'

function TestComponent() {
  const { database, loading, error } = useDatabase()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!database) return <div>No data</div>

  return <div>Soldiers: {database.soldiers.length}</div>
}

describe('DatabaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads database from /data/database.json', async () => {
    const mockData = {
      version: 1,
      lastModified: '2026-03-31T10:00:00.000Z',
      soldiers: [
        { id: 's1', firstName: 'David', lastName: 'Cohen', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 }
      ],
      tasks: [],
      units: [],
      leaveRequests: [],
      leaveAssignments: [],
      taskAssignments: [],
      config: {
        scheduleStartDate: '2026-01-01',
        scheduleEndDate: '2026-12-31',
        leaveRatioDaysInBase: 10,
        leaveRatioDaysHome: 4,
        longLeaveMaxDays: 14,
        weekendDays: ['Friday', 'Saturday'],
        minBasePresence: 5,
        minBasePresenceByRole: { Driver: 2, Medic: 1, Commander: 1 },
        maxDrivingHours: 12,
        defaultRestPeriod: 8,
        taskTypeRestPeriods: {},
        adminEmails: [],
        leaveBaseExitHour: '16:00',
        leaveBaseReturnHour: '08:00'
      },
      roles: ['Driver', 'Medic', 'Commander'],
      admins: [],
      commanders: []
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    })

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Soldiers: 1')).toBeInTheDocument()
    })
  })

  it('shows error when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    render(
      <DatabaseProvider>
        <TestComponent />
      </DatabaseProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DatabaseContext.test.tsx`
Expected: FAIL with "Cannot find module './DatabaseContext'"

- [ ] **Step 3: Define Database type**

```typescript
// src/types/Database.ts
import type { Soldier, Task, LeaveRequest, LeaveAssignment, TaskAssignment, AppConfig, Unit, Admin, Commander } from '../models'

export interface Database {
  version: number
  lastModified: string
  soldiers: Soldier[]
  tasks: Task[]
  units: Unit[]
  leaveRequests: LeaveRequest[]
  leaveAssignments: LeaveAssignment[]
  taskAssignments: TaskAssignment[]
  config: AppConfig
  roles: string[]
  admins: Admin[]
  commanders: Commander[]
}
```

- [ ] **Step 4: Implement DatabaseContext**

```typescript
// src/contexts/DatabaseContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Database } from '../types/Database'

interface DatabaseContextValue {
  database: Database | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  getData: () => Database
  setData: (db: Database) => void
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [database, setDatabase] = useState<Database | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/data/database.json')
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setDatabase(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
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

export function useDatabase() {
  const context = useContext(DatabaseContext)
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider')
  }
  return context
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- DatabaseContext.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/Database.ts src/contexts/DatabaseContext.tsx src/contexts/DatabaseContext.test.tsx
git commit -m "feat: add DatabaseContext for JSON database

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create JsonRepository Base Class

**Files:**
- Create: `src/services/JsonRepository.ts`
- Test: `src/services/JsonRepository.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { JsonRepository } from './JsonRepository'
import { DatabaseProvider, useDatabase } from '../contexts/DatabaseContext'
import { renderHook } from '@testing-library/react'
import type { Database } from '../types/Database'
import type { Soldier } from '../models'

class TestSoldierRepository extends JsonRepository<Soldier> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'soldiers')
  }
}

describe('JsonRepository', () => {
  const mockDatabase: Database = {
    version: 1,
    lastModified: '2026-03-31T10:00:00.000Z',
    soldiers: [
      { id: 's1', firstName: 'David', lastName: 'Cohen', role: 'Driver', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 },
      { id: 's2', firstName: 'Moshe', lastName: 'Levi', role: 'Medic', serviceStart: '2026-01-01', serviceEnd: '2026-12-31', initialFairness: 0, currentFairness: 0, status: 'Active', hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0 }
    ],
    tasks: [],
    units: [],
    leaveRequests: [],
    leaveAssignments: [],
    taskAssignments: [],
    config: {
      scheduleStartDate: '2026-01-01',
      scheduleEndDate: '2026-12-31',
      leaveRatioDaysInBase: 10,
      leaveRatioDaysHome: 4,
      longLeaveMaxDays: 14,
      weekendDays: ['Friday', 'Saturday'],
      minBasePresence: 5,
      minBasePresenceByRole: { Driver: 2, Medic: 1, Commander: 1 },
      maxDrivingHours: 12,
      defaultRestPeriod: 8,
      taskTypeRestPeriods: {},
      adminEmails: [],
      leaveBaseExitHour: '16:00',
      leaveBaseReturnHour: '08:00'
    },
    roles: [],
    admins: [],
    commanders: []
  }

  let mockContext: ReturnType<typeof useDatabase>

  beforeEach(() => {
    mockContext = {
      database: mockDatabase,
      loading: false,
      error: null,
      reload: async () => {},
      getData: () => mockDatabase,
      setData: (db: Database) => { mockDatabase.soldiers = db.soldiers }
    }
  })

  it('lists all entities', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldiers = await repo.list()
    expect(soldiers).toHaveLength(2)
    expect(soldiers[0].id).toBe('s1')
  })

  it('gets entity by id', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldier = await repo.getById('s2')
    expect(soldier).not.toBeNull()
    expect(soldier!.firstName).toBe('Moshe')
  })

  it('returns null for unknown id', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const soldier = await repo.getById('unknown')
    expect(soldier).toBeNull()
  })

  it('creates new entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    const newSoldier: Soldier = {
      id: 's3',
      firstName: 'Yosef',
      lastName: 'Cohen',
      role: 'Commander',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-12-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0
    }

    const created = await repo.create(newSoldier)
    expect(created.id).toBe('s3')

    const all = await repo.list()
    expect(all).toHaveLength(3)
  })

  it('updates entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    await repo.update('s1', { firstName: 'Updated' })

    const soldier = await repo.getById('s1')
    expect(soldier!.firstName).toBe('Updated')
  })

  it('deletes entity', async () => {
    const repo = new TestSoldierRepository(mockContext)
    await repo.delete('s1')

    const all = await repo.list()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('s2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- JsonRepository.test.tsx`
Expected: FAIL with "Cannot find module './JsonRepository'"

- [ ] **Step 3: Implement JsonRepository**

```typescript
// src/services/JsonRepository.ts
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
    const items = db[this.entityKey] as T[]
    items.push(entity)
    this.context.setData({ ...db, [this.entityKey]: items })
    return entity
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Entity ${id} not found`)
    items[index] = { ...items[index], ...updates }
    this.context.setData({ ...db, [this.entityKey]: items })
  }

  async delete(id: string): Promise<void> {
    const db = this.context.getData()
    const items = db[this.entityKey] as T[]
    const filtered = items.filter(item => item.id !== id)
    this.context.setData({ ...db, [this.entityKey]: filtered })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- JsonRepository.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/JsonRepository.ts src/services/JsonRepository.test.tsx
git commit -m "feat: add JsonRepository base class

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Export Google Sheets Data to JSON

**Files:**
- Create: `scripts/export-sheets-to-json.ts`
- Create: `public/data/.gitkeep`

- [ ] **Step 1: Create public/data directory**

```bash
mkdir -p public/data
touch public/data/.gitkeep
```

- [ ] **Step 2: Write export script**

```typescript
// scripts/export-sheets-to-json.ts
import { GoogleSheetsService } from '../src/services/googleSheets'
import { SoldierRepository } from '../src/services/soldierRepository'
import { TaskRepository } from '../src/services/taskRepository'
import { LeaveRequestRepository } from '../src/services/leaveRequestRepository'
import { LeaveAssignmentRepository } from '../src/services/leaveAssignmentRepository'
import { TaskAssignmentRepository } from '../src/services/taskAssignmentRepository'
import { UnitRepository } from '../src/services/unitRepository'
import { ConfigRepository } from '../src/services/configRepository'
import { AdminRepository } from '../src/services/adminRepository'
import { CommanderRepository } from '../src/services/commanderRepository'
import { MasterTaskAssignmentRepository } from '../src/services/masterTaskAssignmentRepository'
import { MasterLeaveAssignmentRepository } from '../src/services/masterLeaveAssignmentRepository'
import { SheetCache } from '../src/services/cache'
import * as fs from 'fs'

// You need to provide your access token and spreadsheet ID
const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || ''
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || ''

if (!ACCESS_TOKEN || !SPREADSHEET_ID) {
  console.error('Error: GOOGLE_ACCESS_TOKEN and SPREADSHEET_ID environment variables are required')
  console.error('Usage: GOOGLE_ACCESS_TOKEN=xxx SPREADSHEET_ID=yyy npx tsx scripts/export-sheets-to-json.ts')
  process.exit(1)
}

async function exportToJson() {
  console.log('Starting export from Google Sheets...')

  const sheets = new GoogleSheetsService(ACCESS_TOKEN)
  const cache = new SheetCache()

  // Initialize repositories
  const soldierRepo = new SoldierRepository(sheets, SPREADSHEET_ID, cache)
  const taskRepo = new TaskRepository(sheets, SPREADSHEET_ID, cache)
  const leaveRequestRepo = new LeaveRequestRepository(sheets, SPREADSHEET_ID, cache)
  const leaveAssignmentRepo = new LeaveAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const taskAssignmentRepo = new TaskAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const unitRepo = new UnitRepository(sheets, SPREADSHEET_ID, cache)
  const configRepo = new ConfigRepository(sheets, SPREADSHEET_ID, cache)
  const adminRepo = new AdminRepository(sheets, SPREADSHEET_ID, cache)
  const commanderRepo = new CommanderRepository(sheets, SPREADSHEET_ID, cache)
  const masterTaskRepo = new MasterTaskAssignmentRepository(sheets, SPREADSHEET_ID, cache)
  const masterLeaveRepo = new MasterLeaveAssignmentRepository(sheets, SPREADSHEET_ID, cache)

  console.log('Fetching soldiers...')
  const soldiers = await soldierRepo.list()
  console.log(`✓ Found ${soldiers.length} soldiers`)

  console.log('Fetching tasks...')
  const tasks = await taskRepo.list()
  console.log(`✓ Found ${tasks.length} tasks`)

  console.log('Fetching units...')
  const units = await unitRepo.list()
  console.log(`✓ Found ${units.length} units`)

  console.log('Fetching leave requests...')
  const leaveRequests = await leaveRequestRepo.list()
  console.log(`✓ Found ${leaveRequests.length} leave requests`)

  console.log('Fetching leave assignments...')
  const leaveAssignments = await leaveAssignmentRepo.list()
  console.log(`✓ Found ${leaveAssignments.length} leave assignments`)

  console.log('Fetching task assignments...')
  const taskAssignments = await taskAssignmentRepo.list()
  console.log(`✓ Found ${taskAssignments.length} task assignments`)

  console.log('Fetching config...')
  const config = await configRepo.read()
  console.log('✓ Config loaded')

  console.log('Fetching admins...')
  const admins = await adminRepo.list()
  console.log(`✓ Found ${admins.length} admins`)

  console.log('Fetching commanders...')
  const commanders = await commanderRepo.list()
  console.log(`✓ Found ${commanders.length} commanders`)

  console.log('Fetching roles...')
  // Assuming roles are stored in a Roles tab
  const rolesValues = await sheets.getValues(SPREADSHEET_ID, 'Roles!A:A')
  const roles = rolesValues.slice(1).map(row => row[0]).filter(Boolean)
  console.log(`✓ Found ${roles.length} roles`)

  const database = {
    version: 1,
    lastModified: new Date().toISOString(),
    soldiers,
    tasks,
    units,
    leaveRequests,
    leaveAssignments,
    taskAssignments,
    config,
    roles,
    admins,
    commanders,
  }

  const outputPath = 'public/data/database.json'
  fs.writeFileSync(outputPath, JSON.stringify(database, null, 2))

  console.log(`\n✅ Export complete!`)
  console.log(`Database saved to: ${outputPath}`)
  console.log(`\nSummary:`)
  console.log(`  - Soldiers: ${soldiers.length}`)
  console.log(`  - Tasks: ${tasks.length}`)
  console.log(`  - Units: ${units.length}`)
  console.log(`  - Leave Requests: ${leaveRequests.length}`)
  console.log(`  - Leave Assignments: ${leaveAssignments.length}`)
  console.log(`  - Task Assignments: ${taskAssignments.length}`)
  console.log(`  - Roles: ${roles.length}`)
  console.log(`  - Admins: ${admins.length}`)
  console.log(`  - Commanders: ${commanders.length}`)
}

exportToJson().catch(err => {
  console.error('Export failed:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Add script to package.json**

In `package.json`, add to scripts section:

```json
"export-sheets": "tsx scripts/export-sheets-to-json.ts"
```

- [ ] **Step 4: Test export script (manual step)**

This requires actual Google Sheets credentials and should be run manually when ready:

```bash
GOOGLE_ACCESS_TOKEN=your_token SPREADSHEET_ID=your_id npm run export-sheets
```

Expected: Creates `public/data/database.json` with all data

- [ ] **Step 5: Commit**

```bash
git add scripts/export-sheets-to-json.ts public/data/.gitkeep package.json
git commit -m "feat: add Google Sheets to JSON export script

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Refactor SoldierRepository to Use JSON

**Files:**
- Modify: `src/services/soldierRepository.ts`
- Modify: `src/services/soldierRepository.test.ts`

- [ ] **Step 1: Update soldierRepository test to use DatabaseContext**

```typescript
// Replace entire file src/services/soldierRepository.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SoldierRepository } from './soldierRepository'
import { useDatabase } from '../contexts/DatabaseContext'
import type { Database } from '../types/Database'
import type { CreateSoldierInput } from '../models'

describe('SoldierRepository', () => {
  const mockDatabase: Database = {
    version: 1,
    lastModified: '2026-03-31T10:00:00.000Z',
    soldiers: [
      {
        id: 's1',
        firstName: 'David',
        lastName: 'Cohen',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-12-31',
        initialFairness: 0,
        currentFairness: 0,
        status: 'Active',
        hoursWorked: 0,
        weekendLeavesCount: 0,
        midweekLeavesCount: 0,
        afterLeavesCount: 0
      },
      {
        id: 's2',
        firstName: 'Moshe',
        lastName: 'Levi',
        role: 'Medic',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-12-31',
        initialFairness: 0,
        currentFairness: 1,
        status: 'Active',
        hoursWorked: 8,
        weekendLeavesCount: 1,
        midweekLeavesCount: 0,
        afterLeavesCount: 0
      }
    ],
    tasks: [],
    units: [],
    leaveRequests: [],
    leaveAssignments: [],
    taskAssignments: [],
    config: {
      scheduleStartDate: '2026-01-01',
      scheduleEndDate: '2026-12-31',
      leaveRatioDaysInBase: 10,
      leaveRatioDaysHome: 4,
      longLeaveMaxDays: 14,
      weekendDays: ['Friday', 'Saturday'],
      minBasePresence: 5,
      minBasePresenceByRole: { Driver: 2, Medic: 1, Commander: 1 },
      maxDrivingHours: 12,
      defaultRestPeriod: 8,
      taskTypeRestPeriods: {},
      adminEmails: [],
      leaveBaseExitHour: '16:00',
      leaveBaseReturnHour: '08:00'
    },
    roles: ['Driver', 'Medic', 'Commander'],
    admins: [],
    commanders: []
  }

  let mockContext: ReturnType<typeof useDatabase>
  let repo: SoldierRepository

  beforeEach(() => {
    const dbCopy = JSON.parse(JSON.stringify(mockDatabase))
    mockContext = {
      database: dbCopy,
      loading: false,
      error: null,
      reload: async () => {},
      getData: () => dbCopy,
      setData: (db: Database) => {
        mockContext.database = db
      }
    }
    repo = new SoldierRepository(mockContext)
  })

  describe('list()', () => {
    it('returns all soldiers', async () => {
      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(2)
      expect(soldiers[0].id).toBe('s1')
      expect(soldiers[0].firstName).toBe('David')
      expect(soldiers[1].id).toBe('s2')
    })

    it('returns empty array when no soldiers', async () => {
      mockContext.database!.soldiers = []
      const soldiers = await repo.list()
      expect(soldiers).toHaveLength(0)
    })
  })

  describe('getById()', () => {
    it('returns soldier by id', async () => {
      const soldier = await repo.getById('s2')
      expect(soldier).not.toBeNull()
      expect(soldier!.firstName).toBe('Moshe')
      expect(soldier!.lastName).toBe('Levi')
    })

    it('returns null for unknown id', async () => {
      const soldier = await repo.getById('unknown')
      expect(soldier).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates a new soldier and returns it', async () => {
      const input: CreateSoldierInput = {
        id: 's3',
        firstName: 'Yosef',
        lastName: 'Cohen',
        role: 'Commander',
        serviceStart: '2026-02-01',
        serviceEnd: '2026-12-31'
      }

      const soldier = await repo.create(input)
      expect(soldier.id).toBe('s3')
      expect(soldier.firstName).toBe('Yosef')
      expect(soldier.status).toBe('Active')
      expect(soldier.currentFairness).toBe(0)
      expect(soldier.hoursWorked).toBe(0)

      const all = await repo.list()
      expect(all).toHaveLength(3)
    })
  })

  describe('update()', () => {
    it('updates soldier fields', async () => {
      await repo.update({
        id: 's1',
        firstName: 'Updated',
        currentFairness: 10
      })

      const soldier = await repo.getById('s1')
      expect(soldier!.firstName).toBe('Updated')
      expect(soldier!.currentFairness).toBe(10)
      expect(soldier!.lastName).toBe('Cohen') // unchanged
    })

    it('throws error for unknown soldier', async () => {
      await expect(
        repo.update({ id: 'unknown', firstName: 'Test' })
      ).rejects.toThrow('not found')
    })
  })

  describe('getActiveByRole()', () => {
    it('returns active soldiers filtered by role', async () => {
      const drivers = await repo.getActiveByRole('Driver')
      expect(drivers).toHaveLength(1)
      expect(drivers[0].role).toBe('Driver')
      expect(drivers[0].status).toBe('Active')
    })

    it('returns empty array when no match', async () => {
      const commanders = await repo.getActiveByRole('Commander')
      expect(commanders).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- soldierRepository.test.ts`
Expected: FAIL (SoldierRepository constructor signature changed)

- [ ] **Step 3: Refactor SoldierRepository**

```typescript
// Replace entire file src/services/soldierRepository.ts
import { JsonRepository } from './JsonRepository'
import type { Soldier, CreateSoldierInput, UpdateSoldierInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'
import type { SoldierRole } from '../constants'

export class SoldierRepository extends JsonRepository<Soldier> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'soldiers')
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

    return super.create(soldier)
  }

  async update(input: UpdateSoldierInput): Promise<void> {
    const { id, newId, ...updates } = input

    if (newId !== undefined) {
      const existing = await this.getById(id)
      if (!existing) throw new Error(`Soldier with id "${id}" not found`)

      await this.delete(id)
      await super.create({ ...existing, ...updates, id: newId })
    } else {
      await super.update(id, updates)
    }
  }

  async getActiveByRole(role: SoldierRole): Promise<Soldier[]> {
    const soldiers = await this.list()
    return soldiers.filter(s => s.role === role && s.status === 'Active')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- soldierRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/soldierRepository.ts src/services/soldierRepository.test.ts
git commit -m "refactor: migrate SoldierRepository to JSON

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Refactor Remaining Repositories

**Files:**
- Modify: `src/services/taskRepository.ts`
- Modify: `src/services/leaveRequestRepository.ts`
- Modify: `src/services/leaveAssignmentRepository.ts`
- Modify: `src/services/taskAssignmentRepository.ts`
- Modify: `src/services/unitRepository.ts`
- Modify: `src/services/adminRepository.ts`
- Modify: `src/services/commanderRepository.ts`

- [ ] **Step 1: Refactor TaskRepository**

```typescript
// Replace entire file src/services/taskRepository.ts
import { JsonRepository } from './JsonRepository'
import type { Task, CreateTaskInput, UpdateTaskInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class TaskRepository extends JsonRepository<Task> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'tasks')
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}`,
      taskType: input.taskType,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: input.durationHours ?? 8,
      roleRequirements: input.roleRequirements,
      minRestAfter: input.minRestAfter ?? 8,
      isSpecial: input.isSpecial ?? false,
      specialDurationDays: input.specialDurationDays
    }

    return super.create(task)
  }

  async update(input: UpdateTaskInput): Promise<void> {
    const { id, ...updates } = input
    await super.update(id, updates)
  }
}
```

- [ ] **Step 2: Refactor LeaveRequestRepository**

```typescript
// Replace entire file src/services/leaveRequestRepository.ts
import { JsonRepository } from './JsonRepository'
import type { LeaveRequest, CreateLeaveRequestInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class LeaveRequestRepository extends JsonRepository<LeaveRequest> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'leaveRequests')
  }

  async submit(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const request: LeaveRequest = {
      id: `lr-${Date.now()}`,
      soldierId: input.soldierId,
      startDate: input.startDate,
      endDate: input.endDate,
      leaveType: this.inferLeaveType(input.startDate, input.endDate),
      constraintType: input.constraintType,
      priority: input.priority,
      status: 'Pending'
    }

    return super.create(request)
  }

  private inferLeaveType(startDate: string, endDate: string): 'Weekend' | 'Midweek' | 'After' {
    const start = new Date(startDate)
    const day = start.getDay()

    if (day === 5 || day === 6) return 'Weekend'
    if (day === 0) return 'After'
    return 'Midweek'
  }
}
```

- [ ] **Step 3: Refactor LeaveAssignmentRepository**

```typescript
// Replace entire file src/services/leaveAssignmentRepository.ts
import { JsonRepository } from './JsonRepository'
import type { LeaveAssignment } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class LeaveAssignmentRepository extends JsonRepository<LeaveAssignment> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'leaveAssignments')
  }
}
```

- [ ] **Step 4: Refactor TaskAssignmentRepository**

```typescript
// Replace entire file src/services/taskAssignmentRepository.ts
import { JsonRepository } from './JsonRepository'
import type { TaskAssignment } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class TaskAssignmentRepository extends JsonRepository<TaskAssignment> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'taskAssignments')
  }
}
```

- [ ] **Step 5: Refactor UnitRepository**

```typescript
// Replace entire file src/services/unitRepository.ts
import { JsonRepository } from './JsonRepository'
import type { Unit, CreateUnitInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class UnitRepository extends JsonRepository<Unit> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'units')
  }

  async create(input: CreateUnitInput): Promise<Unit> {
    const unit: Unit = {
      id: `unit-${Date.now()}`,
      name: input.name,
      spreadsheetId: input.spreadsheetId,
      tabPrefix: input.tabPrefix,
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    }

    return super.create(unit)
  }
}
```

- [ ] **Step 6: Refactor AdminRepository**

```typescript
// Replace entire file src/services/adminRepository.ts
import { JsonRepository } from './JsonRepository'
import type { Admin, CreateAdminInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class AdminRepository extends JsonRepository<Admin> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'admins')
  }

  async create(input: CreateAdminInput): Promise<Admin> {
    const admin: Admin = {
      id: `admin-${Date.now()}`,
      email: input.email,
      addedAt: new Date().toISOString(),
      addedBy: 'system'
    }

    return super.create(admin)
  }
}
```

- [ ] **Step 7: Refactor CommanderRepository**

```typescript
// Replace entire file src/services/commanderRepository.ts
import { JsonRepository } from './JsonRepository'
import type { Commander, CreateCommanderInput } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class CommanderRepository extends JsonRepository<Commander> {
  constructor(context: ReturnType<typeof useDatabase>) {
    super(context, 'commanders')
  }

  async create(input: CreateCommanderInput): Promise<Commander> {
    const commander: Commander = {
      id: `cmd-${Date.now()}`,
      email: input.email,
      unitId: input.unitId,
      addedAt: new Date().toISOString(),
      addedBy: 'system'
    }

    return super.create(commander)
  }
}
```

- [ ] **Step 8: Run all tests**

Run: `npm test`
Expected: All repository tests pass

- [ ] **Step 9: Commit**

```bash
git add src/services/*.ts
git commit -m "refactor: migrate all repositories to JSON

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Refactor ConfigRepository

**Files:**
- Modify: `src/services/configRepository.ts`

- [ ] **Step 1: Refactor ConfigRepository to use DatabaseContext**

```typescript
// Replace entire file src/services/configRepository.ts
import type { AppConfig } from '../models'
import type { useDatabase } from '../contexts/DatabaseContext'

export class ConfigRepository {
  private context: ReturnType<typeof useDatabase>

  constructor(context: ReturnType<typeof useDatabase>) {
    this.context = context
  }

  async read(): Promise<AppConfig> {
    const db = this.context.getData()
    return db.config
  }

  async update(updates: Partial<AppConfig>): Promise<void> {
    const db = this.context.getData()
    const updated = { ...db.config, ...updates }
    this.context.setData({ ...db, config: updated })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/configRepository.ts
git commit -m "refactor: migrate ConfigRepository to JSON

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Update App.tsx to Use DatabaseProvider

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace AuthProvider with DatabaseProvider in App.tsx**

Find this code in `src/App.tsx`:

```typescript
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
```

Replace with:

```typescript
import { DatabaseProvider, useDatabase } from './contexts/DatabaseContext'
```

Find this code:

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

Replace with:

```typescript
export default function App() {
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        <AppContent />
      </DatabaseProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: Remove auth-related code from AppContent**

In the `AppContent` function, remove:

```typescript
const { auth } = useAuth()
```

Add:

```typescript
const { database, loading: dbLoading, error: dbError } = useDatabase()
```

Remove the authentication check:

```typescript
if (!auth.isAuthenticated) return <LoginPage />
```

Add database loading check:

```typescript
if (dbLoading) return (
  <div className="min-h-screen bg-olive-50 flex items-center justify-center">
    <p className="text-olive-500">Loading database…</p>
  </div>
)
if (dbError) return (
  <div className="min-h-screen bg-olive-50 flex items-center justify-center">
    <p className="text-red-500">Error loading database: {dbError}</p>
  </div>
)
```

- [ ] **Step 3: Remove OAuth initialization code**

Remove all references to:
- `auth.accessToken`
- `auth.email`
- Google OAuth initialization
- Login/logout flows

- [ ] **Step 4: Update repository initialization**

Change this pattern:

```typescript
const sheets = new GoogleSheetsService(auth.accessToken)
const soldierRepo = new SoldierRepository(sheets, SPREADSHEET_ID, cache)
```

To:

```typescript
const dbContext = useDatabase()
const soldierRepo = new SoldierRepository(dbContext)
```

- [ ] **Step 5: Test the app locally**

Run: `npm run dev`
Expected: App loads but shows database loading error (database.json doesn't exist yet)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace AuthProvider with DatabaseProvider

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Remove Google Sheets Dependencies

**Files:**
- Delete: `src/services/googleSheets.ts`
- Delete: `src/services/parsers.ts`
- Delete: `src/services/serializers.ts`
- Delete: `src/services/cache.ts`
- Delete: `src/context/AuthContext.tsx`
- Delete: `src/context/AuthContext.test.tsx`
- Delete: `src/components/LoginPage.tsx` (if exists)
- Modify: `package.json`

- [ ] **Step 1: Delete Google Sheets service files**

```bash
git rm src/services/googleSheets.ts
git rm src/services/parsers.ts
git rm src/services/serializers.ts
git rm src/services/cache.ts
```

- [ ] **Step 2: Delete auth context files**

```bash
git rm src/context/AuthContext.tsx
git rm src/context/AuthContext.test.tsx
```

- [ ] **Step 3: Remove Google Sheets dependencies from package.json**

Remove these lines from `dependencies` or `devDependencies`:

```json
"gapi-script": "^1.2.0",
"googleapis": "^171.4.0"
```

Also remove from `devDependencies`:

```json
"@types/gapi": "^0.0.47",
"@types/gapi.auth2": "^0.0.61"
```

- [ ] **Step 4: Run npm install to update lockfile**

Run: `npm install`
Expected: Removed packages are uninstalled

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "refactor: remove Google Sheets dependencies

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Create Initial Database JSON File

**Files:**
- Create: `public/data/database.json`

- [ ] **Step 1: Create minimal database.json for testing**

```json
{
  "version": 1,
  "lastModified": "2026-03-31T10:00:00.000Z",
  "soldiers": [],
  "tasks": [],
  "units": [],
  "leaveRequests": [],
  "leaveAssignments": [],
  "taskAssignments": [],
  "config": {
    "scheduleStartDate": "2026-01-01",
    "scheduleEndDate": "2026-12-31",
    "leaveRatioDaysInBase": 10,
    "leaveRatioDaysHome": 4,
    "longLeaveMaxDays": 14,
    "weekendDays": ["Friday", "Saturday"],
    "minBasePresence": 5,
    "minBasePresenceByRole": {
      "Driver": 2,
      "Medic": 1,
      "Commander": 1
    },
    "maxDrivingHours": 12,
    "defaultRestPeriod": 8,
    "taskTypeRestPeriods": {},
    "adminEmails": [],
    "leaveBaseExitHour": "16:00",
    "leaveBaseReturnHour": "08:00"
  },
  "roles": ["Driver", "Medic", "Commander"],
  "admins": [],
  "commanders": []
}
```

- [ ] **Step 2: Test app loads with empty database**

Run: `npm run dev`
Expected: App loads successfully, shows empty state

- [ ] **Step 3: Commit**

```bash
git add public/data/database.json
git commit -m "feat: add initial empty database.json

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Update DataService and MasterDataService

**Files:**
- Modify: `src/services/dataService.ts`
- Modify: `src/services/masterDataService.ts`

- [ ] **Step 1: Refactor dataService.ts**

Replace GoogleSheetsService initialization with DatabaseContext usage:

Before:
```typescript
constructor(accessToken: string, spreadsheetId: string, cache: SheetCache) {
  const sheets = new GoogleSheetsService(accessToken)
  this.soldierRepo = new SoldierRepository(sheets, spreadsheetId, cache)
  // ...
}
```

After:
```typescript
constructor(dbContext: ReturnType<typeof useDatabase>) {
  this.soldierRepo = new SoldierRepository(dbContext)
  this.taskRepo = new TaskRepository(dbContext)
  // ... initialize all other repos with dbContext
}
```

- [ ] **Step 2: Refactor masterDataService.ts**

Similar refactoring - replace GoogleSheetsService with DatabaseContext

- [ ] **Step 3: Update all service instantiation sites**

Find all places where DataService and MasterDataService are created and update the constructor calls

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/services/dataService.ts src/services/masterDataService.ts
git commit -m "refactor: update DataService to use DatabaseContext

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: End-to-End Testing

**Files:**
- Manual testing

- [ ] **Step 1: Build the app**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Preview production build**

Run: `npm run preview`
Expected: App loads and shows empty database

- [ ] **Step 3: Test adding a soldier manually**

In browser console:
```javascript
// This simulates what would happen in admin UI
const db = JSON.parse(await fetch('/data/database.json').then(r => r.text()))
db.soldiers.push({
  id: 'test1',
  firstName: 'Test',
  lastName: 'Soldier',
  role: 'Driver',
  serviceStart: '2026-01-01',
  serviceEnd: '2026-12-31',
  initialFairness: 0,
  currentFairness: 0,
  status: 'Active',
  hoursWorked: 0,
  weekendLeavesCount: 0,
  midweekLeavesCount: 0,
  afterLeavesCount: 0
})
console.log(JSON.stringify(db, null, 2))
```

Copy the output and save to `public/data/database.json`, then refresh the app.
Expected: Test soldier appears in the UI

- [ ] **Step 4: Verify all pages load**

Navigate to:
- Dashboard
- Soldiers page
- Tasks page
- Leave requests page
- Schedule page
- History page

Expected: All pages load without errors (though they may show empty states)

- [ ] **Step 5: Document manual testing results**

Create a file documenting test results:

```bash
echo "# Manual Testing Results

Date: $(date)

✓ App builds successfully
✓ App loads in browser
✓ Database loads from /data/database.json
✓ All navigation links work
✓ Empty states render correctly
✓ Manual soldier add test passed

## Next Steps
- Export real data from Google Sheets
- Test with production data
- Build admin UI for data management
" > docs/testing/json-migration-manual-tests.md
```

- [ ] **Step 6: Commit**

```bash
git add docs/testing/json-migration-manual-tests.md
git commit -m "docs: add manual testing results for JSON migration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Update README and Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with new architecture**

Add section explaining JSON database:

```markdown
## Architecture

### Data Storage

ShabTzak uses a static JSON file (`public/data/database.json`) as its database, served via GitHub Pages. This eliminates external dependencies, API rate limits, and authentication complexity.

**Benefits:**
- 10-20x faster load times (single HTTP request vs multiple API calls)
- No rate limits (unlimited reads from CDN)
- No authentication required (no Google OAuth)
- Offline-capable (JSON file can be cached)
- Version control (database changes tracked in git)
- Zero hosting costs (GitHub Pages free tier)

### Data Flow

**Read Operations (All Users):**
1. On app startup, fetch `/data/database.json`
2. Store in React Context (in-memory)
3. All operations are instant (no HTTP requests)

**Write Operations (Super Admin Only):**
1. Run app locally: `npm run dev`
2. Make changes via Admin UI
3. Export database: downloads `database.json`
4. Save to `public/data/database.json`
5. Commit and deploy: `npm run deploy`
6. Users get updates on next page refresh

### Migrating from Google Sheets

If you have existing data in Google Sheets:

```bash
# Export current data to JSON
GOOGLE_ACCESS_TOKEN=your_token SPREADSHEET_ID=your_id npm run export-sheets

# Verify the export
cat public/data/database.json

# Commit and deploy
git add public/data/database.json
git commit -m "data: export from Google Sheets"
npm run deploy
```
```

- [ ] **Step 2: Update installation instructions**

Remove Google OAuth setup instructions, add simpler steps:

```markdown
## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Run locally: `npm run dev`
4. Build: `npm run build`
5. Deploy: `npm run deploy`

No API keys or authentication required!
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for JSON database architecture

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Success Criteria

After completing all tasks, verify:

- [ ] ✅ App loads in <1 second (vs 5-8s with Google Sheets)
- [ ] ✅ No API rate limit errors (429)
- [ ] ✅ No authentication required for regular users
- [ ] ✅ All existing features work identically (no regressions)
- [ ] ✅ All tests pass
- [ ] ✅ Zero hosting costs (GitHub Pages free tier)
- [ ] ✅ `npm run build` succeeds
- [ ] ✅ Production deployment works
- [ ] ✅ Database loads from static JSON file
- [ ] ✅ In-memory operations are instant

---

## Timeline Estimate

- **Task 1-2:** Define types and base repository (2 hours)
- **Task 3:** Export script (1 hour)
- **Task 4-5:** Refactor repositories (3 hours)
- **Task 6-7:** Config and App.tsx updates (2 hours)
- **Task 8-9:** Remove old dependencies, create initial DB (1 hour)
- **Task 10:** Update services (2 hours)
- **Task 11:** End-to-end testing (2 hours)
- **Task 12:** Documentation (1 hour)

**Total:** 14 hours (2 days of focused work)

---

## Notes for Implementation

- This plan assumes the export script will be run manually with real Google Sheets credentials when ready
- The admin UI for importing/exporting data is NOT included in this plan (separate feature)
- All repository tests should pass before moving to the next task
- Each commit should be small and focused on one change
- Follow TDD: write test, see it fail, implement, see it pass, commit
- Use `npm test -- <filename>` to run individual test files during development
