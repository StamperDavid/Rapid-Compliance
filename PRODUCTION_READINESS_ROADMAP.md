# Production Readiness Roadmap - 6 Week Plan

> ⚠️ **NOTICE:** This document is outdated (written Dec 23 before build fixes).  
> **See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current status.**  
> Many issues listed here have been resolved (Dec 25, 2025).

**Start Date:** December 23, 2025  
**Target Launch:** February 3, 2026  
**Goal:** Production-ready platform for 100+ users

---

## Week 1: Pagination Fixes (Days 1-4)

### Day 1: Core CRM Pages ✅
**Files to Fix:**
- [ ] `src/app/workspace/[orgId]/leads/page.tsx`
- [ ] `src/app/workspace/[orgId]/deals/page.tsx`
- [ ] `src/app/workspace/[orgId]/contacts/page.tsx`

**Changes:**
1. Replace `FirestoreService.getAll()` with `getAllPaginated()`
2. Add pagination state (currentPage, hasMore, lastDoc)
3. Add "Load More" button or infinite scroll
4. Add loading states

**Acceptance Criteria:**
- Can load 1000+ leads without freezing
- Pagination UI works smoothly
- No performance degradation

---

### Day 2: Automation Pages
**Files to Fix:**
- [ ] `src/app/workspace/[orgId]/workflows/page.tsx`
- [ ] `src/app/workspace/[orgId]/products/page.tsx`
- [ ] `src/app/workspace/[orgId]/email/campaigns/page.tsx`

---

### Day 3: Secondary Features
**Files to Fix:**
- [ ] `src/app/workspace/[orgId]/nurture/page.tsx`
- [ ] `src/app/workspace/[orgId]/calls/page.tsx`
- [ ] `src/app/workspace/[orgId]/ab-tests/page.tsx`
- [ ] `src/app/workspace/[orgId]/ai/fine-tuning/page.tsx`

---

### Day 4: Remaining Pages + Testing
**Files to Fix:**
- [ ] `src/app/workspace/[orgId]/ai/datasets/page.tsx`
- [ ] `src/app/workspace/[orgId]/settings/users/page.tsx`
- [ ] `src/app/workspace/[orgId]/integrations/page.tsx`
- [ ] `src/app/workspace/[orgId]/settings/ai-agents/training/page.tsx`

**Testing:**
- [ ] Create test script to seed 2000 records per entity
- [ ] Verify all pages load smoothly
- [ ] Test pagination edge cases

---

## Week 2: Service Layer (Days 5-9)

### Day 5: Lead & Deal Services
**Create:**
- `src/lib/crm/lead-service.ts`
- `src/lib/crm/deal-service.ts`

**Methods:**
```typescript
interface LeadService {
  getLeads(orgId, filters?, pagination?): Promise<PaginatedResult<Lead>>
  getLead(orgId, leadId): Promise<Lead>
  createLead(orgId, data): Promise<Lead>
  updateLead(orgId, leadId, updates): Promise<Lead>
  deleteLead(orgId, leadId): Promise<void>
  enrichLead(orgId, leadId): Promise<Lead>
}
```

---

### Day 6: Contact & Product Services
**Create:**
- `src/lib/crm/contact-service.ts`
- `src/lib/ecommerce/product-service.ts`

---

### Day 7: Workflow & Campaign Services
**Create:**
- `src/lib/workflows/workflow-service.ts`
- `src/lib/email/campaign-service.ts`
- `src/lib/outbound/nurture-service.ts`

---

### Day 8: Refactor Pages
**Update all workspace pages to use services instead of direct Firestore calls**

Before:
```typescript
const leads = await FirestoreService.getAll(`organizations/${orgId}/...`, []);
```

After:
```typescript
const { data: leads, hasMore } = await LeadService.getLeads(orgId, { status: filter }, { page: 1 });
```

---

### Day 9: Service Tests
**Create test files:**
- `tests/services/lead-service.test.ts`
- `tests/services/deal-service.test.ts`
- etc.

**Test coverage:**
- CRUD operations
- Pagination
- Filtering
- Error handling

---

## Week 3: Logging Migration (Days 10-13)

### Day 10: Service Layer Logging
**Target:** `src/lib/*` directories

**Pattern:**
```typescript
// Before
console.log('Creating lead:', leadData);

// After
logger.info('Lead created', {
  leadId: lead.id,
  orgId: lead.organizationId,
  source: lead.source,
  enriched: !!lead.enrichmentData
});
```

**Priority files:**
- `src/lib/agent/instance-manager.ts` (27 console.logs)
- `src/lib/enrichment/enrichment-service.ts` (16 console.logs)
- `src/lib/integrations/gmail-sync-service.ts` (16 console.logs)

---

### Day 11: API Route Logging
**Target:** `src/app/api/*`

**Add structured logging with context:**
```typescript
logger.info('API request', {
  route: '/api/leads/enrich',
  method: 'POST',
  orgId,
  leadId,
  userId: user.uid
});
```

---

### Day 12: UI Component Logging
**Target:** `src/app/workspace/*` and `src/components/*`

**Replace with user-facing errors:**
```typescript
// Before
catch (error) {
  console.error('Error loading leads:', error);
}

// After
catch (error) {
  logger.error('Failed to load leads', error, { orgId });
  setError('Unable to load leads. Please try again.');
}
```

---

### Day 13: Verification & Cleanup
- [ ] Grep for remaining console.log statements
- [ ] Verify all critical paths have logging
- [ ] Test log aggregation in Sentry
- [ ] Document logging standards

---

## Week 4: Comprehensive Testing (Days 14-18)

### Day 14: E-Commerce Testing
**Setup:**
- [ ] Configure Stripe test mode
- [ ] Create test products in dev environment
- [ ] Setup webhook forwarding (ngrok or Stripe CLI)

**Test Cases:**
1. Add product to cart
2. Apply discount code
3. Calculate tax & shipping
4. Process payment with test card
5. Verify order in Firestore
6. Verify Stripe payment intent
7. Test webhook handling
8. Test refund flow
9. Test failed payment
10. Test inventory updates

---

### Day 15-16: Service Integration Tests
**Create:**
- `tests/integration/lead-service.integration.test.ts`
- `tests/integration/workflow-service.integration.test.ts`
- etc.

**Test with Firebase Emulators:**
```bash
npm run test:integration
```

**Coverage Target:** 70%+ for service layer

---

### Day 17: Load Testing
**Create:**
- `tests/load/pagination-stress.test.ts`

**Scenarios:**
1. Load 10,000 leads - verify pagination works
2. Load 5,000 deals - verify no timeout
3. Load 1,000 workflows - verify performance
4. Concurrent users (10 users × 100 requests)

**Tools:** Artillery or k6

---

### Day 18: Bug Fixes
- [ ] Fix issues found in e-commerce testing
- [ ] Fix issues found in load testing
- [ ] Fix edge cases in pagination
- [ ] Document known issues

---

## Week 5: Full Monitoring (Days 19-23)

### Day 19-20: Observability Stack
**Setup:**
- [ ] Configure Sentry for error tracking
- [ ] Setup log aggregation
- [ ] Add performance monitoring
- [ ] Configure alerting rules

**Metrics to Track:**
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- External API latency (Stripe, Twilio, etc.)

---

### Day 21: Business Metrics Dashboard
**Create Firestore queries for:**
- Active organizations
- Total users
- Monthly recurring revenue (MRR)
- API usage by organization
- Storage usage
- Email/SMS quotas

**Display in:**
- Admin dashboard
- Email alerts (daily digest)

---

### Day 22: Alerting
**Configure alerts for:**
- Error rate > 5%
- Response time > 3s (p95)
- Database connection failures
- External API failures (Stripe, Twilio)
- Quota violations (approaching limits)

**Channels:**
- Sentry alerts
- Email notifications
- Slack webhooks (if configured)

---

### Day 23: Documentation
**Create:**
- `docs/MONITORING_GUIDE.md`
- `docs/RUNBOOK.md`
- `docs/INCIDENT_RESPONSE.md`

---

## Week 6: Polish & Final Validation (Days 24-28)

### Day 24-25: Code Review & Cleanup
- [ ] Review all changed files
- [ ] Run linter and fix issues
- [ ] Update TypeScript types
- [ ] Remove dead code
- [ ] Update dependencies

---

### Day 26: Documentation
- [ ] Update API documentation
- [ ] Update user guides
- [ ] Create deployment guide
- [ ] Create troubleshooting guide

---

### Day 27: Final QA
- [ ] Full regression test
- [ ] Cross-browser testing
- [ ] Mobile responsiveness check
- [ ] Accessibility audit
- [ ] Performance audit

---

### Day 28: Go/No-Go Decision
**Checklist:**
- [ ] All 15 pagination issues fixed
- [ ] Service layer complete
- [ ] < 10 console.log statements remaining
- [ ] 70%+ test coverage
- [ ] Monitoring operational
- [ ] E-commerce validated
- [ ] No critical bugs
- [ ] Performance meets targets (< 2s page loads)

**If GO:** Deploy to production
**If NO-GO:** Document blockers and extend timeline

---

## Success Metrics

**Week 1:**
- ✅ 15 pages paginated
- ✅ Can handle 10,000+ records per entity

**Week 2:**
- ✅ 7+ service classes created
- ✅ UI decoupled from Firestore

**Week 3:**
- ✅ < 10 console.log statements
- ✅ Structured logging everywhere

**Week 4:**
- ✅ E-commerce tested end-to-end
- ✅ 70%+ test coverage
- ✅ Passed load tests

**Week 5:**
- ✅ Monitoring dashboard live
- ✅ Alerts configured
- ✅ Runbooks documented

**Week 6:**
- ✅ Production-ready
- ✅ Can handle 100+ organizations
- ✅ Can scale to 1000+ users

---

## Daily Standup Format

**What did I complete yesterday?**
**What am I working on today?**
**What blockers do I have?**

Update `PROJECT_STATUS.md` daily with progress.

---

**Let's build this right.** 🚀

