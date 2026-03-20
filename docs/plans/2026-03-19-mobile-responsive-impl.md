# Mobile Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all ShabTzak screens work beautifully on mobile phones with bottom navigation, card layouts, and touch-friendly UI.

**Architecture:** Mobile-first responsive design using Tailwind CSS breakpoints. Components render different layouts based on screen size - cards on mobile (<640px), tables on desktop. A shared BottomNav component provides mobile navigation.

**Tech Stack:** React, TypeScript, Tailwind CSS (existing stack - no new dependencies)

---

## Task 1: Create useIsMobile Hook

**Files:**
- Create: `src/hooks/useIsMobile.ts`

**Step 1: Create the hook file**

```typescript
// src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 640 // Tailwind's 'sm' breakpoint

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
```

**Step 2: Commit**

```bash
git add src/hooks/useIsMobile.ts
git commit -m "feat: add useIsMobile hook for responsive layouts"
```

---

## Task 2: Create BottomNav Component

**Files:**
- Create: `src/components/BottomNav.tsx`

**Step 1: Create the BottomNav component**

```typescript
// src/components/BottomNav.tsx
import { useState } from 'react'

export interface NavItem {
  id: string
  label: string
  icon: string
  href?: string
  onClick?: () => void
}

export interface MoreMenuItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BottomNavProps {
  items: NavItem[]
  moreItems?: MoreMenuItem[]
  activeId: string
}

export default function BottomNav({ items, moreItems = [], activeId }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false)

  const handleItemClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.href) {
      window.location.hash = item.href
    }
    setShowMore(false)
  }

  const handleMoreItemClick = (item: MoreMenuItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.href) {
      window.location.hash = item.href
    }
    setShowMore(false)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-olive-200 sm:hidden z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive = activeId === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] ${
                isActive ? 'text-olive-700' : 'text-olive-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs mt-0.5">{item.label}</span>
            </button>
          )
        })}
        {moreItems.length > 0 && (
          <div className="relative flex-1">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex flex-col items-center justify-center w-full h-14 min-w-[64px] ${
                showMore ? 'text-olive-700' : 'text-olive-400'
              }`}
            >
              <span className="text-lg">⋯</span>
              <span className="text-xs mt-0.5">More</span>
            </button>
            {showMore && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMore(false)}
                />
                <div className="absolute bottom-full right-0 mb-2 mr-2 bg-white border border-olive-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                  {moreItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleMoreItemClick(item)}
                      className="block w-full text-left px-4 py-3 text-sm text-olive-700 hover:bg-olive-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: add BottomNav component for mobile navigation"
```

---

## Task 3: Update AppShell with Bottom Navigation

**Files:**
- Modify: `src/components/AppShell.tsx`

**Step 1: Add BottomNav to AppShell**

Add import at top:
```typescript
import BottomNav from './BottomNav'
import type { NavItem, MoreMenuItem } from './BottomNav'
```

Replace the return statement's JSX with mobile-aware navigation. The header nav should be hidden on mobile, and BottomNav shown instead. Add padding-bottom to main content to account for the fixed bottom nav.

Key changes:
1. Add `hidden sm:flex` to the nav element in header
2. Add BottomNav component before closing `</div>` of the root
3. Add `pb-16 sm:pb-0` to main element
4. Build navItems and moreItems arrays from navLinks

**Step 2: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: add bottom navigation to AppShell for mobile"
```

---

## Task 4: Update AdminPanel with Bottom Navigation

**Files:**
- Modify: `src/components/AdminPanel.tsx`

**Step 1: Add BottomNav to AdminPanel**

Add imports at top:
```typescript
import BottomNav from './BottomNav'
import type { NavItem, MoreMenuItem } from './BottomNav'
```

Key changes:
1. Add `hidden sm:flex` to the tab buttons container (line ~270)
2. Add BottomNav with admin-specific items
3. Add `pb-16 sm:pb-0` to the main element
4. Build navItems: Dashboard, Units, People (shows admins+commanders), Config
5. Build moreItems: Roles, Tasks, Diagnostic

**Step 2: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "feat: add bottom navigation to AdminPanel for mobile"
```

---

## Task 5: Create SoldierCard Component

**Files:**
- Create: `src/components/SoldierCard.tsx`

**Step 1: Create the SoldierCard component**

```typescript
// src/components/SoldierCard.tsx
import type { Soldier, AppConfig, LeaveAssignment } from '../models'
import FairnessBar from './FairnessBar'
import { calculateLeaveEntitlement, countUsedLeaveDays } from '../utils/leaveQuota'
import { formatDisplayDate } from '../utils/dateUtils'

interface SoldierCardProps {
  soldier: Soldier
  avgFairness: number
  configData?: AppConfig | null
  leaveAssignments?: LeaveAssignment[]
  onEdit?: () => void
  onAdjust?: () => void
  onToggleActive?: () => void
}

export default function SoldierCard({
  soldier,
  avgFairness,
  configData,
  leaveAssignments = [],
  onEdit,
  onAdjust,
  onToggleActive,
}: SoldierCardProps) {
  const s = soldier

  return (
    <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="active status"
            checked={s.status === 'Active'}
            onChange={onToggleActive}
            className="cursor-pointer mt-1"
          />
          <div>
            <p className="font-medium text-olive-800">{s.firstName} {s.lastName}</p>
            <p className="text-sm text-olive-500">{s.role}</p>
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-olive-600 hover:text-olive-800 px-2 py-1"
          >
            Edit
          </button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-olive-500">Fairness</span>
          <div className="flex-1 mx-3">
            <FairnessBar score={s.currentFairness} average={avgFairness} />
          </div>
          <span className="text-olive-700 font-mono text-xs">{s.currentFairness.toFixed(1)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-olive-500">Status</span>
          <span className={s.status === 'Active' ? 'text-green-600' : 'text-gray-500'}>
            {s.status === 'Active' ? '✓ Active' : 'Inactive'}
            {s.status === 'Inactive' && s.inactiveReason && (
              <span className="text-xs text-gray-400 ml-1">({s.inactiveReason})</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-olive-500">Service</span>
          <span className="text-olive-700 text-xs">
            {formatDisplayDate(s.serviceStart)} → {formatDisplayDate(s.serviceEnd)}
          </span>
        </div>

        {configData && (
          <div className="flex items-center justify-between">
            <span className="text-olive-500">Quota</span>
            <span className="text-olive-700 text-xs">
              {calculateLeaveEntitlement(s, configData)} days
              <span className="text-gray-400 ml-1">
                ({countUsedLeaveDays(s.id, leaveAssignments)} used)
              </span>
            </span>
          </div>
        )}
      </div>

      {onAdjust && (
        <div className="mt-3 pt-3 border-t border-olive-100">
          <button
            onClick={onAdjust}
            className="text-xs text-olive-600 hover:text-olive-800"
          >
            Adjust Fairness
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SoldierCard.tsx
git commit -m "feat: add SoldierCard component for mobile view"
```

---

## Task 6: Update SoldiersPage with Mobile Card Layout

**Files:**
- Modify: `src/components/SoldiersPage.tsx`

**Step 1: Add imports and useIsMobile**

Add at top:
```typescript
import { useIsMobile } from '../hooks/useIsMobile'
import SoldierCard from './SoldierCard'
```

Add inside component:
```typescript
const isMobile = useIsMobile()
```

**Step 2: Add mobile card rendering**

After the filter section and before the table, add conditional rendering:

```typescript
{soldiers.length > 0 && isMobile && (
  <div className="space-y-3">
    {filteredSoldiers.map(s => (
      <SoldierCard
        key={s.id}
        soldier={s}
        avgFairness={avgFairness}
        configData={configData}
        leaveAssignments={leaveAssignments}
        onEdit={onUpdateSoldier ? () => handleEditOpen(s) : undefined}
        onAdjust={() => setAdjustingId(id => id === s.id ? null : s.id)}
        onToggleActive={() => handleCheckboxChange(s)}
      />
    ))}
  </div>
)}
```

**Step 3: Wrap table in `!isMobile` condition**

Change the existing table section to only render on desktop:
```typescript
{soldiers.length > 0 && !isMobile && (
  // existing table code
)}
```

**Step 4: Update filter section for mobile stacking**

Change the filter div from:
```typescript
<div className="flex gap-2">
```
to:
```typescript
<div className="flex flex-col sm:flex-row gap-2">
```

**Step 5: Commit**

```bash
git add src/components/SoldiersPage.tsx
git commit -m "feat: add mobile card layout to SoldiersPage"
```

---

## Task 7: Update ScheduleCalendar for Better Mobile UX

**Files:**
- Modify: `src/components/ScheduleCalendar.tsx`

**Step 1: Add useIsMobile import**

```typescript
import { useIsMobile } from '../hooks/useIsMobile'
```

**Step 2: Use hook in component**

```typescript
const isMobile = useIsMobile()
```

**Step 3: Update date header to show short format on mobile**

Create a helper function:
```typescript
function formatDateHeader(dateStr: string, short: boolean): string {
  if (short) {
    // Just show day number
    return dateStr.split('-')[2].replace(/^0/, '')
  }
  return formatDisplayDate(dateStr)
}
```

Update the header th to use: `{formatDateHeader(d, isMobile)}`

**Step 4: Make legend collapsible on mobile**

Add state:
```typescript
const [legendExpanded, setLegendExpanded] = useState(!isMobile)
```

Wrap the legend in a collapsible container on mobile.

**Step 5: Commit**

```bash
git add src/components/ScheduleCalendar.tsx
git commit -m "feat: improve ScheduleCalendar mobile UX"
```

---

## Task 8: Create LeaveRequestCard Component

**Files:**
- Create: `src/components/LeaveRequestCard.tsx`

**Step 1: Create the card component**

```typescript
// src/components/LeaveRequestCard.tsx
import type { LeaveRequest, Soldier } from '../models'
import { formatDisplayDate } from '../utils/dateUtils'
import { fullName } from '../utils/helpers'

const STATUS_CLASSES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Denied: 'bg-red-100 text-red-600',
}

interface LeaveRequestCardProps {
  request: LeaveRequest
  soldier?: Soldier
  onApprove?: () => void
  onDeny?: () => void
}

export default function LeaveRequestCard({
  request,
  soldier,
  onApprove,
  onDeny,
}: LeaveRequestCardProps) {
  const req = request

  return (
    <div className="bg-white rounded-lg border border-olive-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="font-medium text-olive-800">
          {soldier ? fullName(soldier) : req.soldierId}
        </p>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[req.status] ?? ''}`}>
          {req.status}
        </span>
      </div>

      <div className="space-y-1 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-olive-500">Dates</span>
          <span className="text-olive-700">
            {formatDisplayDate(req.startDate)} – {formatDisplayDate(req.endDate)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-olive-500">Type</span>
          <span className="text-olive-700">{req.leaveType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-olive-500">Priority</span>
          <span className="text-olive-700">{req.priority}</span>
        </div>
      </div>

      {req.status === 'Pending' && (onApprove || onDeny) && (
        <div className="flex gap-2 pt-3 border-t border-olive-100">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 py-2 text-sm text-green-600 bg-green-50 rounded hover:bg-green-100"
            >
              Approve
            </button>
          )}
          {onDeny && (
            <button
              onClick={() => {
                if (window.confirm('Deny this leave request?')) onDeny()
              }}
              className="flex-1 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100"
            >
              Deny
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/LeaveRequestCard.tsx
git commit -m "feat: add LeaveRequestCard component for mobile view"
```

---

## Task 9: Update LeaveRequestsPage with Mobile Layout

**Files:**
- Modify: `src/components/LeaveRequestsPage.tsx`

**Step 1: Add imports**

```typescript
import { useIsMobile } from '../hooks/useIsMobile'
import LeaveRequestCard from './LeaveRequestCard'
```

**Step 2: Add hook usage**

```typescript
const isMobile = useIsMobile()
```

**Step 3: Add mobile card layout**

After the filter, add:
```typescript
{filtered.length > 0 && isMobile && (
  <div className="space-y-3">
    {filtered.map(req => {
      const soldier = soldierMap.get(req.soldierId)
      return (
        <LeaveRequestCard
          key={req.id}
          request={req}
          soldier={soldier}
          onApprove={() => onApprove(req.id)}
          onDeny={() => onDeny(req.id)}
        />
      )
    })}
  </div>
)}
```

**Step 4: Wrap table in !isMobile condition**

```typescript
{filtered.length > 0 && !isMobile && (
  // existing table code
)}
```

**Step 5: Commit**

```bash
git add src/components/LeaveRequestsPage.tsx
git commit -m "feat: add mobile card layout to LeaveRequestsPage"
```

---

## Task 10: Update TasksPage with Mobile Layout

**Files:**
- Modify: `src/components/TasksPage.tsx`

**Step 1: Add imports and hook**

```typescript
import { useIsMobile } from '../hooks/useIsMobile'
```

```typescript
const isMobile = useIsMobile()
```

**Step 2: Create inline TaskCard render**

Add mobile card layout for tasks showing: taskType, start time, duration, role requirements. Edit button expands the form inline.

**Step 3: Conditional rendering**

Wrap table in `!isMobile` condition, add card grid for mobile.

**Step 4: Commit**

```bash
git add src/components/TasksPage.tsx
git commit -m "feat: add mobile card layout to TasksPage"
```

---

## Task 11: Update HistoryPage with Mobile Layout

**Files:**
- Modify: `src/components/HistoryPage.tsx`

**Step 1: Add imports and hook**

```typescript
import { useIsMobile } from '../hooks/useIsMobile'
```

```typescript
const isMobile = useIsMobile()
```

**Step 2: Add mobile card layout**

Each history entry becomes a card showing timestamp, action, entity type, details, and who made the change.

**Step 3: Conditional rendering for table vs cards**

**Step 4: Commit**

```bash
git add src/components/HistoryPage.tsx
git commit -m "feat: add mobile card layout to HistoryPage"
```

---

## Task 12: Update Dashboard for Mobile

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Step 1: Stack fairness summary vertically on mobile**

Change from:
```typescript
<div className="flex gap-6 text-sm text-olive-600">
```
to:
```typescript
<div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-olive-600">
```

**Step 2: Ensure stat cards have minimum touch target**

Add `min-h-[80px]` to stat card divs.

**Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: improve Dashboard mobile layout"
```

---

## Task 13: Update AdminPanel Tables to Cards on Mobile

**Files:**
- Modify: `src/components/AdminPanel.tsx`

**Step 1: Add useIsMobile**

```typescript
import { useIsMobile } from '../hooks/useIsMobile'
```

```typescript
const isMobile = useIsMobile()
```

**Step 2: Convert Admins table to cards on mobile**

**Step 3: Convert Units table to cards on mobile**

**Step 4: Convert Commanders table to cards on mobile**

**Step 5: Make Config page single-column on mobile**

Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`

**Step 6: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "feat: add mobile card layouts to AdminPanel"
```

---

## Task 14: Final Polish and Touch Targets

**Files:**
- Modify: Multiple files for touch target improvements

**Step 1: Review all buttons have min 44px tap area**

Add `min-h-[44px]` to buttons that are too small on mobile.

**Step 2: Review all form inputs have min 44px height**

Ensure inputs have adequate height for touch.

**Step 3: Test all screens at 375px width**

Manual verification that nothing overflows.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: polish mobile touch targets and spacing"
```

---

## Summary

After completing all tasks, the app will have:
- Bottom navigation on mobile for both AppShell and AdminPanel
- Card layouts for Soldiers, Leave Requests, Tasks, History, and Admin tables
- Optimized Schedule Calendar with compressed headers and collapsible legend
- Touch-friendly buttons and inputs
- No horizontal overflow on any screen

Total: 14 tasks
