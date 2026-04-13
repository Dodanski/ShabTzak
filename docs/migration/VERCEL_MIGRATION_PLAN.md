# GitHub Pages to Vercel Migration Plan

## Executive Summary

This plan provides a zero-downtime migration strategy from GitHub Pages to Vercel for continuous deployment. The migration includes automatic Git-based deployments, environment variable management, SPA routing configuration, and comprehensive rollback procedures.

**Timeline:** 7-8 days
**Downtime:** Zero (parallel deployment strategy)
**Cost:** Free tier (sufficient for current traffic)

---

## Current State

**Current Deployment:**
- Platform: GitHub Pages
- Deploy command: `npm run build && gh-pages -d dist`
- Build tool: Vite 5
- Base path: `/ShabTzak/` (subdirectory)
- CI/CD: GitHub Actions (test → build → deploy)
- Environment variables: Stored in `.env.local` (not in CI)

**Environment Variables:**
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_GOOGLE_API_KEY` - Google API key
- `VITE_SPREADSHEET_ID` - Google Sheets ID
- `VITE_ADMIN_EMAIL` - Admin email (optional)

---

## Phase 1: Pre-Migration Setup (Days 1-2)

### Task 1.1: Create vercel.json

**File:** `vercel.json` (project root)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/:path((?!.*))*",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/data/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=3600"
        }
      ]
    },
    {
      "source": "/assets/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/ShabTzak/:path(.*)",
      "destination": "/:path*",
      "permanent": true
    }
  ]
}
```

**Purpose:**
- `rewrites`: SPA routing (all non-file paths → index.html)
- `headers`: Cache control for assets and JSON data
- `redirects`: Redirect old GitHub Pages URLs to Vercel

### Task 1.2: Update vite.config.ts

**Change base path from subdirectory to root:**

```typescript
// Before
export default defineConfig({
  plugins: [react()],
  base: '/ShabTzak/',
})

// After
export default defineConfig({
  plugins: [react()],
  base: '/',
})
```

**Reason:** Vercel serves at root domain, no subdirectory needed.

### Task 1.3: Test Build Locally

```bash
npm run build
npm run preview
# Verify app loads at http://localhost:4173 without /ShabTzak/ prefix
```

---

## Phase 2: Vercel Project Setup (Day 2-3)

### Task 2.1: Create Vercel Project

**Via Vercel Dashboard (recommended):**
1. Go to https://vercel.com/new
2. Import from Git → Select GitHub repository
3. Configure:
   - **Project Name:** shabtzak
   - **Framework:** Vite
   - **Build Command:** npm run build
   - **Output Directory:** dist
   - **Install Command:** npm ci

### Task 2.2: Configure Environment Variables

**In Vercel Dashboard → Project Settings → Environment Variables:**

Add for all environments (Production, Preview, Development):

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_GOOGLE_CLIENT_ID` | [from .env.local] | OAuth client ID |
| `VITE_GOOGLE_API_KEY` | [from .env.local] | Google API key |
| `VITE_SPREADSHEET_ID` | [from .env.local] | Sheets ID |
| `VITE_ADMIN_EMAIL` | [from .env.local] | Admin email (optional) |

⚠️ **Important:** All VITE_* variables are build-time, must be set before build.

### Task 2.3: Test Initial Deployment

1. Trigger first deployment manually from Vercel dashboard
2. Verify preview deployment URL works (e.g., `https://shabtzak-abc123.vercel.app`)
3. Test all routes, authentication, data loading
4. Confirm no console errors

---

## Phase 3: CI/CD Integration (Day 3-4)

### Task 3.1: Add GitHub Secrets

**In GitHub Repository → Settings → Secrets:**

| Secret | How to Get | Purpose |
|--------|-----------|---------|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens | Deploy from CI |
| `VERCEL_PROJECT_ID` | Vercel Project Settings → General | Project identifier |
| `VITE_GOOGLE_CLIENT_ID` | From .env.local | Build-time env var |
| `VITE_GOOGLE_API_KEY` | From .env.local | Build-time env var |
| `VITE_SPREADSHEET_ID` | From .env.local | Build-time env var |
| `VITE_ADMIN_EMAIL` | From .env.local | Build-time env var |

### Task 3.2: Update GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

permissions:
  contents: read

jobs:
  test-and-build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx vitest run

      - name: Build
        run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GOOGLE_API_KEY: ${{ secrets.VITE_GOOGLE_API_KEY }}
          VITE_SPREADSHEET_ID: ${{ secrets.VITE_SPREADSHEET_ID }}
          VITE_ADMIN_EMAIL: ${{ secrets.VITE_ADMIN_EMAIL }}

      - name: Deploy to Vercel
        if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')
        uses: vercel/action@v5
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          projectId: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Changes:**
- Removed GitHub Pages deployment
- Added Vercel deployment (production only on main/master push)
- Tests still run on all PRs for validation

---

## Phase 4: Zero-Downtime Migration (Days 4-7)

### Week 1: Parallel Deployment

1. **GitHub Pages remains live** as primary
2. **Vercel preview deployments** for testing
3. Test all functionality on Vercel URL
4. Validate with small group of users

### Week 2: Gradual Switch

1. Update DNS/links to point to Vercel (if custom domain)
2. Monitor Vercel deployment for 24-48 hours
3. GitHub Pages still available as fallback

### Week 3: Deprecation

1. After validation, turn off GitHub Pages automatic deployment
2. Keep repository accessible for rollback (30 days)

### Validation Checklist

```
Pre-migration validation (on Vercel preview):
✓ Home page loads without GitHub Pages redirect
✓ All SPA routes accessible (#dashboard, #soldiers, #tasks, etc.)
✓ Google OAuth login works
✓ Data loads from /data/database.json
✓ Public assets accessible
✓ JSON database export/import works
✓ Responsive design intact on mobile
✓ No 404 errors on routes
✓ Console has no errors
✓ Build completes successfully on each push
✓ Preview deployments work for PRs
```

---

## Phase 5: Custom Domain (Optional)

If using a custom domain:

### Task 5.1: Add Domain in Vercel

1. Vercel Dashboard → Project Settings → Domains
2. Enter custom domain (e.g., `shabtzak.yourcompany.com`)
3. Vercel provides DNS records

### Task 5.2: Update DNS

**With your DNS provider:**

```
Type: CNAME
Name: subdomain (or @ for root)
Value: cname.vercel-dns.com
TTL: 3600
```

**Or use Vercel's managed DNS for easier setup.**

### Task 5.3: Create CNAME File (Optional)

**File:** `public/CNAME`

```
shabtzak.yourcompany.com
```

This ensures Vercel maintains the domain on redeployment.

---

## Deployment Workflow

### Automatic Deployments

- **Production:** Push to main/master → Vercel deploys automatically
- **Preview:** Create PR → Vercel creates preview with unique URL
- **Development:** Local dev server via `npm run dev`

### Commands

```bash
# Local development
npm run dev

# Test production build
npm run build
npm run preview

# Deploy via git push (automatic)
git push origin main

# Manual deployment (if needed)
vercel --prod
```

---

## Rollback Strategy

### Option 1: Revert Commit (Fastest)

```bash
git revert HEAD
git push origin main
# Vercel automatically deploys previous version
```

### Option 2: Redeploy from Vercel Dashboard

1. Go to Deployments tab
2. Find previous successful deployment
3. Click "Redeploy" → pushes to production immediately

### Option 3: Switch Back to GitHub Pages

1. Revert `vite.config.ts` to `base: '/ShabTzak/'`
2. Re-enable GitHub Pages deploy in CI workflow
3. Push to trigger GitHub Pages deployment
4. Update DNS to point back to GitHub Pages

**Recommended:** Use Option 2 for immediate rollback without code changes.

---

## Cost Analysis

### GitHub Pages
- **Cost:** Free
- **Bandwidth:** Unlimited
- **Storage:** Unlimited

### Vercel Free Tier
- **Cost:** Free
- **Bandwidth:** 100 GB/month
- **Deployments:** Unlimited
- **Preview deployments:** Unlimited

**Estimated Usage for ShabTzak:**
- Internal military scheduling (low external traffic)
- Bandwidth: < 1 GB/month
- **Recommendation:** Vercel Free Tier is sufficient

### Vercel Pro ($20/month)
- Only needed if exceeding 100 GB bandwidth
- Adds advanced analytics and priority support

---

## Monitoring & Validation

### Post-Migration Checklist

```
Production Verification:
✓ Site loads without errors
✓ Login with Google OAuth works
✓ Database JSON loads correctly
✓ All pages accessible
✓ No console errors/warnings
✓ Scheduling algorithm works
✓ Leave requests process correctly
✓ Export functionality works
✓ Mobile responsiveness intact
✓ Performance is acceptable
✓ Backups accessible (via git)
```

### Vercel Built-in Monitoring

- Deployment logs (real-time)
- Error tracking
- Performance analytics (with Pro)
- Function logs (for serverless functions)

**Recommended:**
- Set up Slack notifications for deployment status
- Configure alerts for failed deployments
- Monitor response times and error rates

---

## Documentation Updates

### Update CLAUDE.md

**Section:** Deployment

```markdown
## Deployment

The application is deployed to Vercel with automatic deployments from Git.

**Production URL:** https://shabtzak.vercel.app

**Process:**
1. Push code to main/master branch
2. GitHub Actions runs CI (tests, build)
3. Vercel automatically deploys to production
4. Preview deployments created for all PRs

**Environment Variables:**
Stored in Vercel project settings (all VITE_* variables required at build time)

**Rollback:**
1. Via Vercel Dashboard: Deployments → Redeploy previous version
2. Via git revert: `git revert HEAD && git push origin main`
```

### Update README.md

Add deployment section documenting Vercel workflow, environment variables, and commands.

---

## Risk Mitigation

| Issue | Solution |
|-------|----------|
| Build fails on Vercel | Verify all VITE_* env vars in dashboard |
| 404 errors on routes | Check vercel.json rewrite rules |
| Data not loading | Verify vite.config.ts base = '/' |
| Old URLs not redirecting | Add redirects in vercel.json |
| Auth not working | Update Google OAuth redirect URIs with Vercel URL |
| Slower performance | Check Vercel region, enable caching |

---

## Summary: Files to Modify

### Create/Modify:
1. **Create:** `vercel.json` - Vercel deployment configuration
2. **Modify:** `vite.config.ts` - Change base from `/ShabTzak/` to `/`
3. **Modify:** `.github/workflows/ci.yml` - Add Vercel deployment step
4. **Update:** `CLAUDE.md` - Document new deployment process
5. **Update:** `README.md` - Add deployment section
6. **Optional:** `public/CNAME` - For custom domain

### GitHub Configuration:
- Add secrets: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and all `VITE_*` variables

### Vercel Dashboard:
- Create project and link to GitHub
- Configure environment variables
- Enable automatic deployments

---

## Critical Success Factors

✅ Zero downtime (parallel deployment)
✅ All environment variables configured correctly
✅ SPA routing works (vercel.json rewrites)
✅ Automatic deployments from Git
✅ Preview deployments for PRs
✅ Fast rollback capability
✅ Free tier sufficient for traffic

---

**Timeline:** 7-8 days
**Effort:** ~2 days hands-on configuration + 5-6 days validation
**Risk:** Low (can rollback to GitHub Pages anytime)
**Cost:** $0/month (Vercel Free Tier)
