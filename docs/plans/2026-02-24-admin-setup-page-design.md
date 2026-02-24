# Admin Setup Page Design

**Date:** 2026-02-24
**Status:** Approved

## Goal

Add a dedicated admin-only Setup page where the admin can initialize missing spreadsheet tabs (create them with correct column headers) and manage who else has admin access.

## Approved Scope

- Create missing tabs + write column headers only (no data seeding, no wipes)
- Admin identified by `VITE_ADMIN_EMAIL` env var (primary) + extra admins in Config tab
- After login, fetch user email from Google userinfo API
- Dedicated `#setup` page, accessible to admins only
- Setup nav link visible to admins only

## Architecture

### 1. Auth: Add email to AuthState (`src/context/AuthContext.tsx`)

After successful token callback, fetch:
```
GET https://www.googleapis.com/oauth2/v3/userinfo
Authorization: Bearer <access_token>
```
Returns `{ email }`. Store in `AuthState`:
```typescript
interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  email: string | null   // ADD
  error: string | null
}
```

### 2. Env config: Add adminEmail (`src/config/env.ts`)

```typescript
adminEmail: import.meta.env.VITE_ADMIN_EMAIL || '',
```
Also update `.env.example` with `VITE_ADMIN_EMAIL=`.

### 3. Extra admins in Config tab (`src/services/configRepository.ts`)

Store extra admins as a key-value row in the Config tab:
- Key: `adminEmails`, Value: comma-separated emails e.g. `other@example.com,third@example.com`

Add two methods to `ConfigRepository`:
```typescript
async readAdminEmails(): Promise<string[]>
async writeAdminEmails(emails: string[]): Promise<void>
```

### 4. AppConfig model: Add adminEmails (`src/models/Config.ts`)

Add `adminEmails?: string[]` to the `AppConfig` interface so it flows through `useDataService` naturally.

### 5. isAdmin computation (`src/App.tsx`)

```typescript
const isAdmin = !!auth.email && (
  auth.email === config.adminEmail ||
  (configData?.adminEmails ?? []).includes(auth.email)
)
```

### 6. GoogleSheetsService: Add batchUpdate (`src/services/googleSheets.ts`)

Add method to create new sheets (tabs) in an existing spreadsheet:
```typescript
async batchUpdate(spreadsheetId: string, requests: object[]): Promise<void>
// POST /spreadsheets/{id}:batchUpdate
```

Add helper to get existing tab titles:
```typescript
async getSheetTitles(spreadsheetId: string): Promise<string[]>
// Uses existing getSpreadsheet(), extracts sheets[].properties.title
```

### 7. SetupService: New service (`src/services/setupService.ts`)

```typescript
export type TabStatus = { tab: string; exists: boolean; error?: string }

export class SetupService {
  async checkTabs(spreadsheetId): Promise<TabStatus[]>
  // Gets existing titles, compares to Object.values(SHEET_TABS)

  async initializeMissingTabs(spreadsheetId): Promise<TabStatus[]>
  // 1. checkTabs to find missing ones
  // 2. batchUpdate with AddSheetRequest for each missing tab
  // 3. updateValues to write headers for each newly created tab
  // 4. Returns per-tab result with created: boolean
}
```

### 8. SetupPage component (`src/components/SetupPage.tsx`)

New page with two sections:

**Tab Health section:**
- List all 8 expected tabs with ✅ exists / ❌ missing status
- "Initialize Missing Tabs" button (disabled if all tabs exist)
- Loading/success/error states

**Admin Management section:**
- List current extra admins (from Config tab)
- Input + "Add Admin" button
- "Remove" button per extra admin
- Primary admin (`VITE_ADMIN_EMAIL`) shown but not removable

### 9. Routing + nav updates

**`src/App.tsx`:**
- Add `'setup'` to `Section` type
- Add `if (hash === '#setup') return 'setup'` to `getHashSection`
- Pass `isAdmin` to `AppShell`
- Render `<SetupPage>` when `section === 'setup'`

**`src/components/AppShell.tsx`:**
- Accept `isAdmin?: boolean` prop
- Add `{ href: '#setup', label: 'Setup' }` to nav but only render it when `isAdmin`

## Files Changed

| File | Change |
|------|--------|
| `src/context/AuthContext.tsx` | Add `email` to AuthState, fetch userinfo after token |
| `src/config/env.ts` | Add `adminEmail` |
| `.env.example` | Add `VITE_ADMIN_EMAIL=` |
| `src/models/Config.ts` | Add `adminEmails?: string[]` to AppConfig |
| `src/services/configRepository.ts` | Add `readAdminEmails`, `writeAdminEmails` |
| `src/services/googleSheets.ts` | Add `batchUpdate`, `getSheetTitles` |
| `src/services/setupService.ts` | New file |
| `src/components/SetupPage.tsx` | New file |
| `src/App.tsx` | Add setup route, isAdmin logic |
| `src/components/AppShell.tsx` | Conditional Setup nav link |

## Not Included

- No data seeding (Config default values, etc.)
- No tab deletion or reset
- No Google Sheets formatting (column widths, colors)
- No multi-tenancy (separate feature, task #12)
