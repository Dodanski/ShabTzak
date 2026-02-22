# ShabTzak

Soldier scheduling system for managing weekend duty assignments, leave requests, and task allocations — backed by Google Sheets as the data store.

## Features

- **Soldiers** — Add soldiers, track roles and availability, discharge when service ends
- **Tasks** — Define recurring duties (guard, kitchen, etc.) with time windows
- **Leave Requests** — Submit, approve, or deny leave; constraints are respected during scheduling
- **Schedule** — Auto-generate fair leave and task schedules; view as a calendar grid; export for WhatsApp or print
- **History** — Audit log of all changes
- **Version Check** — Banner alert when another user modifies the spreadsheet while you have it open

## Prerequisites

- Node.js 18+
- A Google Cloud project with:
  - **OAuth 2.0 Client ID** (Web application type) — needed for Google Sign-In
  - **Google Sheets API** enabled on the project
- A Google Spreadsheet set up with the required tabs (Soldiers, Tasks, LeaveRequests, LeaveAssignments, TaskAssignments, Config, History, Version)

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd ShabTzak
   npm install
   ```

2. **Create `.env.local`** in the project root:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your-api-key
   VITE_SPREADSHEET_ID=your-spreadsheet-id
   ```

   | Variable | Description |
   |---|---|
   | `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
   | `VITE_GOOGLE_API_KEY` | Google API key (optional for read-only access) |
   | `VITE_SPREADSHEET_ID` | The ID from the spreadsheet URL (`/d/<ID>/edit`) |

3. **Add your domain as an authorised JavaScript origin** in the OAuth client settings (e.g. `http://localhost:5173` for development).

## Running

```bash
# Development server
npm run dev

# Run tests
npm test

# Production build
npm run build
```

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS v3
- Google Identity Services (OAuth2 token client)
- Google Sheets API v4
- Vitest + Testing Library
