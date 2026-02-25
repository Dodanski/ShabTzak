# Multi-Tenancy + Admin Role Design

**Date:** 2026-02-25

## Goal

Support multiple independent military units (each with its own Google Spreadsheet) under a single deployed app, with two roles: Admin (super-admin, manages units and commanders) and Commander (manages their assigned unit).

---

## Roles

### Admin
- Multiple admins supported; peers with equal permissions
- First admin seeded from `VITE_ADMIN_EMAIL` env var at deploy time
- Can add/remove other admins in-app
- Sees the **Admin Panel** on login (unit registry management)
- Can **enter any unit** and has full commander-level access to that unit
- Can switch between units freely via "← Back to Admin Panel"

### Commander
- Tied to one or more units via the master spreadsheet
- Auto-routed to their unit on login (by email match)
- A unit can have multiple commanders — all share equal access to that unit
- Has full CRUD access: add/discharge soldiers, add/remove tasks, approve/deny leave, generate schedule, manually override assignments
- Cannot access: Config page, Setup page, Admin Panel, or other units

---

## Architecture

### Master Spreadsheet
`VITE_SPREADSHEET_ID` env var points to the **master spreadsheet** (not a unit spreadsheet).

**`Admins` tab**
| AdminID | Email | AddedAt | AddedBy |
|---------|-------|---------|---------|

**`Units` tab**
| UnitID | Name | SpreadsheetID | CreatedAt | CreatedBy |
|--------|------|---------------|-----------|-----------|

**`Commanders` tab**
| CommanderID | Email | UnitID | AddedAt | AddedBy |
|-------------|-------|--------|---------|---------|

Multiple commanders per unit: supported by having multiple rows with the same `UnitID`.

### New Repositories (master spreadsheet)
- `AdminRepository` — CRUD on Admins tab
- `UnitRepository` — CRUD on Units tab
- `CommanderRepository` — CRUD on Commanders tab

These follow the same repository pattern as existing repositories.

### Existing Repositories (unit spreadsheets)
All existing repositories (SoldierRepository, TaskRepository, etc.) are reused as-is. The `DataService` is initialized with the **unit's spreadsheet ID** (resolved at login time), not the master spreadsheet ID.

---

## Login & Routing Flow

```
1. User signs in via Google OAuth
2. App fetches user email from userinfo endpoint
3. App reads master spreadsheet (Admins + Commanders tabs)
4. If email in Admins tab → load Admin Panel
5. Else if email in Commanders tab → load their unit's spreadsheet → show Commander view
6. Else → show "Access Denied — contact your admin" screen
```

**Edge cases:**
- Commander assigned to a unit with an invalid/inaccessible spreadsheet ID → show clear error with unit name
- Commander assigned to multiple units → routed to first unit found (edge case, not expected in practice)

---

## Admin Panel UI

Shown exclusively to admins. Three tabs:

### Admins Tab
- List: email, added by, added date
- Add Admin: enter email → appended to Admins sheet
- Remove: any admin except yourself

### Units Tab
- List: unit name, spreadsheet ID (truncated), commander count, actions
- Add Unit: enter name + spreadsheet ID → appended to Units sheet
- Remove: warns if unit has commanders assigned
- Each row: **"Enter Unit ↗"** button (loads unit app) + **"Open Spreadsheet ↗"** link (Google Sheets)
- When adding a unit: show a sharing guide listing all admin + commander emails that need Editor access in Google Drive

### Commanders Tab
- List: email, unit name, added date
- Add Commander: enter email + pick unit from dropdown → appended to Commanders sheet
- Remove: removes commander from unit

---

## Unit View (Commander + Admin-in-unit)

When inside a unit, the user sees the **existing app** with:

**Nav bar additions:**
- Unit name displayed ("Platoon Alpha")
- For admins: **"← Back to Admin Panel"** button

**Page access:**
| Page | Commander | Admin (in unit) |
|------|-----------|-----------------|
| Dashboard | ✓ View | ✓ View |
| Soldiers | ✓ Full | ✓ Full |
| Tasks | ✓ Full | ✓ Full |
| Leave Requests | ✓ Full | ✓ Full |
| Schedule | ✓ Full | ✓ Full |
| History | ✓ View | ✓ View |
| Config | ✗ | ✗ |
| Setup | ✗ | ✗ |

Config and Setup remain admin-only concerns managed at the master spreadsheet level, not per unit.

---

## Sharing Model

Spreadsheet access is managed manually in Google Drive (outside the app). The app cannot share spreadsheets programmatically with the current OAuth scope (`spreadsheets` only, not `drive`).

**Required sharing per unit spreadsheet:**
- All admins: Editor access
- All commanders assigned to that unit: Editor access

The Admin Panel shows this checklist when a unit is created or a commander is added, so the admin knows exactly who to share with.

---

## Data Flow

```
App starts
  └─ fetch master spreadsheet (Admins + Commanders + Units)
       ├─ email in Admins? → AdminPanel (MasterDataService)
       └─ email in Commanders? → load unit spreadsheet
                                  └─ DataService(unitSpreadsheetId)
                                       └─ existing pages
```

---

## Migration

- Existing `VITE_ADMIN_EMAIL` seeds the first admin row in the master spreadsheet's Admins tab
- Existing `VITE_SPREADSHEET_ID` becomes the master spreadsheet ID — the first unit must be manually added via the Admin Panel
- No data migration required for unit spreadsheets; they continue to work as-is

---

## Out of Scope

- Automatic Google Drive sharing (would require `drive` OAuth scope)
- Soldier-level login (no soldier role)
- Cross-unit reporting or aggregation
- Offline mode
