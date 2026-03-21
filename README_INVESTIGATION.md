# ShabTzak Scheduling Algorithm Investigation - Complete Documentation

## Overview

This directory contains a comprehensive investigation of the ShabTzak scheduling algorithm, with focus on:
- Schedule generation flow from AdminDashboard
- Multi-unit soldier loading and aggregation
- Leave generation with 10:4 ratio enforcement
- Task scheduling across multiple units
- Critical issues in multi-unit handling

## Document Guide

Start here and follow the documents in this order:

### 1. **INVESTIGATION_SUMMARY.md** (START HERE)
Quick reference with:
- Executive summary of findings
- 7 key issues identified
- Architecture overview
- Fix recommendations by priority
- Code locations reference

**Read time:** 5-10 minutes
**Best for:** Quick understanding of what's wrong and why

### 2. **SCHEDULING_INVESTIGATION.md** (DETAILED ANALYSIS)
Complete technical investigation with:
- Section 1: Flow from AdminDashboard to schedule generation
- Section 2: Multi-unit soldier loading mechanisms
- Section 3: Leave generation and 10:4 ratio enforcement
- Section 4: Task scheduler multi-unit logic
- Section 5: Detailed explanation of each issue
- Section 6: Summary table of data sources
- Section 7: Key findings
- Section 8: Recommendations

**Read time:** 20-30 minutes
**Best for:** Understanding the complete system and all issues

### 3. **FLOW_DIAGRAM.txt** (VISUAL FLOWCHARTS)
ASCII flowcharts showing:
- Admin Panel flow (multi-unit)
- Unit App flow (multi-unit)
- Data flow sources diagram
- Critical data flow issues
- Real-world impact examples

**Read time:** 10-15 minutes
**Best for:** Visual learners, understanding data flow

### 4. **CODE_ISSUES.md** (CODE EVIDENCE)
Exact code evidence for each issue with:
- File locations and line numbers
- Before/after code comparisons
- Real-world scenarios
- Impact examples

**Read time:** 15-20 minutes
**Best for:** Developers planning fixes, code reviewers

## Quick Facts

### Architecture
- Master Spreadsheet holds all data across units
- Each unit has local spreadsheet
- Master sheet is source of truth
- Units read from master for schedule data

### Multi-Unit Support Status
| Component | Status | Issue |
|-----------|--------|-------|
| Task Scheduling | WORKS | None |
| Leave Scheduling | BROKEN | Incomplete soldier pool |
| Soldier Loading | WORKS | None |
| Unit Affinity | WORKS | Possible lock-in (may be intentional) |
| Capacity Calculation | BROKEN | Uses unit-only soldiers |
| Cross-Unit Leave Validation | BROKEN | No synchronization |
| Fairness Updates | INCOMPLETE | Unit-only scope |

### 7 Critical Issues Found

1. **Leave generation missing multi-unit support** (P0) - CRITICAL
2. **Leave capacity based on incomplete soldier pool** (P0) - CRITICAL
3. **Cross-unit leave conflicts possible** (P0) - CRITICAL
4. **Task scheduler missing other units' leaves** (P1) - MODERATE
5. **Unit affinity lock-in in task scheduler** (P2) - LOW
6. **Fairness updates not cross-unit aware** (P1) - MODERATE
7. **10:4 ratio only works within single unit** (inherent to issue #2) - CRITICAL

### Key Code Locations

| Issue | File | Lines |
|-------|------|-------|
| Issue #1 | src/services/scheduleService.ts | 25-86 |
| Issue #2 | src/algorithms/leaveCapacityCalculator.ts | 44-50 |
| Issue #3 | src/algorithms/cyclicalLeaveScheduler.ts | 72-74 |
| Issue #4 | src/services/scheduleService.ts | 148 |
| Issue #5 | src/algorithms/taskScheduler.ts | 92-117 |
| Issue #6 | src/App.tsx | 207-227 |

## How the Scheduling System Works

### AdminDashboard → Schedule Generation Flow

```
Admin clicks "Generate Schedule for All Units"
        ↓
AdminPanel.handleGenerateScheduleForAllUnits()
        ↓
PHASE 1: Task Schedule (uses ALL soldiers)
  ├─ Expand recurring tasks
  ├─ Load all soldiers from master
  ├─ Call generateTaskSchedule(tasks, changedBy, onProgress, undefined, config, soldiers)
  └─ ✓ WORKS: Multi-unit task scheduling
        ↓
PHASE 2: Leave Schedule (uses UNIT soldiers only)
  ├─ Load unit soldiers: this.soldiers.list()
  ├─ Call generateLeaveSchedule(config, start, end, changedBy)
  ├─ ✗ BROKEN: No allSoldiers parameter!
  └─ Generates leaves for unit only, ignores other units
        ↓
Both written to Master spreadsheet
All units read from master
```

### Multi-Unit Soldier Aggregation

```
useDataService(spreadsheetId, tabPrefix, masterDs, true)  // true = load all
        ↓
Loads:
  - Unit soldiers: ds.soldiers.list()
  - All soldiers: masterDs.soldiers.list()
        ↓
Returns both in result:
  - soldiers: unit soldiers only
  - allSoldiers: all soldiers from all units
        ↓
Passed to schedule generation:
  - Task scheduler: uses allSoldiers ✓
  - Leave scheduler: doesn't accept allSoldiers ✗
```

### 10:4 Leave Ratio Enforcement

```
Configuration:
  - leaveRatioDaysInBase = 10
  - leaveRatioDaysHome = 4
  - Cycle = 14 days

Algorithm:
  For each soldier:
    1. Assign random phase offset (0-13)
    2. Calculate position: (dayNumber + offset) % 14
    3. If position >= 10: soldier eligible for leave
    4. Check capacity: calculateLeaveCapacityPerRole()
    5. If capacity > 0: assign leave

WORKS within single unit ✓
BREAKS in multi-unit ✗ (capacity calculation incomplete)
```

## Recommended Reading Path

1. **Non-technical stakeholders:** Read INVESTIGATION_SUMMARY.md sections 1-2
2. **Project managers:** Read INVESTIGATION_SUMMARY.md + FLOW_DIAGRAM.txt
3. **Developers (overview):** Read INVESTIGATION_SUMMARY.md + SCHEDULING_INVESTIGATION.md sections 1-4
4. **Developers (fixing):** Read all documents + examine code locations
5. **Code reviewers:** Read SCHEDULING_INVESTIGATION.md + CODE_ISSUES.md

## Quick Fix Checklist

Priority P0 (Critical, Must Fix):
- [ ] Add allSoldiers parameter to generateLeaveSchedule()
- [ ] Pass allSoldiers to generateCyclicalLeaves()
- [ ] Update leaveCapacityCalculator to use complete soldier pool

Priority P1 (Should Fix):
- [ ] Pass all leave assignments to task scheduler
- [ ] Implement cross-unit fairness updates

Priority P2 (Nice to Have):
- [ ] Review/fix unit affinity lock-in
- [ ] Add cross-unit leave validation

## Testing Scenarios

See INVESTIGATION_SUMMARY.md for 3 test cases to validate:
1. Multi-unit leave capacity (2 units, 5 drivers each, minRequired=8)
2. Cross-unit conflict detection
3. Task-leave conflict prevention

## Contact & Questions

Questions about specific findings should reference:
- Issue number (1-7)
- Relevant document
- Specific section/line in code

## Files Included

- README_INVESTIGATION.md (this file)
- INVESTIGATION_SUMMARY.md (executive summary)
- SCHEDULING_INVESTIGATION.md (detailed technical investigation)
- FLOW_DIAGRAM.txt (visual flowcharts)
- CODE_ISSUES.md (code evidence and examples)

---

**Investigation Date:** March 21, 2026
**Scope:** Scheduling algorithm in ShabTzak
**Methodology:** Source code review, manual tracing, data flow analysis
**Status:** Complete

