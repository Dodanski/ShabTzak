# UI Redesign Design

**Date:** 2026-02-25

## Goal

Redesign the visual style of ShabTzak with a military/tactical aesthetic: light olive-tinted (khaki) background, dark olive accents matching IDF uniform color, unit logo on every page, IDF emblem on the login page.

---

## Logos

- `public/logo-unit.jpg` — "זאבי הגבעה" wolf unit logo — appears in nav bar on every page
- `public/logo-idf.jpeg` — IDF emblem (צבא ההגנה לישראל) — appears on login page only

---

## Color Palette

Custom `olive` Tailwind scale replaces all `blue-*` usage:

| Token | Hex | Usage |
|-------|-----|-------|
| `olive-50` | `#f5f2e8` | Page background |
| `olive-100` | `#ebe8d4` | Alternating table rows, input backgrounds |
| `olive-200` | `#d4d0a8` | Borders, dividers |
| `olive-300` | `#b8b87c` | Disabled states |
| `olive-400` | `#8fa050` | Hover accents |
| `olive-500` | `#6b7c3f` | Secondary buttons, badges |
| `olive-600` | `#556630` | Nav links active underline, focus rings |
| `olive-700` | `#4a5a2a` | Primary buttons, primary text, nav active |
| `olive-800` | `#3a4a1a` | Button hover, dark headings |
| `olive-900` | `#2a3510` | Darkest text |
| `olive-950` | `#1a2008` | Near-black |

`bg-gray-50` → `bg-olive-50` (page background)
All `bg-blue-*` → corresponding `bg-olive-*`
All `text-blue-*` → corresponding `text-olive-*`
All `border-blue-*` → `border-olive-*`
All `hover:bg-blue-*` → `hover:bg-olive-*`

---

## Login Page

Centered white card on `bg-olive-50` background:

```
┌─────────────────────────────────┐
│    [IDF emblem — 120px]         │
│    צבא ההגנה לישראל             │
│                                 │
│    [Wolf logo — 80px]           │
│    זאבי הגבעה                   │
│                                 │
│    ── ShabTzak ──               │
│    מערכת ניהול סידור שירות      │
│                                 │
│    [ Sign in with Google ]      │
└─────────────────────────────────┘
```

- Card: `bg-white`, `1px` `border-olive-200`, olive shadow
- "Sign in with Google" button: `bg-olive-700` text-white, hover `bg-olive-800`
- Subtitle text: `text-olive-600`, `text-sm`, RTL Hebrew

---

## Navigation Bar

White bar with `2px` dark-olive bottom border on every page:

```
[wolf logo 32px] זאבי הגבעה  |  Dashboard  Soldiers  Tasks  Leave  Schedule  History  |  Sign out
```

- Logo: `<img src="/logo-unit.jpg">` at `h-8 w-8`, rounded
- Unit name: `text-sm text-olive-600 font-medium` next to logo, separated by `border-l border-olive-200 pl-3`
- Active link: `text-olive-700 font-semibold` + `border-b-2 border-olive-700`
- Inactive link: `text-olive-500 hover:text-olive-700`
- Sign out: `text-olive-400 hover:text-red-600`
- For admins in unit view: "← Admin Panel" button in `text-olive-500 hover:text-olive-700`

---

## Components

### Buttons
- **Primary:** `bg-olive-700 text-white hover:bg-olive-800`
- **Secondary:** `bg-white border border-olive-500 text-olive-700 hover:bg-olive-50`
- **Danger:** `bg-red-600 text-white hover:bg-red-700` (unchanged)

### Cards / Panels
- `bg-white border border-olive-200 rounded-lg shadow-sm` (shadow uses olive tint)
- Page section headings: `text-olive-800 font-bold`

### Tables
- Header row: `bg-olive-700 text-white`
- Odd rows: `bg-white`
- Even rows: `bg-olive-50`
- Border: `border-olive-200`

### Status Badges
- Active / Approved / Success → `bg-olive-100 text-olive-800`
- Pending → `bg-olive-50 text-olive-600 border border-olive-300`
- Denied / Error → `bg-red-100 text-red-700` (unchanged)
- Injured → `bg-amber-100 text-amber-700` (unchanged)
- Discharged → `bg-gray-100 text-gray-600` (unchanged)

### Dashboard KPI Cards
- White card with `border-l-4 border-olive-700` left accent stripe
- Metric number: `text-3xl font-bold text-olive-800`
- Label: `text-sm text-olive-500`

### FairnessBar
- Low: `bg-red-400` (unchanged — critical visibility)
- Medium: `bg-olive-400`
- High: `bg-olive-700`

### Form Inputs
- `border-olive-300 focus:border-olive-600 focus:ring-olive-600`
- Background: `bg-white` (standard) or `bg-olive-50` (disabled/readonly)

### Toast Notifications
- Success: `bg-olive-700 text-white`
- Error: `bg-red-600 text-white` (unchanged)
- Info: `bg-olive-600 text-white`

---

## Tailwind Config

Add to `tailwind.config.js` under `theme.extend.colors`:

```js
olive: {
  50: '#f5f2e8',
  100: '#ebe8d4',
  200: '#d4d0a8',
  300: '#b8b87c',
  400: '#8fa050',
  500: '#6b7c3f',
  600: '#556630',
  700: '#4a5a2a',
  800: '#3a4a1a',
  900: '#2a3510',
  950: '#1a2008',
},
```

---

## Files to Change

1. `tailwind.config.js` — add olive color scale
2. `src/index.css` — set `body { background-color: #f5f2e8 }` (or use Tailwind class on root)
3. `src/components/LoginPage.tsx` — IDF logo + unit logo + olive styling
4. `src/components/AppShell.tsx` — unit logo in nav, olive nav styling
5. All page components — replace `blue-*` with `olive-*`:
   - `src/components/Dashboard.tsx`
   - `src/components/SoldiersPage.tsx`
   - `src/components/TasksPage.tsx`
   - `src/components/LeaveRequestsPage.tsx`
   - `src/components/LeaveRequestForm.tsx`
   - `src/components/SchedulePage.tsx`
   - `src/components/ScheduleCalendar.tsx`
   - `src/components/ConfigPage.tsx`
   - `src/components/SetupPage.tsx`
   - `src/components/HistoryPage.tsx`
   - `src/components/ErrorBanner.tsx`
   - `src/components/Toast.tsx`
   - `src/components/FairnessBar.tsx`
   - `src/components/ConflictList.tsx`
   - `src/components/VersionConflictBanner.tsx`

---

## Out of Scope

- Dark mode
- Mobile-specific layout changes (responsive is already Tailwind-handled)
- Animation or transition effects beyond existing hover states
- RTL layout changes (Hebrew text already renders RTL natively)
