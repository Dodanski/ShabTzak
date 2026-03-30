# Supabase Manual Setup Instructions

This guide walks you through setting up Supabase for the ShabTzak migration from Google Sheets to PostgreSQL.

---

## Overview

**What we're doing:** Creating a Supabase project and database to replace Google Sheets as the backend.

**Time required:** ~10 minutes

**Prerequisites:**
- Web browser
- GitHub account (recommended) or email
- Code editor access to the project

---

## Part 1: Create Supabase Account & Project

### Step 1: Sign Up for Supabase

1. Open your browser and go to: **https://supabase.com**
2. Click the **"Start your project"** button (green button at top)
3. Sign up using one of these methods:
   - **GitHub** (recommended - one-click signup)
   - **Email/Password** (fill in email and create password)
4. If using email, verify your email address by clicking the link sent to your inbox

### Step 2: Create New Project

1. After signing in, you'll land on the Supabase dashboard
2. Click the **"New Project"** button (or **"+ New project"** if you see that)
3. You'll see a form with these fields:

   **Organization:**
   - If this is your first project, an organization is created automatically
   - If you have multiple organizations, select one from the dropdown

   **Project Settings:**
   - **Name:** Enter `shabtazk-production`
   - **Database Password:**
     - Click the **"Generate a password"** button
     - **CRITICAL:** Copy this password immediately and save it somewhere safe (password manager, secure note)
     - You'll need this password later for database migrations
   - **Region:**
     - Open the dropdown
     - Select **"Europe (Frankfurt) eu-central-1"**
     - This is the closest region to Israel for best performance
   - **Pricing Plan:**
     - Should already be set to **"Free"** ($0/month)
     - This gives you 500MB database, unlimited API requests, 2GB bandwidth/month

4. Click the **"Create new project"** button at the bottom
5. Wait 2-3 minutes while Supabase provisions your database
   - You'll see a loading screen with "Setting up project..."
   - The page will automatically refresh when ready

### Step 3: Get API Credentials

Once your project is ready (you'll see the project dashboard):

1. On the left sidebar, click the **"Settings"** icon (gear/cog icon at the bottom of the sidebar)
2. In the Settings menu, click **"API"**
3. You'll see the API settings page with several important values

**Copy these two values:**

**A. Project URL**
   - Found at the top under "Project URL"
   - Looks like: `https://abcdefghijklmnop.supabase.co`
   - Click the copy icon next to it

**B. Project API keys - anon/public key**
   - Scroll down to the "Project API keys" section
   - Find the key labeled **"anon" "public"**
   - This is a long string starting with `eyJ...`
   - Click the copy icon to copy it
   - **Note:** Do NOT copy the "service_role" key - that's different

**Keep these values handy** - you'll need them in the next step.

---

## Part 2: Add Credentials to Your Project

### Step 4: Update .env.local File

1. Open your code editor (VS Code, or whatever you use)
2. Navigate to your project root folder (where `package.json` is located)
3. Find the file named `.env.local`
   - If it doesn't exist, create a new file named `.env.local`
4. Open `.env.local` and add these lines at the end:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

5. Replace the placeholder values:
   - Replace `https://your-project-url.supabase.co` with your actual Project URL
   - Replace `your-anon-key-here` with your actual anon/public key

**Example of what it should look like:**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMzQ1Njc4OSwiZXhwIjoxOTM5MDMyNzg5fQ.Abc123Def456Ghi789
```

6. **Save the file**
7. **IMPORTANT:** Make sure `.env.local` is in your `.gitignore` file (it should be by default)
   - This prevents committing your secret keys to git

---

## Part 3: Create Database Schema

### Step 5: Run SQL Schema Script

Now we'll create all the database tables.

1. Go back to your Supabase dashboard in the browser
2. On the left sidebar, click **"SQL Editor"** (icon looks like `</>` or a database)
3. Click the **"New query"** button (top right)
4. You'll see a blank SQL editor

5. **Copy the entire SQL schema from below** and paste it into the editor:

```sql
-- Units table
CREATE TABLE units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tab_prefix TEXT NOT NULL,
  spreadsheet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soldiers table
CREATE TABLE soldiers (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  service_start DATE NOT NULL,
  service_end DATE NOT NULL,
  initial_fairness INT DEFAULT 0,
  current_fairness INT DEFAULT 0,
  status TEXT DEFAULT 'Active',
  hours_worked INT DEFAULT 0,
  weekend_leaves_count INT DEFAULT 0,
  midweek_leaves_count INT DEFAULT 0,
  after_leaves_count INT DEFAULT 0,
  inactive_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soldiers_unit ON soldiers(unit_id);
CREATE INDEX idx_soldiers_status ON soldiers(status);
CREATE INDEX idx_soldiers_role ON soldiers(role);

-- Tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL NOT NULL,
  role_requirements JSONB NOT NULL,
  min_rest_after INT DEFAULT 8,
  is_special BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave requests
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  priority INT DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave assignments
CREATE TABLE leave_assignments (
  id TEXT PRIMARY KEY,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  leave_type TEXT NOT NULL,
  is_weekend BOOLEAN DEFAULT FALSE,
  request_id TEXT REFERENCES leave_requests(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_assignments_soldier ON leave_assignments(soldier_id);
CREATE INDEX idx_leave_assignments_date ON leave_assignments(date);

-- Task assignments
CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  soldier_id TEXT REFERENCES soldiers(id) ON DELETE CASCADE,
  assigned_unit_id TEXT REFERENCES units(id),
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_assignments_soldier ON task_assignments(soldier_id);
CREATE INDEX idx_task_assignments_date ON task_assignments(date);
CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);

-- Config table
CREATE TABLE config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  schedule_start_date DATE,
  schedule_end_date DATE,
  leave_ratio_days_in_base INT DEFAULT 10,
  leave_ratio_days_home INT DEFAULT 4,
  leave_base_exit_hour INT DEFAULT 16,
  leave_base_return_hour INT DEFAULT 8,
  min_base_presence_by_role JSONB,
  weekend_days JSONB DEFAULT '["Friday", "Saturday"]',
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (for authentication & authorization)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'commander'
  unit_id TEXT REFERENCES units(id),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE soldiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Soldiers: Commanders see only their unit, admins see all
CREATE POLICY "Users can view soldiers based on role"
ON soldiers FOR SELECT
USING (
  unit_id IN (
    SELECT unit_id FROM users
    WHERE id = auth.uid() AND role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Users can modify soldiers based on role"
ON soldiers FOR ALL
USING (
  unit_id IN (
    SELECT unit_id FROM users
    WHERE id = auth.uid() AND role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Tasks: Admins and super admins only
CREATE POLICY "Only admins can manage tasks"
ON tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "All authenticated users can view tasks"
ON tasks FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Leave requests: Commanders see their unit, admins see all
CREATE POLICY "Users can view leave requests based on role"
ON leave_requests FOR SELECT
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Users can modify leave requests based on role"
ON leave_requests FOR ALL
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Leave assignments: Commanders see their unit, admins see all
CREATE POLICY "Users can view leave assignments based on role"
ON leave_assignments FOR SELECT
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Users can modify leave assignments based on role"
ON leave_assignments FOR ALL
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Task assignments: Commanders see their unit, admins see all
CREATE POLICY "Users can view task assignments based on role"
ON task_assignments FOR SELECT
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Users can modify task assignments based on role"
ON task_assignments FOR ALL
USING (
  soldier_id IN (
    SELECT s.id FROM soldiers s
    INNER JOIN users u ON u.unit_id = s.unit_id
    WHERE u.id = auth.uid() AND u.role = 'commander'
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Config: Admins and super admins only
CREATE POLICY "Only admins can manage config"
ON config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "All authenticated users can view config"
ON config FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Units: Admins and super admins only
CREATE POLICY "Only admins can manage units"
ON units FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "All authenticated users can view units"
ON units FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Roles: Admins and super admins only
CREATE POLICY "Only admins can manage roles"
ON roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "All authenticated users can view roles"
ON roles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users: Super admins only
CREATE POLICY "Only super admins can view users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Only super admins can manage users"
ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
```

6. After pasting, click the **"Run"** button (bottom right of the editor)
7. You should see: **"Success. No rows returned"** message
   - This is correct - the script creates tables, it doesn't return data
8. If you see any errors:
   - Check that you pasted the entire SQL (scroll to make sure nothing was cut off)
   - Make sure you're running it in a new query (not an old one with other SQL)
   - Take a screenshot of the error and we can debug it

### Step 6: Verify Tables Were Created

1. On the left sidebar, click **"Table Editor"** (icon looks like a grid/table)
2. You should now see a list of tables on the left:
   - units
   - soldiers
   - tasks
   - leave_requests
   - leave_assignments
   - task_assignments
   - config
   - roles
   - users

3. Click on any table (e.g., "soldiers") to view its structure
4. You should see all the columns defined (id, unit_id, first_name, etc.)

**If you see all 9 tables listed, you're done with setup! ✅**

---

## Troubleshooting

### "Error: relation already exists"
- The tables already exist from a previous attempt
- Solution: Either use the existing tables, or drop them first with:
  ```sql
  DROP TABLE IF EXISTS task_assignments CASCADE;
  DROP TABLE IF EXISTS leave_assignments CASCADE;
  DROP TABLE IF EXISTS leave_requests CASCADE;
  DROP TABLE IF EXISTS soldiers CASCADE;
  DROP TABLE IF EXISTS tasks CASCADE;
  DROP TABLE IF EXISTS config CASCADE;
  DROP TABLE IF EXISTS roles CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  DROP TABLE IF EXISTS units CASCADE;
  ```
- Then run the schema creation SQL again

### "Error: permission denied"
- Make sure you're logged into the correct Supabase project
- Refresh the page and try again

### Can't find SQL Editor
- Look for the `</>` icon on the left sidebar
- Or try the top menu: Project → SQL Editor

### Project taking too long to provision
- Normal provisioning time: 2-3 minutes
- If it takes more than 5 minutes, refresh the page
- If still stuck, try creating a new project

---

## What's Next?

After completing this setup:

1. Your Supabase database is ready
2. Your `.env.local` file has the credentials
3. All database tables are created with proper security policies

**You can now proceed with the code migration** - the implementation agent will:
- Install dependencies
- Create Supabase client code
- Migrate all repositories from Google Sheets to Supabase
- Build UI components for data management

---

## Important Notes

- ✅ Keep your database password safe (you saved it in Step 2, right?)
- ✅ Never commit `.env.local` to git (it contains secret keys)
- ✅ The free tier is sufficient for 1-5 units, 100+ soldiers
- ✅ You can upgrade to Pro ($25/mo) later if you need more capacity
- ✅ Your data is backed up automatically by Supabase

---

## Need Help?

If you get stuck:
1. Take a screenshot of the error or issue
2. Note which step you're on
3. Share with the agent for troubleshooting
