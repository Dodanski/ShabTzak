# Schedule Generator Performance Optimizations

## Overview

The schedule generator is slow due to conservative batch sizes and delays when writing to Google Sheets. This document outlines specific code changes to improve performance by ~40%.

## Current Performance Bottlenecks

| Operation | File | Batch Size | Delay | For 300 items |
|-----------|------|-----------|-------|---------------|
| Task Assignment Create | masterTaskAssignmentRepository.ts:147-148 | 15 | 1500ms | ~32s |
| Leave Assignment Create | masterLeaveAssignmentRepository.ts:104-105 | 30 | 2000ms | ~42s |
| Task Assignment Delete | masterTaskAssignmentRepository.ts:280-281 | 100 | 1000ms | ~3s |

**Total estimated time for typical schedule (300 tasks + 600 leaves): ~105 seconds**

---

## Optimization 1: Increase Task Assignment Batch Size & Reduce Delay

**File:** `src/services/masterTaskAssignmentRepository.ts`
**Lines:** 147-148

**Current:**
```typescript
const BATCH_SIZE = 15  // Reduced from 20 to lower API pressure
const DELAY_MS = 1500  // Increased from 300ms to 1.5s between batches
```

**Change to (Conservative):**
```typescript
const BATCH_SIZE = 25  // Increased for better throughput
const DELAY_MS = 1000  // Reduced delay, still safe for rate limits
```

**Change to (Aggressive):**
```typescript
const BATCH_SIZE = 35  // Higher throughput
const DELAY_MS = 600   // Faster but monitor for 429 errors
```

**Impact:** 300 assignments: 32s → ~18s (conservative) or ~12s (aggressive)

---

## Optimization 2: Increase Leave Assignment Batch Size & Reduce Delay

**File:** `src/services/masterLeaveAssignmentRepository.ts`
**Lines:** 104-105

**Current:**
```typescript
const BATCH_SIZE = 30  // Reduced from 50
const DELAY_MS = 2000  // Increased from 500ms
```

**Change to (Conservative):**
```typescript
const BATCH_SIZE = 45  // Increased for better throughput
const DELAY_MS = 1200  // Reduced delay
```

**Change to (Aggressive):**
```typescript
const BATCH_SIZE = 60  // Higher throughput
const DELAY_MS = 800   // Faster but monitor for 429 errors
```

**Impact:** 600 assignments: 42s → ~22s (conservative) or ~14s (aggressive)

---

## Optimization 3: Fix Missing Retry Logic on clearValues()

**File:** `src/services/googleSheets.ts`
**Lines:** 173-185

**Issue:** `clearValues()` does NOT use `retryWithBackoff()`, so it fails immediately on 429 rate limit errors.

**Current:**
```typescript
async clearValues(spreadsheetId: string, range: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.accessToken}` },
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to clear values: ${response.status} ${errorText}`)
  }
}
```

**Change to:**
```typescript
async clearValues(spreadsheetId: string, range: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`
  await retryWithBackoff(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to clear values: ${response.status} ${errorText}`)
    }
  })
}
```

**Impact:** Prevents failures during schedule clearing when rate limited.

---

## Optimization 4: Increase Delete Batch Size (Optional)

**File:** `src/services/masterTaskAssignmentRepository.ts`
**Lines:** 280-281

**Current:**
```typescript
const BATCH_SIZE = 100  // Google Sheets allows many ranges per batchClear
const DELAY_MS = 1000   // Delay between batches to avoid rate limiting
```

**Change to:**
```typescript
const BATCH_SIZE = 150  // batchClear can handle more ranges
const DELAY_MS = 800    // Slightly reduced
```

**Impact:** Marginal improvement for large deletions.

---

## Optimization 5: Implement clearFutureLeaves() for Leave Assignments

**File:** `src/services/masterLeaveAssignmentRepository.ts`

**Issue:** Currently `generateLeaveSchedule()` calls `clearAll()` which deletes ALL leave assignments including historical ones. Task assignments already have `clearFutureAssignments()`.

**Add new method** (similar to masterTaskAssignmentRepository.ts:205-252):

```typescript
/**
 * Clear only future leave assignments (from today onwards), preserving past assignments.
 * @param today - Today's date in YYYY-MM-DD format (optional, defaults to current date)
 * @returns The assignments that were kept (past assignments)
 */
async clearFutureAssignments(today?: string): Promise<LeaveAssignment[]> {
  const todayDate = today || new Date().toISOString().split('T')[0]

  const { headers, rows } = await this.fetchAll()
  const allAssignments = rows.map(row => parseLeaveAssignment(row, headers))

  const pastAssignments: LeaveAssignment[] = []
  const futureIds: string[] = []

  for (const assignment of allAssignments) {
    // Use endDate to determine if leave is in the past
    // A leave that ended before today is considered past
    const leaveEndDate = assignment.endDate.split('T')[0]
    if (leaveEndDate < todayDate) {
      pastAssignments.push(assignment)
    } else {
      futureIds.push(assignment.id)
    }
  }

  console.log(`[masterLeaveAssignmentRepository] Clearing ${futureIds.length} future assignments, keeping ${pastAssignments.length} past assignments`)

  if (futureIds.length > 0) {
    await this.deleteByIds(futureIds)
  }

  return pastAssignments
}
```

**Then update `scheduleService.ts` lines 59-63:**

```typescript
// Change from:
if (existing.length > 0) {
  console.log(`[scheduleService] Clearing all ${existing.length} existing leave assignments for fresh generation`)
  await this.leaveAssignments.clearAll()
  existing = []
}

// To:
if (existing.length > 0) {
  console.log(`[scheduleService] Clearing future leave assignments, preserving past`)
  existing = await this.leaveAssignments.clearFutureAssignments()
}
```

**Impact:** Preserves leave history, reduces data to delete, faster regeneration.

---

## Summary of Expected Improvements

| Optimization | Current | After (Conservative) | After (Aggressive) |
|--------------|---------|---------------------|-------------------|
| Task assignments (300) | ~32s | ~18s | ~12s |
| Leave assignments (600) | ~42s | ~22s | ~14s |
| Delete operations | ~3s | ~2s | ~2s |
| **Total** | **~105s** | **~62s (-41%)** | **~42s (-60%)** |

---

## Implementation Order

1. **Start with Optimization 3** (fix clearValues retry) - Zero risk, prevents failures
2. **Apply Conservative batch sizes** (Optimizations 1 & 2) - Low risk
3. **Monitor for 429 errors** in production for 1-2 weeks
4. **If stable, apply Aggressive settings** - Higher reward
5. **Implement Optimization 5** (clearFutureLeaves) - Moderate effort, good benefit

---

## Testing Recommendations

After making changes:

1. Run the test suite: `npm test -- --run`
2. Generate a test schedule with ~60 days of data
3. Monitor browser console for:
   - 429 rate limit errors
   - Retry attempts logged
   - Total generation time
4. If 429 errors occur frequently, increase delays or reduce batch sizes

---

## Rollback Plan

If performance degrades or rate limiting becomes problematic:

1. Revert batch sizes to original values:
   - Task: `BATCH_SIZE = 15, DELAY_MS = 1500`
   - Leave: `BATCH_SIZE = 30, DELAY_MS = 2000`
2. Keep the retry logic fix (Optimization 3) as it only improves reliability
