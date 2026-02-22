# ShabTzak - Soldier Scheduling System
## Design Document

**Date:** February 22, 2026
**Version:** 1.0
**Status:** Approved

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Requirements](#requirements)
4. [Architecture](#architecture)
5. [System Components](#system-components)
6. [Data Model](#data-model)
7. [Algorithms](#algorithms)
8. [Data Flow](#data-flow)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)
11. [Acceptance Criteria](#acceptance-criteria)
12. [Future Considerations](#future-considerations)

---

## 1. Executive Summary

### Purpose
ShabTzak is a web-based soldier scheduling system that automates:
- **Leave/vacation scheduling** for entire service periods
- **Task/mission assignment** on a 72-hour rolling basis

### Goals
- Maintain mission coverage (primary)
- Ensure fairness between soldiers (secondary)
- Accommodate soldier preferences (tertiary)
- Eliminate manual scheduling burden on commanders

### Key Features
- Automated constraint-based scheduling
- Fairness tracking and distribution
- Multi-user support with conflict resolution
- Export to PDF and WhatsApp text formats
- Manual override with locking
- Complete history tracking

---

## 2. System Overview

### Users
**Primary:** Platoon commanders (מפקדי מחלקות)

### Core Functionality

#### Leave Management
- Plan leaves for entire service period
- Two types: "After" (1 night) and "Long" (2-4 nights)
- 10:4 ratio (10 days on base, 4 days home)
- Fair distribution of weekend vs mid-week leaves
- Priority-based constraint satisfaction

#### Task Assignment
- 72-hour rolling window
- Fixed time slots with parallel tasks
- Role-based assignment (6 critical roles)
- Rest period enforcement
- Fairness via even hour distribution

### Constraints
- **Hard:** Minimum base presence, service dates, role requirements
- **Soft:** Priority 1-10 leave requests, fairness scores

---

## 3. Requirements

### Functional Requirements

**FR1: Soldier Management**
- Add/remove soldiers at any time
- Track: Name, ID, Role, Service start/end dates
- One role per soldier from: Driver, Radio Operator, Medic, Squad Leader, Operations Room, Weapons Specialist

**FR2: Leave Scheduling**
- Accept leave requests with constraint types and priorities
- Constraint types: Family event, University exam, Civilian job, Medical appointment (soldier), Child's birthday, Wife's birthday, Wedding anniversary, Parent medical appointment, General home issue, Preference
- Priority: Numeric 1-10 (commander assigned)
- Enforce 10:4 leave ratio
- Track weekend (Friday-Saturday) vs mid-week distribution
- Maximum 4 consecutive days for long leaves (configurable)
- "After" leaves don't count in ratio but affect fairness

**FR3: Task Scheduling**
- Define task types with fixed time slots
- Specify role requirements per task (e.g., "1 Squad Leader + 3 any")
- Special tasks: "Pillbox" (full days, off rotation, not counted as leave)
- Minimum rest period per task type (configurable)
- Maximum consecutive driving hours (configurable)
- No overlapping tasks for same soldier
- 72-hour planning window

**FR4: Fairness System**
- Track hours worked per soldier
- Track leave days taken (weekend vs mid-week)
- Track "After" leaves separately
- Calculate deviation from platoon average
- New soldiers start at platoon average
- Display fairness heatmap

**FR5: Manual Override**
- Commander can manually assign soldier to task/leave
- Manual assignments "lock" and persist through re-calculations
- Algorithm schedules around locked items

**FR6: Conflict Resolution**
- Detect impossible schedules (over-constrained)
- Present conflicts to commander with context
- Allow manual decision-making
- Re-run algorithm with decisions applied

**FR7: Multi-User Support**
- Multiple commanders work simultaneously
- Concurrent edit detection (version tracking)
- Conflict merge UI
- Last-write-wins with notification option

**FR8: Export**
- PDF format: schedule tables by day/soldier
- WhatsApp text format: plaintext with emojis
- Both for task schedules and leave plans

**FR9: History & Analytics**
- View past schedules
- Fairness trends over time
- Leave quota tracking vs standard

**FR10: Configuration**
- Server-side settings in Google Sheet "Config" tab:
  - Leave ratios (default 10:4)
  - Long leave max days (default 4)
  - Rest periods per task type
  - Max driving hours
  - Weekend definition (Friday-Saturday)
  - Minimum base presence per day (by role)

### Non-Functional Requirements

**NFR1: Platform**
- Runs on Windows without installation
- Web browser only (Chrome/Edge/Firefox)
- No admin rights required

**NFR2: Cost**
- 100% free (no subscription, no server costs)

**NFR3: Data Storage**
- Google Sheets as database
- Google Drive for access control

**NFR4: Authentication**
- Google OAuth 2.0
- All users have Google accounts

**NFR5: Determinism**
- Same input → same output (always)
- Reproducible schedules

**NFR6: Performance**
- Schedule calculation: < 5 seconds for 30 soldiers
- UI responsiveness: no lag

**NFR7: Scalability**
- Target: 50 soldiers, 6-month planning horizon
- Graceful degradation if limits exceeded

---

## 4. Architecture

### High-Level Architecture

**System Type:** Single-Page Web Application (SPA) with Google Sheets as database

**Technology Stack:**
- **Frontend Framework:** React
- **Language:** JavaScript/TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context or Zustand
- **Data Backend:** Google Sheets API v4
- **Authentication:** Google OAuth 2.0 (Google Identity Services)
- **Hosting:** GitHub Pages, Vercel, or Netlify (free tier)
- **Build Tool:** Vite

**Deployment Model:**
```
User's Browser (Chrome/Edge on Windows)
    ↓
Static Web App (HTML/CSS/JS bundle)
    ↓
Google Sheets API (HTTPS)
    ↓
Google Sheet (Data Storage)
```

### Key Architectural Decisions

**1. Client-Side Computation**
- All scheduling algorithms run in browser
- Deterministic results guaranteed
- No server costs
- Works offline after initial load

**2. Google Sheets as Database**
- One spreadsheet per unit/platoon
- Separate tabs: Soldiers, Tasks, TaskSchedule, LeaveRequests, LeaveSchedule, History, Config
- Shared via Google Drive with commander permissions
- API calls with version tracking for conflict detection

**3. Zero Installation**
- User opens URL in browser
- Signs in with Google
- Grants permission to access specific Google Sheet
- Ready to use immediately

**4. Conflict Resolution**
- Each write includes version/timestamp
- Concurrent edits trigger merge UI
- Options: Keep both, use mine, use theirs, manual merge

---

## 5. System Components

### Core Modules

#### 5.1 Authentication Module
- Google OAuth sign-in flow
- Permission management for Google Sheets access
- Session persistence (localStorage)

#### 5.2 Data Layer
- Google Sheets API integration
- CRUD operations (Create, Read, Update, Delete)
- Client-side caching for performance
- Version tracking for conflict detection
- Optimistic updates with rollback

#### 5.3 Soldier Management
- Roster management (add/edit/remove)
- Role assignment tracking
- Service date tracking
- Individual fairness metric calculation

#### 5.4 Task Configuration
- Task type definitions
- Time slot management (fixed start/end times)
- Role requirement specification
- Rest period configuration per task type
- Special task handling (Pillbox, driving limits)

#### 5.5 Leave Management
- Leave request submission
- Quota tracking per soldier
- Weekend vs mid-week categorization
- "After" vs "Long" classification
- Fairness distribution calculations

#### 5.6 Scheduling Engine

**Leave Scheduler (Long-term):**
- Input: Service period, soldier quotas, leave requests with priorities
- Algorithm: Constraint satisfaction solver
  - Hard constraints: Minimum base presence, service dates, role requirements
  - Soft constraints: Priorities 1-10, fairness distribution
- Output: Leave schedule for entire service period

**Task Scheduler (72-hour rolling):**
- Input: Available soldiers (not on leave), task definitions, rest requirements
- Algorithm: Task assignment optimizer
  - Match roles to requirements
  - Ensure rest periods between tasks
  - Maximize fairness (distribute hours evenly)
  - Respect manual locks
- Output: 72-hour task schedule with role assignments

#### 5.7 Fairness Calculator
- Hours worked tracking
- Leave days taken (weekend vs mid-week)
- "After" leave tracking
- Deviation from platoon average
- Heatmap generation

#### 5.8 Manual Override & Locking
- Commander manual assignment interface
- Lock persistence across re-calculations
- Visual indicators for locked items

#### 5.9 Conflict Resolution UI
- Conflict detection and presentation
- Context display (priorities, fairness scores)
- Decision interface for commander
- Algorithm re-run with manual inputs

#### 5.10 Export Module
- PDF generation (browser print API)
- WhatsApp text formatting
- Template customization

#### 5.11 History & Analytics
- Past schedule viewing
- Fairness trend visualization
- Quota tracking dashboard

#### 5.12 Configuration Management
- Server-side settings interface
- Google Sheet "Config" tab synchronization
- Validation and defaults

### UI Components

**Dashboard**
- Overview cards (upcoming tasks, leave balance)
- Quick actions
- Alerts and notifications

**Soldier Roster Table**
- Sortable/filterable list
- Inline editing
- Fairness score column

**Task Definition Interface**
- Task type library
- Instance creation (specific time slots)
- Role requirement builder

**Leave Request Form**
- Soldier selection
- Date range picker
- Constraint type dropdown
- Priority input (1-10)

**Schedule Visualizer**
- Calendar/timeline view
- Filter by soldier/task/date
- Color coding by status

**Fairness Heatmap**
- Grid view (soldiers × metrics)
- Color gradient (red = above average, green = below average)

**Conflict Resolution Wizard**
- Step-by-step conflict presentation
- Decision options
- Preview of resolution impact

**Export Dialog**
- Format selection (PDF/Text)
- Scope selection (tasks/leaves)
- Preview before export

---

## 6. Data Model

### Google Sheets Structure

**Spreadsheet:** One per unit/platoon

#### Tab 1: Soldiers
| Column | Type | Description |
|--------|------|-------------|
| ID | String | Unique soldier ID |
| Name | String | Full name |
| Role | Enum | Driver, Radio, Medic, Squad Leader, Ops Room, Weapons |
| ServiceStart | Date | First day of service |
| ServiceEnd | Date | Last day of service |
| InitialFairness | Number | Starting fairness score (platoon avg) |
| CurrentFairness | Number | Current fairness score |
| Status | Enum | Active, Injured, Discharged |

#### Tab 2: Tasks
| Column | Type | Description |
|--------|------|-------------|
| TaskID | String | Unique task instance ID |
| TaskType | String | e.g., "Guard Duty", "Kitchen" |
| StartTime | DateTime | Fixed start time |
| EndTime | DateTime | Fixed end time |
| DurationHours | Number | Calculated duration |
| RoleRequirements | JSON | e.g., `{"Squad Leader": 1, "Any": 3}` |
| MinRestAfter | Number | Hours of rest required after |
| IsSpecial | Boolean | True for Pillbox-type tasks |
| SpecialDuration | Number | Days for special tasks |

#### Tab 3: TaskSchedule
| Column | Type | Description |
|--------|------|-------------|
| ScheduleID | String | Unique schedule entry ID |
| TaskID | String | References Tasks.TaskID |
| SoldierID | String | References Soldiers.ID |
| AssignedRole | String | Role soldier is filling |
| IsLocked | Boolean | Manual override lock |
| CreatedAt | DateTime | When assignment was made |
| CreatedBy | String | Commander who created/locked |

#### Tab 4: LeaveRequests
| Column | Type | Description |
|--------|------|-------------|
| RequestID | String | Unique request ID |
| SoldierID | String | References Soldiers.ID |
| StartDate | Date | Leave start date |
| EndDate | Date | Leave end date |
| LeaveType | Enum | After, Long |
| ConstraintType | Enum | Family event, Exam, Job, Medical, etc. |
| Priority | Number | 1-10 (commander assigned) |
| Status | Enum | Pending, Approved, Denied |

#### Tab 5: LeaveSchedule
| Column | Type | Description |
|--------|------|-------------|
| LeaveID | String | Unique leave assignment ID |
| SoldierID | String | References Soldiers.ID |
| StartDate | Date | Approved leave start |
| EndDate | Date | Approved leave end |
| LeaveType | Enum | After, Long |
| IsWeekend | Boolean | Includes Friday-Saturday |
| IsLocked | Boolean | Manual override lock |
| RequestID | String | References LeaveRequests (if applicable) |
| CreatedAt | DateTime | When scheduled |

#### Tab 6: History
| Column | Type | Description |
|--------|------|-------------|
| HistoryID | String | Unique history entry ID |
| Type | Enum | TaskSchedule, LeaveSchedule |
| Timestamp | DateTime | When snapshot was taken |
| SnapshotData | JSON | Full schedule snapshot |
| GeneratedBy | String | Commander who generated |

#### Tab 7: Config
| Key | Value | Description |
|-----|-------|-------------|
| LeaveRatioDaysInBase | 10 | Default days on base |
| LeaveRatioDaysHome | 4 | Default days home |
| LongLeaveMaxDays | 4 | Max consecutive days for long leave |
| WeekendDays | "Friday,Saturday" | Days considered weekend |
| MinBasePresence | 20 | Minimum soldiers on base per day |
| MinBasePresenceByRole | `{"Driver": 2, "Medic": 1, ...}` | Role-specific minimums |
| MaxDrivingHours | 8 | Max consecutive driving hours |
| DefaultRestPeriod | 6 | Default hours rest between tasks |
| TaskTypeRestPeriods | `{"Guard": 6, "Kitchen": 4, ...}` | Task-specific rest periods |

#### Tab 8: Version (for conflict detection)
| Column | Type | Description |
|--------|------|-------------|
| TabName | String | Which tab (Soldiers, Tasks, etc.) |
| Version | Number | Incremented on each write |
| LastModified | DateTime | Timestamp of last change |
| LastModifiedBy | String | Email of last modifier |

---

## 7. Algorithms

### 7.1 Leave Scheduling Algorithm

**Type:** Constraint Satisfaction Problem (CSP) Solver

**Input:**
- List of soldiers (with service dates, roles, current fairness scores)
- List of leave requests (dates, priorities, constraint types)
- Configuration (ratios, minimums, weekend definition)
- Current leave schedule (locked items)

**Output:**
- Complete leave schedule for service period
- OR conflict report if unsatisfiable

**Algorithm Approach:**

**Option A: Greedy Heuristic (Recommended for MVP)**
```
1. Sort leave requests by priority (1 = highest)
2. For each request (in priority order):
   a. Check hard constraints:
      - Soldier within service dates
      - Minimum base presence met (including role requirements)
      - No overlap with soldier's existing leaves
   b. If satisfied, tentatively assign
   c. Update fairness scores
3. Post-process for fairness:
   - Identify soldiers significantly below average fairness
   - Attempt to grant additional lower-priority requests for them
4. Return schedule or conflicts
```

**Option B: Genetic Algorithm (for better optimization)**
```
1. Generate initial population of random valid schedules
2. For N generations:
   a. Score each schedule (fitness function)
   b. Select best performers
   c. Crossover and mutate to create new generation
3. Return best schedule found
```

**Fitness Function (for both approaches):**
```
Score = (Priority satisfaction weight × priority_score)
      + (Fairness weight × fairness_score)
      - (Constraint violation penalty × violations)

Where:
- priority_score = sum of priorities of fulfilled requests
- fairness_score = -1 × standard deviation of fairness across soldiers
- violations = count of hard constraint violations
```

**Complexity:** O(n × m) where n = soldiers, m = requests (greedy)
**Expected Runtime:** < 2 seconds for 30 soldiers, 100 requests

### 7.2 Task Scheduling Algorithm

**Type:** Role-based Assignment with Fairness Optimization

**Input:**
- Available soldiers (not on leave in next 72 hours)
- Task instances (time slots, role requirements)
- Rest period requirements
- Current fairness scores (hours worked)
- Locked assignments

**Output:**
- 72-hour task schedule
- Updated fairness scores

**Algorithm:**
```
1. Build time-indexed availability matrix:
   - For each soldier, for each hour in 72-hour window:
     - Available if: not on leave, not in another task, rest period satisfied

2. For each task (ordered by start time):
   a. For each required role:
      - Filter soldiers with matching role
      - Filter by availability at task time
      - Sort by fairness (ascending = fewer hours worked = higher priority)
      - Assign top available soldier
      - Mark soldier unavailable for:
        - Task duration
        - + Rest period after
   b. If any role cannot be filled:
      - Report conflict for this task

3. Update fairness scores (add hours worked)

4. Return schedule
```

**Conflict Handling:**
- If task cannot be filled: Mark as "Needs Manual Resolution"
- Present to commander with options:
  - Skip this task
  - Override (assign someone anyway, breaking constraints)
  - Adjust role requirements
  - Manually select specific soldier

**Complexity:** O(t × r × s) where t = tasks, r = roles, s = soldiers
**Expected Runtime:** < 1 second for 72 hours, 30 soldiers

### 7.3 Fairness Calculation

**Fairness Score Formula:**

**For Task Hours:**
```
TaskFairness(soldier) = HoursWorked(soldier) - PlatoonAverage(HoursWorked)
```

**For Leaves:**
```
LeaveFairness(soldier) =
  (WeekendLeaves(soldier) - PlatoonAverage(WeekendLeaves)) × WeekendWeight
  + (MidweekLeaves(soldier) - PlatoonAverage(MidweekLeaves)) × MidweekWeight
  + (AfterCount(soldier) - PlatoonAverage(AfterCount)) × AfterWeight

Where:
  WeekendWeight = 1.5
  MidweekWeight = 1.0
  AfterWeight = 0.5
```

**Combined Fairness:**
```
TotalFairness(soldier) = TaskFairness(soldier) + LeaveFairness(soldier)
```

**Interpretation:**
- **Negative score:** Soldier has worked less / had fewer leaves (owed preferential treatment)
- **Positive score:** Soldier has worked more / had more leaves (should be deprioritized)
- **Zero:** Exactly at platoon average

**Platoon Average Calculation:**
```
PlatoonAverage(metric) = Sum(metric for all active soldiers) / Count(active soldiers)
```

**New Soldier Initialization:**
```
When soldier added:
  NewSoldier.InitialFairness = PlatoonAverage(TotalFairness)
  NewSoldier.CurrentFairness = InitialFairness
```

**Injured Soldier Return:**
```
When soldier returns after injury/absence:
  ReturningSoldier.CurrentFairness = PlatoonAverage(TotalFairness)
```

---

## 8. Data Flow

### 8.1 Commander Signs In (First Time)

```
1. User opens web app URL (e.g., https://shabtazk.github.io)
2. Click "Sign in with Google"
3. Google OAuth popup → User authorizes app
4. App receives access token + user profile
5. App prompts: "Select your unit's Google Sheet"
   - Option A: Select existing sheet (from Drive)
   - Option B: Create new from template
6. If creating new:
   a. App creates Google Sheet with name: "ShabTzak - [Unit Name]"
   b. Creates tabs: Soldiers, Tasks, TaskSchedule, LeaveRequests,
      LeaveSchedule, History, Config, Version
   c. Populates Config with defaults
   d. Initializes Version tab
   e. Shares sheet with user (owner permissions)
7. Sheet ID saved in browser localStorage
8. App loads data from sheet
9. Dashboard displays
```

### 8.2 Add/Edit Soldiers

```
1. Commander navigates to "Soldiers" page
2. UI displays table of current soldiers
3. Click "Add Soldier" button
4. Form appears:
   - Name (text input)
   - ID (text input)
   - Role (dropdown: Driver, Radio, Medic, Squad Leader, Ops Room, Weapons)
   - Service Start Date (date picker)
   - Service End Date (date picker)
5. On submit:
   a. Client-side validation
   b. Calculate InitialFairness = current PlatoonAverage(TotalFairness)
   c. Read Version tab → get current version for "Soldiers"
   d. Optimistic UI update (add row to table immediately)
   e. API call to Google Sheets:
      - Append row to Soldiers tab
      - Include version number in request
   f. If success:
      - Update Version tab (increment version, update timestamp)
      - Confirm to user
   g. If conflict (version mismatch):
      - Show conflict dialog:
        "Another user modified soldiers. Refresh and try again?"
      - Rollback optimistic UI update
      - Reload data
6. Table updates with new soldier
```

### 8.3 Configure Tasks

```
1. Commander navigates to "Tasks Configuration"
2. Two sections:
   a. Task Types (templates)
   b. Task Instances (specific scheduled tasks)

3. Create Task Type:
   - Name (e.g., "Guard Duty")
   - Default duration (e.g., 4 hours)
   - Role requirements (e.g., "1 Squad Leader, 3 Any")
   - Minimum rest after (e.g., 6 hours)
   - Save to local config (or Config tab)

4. Create Task Instance:
   - Select task type (dropdown)
   - Set specific date and start time (datetime picker)
   - End time auto-calculated (or editable)
   - Role requirements pre-filled (editable)
   - Save to Tasks tab in Google Sheets

5. Special Tasks:
   - Toggle "Is Special Task" (e.g., Pillbox)
   - Specify duration in days
   - Soldier assigned to this is removed from regular rotation

6. Data written to Tasks tab with version tracking
```

### 8.4 Submit Leave Request

```
1. Commander opens "Leave Requests" page
2. Soldier verbally requests leave to commander
3. Commander clicks "New Request"
4. Form:
   - Soldier (dropdown)
   - Start Date (date picker)
   - End Date (date picker)
   - Constraint Type (dropdown: Family event, Exam, etc.)
   - Priority (number input 1-10)
5. On submit:
   a. Calculate leave type:
      - If (EndDate - StartDate) = 1 night → "After"
      - If > 1 night → "Long"
   b. Validate:
      - Dates within soldier's service period
      - Long leave ≤ MaxDays (from Config)
   c. Check soldier's current leave balance vs quota
      - Show warning if over quota (but allow anyway)
   d. Check if dates include weekend (Friday-Saturday)
   e. Write to LeaveRequests tab
   f. Status = "Pending"
6. Request appears in pending list
```

### 8.5 Generate Leave Schedule

```
1. Commander clicks "Calculate Leave Schedule"
2. Loading indicator appears
3. App loads from Google Sheets:
   - All soldiers (Soldiers tab)
   - All leave requests (LeaveRequests tab)
   - Config settings (Config tab)
   - Current leave schedule (LeaveSchedule tab) - for locked items
   - Version info

4. Scheduling engine runs (client-side JavaScript):
   a. Filter active soldiers (ServiceStart ≤ today ≤ ServiceEnd)
   b. Build constraint list:
      - Hard: Minimum base presence, service dates, no overlaps
      - Soft: Priorities, fairness
   c. Load locked leave assignments (manual overrides)
   d. Run algorithm (see section 7.1):
      - Greedy heuristic or genetic algorithm
      - Iterates through possible assignments
      - Scores each solution
      - Finds best valid schedule
   e. If successful:
      - Generate complete leave schedule
      - Calculate updated fairness scores
   f. If conflicts/impossible:
      - Generate conflict report
      - List problematic requests
      - Suggest resolutions

5. If conflicts:
   - Show Conflict Resolution UI:
     ```
     Conflict: Not enough soldiers on base March 15-17

     Conflicting Requests:
     - David (Priority 8, Wedding) - March 15-16
     - Sarah (Priority 7, Exam) - March 15-17
     - Alex (Priority 9, Family Event) - March 16-17

     Options:
     [ ] Deny David's request
     [ ] Deny Sarah's request
     [ ] Shorten Alex's leave to March 16 only
     [ ] Manually select who to approve

     [Re-calculate]
     ```
   - Commander makes decision
   - Re-run algorithm with manual inputs

6. If successful:
   - Display leave schedule (calendar view)
   - Highlight weekends in different color
   - Show fairness heatmap
   - Commander can:
     - Manually adjust specific leaves (locks them)
     - Approve and save

7. On "Save":
   - Write to LeaveSchedule tab
   - Update LeaveRequests (mark approved/denied)
   - Update soldier fairness scores
   - Increment version
   - Save snapshot to History tab

8. Success message + option to export
```

### 8.6 Generate Task Schedule (72-hour rolling)

```
1. Trigger: Manual click or automatic timer
2. App loads:
   - Soldiers (Soldiers tab)
   - Leave schedule (LeaveSchedule tab) - filter next 72 hours
   - Task instances (Tasks tab) - filter next 72 hours
   - Config (rest periods)
   - Current task schedule (TaskSchedule tab) - for locked items

3. Determine available soldiers:
   - Active soldiers (within service dates)
   - NOT on leave in next 72 hours
   - NOT assigned to special tasks (Pillbox)

4. Task assignment engine runs (see section 7.2):
   a. Build availability matrix (soldier × time)
   b. For each task (chronological order):
      - For each required role:
        - Find available soldiers with role
        - Sort by fairness (ascending)
        - Assign top soldier
        - Update availability (block task time + rest period)
   c. Respect locked assignments (skip those slots)
   d. Detect conflicts (unfillable tasks)

5. If conflicts:
   - Show conflict UI:
     ```
     Cannot fill:
     - Guard Duty, March 22 14:00-18:00
       Reason: Need 1 Squad Leader, none available

     Options:
     [ ] Skip this task
     [ ] Override rest period for [select soldier]
     [ ] Manually assign [select soldier]

     [Re-calculate]
     ```

6. If successful:
   - Display task schedule (timeline view)
   - Color-code by task type
   - Show soldier assignments
   - Show fairness scores (updated)

7. Commander can manually adjust:
   - Drag-drop soldiers to different tasks
   - Lock specific assignments

8. On "Save":
   - Write to TaskSchedule tab
   - Update soldier fairness scores (add hours worked)
   - Increment version
   - Save snapshot to History tab

9. Success + export option
```

### 8.7 Multi-User Concurrent Editing

```
Scenario: Two commanders edit same data simultaneously

Timeline:

00:00 - User A loads soldier list (Version 42)
00:05 - User B loads soldier list (Version 42)
00:10 - User A edits Soldier "David" role: Medic → Driver
00:15 - User B edits Soldier "David" status: Active → Injured
00:20 - User A saves:
        - Client checks Version tab for "Soldiers"
        - Current version = 42 (matches loaded version)
        - Write succeeds
        - Update Version to 43
00:25 - User B saves:
        - Client checks Version tab for "Soldiers"
        - Current version = 43 (does NOT match loaded version 42)
        - CONFLICT DETECTED
        - API returns error: "Version mismatch"

00:26 - User B sees conflict dialog:
        ┌─────────────────────────────────────────────┐
        │   Another user modified this soldier        │
        ├─────────────────────────────────────────────┤
        │ Soldier: David                              │
        │                                             │
        │ User A changed:                             │
        │   Role: Medic → Driver                      │
        │                                             │
        │ You changed:                                │
        │   Status: Active → Injured                  │
        │                                             │
        │ Resolution:                                 │
        │ ⦿ Keep both changes (Recommended)           │
        │   Result: Role=Driver, Status=Injured       │
        │                                             │
        │ ○ Use your version only                     │
        │   Result: Role=Medic, Status=Injured        │
        │                                             │
        │ ○ Use other user's version only             │
        │   Result: Role=Driver, Status=Active        │
        │                                             │
        │         [Cancel]  [Apply Resolution]        │
        └─────────────────────────────────────────────┘

00:27 - User B selects "Keep both changes"
00:28 - App merges:
        - Reload current data (Version 43)
        - Apply User B's changes on top
        - Write to Sheets (Version 43 → 44)
00:29 - Success

Alternative: If changes conflict (both edited same field):
        - Cannot auto-merge
        - Must choose: Mine, Theirs, or Manual
```

### 8.8 Export & Distribution

```
1. Commander clicks "Export Schedule"
2. Dialog appears:
   - Format: [ ] PDF  [ ] WhatsApp Text
   - Scope:  [ ] Task Schedule (72h)  [ ] Leave Schedule
   - Date Range: [Start Date] to [End Date]

3. If PDF selected:
   a. Generate HTML table:
      - If task schedule: columns = time slots, rows = tasks
      - If leave schedule: columns = dates, rows = soldiers
      - Color-code by status
   b. Use browser print API (window.print())
   c. User prints to PDF (standard Windows print dialog)
   d. Or: use library like jsPDF for programmatic generation

4. If WhatsApp Text selected:
   a. Format as plaintext with emojis:
      ```
      📅 ShabTzak - Task Schedule
      📆 March 22-24, 2026

      🗓️ Friday, March 22
      ⏰ 08:00-12:00 - Kitchen Duty
         👤 Sarah (Any), Rachel (Any)

      ⏰ 14:00-18:00 - Guard Duty
         🎖️ Moshe (Squad Leader), David (Driver),
         👤 Yoni, Alex

      ⏰ 22:00-02:00 - Night Watch
         📻 Michael (Radio), 👤 Dan, Avi

      🗓️ Saturday, March 23
      ...
      ```
   b. Copy to clipboard automatically
   c. Show toast: "Copied to clipboard! Paste in WhatsApp."

5. Optionally:
   - Save export to History tab (for record-keeping)
   - Include metadata (who exported, when)
```

---

## 9. Error Handling

### Error Categories & Responses

#### 9.1 Network/API Errors

| Error | Cause | User Experience |
|-------|-------|-----------------|
| Google Sheets API unavailable | No internet, Google down | "Cannot connect to Google Sheets. Check your internet connection and try again." + [Retry] button |
| Authentication expired | Session timeout | Auto-redirect to sign-in with message: "Your session has expired. Please sign in again." |
| Permission denied | Sheet not shared with user | "Access denied. Please ask the sheet owner to share it with you." + [Help] link |
| Rate limit exceeded | Too many API calls | "Too many requests. Please wait a moment..." (auto-retry with exponential backoff: 1s, 2s, 4s) |
| API quota exceeded | Daily limit hit | "Google Sheets quota exceeded for today. Try again tomorrow or contact support." |

**Implementation:**
```javascript
async function apiCall(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === 401) {
      // Session expired
      redirectToLogin("Session expired");
    } else if (error.code === 403) {
      // Permission denied
      showError("Access denied", "Ask sheet owner to share");
    } else if (error.code === 429) {
      // Rate limit
      await exponentialBackoff();
      return apiCall(operation); // Retry
    } else {
      // Generic network error
      showError("Connection error", "Check internet and retry");
    }
  }
}
```

#### 9.2 Data Validation Errors

| Error | Cause | User Experience |
|-------|-------|-----------------|
| Missing required field | User didn't fill name/role | Inline error: "Name is required" (red border, message below field). Submit button disabled until fixed. |
| Invalid date range | End date before start date | "End date must be after start date" + auto-correct suggestion |
| Date outside service period | Leave request before soldier's service start | "Leave dates must be within service period (Feb 1 - Aug 31, 2026)" |
| Overlapping task assignment | Same soldier, same time | Warning dialog: "David is already assigned to Guard Duty 14:00-18:00. Override?" [Yes/No] |
| Invalid role for task | Assigning Driver to Medic-required slot | Error: "This task requires a Medic. David is a Driver." |
| Exceeds max days | Long leave > 4 days | "Long leave cannot exceed 4 days. Adjust dates or split into multiple leaves." |

**Form Validation Pattern:**
```javascript
function validateSoldierForm(data) {
  const errors = {};

  if (!data.name || data.name.trim() === "") {
    errors.name = "Name is required";
  }

  if (!data.role || !validRoles.includes(data.role)) {
    errors.role = "Please select a valid role";
  }

  if (data.serviceEnd <= data.serviceStart) {
    errors.serviceEnd = "End date must be after start date";
  }

  return Object.keys(errors).length === 0 ? null : errors;
}
```

#### 9.3 Scheduling Algorithm Errors

| Error | Cause | User Experience |
|-------|-------|-----------------|
| Impossible schedule (over-constrained) | Too many high-priority leaves, not enough soldiers | **Conflict Resolution Dialog:**<br>"Cannot create valid schedule. Conflicts detected:"<br>- List specific conflicts with context<br>- Suggested resolutions<br>- Manual override options |
| No soldiers with required role | Task needs Medic, none available (all on leave) | "Warning: No Medic available for Guard Duty on March 22 14:00-18:00.<br>Options:<br>[ ] Skip this task<br>[ ] Assign soldier with different role (override)<br>[ ] Adjust task requirements" |
| Algorithm timeout | Constraints too complex | "Scheduling is taking longer than expected. This may indicate over-constrained inputs.<br>Suggestions:<br>- Reduce number of simultaneous high-priority requests<br>- Extend planning window<br>- Manually resolve some conflicts first" |
| Insufficient base presence | Too many leaves on same day | "Cannot approve all requests: Only 15 soldiers on base March 15 (minimum 20 required).<br>Conflicting leaves: [list]<br>Please deny or reschedule some requests." |

**Conflict Resolution UI Example:**
```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Schedule Conflicts Detected                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Conflict #1: Insufficient base presence                │
│  Date: March 15, 2026                                   │
│  Required: 20 soldiers (2 Drivers, 1 Medic minimum)     │
│  Available: 15 soldiers (1 Driver, 1 Medic)             │
│                                                          │
│  Conflicting Leave Requests:                            │
│  ☐ David (Driver, Priority 9, Family Event)             │
│  ☐ Sarah (Any, Priority 7, Exam)                        │
│  ☐ Alex (Any, Priority 8, Wedding)                      │
│  ☐ Rachel (Driver, Priority 6, Preference)              │
│                                                          │
│  Recommendation: Deny Rachel's request (lowest priority)│
│                                                          │
│  [ Apply Recommendation ]  [ Manual Selection ]         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Conflict #2: Role shortage                             │
│  ...                                                     │
│                                                          │
│                    [ Cancel ]  [ Resolve All ]           │
└──────────────────────────────────────────────────────────┘
```

#### 9.4 Concurrent Edit Conflicts

See section 8.7 for full flow. Summary:

```
1. Detect version mismatch
2. Show merge dialog with:
   - What other user changed
   - What current user changed
   - Merge options (auto-merge if possible)
3. Apply resolution
4. Retry save with merged data
```

#### 9.5 Data Corruption/Integrity Issues

| Error | Cause | User Experience |
|-------|-------|-----------------|
| Corrupted Google Sheet | Someone manually edited structure | "Data structure error detected in Google Sheet.<br>This usually happens if the sheet was manually edited.<br>[View Details] [Restore from Backup] [Contact Support]" |
| Missing required tabs | Someone deleted "Soldiers" tab | "Missing required data tab: 'Soldiers'.<br>The Google Sheet structure is incomplete.<br>[Recreate Missing Tabs] [Use Different Sheet]" |
| Invalid data types | Text in number field (manual edit) | Auto-fix where possible (coerce to number).<br>If impossible: "Invalid data in Soldiers table, row 5, column 'ServiceStart'. Please fix manually in Google Sheet." |
| Orphaned references | Task assigned to deleted soldier | On load: Detect and show: "Found 3 task assignments to soldiers no longer in roster. Clean up?"<br>[Yes - Remove] [No - Keep for now]" |

**Data Integrity Check (on load):**
```javascript
async function validateDataIntegrity(sheetData) {
  const issues = [];

  // Check for required tabs
  const requiredTabs = ['Soldiers', 'Tasks', 'TaskSchedule',
                        'LeaveRequests', 'LeaveSchedule', 'Config'];
  for (const tab of requiredTabs) {
    if (!sheetData.tabs.includes(tab)) {
      issues.push({ type: 'MISSING_TAB', tab });
    }
  }

  // Check for orphaned references
  const soldierIDs = new Set(sheetData.Soldiers.map(s => s.ID));
  const orphanedTasks = sheetData.TaskSchedule.filter(
    t => !soldierIDs.has(t.SoldierID)
  );
  if (orphanedTasks.length > 0) {
    issues.push({ type: 'ORPHANED_TASKS', count: orphanedTasks.length });
  }

  return issues;
}
```

#### 9.6 Browser/Client Errors

| Error | Cause | User Experience |
|-------|-------|-----------------|
| JavaScript disabled | Rare but possible | Static HTML fallback page:<br>"ShabTzak requires JavaScript to run.<br>[How to enable JavaScript]" |
| Unsupported browser | IE11 or very old browser | "ShabTzak requires a modern browser.<br>Please use:<br>- Chrome (2020+)<br>- Edge (2020+)<br>- Firefox (2020+)<br>[Download Chrome]" |
| Out of memory | Dataset too large for browser | "Too much data to load.<br>Suggestions:<br>- Archive old schedules<br>- Use a computer with more RAM<br>- Reduce planning window" |
| Local storage full | Too much cached data | Auto-clear old cache.<br>If persists: "Cannot save settings locally. Clear browser data or use incognito mode." |

### Error Prevention Strategies

#### 9.7 Input Validation (Client-Side)

```javascript
// Example: Soldier form validation
<SoldierForm onSubmit={handleSubmit}>
  <Input
    name="name"
    required
    minLength={2}
    pattern="[A-Za-z\s]+"
    errorMessage="Name must be at least 2 letters"
  />

  <Select
    name="role"
    required
    options={validRoles}
    errorMessage="Please select a role"
  />

  <DatePicker
    name="serviceStart"
    required
    min={today}
    errorMessage="Service start must be today or future"
  />

  <DatePicker
    name="serviceEnd"
    required
    min={formData.serviceStart}
    errorMessage="Service end must be after start"
  />

  <Button type="submit" disabled={!formIsValid}>
    Save Soldier
  </Button>
</SoldierForm>
```

- Disable submit button until form is valid
- Show inline errors in real-time (onChange)
- Use HTML5 validation attributes
- Custom validation for business rules

#### 9.8 Schema Validation (Sheet Structure)

```javascript
async function initializeApp() {
  const sheetData = await loadGoogleSheet();

  // Validate structure
  const issues = await validateDataIntegrity(sheetData);

  if (issues.length > 0) {
    // Minor issues: auto-fix
    if (issues.every(i => i.type === 'ORPHANED_TASKS')) {
      await autoFixOrphanedReferences(issues);
    }
    // Major issues: prompt user
    else {
      showRepairDialog(issues);
    }
  }

  // Proceed
  renderDashboard(sheetData);
}
```

#### 9.9 Optimistic Updates with Rollback

```javascript
async function updateSoldier(soldierID, changes) {
  // 1. Save current state
  const originalData = getCurrentSoldierData(soldierID);

  // 2. Update UI immediately (optimistic)
  updateUIOptimistically(soldierID, changes);
  showLoadingIndicator();

  try {
    // 3. Save to Google Sheets
    await sheetsAPI.updateSoldier(soldierID, changes);

    // 4. Success
    hideLoadingIndicator();
    showToast("Soldier updated successfully");

  } catch (error) {
    // 5. Rollback UI on failure
    rollbackUI(soldierID, originalData);
    hideLoadingIndicator();

    // 6. Show error
    showError("Failed to save", error.message);
  }
}
```

#### 9.10 Graceful Degradation

| Feature | Failure | Fallback |
|---------|---------|----------|
| Calendar visualization | Library fails to load | Show table view instead |
| PDF export | Browser print API fails | Offer CSV download |
| Fairness heatmap | Rendering error | Show simple sorted list |
| Real-time sync | Network issues | Manual refresh button |

#### 9.11 User Guidance

- **Tooltips:** Hover over field labels for explanations
- **Help icons:** (?) next to complex features → popup with details
- **Placeholder text:** Show examples in empty inputs
  - Example: Priority field placeholder: "1-10 (1=highest)"
- **Confirmation dialogs:** For destructive actions
  - "Delete soldier 'David'? This cannot be undone. [Cancel] [Delete]"
- **Onboarding tour:** First-time users get step-by-step walkthrough

### Logging & Debugging

#### For Users:
- Clear, actionable error messages (no stack traces)
- No technical jargon
- Always suggest next steps or offer help link

#### For Developers:
- Console logging in development mode only
- Error tracking service (optional): Sentry (free tier)
  - Captures unhandled exceptions
  - Sends to centralized dashboard
  - Includes user context (browser, sheet ID, recent actions)
- Export error report feature:
  - "Report Bug" button in app
  - Generates JSON report with:
    - Error message
    - Stack trace
    - User actions leading to error
    - Browser info
    - Sheet structure snapshot
  - User can email to support

---

## 10. Testing Strategy

### 10.1 Unit Testing

**Framework:** Vitest (fast, modern, Vite-integrated)

**Coverage Target:** 80% of utility functions

**Test Categories:**

**A. Fairness Calculations**
```javascript
describe('Fairness Calculator', () => {
  test('calculates leave ratio correctly', () => {
    expect(calculateLeaveRatio(10, 4)).toBe(0.4);
    expect(calculateLeaveRatio(5, 2)).toBe(0.4);
    expect(calculateLeaveRatio(20, 8)).toBe(0.4);
  });

  test('calculates task fairness score', () => {
    const soldier = { hoursWorked: 50 };
    const platoonAvg = 40;
    expect(calculateTaskFairness(soldier, platoonAvg)).toBe(10);
  });

  test('handles new soldier initialization', () => {
    const platoon = [
      { fairness: 10 },
      { fairness: -5 },
      { fairness: 15 }
    ];
    const newSoldier = initializeNewSoldier(platoon);
    expect(newSoldier.fairness).toBe(6.67); // avg of 10, -5, 15
  });
});
```

**B. Date/Time Utilities**
```javascript
describe('Date Utilities', () => {
  test('correctly identifies weekend', () => {
    expect(isWeekend(new Date('2026-03-20'))).toBe(true);  // Friday
    expect(isWeekend(new Date('2026-03-21'))).toBe(true);  // Saturday
    expect(isWeekend(new Date('2026-03-22'))).toBe(false); // Sunday
  });

  test('calculates leave duration in nights', () => {
    const start = new Date('2026-03-20');
    const end = new Date('2026-03-22');
    expect(calculateNights(start, end)).toBe(2);
  });

  test('classifies leave type', () => {
    expect(classifyLeaveType(1)).toBe('After');
    expect(classifyLeaveType(3)).toBe('Long');
  });
});
```

**C. Validation Logic**
```javascript
describe('Validation', () => {
  test('validates soldier data', () => {
    const validSoldier = {
      name: 'David',
      role: 'Driver',
      serviceStart: '2026-01-01',
      serviceEnd: '2026-08-31'
    };
    expect(validateSoldier(validSoldier)).toBeNull(); // no errors

    const invalidSoldier = { name: '' };
    expect(validateSoldier(invalidSoldier)).toHaveProperty('name');
  });

  test('detects task time conflicts', () => {
    const task1 = { start: '14:00', end: '18:00' };
    const task2 = { start: '16:00', end: '20:00' };
    expect(tasksOverlap(task1, task2)).toBe(true);

    const task3 = { start: '18:00', end: '22:00' };
    expect(tasksOverlap(task1, task3)).toBe(false);
  });
});
```

**D. Algorithm Helpers**
```javascript
describe('Scheduling Helpers', () => {
  test('builds availability matrix', () => {
    const soldiers = [/* ... */];
    const leaves = [/* ... */];
    const matrix = buildAvailabilityMatrix(soldiers, leaves, 72);
    expect(matrix.length).toBe(soldiers.length);
    expect(matrix[0].length).toBe(72); // hours
  });

  test('filters soldiers by role', () => {
    const soldiers = [
      { name: 'David', role: 'Driver' },
      { name: 'Sarah', role: 'Medic' }
    ];
    expect(filterByRole(soldiers, 'Driver')).toHaveLength(1);
  });
});
```

### 10.2 Integration Testing

**Framework:** Vitest + Mock Service Worker (MSW) for API mocking

**Coverage:**

**A. Google Sheets API Integration**
```javascript
describe('Sheets API', () => {
  beforeEach(() => {
    // Mock Google Sheets API responses
    server.use(
      rest.get('https://sheets.googleapis.com/v4/spreadsheets/:id',
        (req, res, ctx) => {
          return res(ctx.json(mockSheetData));
        }
      )
    );
  });

  test('loads soldiers from sheet', async () => {
    const soldiers = await loadSoldiers('sheet-id-123');
    expect(soldiers).toHaveLength(10);
    expect(soldiers[0]).toHaveProperty('name');
  });

  test('handles API errors gracefully', async () => {
    server.use(
      rest.get('*', (req, res, ctx) => {
        return res(ctx.status(403));
      })
    );

    await expect(loadSoldiers('sheet-id')).rejects.toThrow('Access denied');
  });

  test('detects version conflicts', async () => {
    // First read: version 5
    const data1 = await readSheet('sheet-id');

    // Simulate another user writing
    await simulateExternalWrite('sheet-id');

    // Second write: should detect conflict
    await expect(writeSheet('sheet-id', data1, 5))
      .rejects.toThrow('Version conflict');
  });
});
```

**B. Data Flow Between Components**
```javascript
describe('Component Integration', () => {
  test('adding soldier updates dashboard', async () => {
    const { getByText, getByLabelText } = render(<App />);

    // Navigate to soldiers page
    click(getByText('Soldiers'));

    // Add soldier
    click(getByText('Add Soldier'));
    type(getByLabelText('Name'), 'David');
    select(getByLabelText('Role'), 'Driver');
    click(getByText('Save'));

    // Verify appears in list
    await waitFor(() => {
      expect(getByText('David')).toBeInTheDocument();
    });

    // Verify dashboard updated
    click(getByText('Dashboard'));
    await waitFor(() => {
      expect(getByText('11 soldiers')).toBeInTheDocument();
    });
  });
});
```

**C. Authentication Flow**
```javascript
describe('Authentication', () => {
  test('redirects to login when not authenticated', () => {
    render(<App />);
    expect(window.location.pathname).toBe('/login');
  });

  test('successful login loads dashboard', async () => {
    const { getByText } = render(<App />);

    // Mock Google OAuth
    mockGoogleAuth.signIn();

    await waitFor(() => {
      expect(getByText('Dashboard')).toBeInTheDocument();
    });
  });

  test('handles expired session', async () => {
    mockGoogleAuth.expireSession();

    // Trigger API call
    await loadSoldiers();

    // Should redirect to login
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });
});
```

### 10.3 Algorithm Testing

**Test Data Sets:**

**Small:** 5 soldiers, 3 task types, 1 week
**Medium:** 20 soldiers, 10 task types, 1 month
**Large:** 50 soldiers, 20 task types, 6 months

**Test Cases:**

```javascript
describe('Leave Scheduling Algorithm', () => {
  test('simple case: grants all requests when possible', () => {
    const soldiers = createMockSoldiers(10);
    const requests = [
      { soldierID: '1', dates: ['2026-03-20'], priority: 5 }
    ];

    const schedule = scheduleLeaves(soldiers, requests);
    expect(schedule.approved).toHaveLength(1);
    expect(schedule.denied).toHaveLength(0);
  });

  test('respects minimum base presence', () => {
    const soldiers = createMockSoldiers(20);
    const requests = soldiers.map((s, i) => ({
      soldierID: s.id,
      dates: ['2026-03-20'], // Everyone wants same day
      priority: i
    }));

    const schedule = scheduleLeaves(soldiers, requests, { minPresence: 10 });
    expect(schedule.approved).toHaveLength(10); // Max allowed
    expect(schedule.denied).toHaveLength(10);
  });

  test('prioritizes by priority number', () => {
    const soldiers = createMockSoldiers(20);
    const requests = [
      { soldierID: '1', dates: ['2026-03-20'], priority: 1 }, // Highest
      { soldierID: '2', dates: ['2026-03-20'], priority: 10 } // Lowest
    ];

    const schedule = scheduleLeaves(soldiers, requests, { maxLeaves: 1 });
    expect(schedule.approved[0].soldierID).toBe('1'); // Priority 1 wins
  });

  test('balances fairness when priorities equal', () => {
    const soldiers = [
      { id: '1', fairness: -10 }, // Below average
      { id: '2', fairness: 10 }   // Above average
    ];
    const requests = [
      { soldierID: '1', dates: ['2026-03-20'], priority: 5 },
      { soldierID: '2', dates: ['2026-03-20'], priority: 5 }
    ];

    const schedule = scheduleLeaves(soldiers, requests, { maxLeaves: 1 });
    expect(schedule.approved[0].soldierID).toBe('1'); // Fairness breaks tie
  });

  test('detects impossible schedules', () => {
    const soldiers = createMockSoldiers(2); // Only 2 soldiers
    const requests = createOverlappingRequests(soldiers, '2026-03-20');

    const schedule = scheduleLeaves(soldiers, requests, { minPresence: 5 });
    expect(schedule.conflicts).toHaveLength(1);
    expect(schedule.conflicts[0].reason).toBe('Insufficient base presence');
  });

  test('respects locked assignments', () => {
    const soldiers = createMockSoldiers(10);
    const requests = [
      { soldierID: '1', dates: ['2026-03-20'], priority: 10 }
    ];
    const locked = [
      { soldierID: '1', dates: ['2026-03-20'] } // Manually locked
    ];

    const schedule = scheduleLeaves(soldiers, requests, { locked });
    expect(schedule.approved).toContainEqual(locked[0]); // Kept
  });
});

describe('Task Scheduling Algorithm', () => {
  test('assigns tasks to available soldiers', () => {
    const soldiers = createMockSoldiers(10);
    const tasks = [
      { id: 't1', start: '14:00', end: '18:00', roles: { 'Driver': 1 } }
    ];

    const schedule = scheduleTasks(soldiers, tasks);
    expect(schedule[0].assignments).toHaveLength(1);
    expect(schedule[0].assignments[0].role).toBe('Driver');
  });

  test('enforces rest periods', () => {
    const soldiers = [
      { id: '1', role: 'Driver' }
    ];
    const tasks = [
      { id: 't1', start: '08:00', end: '12:00', roles: { 'Driver': 1 } },
      { id: 't2', start: '13:00', end: '17:00', roles: { 'Driver': 1 } }
    ];
    const config = { restPeriods: { default: 6 } }; // 6 hours minimum

    const schedule = scheduleTasks(soldiers, tasks, config);
    // Task 2 should be unassigned (not enough rest)
    expect(schedule[1].assignments).toHaveLength(0);
    expect(schedule[1].conflicts).toContain('Insufficient rest period');
  });

  test('balances hours across soldiers', () => {
    const soldiers = [
      { id: '1', role: 'Any', hoursWorked: 0 },
      { id: '2', role: 'Any', hoursWorked: 20 }
    ];
    const tasks = [
      { id: 't1', start: '08:00', end: '12:00', roles: { 'Any': 1 } }
    ];

    const schedule = scheduleTasks(soldiers, tasks);
    expect(schedule[0].assignments[0].soldierID).toBe('1'); // Fewer hours
  });

  test('deterministic: same input = same output', () => {
    const soldiers = createMockSoldiers(20);
    const tasks = createMockTasks(10);

    const schedule1 = scheduleTasks(soldiers, tasks);
    const schedule2 = scheduleTasks(soldiers, tasks);

    expect(schedule1).toEqual(schedule2);
  });
});
```

### 10.4 End-to-End Testing

**Framework:** Playwright (browser automation)

**Scenarios:**

```javascript
describe('E2E: Complete Workflow', () => {
  test('commander schedules leaves end-to-end', async ({ page }) => {
    // 1. Sign in
    await page.goto('https://shabtazk.github.io');
    await page.click('text=Sign in with Google');
    await mockGoogleAuth(page);

    // 2. Create new sheet
    await page.click('text=Create New Sheet');
    await page.fill('input[name="unitName"]', 'Alpha Platoon');
    await page.click('text=Create');

    // 3. Add soldiers
    await page.click('text=Soldiers');
    for (let i = 0; i < 5; i++) {
      await page.click('text=Add Soldier');
      await page.fill('input[name="name"]', `Soldier ${i}`);
      await page.selectOption('select[name="role"]', 'Driver');
      await page.fill('input[name="serviceStart"]', '2026-01-01');
      await page.fill('input[name="serviceEnd"]', '2026-08-31');
      await page.click('text=Save');
    }

    // 4. Add leave requests
    await page.click('text=Leave Requests');
    await page.click('text=New Request');
    await page.selectOption('select[name="soldier"]', 'Soldier 0');
    await page.fill('input[name="startDate"]', '2026-03-20');
    await page.fill('input[name="endDate"]', '2026-03-21');
    await page.selectOption('select[name="constraint"]', 'Family event');
    await page.fill('input[name="priority"]', '5');
    await page.click('text=Submit');

    // 5. Generate schedule
    await page.click('text=Calculate Leave Schedule');
    await page.waitForSelector('text=Schedule generated');

    // 6. Verify calendar shows leave
    await page.click('text=Calendar View');
    const leaveCell = await page.locator('td:has-text("Soldier 0")');
    await expect(leaveCell).toBeVisible();

    // 7. Export to PDF
    await page.click('text=Export');
    await page.click('text=PDF');
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('multi-user concurrent editing', async ({ browser }) => {
    // Open two contexts (simulate two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Both sign in and open same sheet
    await setupUser(page1, 'user1@example.com');
    await setupUser(page2, 'user2@example.com');

    // User 1 edits soldier
    await page1.click('text=Soldiers');
    await page1.click('text=Edit David');
    await page1.selectOption('select[name="role"]', 'Medic');

    // User 2 edits same soldier (different field)
    await page2.click('text=Soldiers');
    await page2.click('text=Edit David');
    await page2.selectOption('select[name="status"]', 'Injured');

    // User 1 saves first
    await page1.click('text=Save');
    await page1.waitForSelector('text=Saved successfully');

    // User 2 saves (should trigger conflict)
    await page2.click('text=Save');
    await page2.waitForSelector('text=Another user modified');

    // Resolve conflict
    await page2.click('text=Keep both changes');
    await page2.click('text=Apply Resolution');
    await page2.waitForSelector('text=Saved successfully');

    // Verify both changes persisted
    await page1.reload();
    await page1.click('text=David');
    await expect(page1.locator('text=Medic')).toBeVisible();
    await expect(page1.locator('text=Injured')).toBeVisible();
  });
});
```

### 10.5 Performance Testing

**Benchmarks:**

```javascript
describe('Performance', () => {
  test('schedule calculation completes in < 5 seconds', async () => {
    const soldiers = createMockSoldiers(30);
    const requests = createMockRequests(100);

    const startTime = performance.now();
    await scheduleLeaves(soldiers, requests);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(5000); // 5 seconds
  });

  test('Google Sheets sync in < 2 seconds', async () => {
    const startTime = performance.now();
    await loadAllData('sheet-id');
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(2000); // 2 seconds
  });

  test('UI responsiveness: form input has no lag', async () => {
    const { getByLabelText } = render(<SoldierForm />);
    const input = getByLabelText('Name');

    const startTime = performance.now();
    await type(input, 'David');
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100); // No perceptible lag
  });

  test('handles large datasets gracefully', async () => {
    const soldiers = createMockSoldiers(100); // Stress test
    const tasks = createMockTasks(200);

    // Should complete without crashing
    const schedule = await scheduleTasks(soldiers, tasks);
    expect(schedule).toBeDefined();
  });
});
```

**If performance issues detected:**
- Profile with Chrome DevTools
- Optimize hot paths in algorithm
- Implement virtual scrolling for large tables
- Add pagination
- Cache frequently accessed data
- Use Web Workers for heavy computations

### 10.6 Manual Testing (UAT)

**Participants:** 2-3 actual commanders from target unit

**Timing:** Before initial release, after major features

**Scenarios:**
1. **Real Data Test**
   - Use actual soldier roster (anonymized if needed)
   - Real leave requests from past cycle
   - Compare algorithm output to manual schedule
   - Verify fairness metrics match expectations

2. **Edge Cases**
   - All soldiers request same weekend
   - Only 1 soldier with critical role
   - Soldier added mid-period
   - Soldier injured/removed mid-period

3. **Usability Test**
   - Can commanders complete tasks without help?
   - Time to complete common workflows
   - Identify confusing UI elements
   - Gather feature requests

**Feedback Collection:**
- Screen recording + think-aloud protocol
- Post-test survey (SUS - System Usability Scale)
- Bug reports
- Feature requests prioritized

### 10.7 Quality Assurance Checklist

**Before ANY release:**

- [ ] All unit tests pass (100%)
- [ ] Integration tests pass
- [ ] Algorithm produces valid schedules for all test scenarios
- [ ] Multi-user conflict resolution tested
- [ ] Export formats (PDF, text) verified
- [ ] Cross-browser testing:
  - [ ] Chrome (latest)
  - [ ] Edge (latest)
  - [ ] Firefox (latest)
- [ ] Mobile responsive (bonus, not critical)
- [ ] No console errors on production build
- [ ] Deterministic test: Same inputs produce same outputs (run 10 times)
- [ ] Performance benchmarks met:
  - [ ] Schedule generation < 5 seconds (30 soldiers)
  - [ ] Sheets sync < 2 seconds
  - [ ] UI responsive (no lag)
- [ ] Security checks:
  - [ ] Authentication required
  - [ ] Authorization enforced
  - [ ] HTTPS only
  - [ ] No API keys in client code
- [ ] Manual UAT with at least 2 commanders
- [ ] Documentation updated (if applicable)

### 10.8 Regression Testing

**When:** After every code change (automated via CI/CD)

**Process:**
1. Code committed to Git
2. GitHub Actions runs:
   - Lint (ESLint)
   - Unit tests (Vitest)
   - Integration tests
   - Build production bundle
3. If all pass: Deploy to staging
4. Manual smoke test on staging
5. If OK: Deploy to production

**Goal:** Ensure new features don't break existing functionality

---

## 11. Acceptance Criteria

### Functional Acceptance

**The system is considered complete when:**

**Soldier Management:**
- ✅ Commander can add soldier with all required fields
- ✅ Commander can edit soldier (role, dates, status)
- ✅ Commander can remove soldier
- ✅ Soldier list displays with sortable columns
- ✅ Fairness score shown for each soldier
- ✅ New soldiers initialize with platoon average fairness

**Leave Scheduling:**
- ✅ Commander can submit leave request with all fields
- ✅ System classifies as "After" or "Long" automatically
- ✅ System identifies weekend leaves (Friday-Saturday)
- ✅ Algorithm generates valid leave schedule
- ✅ Respects 10:4 ratio (or configurable equivalent)
- ✅ Prioritizes by priority 1-10
- ✅ Balances fairness (weekend vs midweek distribution)
- ✅ Enforces minimum base presence
- ✅ Detects and reports conflicts when impossible
- ✅ Allows manual override/locking
- ✅ Locked leaves persist through re-calculation

**Task Scheduling:**
- ✅ Commander can define task types and instances
- ✅ Algorithm assigns soldiers to tasks with role matching
- ✅ Enforces rest periods (configurable per task type)
- ✅ Prevents overlapping assignments
- ✅ Distributes hours fairly (balances workload)
- ✅ Handles special tasks (Pillbox) correctly
- ✅ Limits consecutive driving hours
- ✅ Works within 72-hour rolling window
- ✅ Allows manual override/locking

**Fairness System:**
- ✅ Tracks hours worked per soldier
- ✅ Tracks leave days (weekend vs midweek)
- ✅ Tracks "After" leaves separately
- ✅ Calculates deviation from platoon average
- ✅ Displays heatmap visualization
- ✅ Updates in real-time with schedule changes

**Multi-User:**
- ✅ Multiple commanders can work simultaneously
- ✅ Concurrent edits detected (version tracking)
- ✅ Conflict merge UI presented
- ✅ Successful conflict resolution

**Export:**
- ✅ PDF export works (readable, formatted)
- ✅ WhatsApp text export works (formatted, with emojis)
- ✅ Both task and leave schedules exportable

**History:**
- ✅ Past schedules viewable
- ✅ Fairness trends over time shown

**Configuration:**
- ✅ All settings editable (ratios, rest periods, etc.)
- ✅ Changes persist to Google Sheet
- ✅ Changes apply to future calculations

### Non-Functional Acceptance

**Platform:**
- ✅ Runs on Windows 10/11
- ✅ Works in Chrome, Edge, Firefox (latest versions)
- ✅ No installation required (browser only)
- ✅ No admin rights needed

**Performance:**
- ✅ Leave schedule calculation: < 5 seconds (30 soldiers, 100 requests)
- ✅ Task schedule calculation: < 1 second (30 soldiers, 72 hours)
- ✅ Google Sheets sync: < 2 seconds
- ✅ UI responsive: no perceptible lag when typing

**Reliability:**
- ✅ Deterministic: same inputs always produce same outputs
- ✅ Handles network errors gracefully (retry, error messages)
- ✅ Data integrity maintained (no corruption)

**Usability:**
- ✅ Commander can complete common workflows without help
- ✅ Error messages are clear and actionable
- ✅ System Usability Scale (SUS) score > 70

**Cost:**
- ✅ 100% free (no subscription, no hidden costs)
- ✅ Uses only free services (Google Sheets, free hosting)

### User Acceptance Test (UAT)

**Test with real commanders:**

**Scenario 1: Schedule 2-week leave cycle**
- Given: 20 soldiers, 50 leave requests
- When: Commander runs leave scheduler
- Then: Valid schedule generated in < 5 seconds
- And: Commander approves schedule as "fair"

**Scenario 2: Schedule 72-hour tasks**
- Given: 15 available soldiers, 30 tasks
- When: Commander runs task scheduler
- Then: All tasks filled (or conflicts clearly reported)
- And: No soldier violates rest periods

**Scenario 3: Handle conflict**
- Given: Too many high-priority leave requests
- When: Commander runs scheduler
- Then: Conflict dialog appears with clear options
- When: Commander resolves manually
- Then: New schedule generated successfully

**Scenario 4: Export and distribute**
- Given: Generated schedule
- When: Commander exports to PDF
- Then: PDF downloads correctly and is readable
- When: Commander exports to WhatsApp text
- Then: Text copies to clipboard and formats correctly in WhatsApp

**Acceptance:** 2 out of 3 commanders successfully complete all scenarios

---

## 12. Future Considerations

### Phase 2 Features (Post-MVP)

**Not in initial scope, but potential future additions:**

**1. Soldier Self-Service Portal**
- Soldiers submit leave requests directly (mobile app or web)
- View their own schedule
- Fairness score transparency

**2. Calendar Integration**
- Sync to Google Calendar
- iCal export for iOS/Outlook

**3. Advanced Analytics**
- Predictive fairness (forecast future imbalance)
- Workload heatmaps over time
- Leave utilization reports

**4. AI-Powered Recommendations**
- Suggest optimal leave distributions
- Identify fairness issues proactively
- Learn from commander's manual overrides

**5. Notifications**
- Email/SMS alerts for upcoming tasks
- Reminders for leave approval
- Conflict alerts

**6. Mobile App**
- Native iOS/Android apps
- Push notifications
- Offline mode

**7. Multi-Unit Support**
- Manage multiple platoons from one account
- Cross-platoon scheduling (borrow soldiers)

**8. Audit Trail**
- Detailed change history (who changed what, when)
- Compliance reporting
- Undo/redo functionality

**9. Templates & Presets**
- Save common task configurations
- Recurring schedules (weekly patterns)
- Holiday calendars

**10. Integration with IDF Systems**
- Import soldier data from existing systems
- Export to official formats

### Technical Debt to Address

**Performance Optimizations:**
- Implement Web Workers for algorithm (off main thread)
- Add service worker for offline capability
- Optimize re-renders with React.memo

**Code Quality:**
- Increase test coverage to 90%+
- Add E2E tests for all critical paths
- Implement comprehensive error tracking (Sentry)

**UX Improvements:**
- User onboarding tutorial
- Keyboard shortcuts for power users
- Accessibility (WCAG 2.1 AA compliance)

**Infrastructure:**
- CI/CD pipeline (GitHub Actions)
- Automated deployment
- Staging environment for testing

---

## Appendix A: Technology Justification

### Why React?
- Most popular framework (large community, good docs)
- Component-based (matches our modular design)
- Fast rendering (virtual DOM)
- Easy to find developers

**Alternative:** Vue.js (simpler learning curve, but smaller ecosystem)

### Why Google Sheets as Database?
- ✅ Meets "free" requirement
- ✅ Multi-user built-in (Google's conflict resolution)
- ✅ Familiar to users (can manually inspect/edit if needed)
- ✅ No server setup/maintenance
- ✅ Automatic backups (Google Drive revision history)

**Downsides:**
- API rate limits (but sufficient for use case)
- Not ideal for very large datasets (>10,000 rows)
- Requires internet connection

**Alternatives considered:**
- Firebase (free tier limited)
- SQLite (requires backend)
- Local storage (no multi-user)

### Why Client-Side Algorithm?
- ✅ Deterministic (no server state)
- ✅ Free (no compute costs)
- ✅ Fast (modern browsers are powerful)
- ✅ Privacy (data never leaves Google ecosystem)

**Downside:**
- Limited to browser's computation power
- For very large datasets (100+ soldiers), may need server

### Why Static Hosting?
- ✅ Free (GitHub Pages, Vercel, Netlify)
- ✅ Fast (CDN distribution)
- ✅ Simple deployment (git push)
- ✅ HTTPS by default

---

## Appendix B: Data Flow Diagrams

*[Diagrams from section 8 can be enhanced with visual flowcharts if needed]*

---

## Appendix C: Glossary

**Terms:**

- **After:** 1-night leave
- **Long Leave:** 2-4 night leave
- **Fairness Score:** Deviation from platoon average (hours/leaves)
- **Locked Assignment:** Manual override that persists through re-calculations
- **Platoon Average:** Mean of metric across all active soldiers
- **Pillbox:** Special multi-day task, removes soldier from regular rotation
- **Priority:** 1-10 ranking for leave requests (1=highest)
- **Rest Period:** Minimum hours between task assignments
- **Role:** Critical position (Driver, Medic, etc.)
- **Service Period:** Start date to end date of soldier's service
- **Weekend:** Friday-Saturday (configurable)

---

## Appendix D: References

**Technologies:**
- React: https://react.dev
- Google Sheets API: https://developers.google.com/sheets/api
- Vite: https://vitejs.dev
- Vitest: https://vitest.dev
- Playwright: https://playwright.dev

**Algorithms:**
- Constraint Satisfaction Problems: https://en.wikipedia.org/wiki/Constraint_satisfaction_problem
- Genetic Algorithms: https://en.wikipedia.org/wiki/Genetic_algorithm

---

**End of Design Document**

---

**Next Steps:**
1. Review and approve this design
2. Create detailed implementation plan (breakdown into tasks)
3. Set up development environment
4. Begin implementation (suggested order: data layer → soldier management → leave scheduler → task scheduler → UI → export)
5. Continuous testing throughout
6. UAT with real commanders
7. Deploy to production
8. Gather feedback for Phase 2

---

**Document Approval:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [User] | __________ | 2026-02-22 |
| Technical Lead | Claude (ShabTzak Team) | ✓ | 2026-02-22 |
| Commander (UAT) | [TBD] | __________ | [TBD] |

---

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-22 | Claude | Initial design document |
