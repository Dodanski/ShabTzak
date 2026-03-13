# Architecture Refactoring: Single Shared Schedule

## Current Architecture (WRONG)
- Each unit has separate `{tabPrefix}_TaskSchedule` sheets
- Each unit has separate `{tabPrefix}_LeaveSchedule` sheets
- Generates separate schedules per unit
- Attempts multi-unit distribution (failing)

## New Architecture (CORRECT)
- ONE shared `TaskSchedule` in Admin/Master sheet
- ONE shared `LeaveSchedule` in Admin/Master sheet
- All units read/write from these shared sheets
- When any unit generates → updates shared schedule
- All units automatically see same schedule

## Implementation Steps

### 1. Create Master Sheet Repositories
- [ ] Create `MasterTaskAssignmentRepository` for admin TaskSchedule tab
- [ ] Create `MasterLeaveAssignmentRepository` for admin LeaveSchedule tab
- [ ] Add to `MasterDataService`

### 2. Modify ScheduleService
- [ ] Accept master repositories instead of unit-specific ones
- [ ] Save all assignments to master sheet
- [ ] Remove unit-specific save logic
- [ ] Remove multi-unit distribution code

### 3. Modify App.tsx
- [ ] Load schedule from master sheet via MasterDataService
- [ ] Pass master repositories to scheduleService
- [ ] Remove unitDataServiceManager distribution code

### 4. Modify SchedulePage
- [ ] Display master schedule (shared across all units)
- [ ] Keep soldier filtering per unit (show only their soldiers)
- [ ] But show tasks from shared master schedule

### 5. Clean Up
- [ ] Remove multi-unit distribution logic
- [ ] Remove unit-specific schedule logic
- [ ] Update comments

## Files to Modify
1. `src/services/masterDataService.ts` - Add repositories
2. `src/services/scheduleService.ts` - Use master repos
3. `src/App.tsx` - Load from master, pass to service
4. `src/components/SchedulePage.tsx` - Display master schedule
5. `src/hooks/useDataService.ts` - May need updates

## Result
✓ One generate = one schedule shared to all units
✓ All units see same tasks
✓ Simple, clear architecture
✓ No distribution confusion
