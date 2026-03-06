# Design: Dynamic Roles from Spreadsheet

**Date:** 2026-03-05

---

## Goal

Move soldier roles out of hardcoded TypeScript constants into an admin-managed `Roles` tab in the admin spreadsheet. Admins can add/delete roles in the Admin panel. If the tab doesn't exist, it is created empty — the app never fails, it just shows empty role dropdowns until roles are added.

---

## Data Layer

### New `Roles` tab in admin spreadsheet

- Single column: `RoleName`
- One role name per row (e.g. `Driver`, `Medic`, ...)
- `MASTER_SHEET_TABS` gets `ROLES: 'Roles'`

### MasterDataService.initialize()

- Creates the `Roles` tab if missing — **empty, no seed data**
- Does NOT fail if tab is absent or empty

### RolesService (new, simple)

- `list(): Promise<string[]>` — reads all rows from the Roles tab, returns array of strings
- `create(name): Promise<void>` — appends a new row
- `delete(name): Promise<void>` — removes the row matching the name

### SoldierRole type

- `SoldierRole` becomes `string` (no longer a TypeScript union derived from a constant)
- `ROLES` constant removed from `src/constants/index.ts`
- Role validation removed from `validateSoldier()` (dropdown constrains input at UI level)

---

## Props Threading

`AppContent` loads `roles: string[]` from `masterDs.roles.list()` alongside tasks on login. Passes:
- To `UnitApp` as `roles: string[]`
- To `AdminPanel` as `roles: string[]` + `onAddRole` / `onDeleteRole` callbacks

`UnitApp` passes `roles` down to `SoldiersPage`, `TasksPage`, `SchedulePage`.

Components that currently import `ROLES` directly remove that import and use the prop instead.

---

## Graceful Empty-State

| Component | When roles=[] |
|---|---|
| SoldiersPage add/edit dropdown | Empty `<select>` (no options) |
| SoldiersPage role filter | No role options (shows only "All roles") |
| TasksPage role requirement | Just `['Any']` |
| SchedulePage manual assign | Just `['Any']` |

No crash. Existing soldiers display their stored role string as-is regardless.

---

## Admin Panel

New **Roles** tab added between Commanders and Tasks:
- Lists all current roles
- **Delete** button per role
- Text input + **Add Role** button at the bottom
- No reordering (YAGNI)

---

## Out of Scope

- `minBasePresenceByRole` in Config stays unchanged (`Record<string, number>` handles dynamic keys already)
- No migration of existing soldiers' roles
- No role reordering
