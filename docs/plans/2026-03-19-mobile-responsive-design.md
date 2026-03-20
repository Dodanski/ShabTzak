# Mobile Responsive Design

**Date:** 2026-03-19
**Goal:** Make all screens in ShabTzak look and work great on mobile phones.

## Overview

Currently, the application works on desktop but is broken on mobile - content overflows the screen and there's no proper scrolling. This design transforms the app into a mobile-friendly experience while preserving the desktop layout.

## Design Decisions

### Navigation: Bottom Navigation Bar

**Mobile (< 640px):**
- Fixed bottom navigation bar with icons + labels
- Header simplified to: Logo | Unit name | Sign out
- Safe-area padding for notched phones

**AppShell (unit view) - 5 items:**
| Icon | Label | Route |
|------|-------|-------|
| Dashboard | Dashboard | # |
| Soldiers | Soldiers | #soldiers |
| Leave | Leave | #leave |
| Schedule | Schedule | #schedule |
| More | More... | (menu: Tasks, History) |

**AdminPanel - 5 items:**
| Icon | Label | Route |
|------|-------|-------|
| Dashboard | Dashboard | dashboard |
| Units | Units | units |
| People | People | (menu: Admins, Commanders) |
| Config | Config | config |
| More | More... | (menu: Roles, Tasks, Diagnostic) |

**Desktop (>= 640px):** Current top navigation unchanged.

### Data Display: Cards vs Tables

**Soldiers Page:**
- Mobile: Card layout per soldier showing name, role, fairness bar, status, service dates, quota
- Hidden on mobile: Army ID, Hours worked, First/Last name columns
- Edit/Adjust expand inline below card
- Desktop: Current table unchanged

**Schedule Calendar:**
- Keep horizontal scroll approach (grid nature requires it)
- Improvements:
  - Sticky soldier name column (reliable z-index)
  - Larger touch targets: min-w-[36px] cells
  - Compressed date headers (day number only)
  - Collapsible legend to save space
  - Visual scroll indicator (gradient shadow)

**Admin Tables (Admins, Units, Commanders, Roles):**
- Mobile: Simple cards with key info + action buttons
- Desktop: Current tables unchanged

### Forms

- Stack all inputs vertically on mobile (grid-cols-1)
- Full-width buttons
- Minimum 44px height for touch targets

### Config Page

- Single column layout on mobile
- Each config field gets full width

## Technical Implementation

### New Components

1. **`src/components/BottomNav.tsx`**
   - Fixed position bottom navigation
   - Shows on mobile only (`sm:hidden`)
   - Handles "More" menu dropdown
   - Safe-area-inset-bottom padding

2. **`src/hooks/useIsMobile.ts`**
   - Hook returning boolean for viewport < 640px
   - Used for conditional rendering where Tailwind classes aren't sufficient

### Component Changes

| Component | Changes |
|-----------|---------|
| AppShell.tsx | Add BottomNav, hide top nav links on mobile, simplify header |
| AdminPanel.tsx | Add BottomNav, convert tab bar to bottom nav on mobile |
| SoldiersPage.tsx | Add card view for mobile, keep table for desktop |
| ScheduleCalendar.tsx | Improve sticky column, larger cells, collapsible legend |
| Dashboard.tsx | Stack fairness summary vertically on mobile |
| LeaveRequestsPage.tsx | Card layout for request list on mobile |
| TasksPage.tsx | Card layout for task list on mobile |

### Shared Improvements

- All buttons: minimum 44x44px tap area
- Form inputs: minimum 44px height
- Card padding: p-4 on mobile
- Modals/dialogs: full-screen on mobile

### CSS/Tailwind

No new Tailwind config needed. Use existing responsive prefixes:
- `sm:` for >= 640px (desktop)
- Default (no prefix) for mobile-first styles
- `hidden sm:flex` / `sm:hidden` for show/hide

## File Structure

```
src/
  components/
    BottomNav.tsx          (new)
    AppShell.tsx           (modify)
    AdminPanel.tsx         (modify)
    SoldiersPage.tsx       (modify)
    ScheduleCalendar.tsx   (modify)
    Dashboard.tsx          (modify)
    LeaveRequestsPage.tsx  (modify)
    TasksPage.tsx          (modify)
  hooks/
    useIsMobile.ts         (new)
```

## Testing Checklist

- [ ] Bottom nav appears on mobile, hidden on desktop
- [ ] All nav items work correctly
- [ ] "More" menu opens and closes properly
- [ ] Soldiers page shows cards on mobile, table on desktop
- [ ] Schedule calendar scrolls horizontally with sticky first column
- [ ] All forms are usable on mobile (inputs reachable, buttons tappable)
- [ ] Admin panel fully functional on mobile
- [ ] No horizontal overflow on any screen
- [ ] Safe area respected on notched phones (iPhone X+)
