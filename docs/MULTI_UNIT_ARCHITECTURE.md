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
   - System loads all soldiers from admin Soldiers tab
   - Scheduler uses ALL soldiers to fill tasks
   - Assignments are saved to Unit1's TaskSchedule tab

2. **Problem:** Unit2/Unit3 commanders can't see assignments for their soldiers
   - Their soldiers' assignments are in Unit1's sheet, not their own

## Solutions

### Short-term (For testing)
1. All commanders work from Unit1 spreadsheet
2. Or, manually copy assignments to other units' TaskSchedule tabs

### Medium-term (MVP Enhancement)
Modify `scheduleService.generateTaskSchedule()` to:
```typescript
// After creating assignments, route them to appropriate unit sheets
const assignmentsByUnit = new Map<string, TaskAssignment[]>()
newAssignments.forEach(a => {
  const soldier = schedulingSoldiers.find(s => s.id === a.soldierId)
  const unit = soldier?.unit || 'Unit1'
  if (!assignmentsByUnit.has(unit)) {
    assignmentsByUnit.set(unit, [])
  }
  assignmentsByUnit.get(unit)!.push(a)
})

// Save to each unit's spreadsheet
for (const [unit, assignments] of assignmentsByUnit) {
  const unitDs = getDataServiceForUnit(unit)
  await unitDs.taskAssignments.createBatch(assignments)
}
```

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
