# ShabTzak Soldier Scheduling System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based soldier scheduling system that automates leave and task assignments using Google Sheets as the database, with fairness tracking and multi-user support.

**Architecture:** React SPA with client-side scheduling algorithms, Google Sheets API for data persistence, Google OAuth for authentication, static hosting (GitHub Pages/Vercel).

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Google Sheets API v4, Google Identity Services, Vitest (testing), Playwright (E2E)

---

## Implementation Strategy

This plan follows **Test-Driven Development (TDD)** with frequent commits. Each task is 2-5 minutes.

**Phases:**
1. Project Setup & Infrastructure (Tasks 1-10)
2. Data Layer & Google Sheets Integration (Tasks 11-25)
3. Core Domain Models (Tasks 26-40)
4. Scheduling Algorithms (Tasks 41-60)
5. UI Components (Tasks 61-85)
6. Export & Multi-User Features (Tasks 86-95)
7. Polish & Production Ready (Tasks 96-100)

**Principles:** DRY, YAGNI, TDD, Frequent Commits

---

## PHASE 1: Project Setup & Infrastructure

### Task 1: Initialize React + TypeScript + Vite Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`

**Step 1: Initialize npm project**

```bash
npm create vite@latest . -- --template react-ts
```

Expected: Project scaffolded with Vite + React + TypeScript

**Step 2: Install dependencies**

```bash
npm install
npm install -D @types/node
```

Expected: Dependencies installed

**Step 3: Verify build works**

```bash
npm run dev
```

Expected: Dev server starts on http://localhost:5173

**Step 4: Commit**

```bash
git add .
git commit -m "chore: initialize React + TypeScript + Vite project"
```

---

### Task 2: Install and Configure Tailwind CSS

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `src/index.css`

**Step 1: Install Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Expected: Config files created

**Step 2: Configure Tailwind**

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Step 3: Add Tailwind directives to CSS**

Update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Test Tailwind**

Update `src/App.tsx`:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-600">ShabTzak</h1>
    </div>
  )
}

export default App
```

**Step 5: Verify styling works**

```bash
npm run dev
```

Expected: Blue "ShabTzak" title centered on gray background

**Step 6: Commit**

```bash
git add .
git commit -m "chore: add and configure Tailwind CSS"
```

---

### Task 3: Set Up Testing with Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/setupTests.ts`
- Modify: `package.json`

**Step 1: Install Vitest and testing libraries**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
```

**Step 3: Create test setup file**

Create `src/setupTests.ts`:

```typescript
import '@testing-library/jest-dom'
```

**Step 4: Add test script to package.json**

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

**Step 5: Write first test**

Create `src/App.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders ShabTzak title', () => {
    render(<App />)
    expect(screen.getByText('ShabTzak')).toBeInTheDocument()
  })
})
```

**Step 6: Run test**

```bash
npm test
```

Expected: Test passes

**Step 7: Commit**

```bash
git add .
git commit -m "chore: set up Vitest testing framework"
```

---

### Task 4: Create Project Directory Structure

**Files:**
- Create: `src/components/` directory
- Create: `src/services/` directory
- Create: `src/models/` directory
- Create: `src/utils/` directory
- Create: `src/hooks/` directory
- Create: `src/contexts/` directory
- Create: `src/algorithms/` directory
- Create: `tests/` directory

**Step 1: Create directories**

```bash
mkdir -p src/{components,services,models,utils,hooks,contexts,algorithms}
mkdir -p tests/{unit,integration,e2e}
```

**Step 2: Create placeholder README files**

Create `src/components/README.md`:

```markdown
# Components

React UI components for the ShabTzak application.
```

Create `src/services/README.md`:

```markdown
# Services

External service integrations (Google Sheets API, etc.)
```

Create `src/models/README.md`:

```markdown
# Models

TypeScript interfaces and types for domain models.
```

Create `src/utils/README.md`:

```markdown
# Utils

Utility functions (date formatting, validation, etc.)
```

Create `src/algorithms/README.md`:

```markdown
# Algorithms

Scheduling algorithms for leave and task assignment.
```

**Step 3: Verify structure**

```bash
tree src -L 2
```

Expected: Directory structure displayed

**Step 4: Commit**

```bash
git add .
git commit -m "chore: create project directory structure"
```

---

### Task 5: Set Up Environment Variables

**Files:**
- Create: `.env.example`
- Create: `.env.local`
- Create: `src/config/env.ts`
- Modify: `.gitignore`

**Step 1: Create environment example file**

Create `.env.example`:

```env
# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com

# Google Sheets API Key (optional, for read-only public sheets)
VITE_GOOGLE_API_KEY=your-api-key-here
```

**Step 2: Create local env file (not committed)**

Create `.env.local`:

```env
# Local development - replace with actual values later
VITE_GOOGLE_CLIENT_ID=TODO
VITE_GOOGLE_API_KEY=TODO
```

**Step 3: Update .gitignore**

Add to `.gitignore`:

```
# Environment variables
.env.local
.env.production
```

**Step 4: Create env config module**

Create `src/config/env.ts`:

```typescript
export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const

export function validateConfig() {
  const missing: string[] = []

  if (!config.googleClientId) missing.push('VITE_GOOGLE_CLIENT_ID')

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
```

**Step 5: Write test for config**

Create `src/config/env.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { config } from './env'

describe('Environment Config', () => {
  it('exports config object', () => {
    expect(config).toBeDefined()
    expect(config).toHaveProperty('googleClientId')
    expect(config).toHaveProperty('isDevelopment')
  })
})
```

**Step 6: Run test**

```bash
npm test env.test
```

Expected: Test passes

**Step 7: Commit**

```bash
git add .
git commit -m "chore: set up environment configuration"
```

---

### Task 6: Install Google APIs Client Library

**Files:**
- Modify: `package.json`
- Create: `src/types/google.d.ts`

**Step 1: Install Google API libraries**

```bash
npm install gapi-script @types/gapi @types/gapi.auth2
```

**Step 2: Create TypeScript declarations for Google Identity**

Create `src/types/google.d.ts`:

```typescript
// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          prompt: () => void
          renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void
          revoke: (email: string, callback: () => void) => void
        }
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
        }
      }
    }
  }
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: CredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
}

interface CredentialResponse {
  credential: string
  select_by: string
}

interface GsiButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: string
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
}

interface TokenClient {
  requestAccessToken: () => void
}

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
}

export {}
```

**Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add .
git commit -m "chore: install Google APIs client library and add type definitions"
```

---

### Task 7: Create Constants File

**Files:**
- Create: `src/constants/index.ts`

**Step 1: Define application constants**

Create `src/constants/index.ts`:

```typescript
// Soldier roles
export const ROLES = [
  'Driver',
  'Radio Operator',
  'Medic',
  'Squad Leader',
  'Operations Room',
  'Weapons Specialist',
] as const

export type SoldierRole = typeof ROLES[number]

// Leave types
export const LEAVE_TYPES = ['After', 'Long'] as const
export type LeaveType = typeof LEAVE_TYPES[number]

// Leave constraint types
export const CONSTRAINT_TYPES = [
  'Family event',
  'University exam',
  'Civilian job',
  'Medical appointment',
  "Child's birthday",
  "Wife's birthday",
  'Wedding anniversary',
  'Parent medical appointment',
  'General home issue',
  'Preference',
] as const

export type ConstraintType = typeof CONSTRAINT_TYPES[number]

// Request status
export const REQUEST_STATUS = ['Pending', 'Approved', 'Denied'] as const
export type RequestStatus = typeof REQUEST_STATUS[number]

// Soldier status
export const SOLDIER_STATUS = ['Active', 'Injured', 'Discharged'] as const
export type SoldierStatus = typeof SOLDIER_STATUS[number]

// Configuration defaults
export const DEFAULT_CONFIG = {
  leaveRatioDaysInBase: 10,
  leaveRatioDaysHome: 4,
  longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'],
  minBasePresence: 20,
  maxDrivingHours: 8,
  defaultRestPeriod: 6,
} as const

// Google Sheets tabs
export const SHEET_TABS = {
  SOLDIERS: 'Soldiers',
  TASKS: 'Tasks',
  TASK_SCHEDULE: 'TaskSchedule',
  LEAVE_REQUESTS: 'LeaveRequests',
  LEAVE_SCHEDULE: 'LeaveSchedule',
  HISTORY: 'History',
  CONFIG: 'Config',
  VERSION: 'Version',
} as const

// Priority range
export const PRIORITY_MIN = 1
export const PRIORITY_MAX = 10

// Weekend definition (day indices: 0 = Sunday, 5 = Friday, 6 = Saturday)
export const WEEKEND_DAY_INDICES = [5, 6] // Friday, Saturday

// Fairness weights
export const FAIRNESS_WEIGHTS = {
  WEEKEND_LEAVE: 1.5,
  MIDWEEK_LEAVE: 1.0,
  AFTER_LEAVE: 0.5,
} as const
```

**Step 2: Write test for constants**

Create `src/constants/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ROLES, CONSTRAINT_TYPES, DEFAULT_CONFIG } from './index'

describe('Constants', () => {
  it('exports soldier roles', () => {
    expect(ROLES).toHaveLength(6)
    expect(ROLES).toContain('Driver')
    expect(ROLES).toContain('Medic')
  })

  it('exports constraint types', () => {
    expect(CONSTRAINT_TYPES).toHaveLength(10)
    expect(CONSTRAINT_TYPES).toContain('Family event')
  })

  it('exports default config', () => {
    expect(DEFAULT_CONFIG.leaveRatioDaysInBase).toBe(10)
    expect(DEFAULT_CONFIG.leaveRatioDaysHome).toBe(4)
    expect(DEFAULT_CONFIG.longLeaveMaxDays).toBe(4)
  })
})
```

**Step 3: Run test**

```bash
npm test constants
```

Expected: Tests pass

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add application constants and types"
```

---

### Task 8: Create Domain Model Types

**Files:**
- Create: `src/models/Soldier.ts`
- Create: `src/models/Task.ts`
- Create: `src/models/Leave.ts`
- Create: `src/models/Schedule.ts`
- Create: `src/models/Config.ts`

**Step 1: Define Soldier model**

Create `src/models/Soldier.ts`:

```typescript
import { SoldierRole, SoldierStatus } from '../constants'

export interface Soldier {
  id: string
  name: string
  role: SoldierRole
  serviceStart: string // ISO date
  serviceEnd: string // ISO date
  initialFairness: number
  currentFairness: number
  status: SoldierStatus
  hoursWorked: number
  weekendLeavesCount: number
  midweekLeavesCount: number
  afterLeavesCount: number
}

export interface CreateSoldierInput {
  name: string
  role: SoldierRole
  serviceStart: string
  serviceEnd: string
}

export interface UpdateSoldierInput {
  id: string
  name?: string
  role?: SoldierRole
  serviceStart?: string
  serviceEnd?: string
  status?: SoldierStatus
}
```

**Step 2: Define Task model**

Create `src/models/Task.ts`:

```typescript
import { SoldierRole } from '../constants'

export interface RoleRequirement {
  role: SoldierRole | 'Any'
  count: number
}

export interface Task {
  id: string
  taskType: string
  startTime: string // ISO datetime
  endTime: string // ISO datetime
  durationHours: number
  roleRequirements: RoleRequirement[]
  minRestAfter: number // hours
  isSpecial: boolean
  specialDurationDays?: number
}

export interface TaskAssignment {
  scheduleId: string
  taskId: string
  soldierId: string
  assignedRole: SoldierRole
  isLocked: boolean
  createdAt: string
  createdBy: string
}

export interface CreateTaskInput {
  taskType: string
  startTime: string
  endTime: string
  roleRequirements: RoleRequirement[]
  minRestAfter?: number
  isSpecial?: boolean
  specialDurationDays?: number
}
```

**Step 3: Define Leave model**

Create `src/models/Leave.ts`:

```typescript
import { LeaveType, ConstraintType, RequestStatus } from '../constants'

export interface LeaveRequest {
  id: string
  soldierId: string
  startDate: string // ISO date
  endDate: string // ISO date
  leaveType: LeaveType
  constraintType: ConstraintType
  priority: number // 1-10
  status: RequestStatus
}

export interface LeaveAssignment {
  id: string
  soldierId: string
  startDate: string
  endDate: string
  leaveType: LeaveType
  isWeekend: boolean
  isLocked: boolean
  requestId?: string
  createdAt: string
}

export interface CreateLeaveRequestInput {
  soldierId: string
  startDate: string
  endDate: string
  constraintType: ConstraintType
  priority: number
}
```

**Step 4: Define Schedule model**

Create `src/models/Schedule.ts`:

```typescript
import { TaskAssignment } from './Task'
import { LeaveAssignment } from './Leave'

export interface TaskSchedule {
  startDate: string
  endDate: string
  assignments: TaskAssignment[]
  conflicts: ScheduleConflict[]
}

export interface LeaveSchedule {
  startDate: string
  endDate: string
  assignments: LeaveAssignment[]
  conflicts: ScheduleConflict[]
}

export interface ScheduleConflict {
  type: ConflictType
  message: string
  affectedSoldierIds: string[]
  affectedTaskIds?: string[]
  affectedRequestIds?: string[]
  suggestions: string[]
}

export type ConflictType =
  | 'INSUFFICIENT_BASE_PRESENCE'
  | 'NO_ROLE_AVAILABLE'
  | 'REST_PERIOD_VIOLATION'
  | 'OVERLAPPING_ASSIGNMENT'
  | 'OVER_QUOTA'
```

**Step 5: Define Config model**

Create `src/models/Config.ts`:

```typescript
import { SoldierRole } from '../constants'

export interface AppConfig {
  leaveRatioDaysInBase: number
  leaveRatioDaysHome: number
  longLeaveMaxDays: number
  weekendDays: string[]
  minBasePresence: number
  minBasePresenceByRole: Record<SoldierRole, number>
  maxDrivingHours: number
  defaultRestPeriod: number
  taskTypeRestPeriods: Record<string, number>
}

export interface VersionInfo {
  tabName: string
  version: number
  lastModified: string
  lastModifiedBy: string
}
```

**Step 6: Create index barrel export**

Create `src/models/index.ts`:

```typescript
export * from './Soldier'
export * from './Task'
export * from './Leave'
export * from './Schedule'
export * from './Config'
```

**Step 7: Write tests for model types**

Create `src/models/Soldier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Soldier } from './Soldier'

describe('Soldier Model', () => {
  it('has correct type structure', () => {
    const soldier: Soldier = {
      id: '1',
      name: 'David',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-08-31',
      initialFairness: 0,
      currentFairness: 0,
      status: 'Active',
      hoursWorked: 0,
      weekendLeavesCount: 0,
      midweekLeavesCount: 0,
      afterLeavesCount: 0,
    }

    expect(soldier.id).toBe('1')
    expect(soldier.role).toBe('Driver')
  })
})
```

**Step 8: Run tests**

```bash
npm test models
```

Expected: Tests pass

**Step 9: Commit**

```bash
git add .
git commit -m "feat: define domain model types for Soldier, Task, Leave, Schedule, Config"
```

---

### Task 9: Create Utility Functions (Date Handling)

**Files:**
- Create: `src/utils/dateUtils.ts`
- Create: `src/utils/dateUtils.test.ts`

**Step 1: Write test for date utilities**

Create `src/utils/dateUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  isWeekend,
  calculateNights,
  formatDate,
  parseDate,
  isSameDay,
  addDays,
} from './dateUtils'

describe('Date Utils', () => {
  describe('isWeekend', () => {
    it('returns true for Friday', () => {
      const friday = new Date('2026-03-20') // Friday
      expect(isWeekend(friday)).toBe(true)
    })

    it('returns true for Saturday', () => {
      const saturday = new Date('2026-03-21') // Saturday
      expect(isWeekend(saturday)).toBe(true)
    })

    it('returns false for Sunday', () => {
      const sunday = new Date('2026-03-22') // Sunday
      expect(isWeekend(sunday)).toBe(false)
    })

    it('returns false for weekdays', () => {
      const monday = new Date('2026-03-23') // Monday
      expect(isWeekend(monday)).toBe(false)
    })
  })

  describe('calculateNights', () => {
    it('calculates 1 night for consecutive days', () => {
      const start = new Date('2026-03-20')
      const end = new Date('2026-03-21')
      expect(calculateNights(start, end)).toBe(1)
    })

    it('calculates 3 nights correctly', () => {
      const start = new Date('2026-03-20')
      const end = new Date('2026-03-23')
      expect(calculateNights(start, end)).toBe(3)
    })

    it('returns 0 for same day', () => {
      const date = new Date('2026-03-20')
      expect(calculateNights(date, date)).toBe(0)
    })
  })

  describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date('2026-03-20')
      expect(formatDate(date)).toBe('2026-03-20')
    })
  })

  describe('parseDate', () => {
    it('parses ISO date string', () => {
      const date = parseDate('2026-03-20')
      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth()).toBe(2) // 0-indexed
      expect(date.getDate()).toBe(20)
    })
  })

  describe('isSameDay', () => {
    it('returns true for same day', () => {
      const date1 = new Date('2026-03-20T10:00:00')
      const date2 = new Date('2026-03-20T15:00:00')
      expect(isSameDay(date1, date2)).toBe(true)
    })

    it('returns false for different days', () => {
      const date1 = new Date('2026-03-20')
      const date2 = new Date('2026-03-21')
      expect(isSameDay(date1, date2)).toBe(false)
    })
  })

  describe('addDays', () => {
    it('adds days to date', () => {
      const date = new Date('2026-03-20')
      const result = addDays(date, 3)
      expect(formatDate(result)).toBe('2026-03-23')
    })

    it('subtracts days with negative number', () => {
      const date = new Date('2026-03-20')
      const result = addDays(date, -5)
      expect(formatDate(result)).toBe('2026-03-15')
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test dateUtils
```

Expected: FAIL - module not found

**Step 3: Implement date utilities**

Create `src/utils/dateUtils.ts`:

```typescript
import { WEEKEND_DAY_INDICES } from '../constants'

/**
 * Check if a date falls on a weekend (Friday or Saturday)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay()
  return WEEKEND_DAY_INDICES.includes(dayOfWeek)
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(startDate: Date, endDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.round((end.getTime() - start.getTime()) / msPerDay)
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2)
}

/**
 * Add days to a date (negative to subtract)
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Format datetime as ISO string
 */
export function formatDateTime(date: Date): string {
  return date.toISOString()
}

/**
 * Get date range between two dates (inclusive)
 */
export function getDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Check if a date is within service period
 */
export function isWithinServicePeriod(
  date: Date,
  serviceStart: string,
  serviceEnd: string
): boolean {
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const start = parseDate(serviceStart)
  const end = parseDate(serviceEnd)
  return checkDate >= start && checkDate <= end
}
```

**Step 4: Run test to verify it passes**

```bash
npm test dateUtils
```

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add date utility functions with tests"
```

---

### Task 10: Create Validation Utilities

**Files:**
- Create: `src/utils/validation.ts`
- Create: `src/utils/validation.test.ts`

**Step 1: Write test for validation utilities**

Create `src/utils/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  validateSoldier,
  validateLeaveRequest,
  validateTask,
  isPriorityValid,
} from './validation'
import type { CreateSoldierInput, CreateLeaveRequestInput } from '../models'

describe('Validation Utils', () => {
  describe('validateSoldier', () => {
    it('returns null for valid soldier', () => {
      const input: CreateSoldierInput = {
        name: 'David',
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      expect(validateSoldier(input)).toBeNull()
    })

    it('returns error for missing name', () => {
      const input: any = {
        role: 'Driver',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('name')
    })

    it('returns error for invalid role', () => {
      const input: any = {
        name: 'David',
        role: 'InvalidRole',
        serviceStart: '2026-01-01',
        serviceEnd: '2026-08-31',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('role')
    })

    it('returns error for end date before start date', () => {
      const input: CreateSoldierInput = {
        name: 'David',
        role: 'Driver',
        serviceStart: '2026-08-31',
        serviceEnd: '2026-01-01',
      }
      const errors = validateSoldier(input)
      expect(errors).toHaveProperty('serviceEnd')
    })
  })

  describe('validateLeaveRequest', () => {
    it('returns null for valid request', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        constraintType: 'Family event',
        priority: 5,
      }
      expect(validateLeaveRequest(input)).toBeNull()
    })

    it('returns error for invalid priority', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        constraintType: 'Family event',
        priority: 15, // Out of range
      }
      const errors = validateLeaveRequest(input)
      expect(errors).toHaveProperty('priority')
    })

    it('returns error for end date before start date', () => {
      const input: CreateLeaveRequestInput = {
        soldierId: '1',
        startDate: '2026-03-21',
        endDate: '2026-03-20',
        constraintType: 'Family event',
        priority: 5,
      }
      const errors = validateLeaveRequest(input)
      expect(errors).toHaveProperty('endDate')
    })
  })

  describe('isPriorityValid', () => {
    it('returns true for valid priorities', () => {
      expect(isPriorityValid(1)).toBe(true)
      expect(isPriorityValid(5)).toBe(true)
      expect(isPriorityValid(10)).toBe(true)
    })

    it('returns false for invalid priorities', () => {
      expect(isPriorityValid(0)).toBe(false)
      expect(isPriorityValid(11)).toBe(false)
      expect(isPriorityValid(-1)).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test validation
```

Expected: FAIL

**Step 3: Implement validation utilities**

Create `src/utils/validation.ts`:

```typescript
import { ROLES, CONSTRAINT_TYPES, PRIORITY_MIN, PRIORITY_MAX } from '../constants'
import type { CreateSoldierInput, CreateLeaveRequestInput, CreateTaskInput } from '../models'
import { parseDate } from './dateUtils'

export interface ValidationErrors {
  [field: string]: string
}

export function validateSoldier(input: CreateSoldierInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  // Name validation
  if (!input.name || input.name.trim() === '') {
    errors.name = 'Name is required'
  } else if (input.name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }

  // Role validation
  if (!input.role || !ROLES.includes(input.role as any)) {
    errors.role = 'Please select a valid role'
  }

  // Date validation
  if (!input.serviceStart) {
    errors.serviceStart = 'Service start date is required'
  }

  if (!input.serviceEnd) {
    errors.serviceEnd = 'Service end date is required'
  }

  if (input.serviceStart && input.serviceEnd) {
    const start = parseDate(input.serviceStart)
    const end = parseDate(input.serviceEnd)
    if (end <= start) {
      errors.serviceEnd = 'Service end date must be after start date'
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function validateLeaveRequest(input: CreateLeaveRequestInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  // Soldier ID validation
  if (!input.soldierId) {
    errors.soldierId = 'Soldier is required'
  }

  // Date validation
  if (!input.startDate) {
    errors.startDate = 'Start date is required'
  }

  if (!input.endDate) {
    errors.endDate = 'End date is required'
  }

  if (input.startDate && input.endDate) {
    const start = parseDate(input.startDate)
    const end = parseDate(input.endDate)
    if (end < start) {
      errors.endDate = 'End date must be on or after start date'
    }
  }

  // Constraint type validation
  if (!input.constraintType || !CONSTRAINT_TYPES.includes(input.constraintType as any)) {
    errors.constraintType = 'Please select a valid constraint type'
  }

  // Priority validation
  if (!isPriorityValid(input.priority)) {
    errors.priority = `Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function validateTask(input: CreateTaskInput): ValidationErrors | null {
  const errors: ValidationErrors = {}

  // Task type validation
  if (!input.taskType || input.taskType.trim() === '') {
    errors.taskType = 'Task type is required'
  }

  // Time validation
  if (!input.startTime) {
    errors.startTime = 'Start time is required'
  }

  if (!input.endTime) {
    errors.endTime = 'End time is required'
  }

  if (input.startTime && input.endTime) {
    const start = new Date(input.startTime)
    const end = new Date(input.endTime)
    if (end <= start) {
      errors.endTime = 'End time must be after start time'
    }
  }

  // Role requirements validation
  if (!input.roleRequirements || input.roleRequirements.length === 0) {
    errors.roleRequirements = 'At least one role requirement is needed'
  }

  return Object.keys(errors).length > 0 ? errors : null
}

export function isPriorityValid(priority: number): boolean {
  return Number.isInteger(priority) && priority >= PRIORITY_MIN && priority <= PRIORITY_MAX
}
```

**Step 4: Run test to verify it passes**

```bash
npm test validation
```

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add validation utilities with tests"
```

---

## PHASE 2: Data Layer & Google Sheets Integration

### Task 11: Create Google Sheets Service (API Wrapper) - Part 1: Setup

**Files:**
- Create: `src/services/googleSheets.ts`
- Create: `src/services/googleSheets.test.ts`

**Step 1: Write initial test**

Create `src/services/googleSheets.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GoogleSheetsService } from './googleSheets'

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService

  beforeEach(() => {
    service = new GoogleSheetsService('test-access-token')
  })

  it('initializes with access token', () => {
    expect(service).toBeDefined()
  })

  it('has getSpreadsheet method', () => {
    expect(service.getSpreadsheet).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test googleSheets
```

Expected: FAIL

**Step 3: Create basic service class**

Create `src/services/googleSheets.ts`:

```typescript
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export class GoogleSheetsService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheet(spreadsheetId: string) {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get values from a range
   */
  async getValues(spreadsheetId: string, range: string): Promise<any[][]> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch values: ${response.statusText}`)
    }

    const data = await response.json()
    return data.values || []
  }

  /**
   * Update values in a range
   */
  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update values: ${response.statusText}`)
    }
  }

  /**
   * Append values to a sheet
   */
  async appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      throw new Error(`Failed to append values: ${response.statusText}`)
    }
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string) {
    const url = SHEETS_API_BASE
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create spreadsheet: ${response.statusText}`)
    }

    return response.json()
  }
}
```

**Step 4: Run test**

```bash
npm test googleSheets
```

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat: create Google Sheets API wrapper service"
```

---

*[Note: The implementation plan continues with Tasks 12-100 covering all remaining phases. For brevity in this response, I'll provide the structure outline and a few more detailed tasks, then summarize the remaining phases.]*

---

### Task 12: Create Sheet Template Generator

**[Similar TDD structure: test first → implement → verify → commit]**

**Purpose:** Generate the initial Google Sheet structure with all required tabs

**Files:**
- Create: `src/services/sheetTemplate.ts`
- Create: `src/services/sheetTemplate.test.ts`

---

### Tasks 13-25: Complete Data Layer

- Task 13: Create data parsers (sheet rows → domain models)
- Task 14: Create data serializers (domain models → sheet rows)
- Task 15: Implement version tracking service
- Task 16: Implement conflict detection
- Task 17: Create caching layer
- Task 18: Implement optimistic updates with rollback
- Task 19-25: CRUD operations for each entity (Soldiers, Tasks, Leaves, etc.)

---

## PHASE 3: Core Domain Logic

### Tasks 26-40: Domain Services

- Task 26-30: Soldier management service
- Task 31-35: Task configuration service
- Task 36-40: Leave request service

---

## PHASE 4: Scheduling Algorithms

### Tasks 41-50: Fairness Calculator

**[Each task follows TDD: test → implement → verify → commit]**

- Task 41: Calculate task fairness (hours worked)
- Task 42: Calculate leave fairness (weekend/midweek distribution)
- Task 43: Calculate combined fairness score
- Task 44: Calculate platoon average
- Task 45: Initialize new soldier fairness
- Task 46: Update fairness on schedule change
- Task 47-50: Fairness utilities and helpers

---

### Tasks 51-60: Leave Scheduling Algorithm

- Task 51: Implement greedy heuristic scheduler
- Task 52: Hard constraint validators
- Task 53: Soft constraint scoring
- Task 54: Fitness function
- Task 55: Conflict detection
- Task 56: Locked assignment handling
- Task 57-60: Algorithm optimization and edge cases

---

### Tasks 61-70: Task Scheduling Algorithm

- Task 61: Build availability matrix
- Task 62: Role matching logic
- Task 63: Rest period enforcement
- Task 64: Hour distribution balancing
- Task 65: Special task handling (Pillbox)
- Task 66: Driving hour limits
- Task 67-70: Algorithm refinement

---

## PHASE 5: UI Components

### Tasks 71-85: React Components

**[Each component: test → implement → style → verify → commit]**

- Task 71-73: Authentication UI (Google sign-in)
- Task 74-76: Dashboard
- Task 77-79: Soldier management UI (list, add, edit)
- Task 80-82: Leave request form
- Task 83-85: Schedule visualization (calendar/timeline)

---

## PHASE 6: Export & Multi-User

### Tasks 86-90: Export Features

- Task 86-87: PDF export
- Task 88-89: WhatsApp text export
- Task 90: History snapshots

---

### Tasks 91-95: Multi-User Support

- Task 91-92: Version conflict detection UI
- Task 93-94: Merge conflict dialog
- Task 95: Concurrent edit testing

---

## PHASE 7: Production Ready

### Tasks 96-100: Polish & Deploy

- Task 96: E2E test suite
- Task 97: Performance optimization
- Task 98: Error boundary and logging
- Task 99: Production build configuration
- Task 100: Deployment to GitHub Pages/Vercel

---

## Summary of Remaining Tasks (Detail on request)

**Total: 100 bite-sized tasks**
- Each task: 2-5 minutes
- Total estimated time: ~8-10 hours of focused work
- All following TDD: test → fail → implement → pass → commit

**Next Steps:**
1. Choose execution approach (Subagent-Driven or Parallel Session)
2. Begin with Phase 1 (Tasks 1-10)
3. Progress through phases sequentially
4. Review and test after each phase
5. Deploy when Task 100 complete

---

**Execution Notes:**

- **DRY**: Don't repeat yourself - extract common logic
- **YAGNI**: You aren't gonna need it - implement only what's needed now
- **TDD**: Test-driven development - always write tests first
- **Frequent commits**: Commit after every passing test

**Dependencies:**
- Google Cloud Project (for OAuth credentials) - set up before Task 71
- GitHub/Vercel account (for deployment) - set up before Task 100

---

**End of Implementation Plan**
