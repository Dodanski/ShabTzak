# Multi-Unit Scheduling Architecture Guide

## Current Implementation Status

### ✅ Completed
- Data model extended for alternative role requirements
- Scheduler logic updated to support multiple roles per requirement
- UI updated with multi-select role editing
- All soldiers loaded from admin spreadsheet

### ⚠️ Partial - Requires Spreadsheet Setup
- Multi-unit scheduling works **if admin sheet has all soldiers with unit assignments**
- Task assignments are written to current unit's spreadsheet only

## How to Set Up Multi-Unit Scheduling

### Admin Spreadsheet Setup
Your admin spreadsheet (VITE_SPREADSHEET_ID) must have:

1. **Soldiers Tab** with columns:
   - ID
   - First Name
   - Last Name
   - Role
   - **Unit** ← CRITICAL: Each soldier must have their unit name
   - ServiceStart
   - ServiceEnd
   - InitialFairness
   - CurrentFairness
   - Status
   - HoursWorked
   - WeekendLeavesCount
   - MidweekLeavesCount
   - AfterLeavesCount
   - InactiveReason

2. **Example Soldiers Tab:**
   ```
   ID  | First Name | Last Name | Role         | Unit   | ...
   001 | Aaron      | Davis     | Driver       | Unit1  | ...
   002 | Benjamin   | Chen      | Squad leader | Unit2  | ...
   003 | Caroline   | Ahmed     | Fighter      | Unit3  | ...
   ```

3. **Tasks Tab** with Alternative Roles:
   ```json
   RoleRequirements = [
     {"roles": ["Driver", "Squad leader", "Fighter"], "count": 5}
   ]
   ```

## Current Workflow

1. **Commander in Unit1 clicks "Generate Schedule"**
   - System loads all soldiers from admin Soldiers tab (NOW WORKING with Unit column)
   - Scheduler logs which units are being scheduled
   - Assignments are saved to Unit1's TaskSchedule tab

2. **Assignment Distribution:**
   - All assignments currently saved to Unit1's sheet
   - System logs unit distribution (e.g., "Unit1: 5, Unit2: 3, Unit3: 2")
   - Check browser console for assignment details

3. **For Unit2/Unit3 to see assignments:**
   - Option A: Manually copy assignments from Unit1's TaskSchedule to their own sheets
   - Option B: Implement programmatic sync (see next section)

## Solutions

## Rate Limiting

**Current Configuration:**
- 1 update per second (1000ms delay between fairness updates)
- Applies after schedule generation completes
- Total time for 30 new soldiers: ~30 seconds

**If still seeing 429 errors:**
1. Increase delay further in `App.tsx` line ~219
2. Or, batch-process fairness updates differently

## Working Solutions

### Short-term (For testing - Current state)
1. Generate schedule from Unit1
2. Check console logs for unit distribution
3. View all assignments in Unit1's TaskSchedule tab
4. Manually copy to other units if needed

### Medium-term (MVP Enhancement - Proposed)

**Goal:** Automatically save assignments to each unit's spreadsheet

**Implementation Steps:**

1. **Modify App.tsx to create DataServices for all units:**
```typescript
// In AppContent, create DataServices for all known units
const unitDataServices = new Map<string, DataService>()
for (const unit of units) {
  const ds = new DataService(
    auth.accessToken,
    unit.spreadsheetId,
    unit.tabPrefix || unit.name,
    masterDs.history
  )
  unitDataServices.set(unit.name, ds)
}
```

2. **Pass to UnitApp:**
```typescript
<UnitApp
  // ... existing props ...
  allUnitDataServices={unitDataServices}
/>
```

3. **In scheduleService, distribute assignments by unit:**
```typescript
// After creating main assignments
const assignmentsByUnit = groupByUnit(newAssignments, schedulingSoldiers)

// Save to each unit's sheet
for (const [unitName, assignments] of assignmentsByUnit) {
  const unitDs = allUnitDataServices.get(unitName)
  if (unitDs) {
    await unitDs.taskAssignments.createBatch(assignments)
  }
}
```

**Current Status:** Logging implemented, showing which units are scheduled. Manual copy-to-units needed for MVP.

### Long-term (Full Multi-Unit)
1. Create shared TaskSchedule tab in admin sheet
2. All units read assignments from admin sheet
3. Remove unit-specific TaskSchedule duplication

## Rate Limiting (429 Errors)

If you see "429 Too Many Requests" errors:
- Increase delays in App.tsx `handleGenerateSchedule()`
- Current: 500ms-2000ms delays between updates
- Recommended: 5000ms+ for large schedules
- Or: Batch fairness updates differently (e.g., update all at end instead of after each assignment)

## Testing Multi-Unit Scheduling

### Scenario
- 3 units with 5 soldiers each
- Gate Guard task requiring 5 soldiers from ANY role
- Generate schedule from Unit1

### Expected Results
- Task should be filled with 5 soldiers
- Some from Unit1, some from Unit2/Unit3 (if available)
- All soldiers should have fairness updated

### Verification
1. Check Unit1's TaskSchedule tab - should show all 5 assignments
2. Check Unit2/Unit3's TaskSchedule tabs - currently empty (known limitation)
3. View soldier calendar - should show task assignments

## Key Files

- `src/services/scheduleService.ts` - Main scheduling logic
- `src/algorithms/taskScheduler.ts` - Greedy assignment algorithm
- `src/hooks/useScheduleGenerator.ts` - Hook for schedule generation
- `docs/plans/2026-03-12-multi-unit-alt-roles.md` - Original implementation plan
