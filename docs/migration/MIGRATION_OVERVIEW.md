# Migration Overview & Roadmap

**Project:** ShabTzak Full
**Goal:** Modernize infrastructure while maintaining 100% feature parity
**Status:** Planning complete, ready for execution

---

## Current State

**Architecture:**
- Frontend: React 18 + TypeScript + Vite
- Backend: Google Sheets API v4 (JSON migration in progress)
- Deployment: GitHub Pages (automatic via gh-pages)
- Auth: Google OAuth (being phased out)
- Cost: $0/month

**Performance:**
- Schedule generation: ~105 seconds
- Read operations: 1-2 seconds
- Rate limits: 100 requests/100s per user
- Concurrent users: Limited by shared rate limits

**Pain Points:**
- API rate limiting (429 errors)
- Slow schedule generation (>1 minute)
- No real-time collaboration
- Manual coordination required
- Limited scalability

---

## Target State

**Architecture:**
- Frontend: React 18 + TypeScript + Vite (unchanged)
- Backend: Supabase PostgreSQL (21 tables with RLS)
- Deployment: Vercel (automatic deployments from Git)
- Auth: Supabase Auth (email/password)
- Cost: $0/month (free tiers)

**Performance:**
- Schedule generation: 2-5 seconds (20-50x faster)
- Read operations: <150ms (10-20x faster)
- No rate limits: Direct database access
- Concurrent users: Unlimited with real-time sync

**Benefits:**
- Real-time collaboration
- Instant schedule generation
- No API limitations
- Multi-tenant isolation (RLS)
- Transactional integrity (ACID)
- Audit logging built-in

---

## Migration Path

### Two Parallel Migrations

We have two independent migrations that can be executed in any order:

1. **Deployment Migration:** GitHub Pages → Vercel (7-8 days)
2. **Database Migration:** Google Sheets → Supabase (8-10 days)

**Recommended Order:**
1. Execute Vercel migration first (simpler, lower risk)
2. Then execute Supabase migration (more complex, benefits from Vercel infrastructure)

---

## Migration 1: Vercel Deployment

**Timeline:** 7-8 days
**Risk:** Low (zero downtime)
**Cost Impact:** $0 (Free Tier sufficient)

### Phases

**Phase 1: Configuration (Days 1-2)**
- Create vercel.json
- Update vite.config.ts (base path)
- Test build locally

**Phase 2: Vercel Setup (Days 2-3)**
- Create Vercel project
- Configure environment variables
- Test initial deployment

**Phase 3: CI/CD Integration (Days 3-4)**
- Add GitHub secrets
- Update GitHub Actions workflow
- Test automatic deployments

**Phase 4: Zero-Downtime Switch (Days 4-7)**
- Week 1: Parallel deployment (GitHub Pages + Vercel)
- Week 2: Gradual traffic switch
- Week 3: Deprecate GitHub Pages

**Phase 5: Custom Domain (Optional)**
- Add domain to Vercel
- Update DNS records

### Benefits

✅ **Performance:** Global CDN, faster load times
✅ **DevOps:** Automatic deployments on push
✅ **Preview:** PR deployments for testing
✅ **Rollback:** Instant via dashboard
✅ **Monitoring:** Built-in analytics

### Rollback

- **Option 1:** Revert commit (< 5 minutes)
- **Option 2:** Redeploy previous version via dashboard
- **Option 3:** Switch DNS back to GitHub Pages

**See:** `docs/migration/VERCEL_MIGRATION_PLAN.md`

---

## Migration 2: Supabase Database

**Timeline:** 8-10 days
**Risk:** Medium (mitigated with rollback strategy)
**Cost Impact:** $0 (Free Tier sufficient)

### Phases

**Phase 1: Complete JSON Migration (4 days)**
- Prerequisite: Clean foundation
- Implement JsonRepository
- Remove Google Sheets code
- Export data to JSON

**Phase 2: Supabase Infrastructure (1 day)**
- Create project
- Define schema (21 tables)
- Configure RLS policies

**Phase 3: Repository Implementation (2 days)**
- Create Supabase client
- Implement all repositories
- Type-safe CRUD operations

**Phase 4: Authentication (1 day)**
- Supabase Auth service
- Email/password flow
- Replace AuthContext

**Phase 5: Data Migration (0.5 days)**
- Import script
- JSON → Supabase transfer
- Data validation

**Phase 6: Service Refactoring (1.5 days)**
- Update DataService
- Update ScheduleService
- Real-time subscriptions

**Phase 7-9: UI, Testing, Deploy (3.5 days)**
- Admin panel updates
- Full test suite
- Production deployment

### Benefits

✅ **Performance:** 20-50x faster operations
✅ **Real-time:** Multi-user collaboration
✅ **Integrity:** ACID transactions
✅ **Security:** Row Level Security (RLS)
✅ **Audit:** Built-in logging
✅ **Scalability:** No rate limits

### Rollback

**Dual-Write Mode:**
- Phase A: Write to both JSON and Supabase, read from Supabase
- Phase B: Read+write only from Supabase
- Rollback: Switch reads back to JSON (<5 minutes)

**Feature Flags:**
```typescript
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true'
```

**See:** `docs/migration/SUPABASE_MIGRATION_PLAN.md`

---

## Reference Implementation

**Shabtzak_light** provides a complete production-ready reference:
- 21 Supabase tables with RLS
- Next.js 16 App Router
- Vercel deployment
- Hebrew RTL interface
- Fairness algorithm implementation

**Key Patterns:**
- Client/Server Supabase initialization
- Authentication middleware
- Query patterns with nested selects
- Real-time subscriptions (polling initially)
- Multi-tenant isolation via RLS

**See:** `docs/reference/SHABTZAK_LIGHT_ANALYSIS.md`

---

## Timeline Comparison

### Conservative (Sequential)

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| Vercel Migration | 7-8 days | 7-8 days |
| Supabase Migration | 8-10 days | 15-18 days |
| **Total** | **15-18 days** | **3-4 weeks** |

### Optimized (Parallel)

| Phase | Duration | Notes |
|-------|----------|-------|
| Vercel Migration | 7-8 days | Can start immediately |
| Supabase Phase 1 (JSON) | 4 days | Can overlap with Vercel |
| Supabase Phase 2-9 | 4-6 days | After Vercel complete |
| **Total** | **11-14 days** | **~2 weeks** |

**Recommended:** Conservative approach for safety (3-4 weeks)

---

## Risk Assessment

### Low Risk (Green)

✅ **Vercel Migration**
- Zero downtime strategy
- Instant rollback capability
- No code changes required (config only)
- Free tier sufficient

✅ **Code Fixes**
- All backward compatible
- Comprehensive testing
- No regressions

### Medium Risk (Yellow)

⚠️ **Supabase Migration**
- Complex multi-phase process
- Data migration required
- Authentication changes

**Mitigations:**
- Dual-write mode for safety
- Feature flags for instant rollback
- Extensive testing phase
- Data validation scripts
- Rollback in <5 minutes

---

## Cost Analysis

### Current Costs

- GitHub Pages: $0/month
- Google Sheets API: $0/month (within free tier)
- **Total:** $0/month

### Future Costs

**Vercel:**
- Free Tier: 100 GB bandwidth/month
- Estimated Usage: <1 GB/month
- **Cost:** $0/month

**Supabase:**
- Free Tier: 500 MB storage, unlimited API requests
- Estimated Usage: ~50 MB database
- **Cost:** $0/month

**Total Future Cost:** $0/month

**ROI:**
- Same cost ($0)
- 20-50x performance improvement
- Real-time collaboration
- Better reliability (99.9% uptime)

---

## Success Criteria

### Functional Requirements

- ✅ 100% feature parity maintained
- ✅ All existing tests pass
- ✅ No data loss during migration
- ✅ Authentication works correctly
- ✅ Scheduling algorithms unchanged

### Performance Requirements

- ✅ Schedule generation: <5s (was ~105s)
- ✅ Read operations: <150ms (was 1-2s)
- ✅ Bulk operations: <500ms (was 30-40s)
- ✅ App cold start: <2s (was 5-8s)

### Operational Requirements

- ✅ Zero downtime during migration
- ✅ Rollback capability (<5 minutes)
- ✅ Monitoring and alerts configured
- ✅ Documentation complete
- ✅ Team trained on new system

---

## Decision Matrix

### Should We Migrate?

| Factor | Current | After Migration | Impact |
|--------|---------|-----------------|--------|
| Performance | Slow (105s) | Fast (2-5s) | +20-50x |
| Cost | $0/month | $0/month | Neutral |
| Reliability | Medium (rate limits) | High (99.9% SLA) | ++High |
| Real-time | None | Full | ++High |
| Complexity | Low (Google Sheets) | Medium (Supabase) | -Medium |
| Risk | Low (stable) | Medium (migration) | -Medium |

**Recommendation:** Yes, migrate. Benefits outweigh risks, especially with rollback strategy.

---

## Execution Checklist

### Before Starting

- [ ] Review all migration plans
- [ ] Review code fixes
- [ ] Backup current Google Sheets data
- [ ] Document current environment
- [ ] Set aside dedicated time (3-4 weeks)

### Vercel Migration

- [ ] Create vercel.json
- [ ] Update vite.config.ts
- [ ] Test build locally
- [ ] Create Vercel project
- [ ] Configure environment variables
- [ ] Update GitHub Actions
- [ ] Test automatic deployments
- [ ] Parallel deployment period
- [ ] Switch traffic to Vercel
- [ ] Deprecate GitHub Pages

### Supabase Migration

- [ ] Complete JSON migration (Phase 1)
- [ ] Create Supabase project
- [ ] Run database migrations
- [ ] Implement repositories
- [ ] Migrate authentication
- [ ] Import data from JSON
- [ ] Update service layer
- [ ] Implement real-time subscriptions
- [ ] Full test suite
- [ ] Deploy to production
- [ ] Monitor for 48 hours

---

## Support & Resources

### Documentation

- `AUTO_MODE_DELIVERABLES.md` - Complete summary of all work
- `docs/migration/VERCEL_MIGRATION_PLAN.md` - Vercel deployment strategy
- `docs/migration/SUPABASE_MIGRATION_PLAN.md` - Database migration strategy
- `docs/reference/SHABTZAK_LIGHT_ANALYSIS.md` - Reference implementation
- `CODE_REVIEW_ALGORITHMS.md` - Algorithm bug fixes
- `REVIEW_INDEX.md` - Navigation guide

### External Resources

- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Shabtzak_light Repository: `/home/e173165/testDir/ShabTzak/Shabtzak_light`

---

## Next Steps

### Immediate (This Week)

1. ✅ Review all deliverables
2. ✅ Test code fixes (`npm test`)
3. ✅ Decide on migration timeline
4. ⏳ Schedule migration window

### Short-term (Next 2 Weeks)

5. ⏳ Execute Vercel migration (7-8 days)
6. ⏳ Begin Supabase Phase 1 (JSON migration)

### Medium-term (Next Month)

7. ⏳ Complete Supabase migration (8-10 days)
8. ⏳ Monitor performance and stability
9. ⏳ Address documented issues (leave debt tracking, etc.)

---

## Conclusion

Both migrations are **ready for execution** with:
- ✅ Complete implementation plans
- ✅ Rollback strategies documented
- ✅ Cost analysis complete ($0/month maintained)
- ✅ Performance targets defined (20-50x improvement)
- ✅ Risk mitigation strategies in place

**Recommended Timeline:** 3-4 weeks conservative, 2 weeks optimized

**Key Decision Point:** Choose between conservative (safer) or optimized (faster) timeline.

---

**Last Updated:** 2026-04-12
**Status:** Planning complete, ready for execution
**Next Review:** After Vercel migration (or 2 weeks)
