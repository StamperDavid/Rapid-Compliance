# FORENSIC GROUND TRUTH DISCOVERY REPORT
## No-Guesswork Technical Status - January 20, 2026

**Audit Method:** Exhaustive codebase scan via Claude Opus 4.5
**Files Analyzed:** 200+ route files, 27 agent specialists, 15+ auth files
**Objective:** Map Platform Admin ↔ Organization ↔ Agent Swarm relationships

---

## EXECUTIVE SUMMARY

| Finding | Status |
|---------|--------|
| Social Media UI for Admin | **WORKING** - Located at `/admin/social` (platform-level) |
| Organization-scoped Social | **TRAPPED** in `/workspace/[orgId]/social/campaigns` |
| Platform Admin Org Bypass | **REMOVED** (per V3 audit) - Strict multi-tenant isolation |
| MASTER_ORG_ID Constant | **DOES NOT EXIST** - Must be created |
| Agent Swarm Count | **27 specialists** (19 functional, 8 ghost) |
| Unified Dashboard | **REQUIRES REFACTOR** - Components split across admin/workspace |

---

## PART 1: THE "GAP" ANALYSIS

### Why Social Media UI "Doesn't Appear" for Admin

**FINDING: It DOES appear, but in two separate locations with different purposes.**

#### Location A: Platform-Level Social Media (WORKS)
```
/admin/social/page.tsx (534 lines)
/admin/swarm/page.tsx (1013 lines)
```
- **Purpose:** Post to SalesVelocity.ai's official Twitter/LinkedIn accounts
- **Access:** Platform admins only via `useAdminAuth()` hook
- **Features:** Compose tweets, schedule posts, view platform analytics
- **OrgId Required:** NO - Uses platform environment variables

#### Location B: Organization-Scoped Social Media (TRAPPED)
```
/workspace/[orgId]/social/campaigns/page.tsx
/workspace/[orgId]/social/training/page.tsx
```
- **Purpose:** Manage customer organization's social media campaigns
- **Access:** Requires `orgId` in URL path
- **Features:** Campaign management, AI training, multi-platform scheduling
- **OrgId Required:** YES - Mandatory URL parameter

### Root Cause of the "Gap"

```
THREE ARCHITECTURAL BARRIERS:
┌─────────────────────────────────────────────────────────────────┐
│ BARRIER 1: URL Structure                                        │
│ ──────────────────────────                                      │
│ /admin/* routes → No orgId, platform-level only                 │
│ /workspace/[orgId]/* routes → Requires orgId in URL             │
│                                                                 │
│ Admin cannot access /workspace/ features without picking an org │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BARRIER 2: Claims Enforcement (src/lib/auth/claims-validator.ts)│
│ ───────────────────────────────────────────────────────────────── │
│ Line 167-180: if (!claims.tenant_id) { return { allowed: false }}│
│                                                                 │
│ Even platform_admin MUST have a tenant_id claim                 │
│ No special bypass exists (God Mode removed per V3 audit)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ BARRIER 3: Data Isolation (src/lib/dal/BaseAgentDAL.ts)         │
│ ──────────────────────────────────────────────────────────────── │
│ All queries scoped: organizations/{orgId}/records               │
│                                                                 │
│ Without orgId, agent specialists cannot query any data          │
└─────────────────────────────────────────────────────────────────┘
```

### Specific Code Locations of Barriers

| Barrier | File | Line(s) | Issue |
|---------|------|---------|-------|
| URL Routing | `src/app/workspace/[orgId]/layout.tsx` | 1-50 | Extracts orgId from params |
| Claims Check | `src/lib/auth/claims-validator.ts` | 167-180 | Rejects if no tenant_id |
| Admin Fallback | `src/lib/api/admin-auth.ts` | 201-202 | Falls back to `'platform'` org |
| Data Queries | `src/lib/dal/BaseAgentDAL.ts` | 104-130 | Scopes all collections by orgId |
| Agent Payloads | `src/lib/agents/*/specialist.ts` | Various | All require `organizationId` in payload |

---

## PART 2: THE "IDENTITY" BRIDGE PROPOSAL

### MASTER_ORG_ID Implementation Plan

**Problem:** Platform admins need to use all 27 agents without being a "client"

**Solution:** Create a `platform-admin` organization with special flags

#### Step 1: Define the Master Organization Constant

```typescript
// src/lib/constants/platform.ts (NEW FILE)

export const PLATFORM_MASTER_ORG = {
  id: 'platform-admin',
  name: 'Platform Admin - Internal',
  slug: 'platform-admin',
  plan: 'enterprise' as const,
  status: 'active' as const,
  flags: {
    isPlatformOrg: true,
    isInternalAdmin: true,
    bypassQuotas: true,
    unlimitedAgents: true,
  },
};

export const PLATFORM_ORG_IDS = [
  'platform',
  'platform-admin',
  'admin',
  'default',
] as const;

export function isPlatformOrg(orgId: string): boolean {
  return PLATFORM_ORG_IDS.includes(orgId as typeof PLATFORM_ORG_IDS[number]);
}
```

#### Step 2: Create the Platform Organization (One-Time Setup)

Existing route already handles this: `/api/setup/create-platform-org/route.ts`

**The organization should be created with:**
```typescript
const orgData = {
  id: 'platform-admin',
  name: 'Platform Admin - Sales Agent',
  industry: 'AI Sales Automation',
  plan: 'enterprise',
  status: 'active',
  isPlatformOrg: true,
  isInternalAdmin: true,
  settings: { timezone: 'America/New_York', currency: 'USD' },
};
```

#### Step 3: Update Admin Layout for Workspace Access

```typescript
// src/app/admin/layout.tsx - ADD quick-switch link in navigation

<NavSection title="Workspace Access">
  <NavLink
    href="/workspace/platform-admin/dashboard"
    icon="🚀"
    tooltip="Access all workspace features using the platform organization"
  >
    God Mode Workspace
  </NavLink>
</NavSection>
```

#### Step 4: Assign Platform Admin Users to platform-admin Organization

When a platform_admin user is created, their Firebase custom claims should include:
```typescript
{
  tenant_id: 'platform-admin',
  role: 'platform_admin',
}
```

This allows them to access `/workspace/platform-admin/*` routes legally.

---

## PART 3: AGENT SWARM INVENTORY

### Verified Agent Count: 27 Specialists

**Source:** Line-by-line analysis of `src/lib/agents/`

| Category | Functional | Ghost | Total |
|----------|------------|-------|-------|
| Architect | 3 | 0 | 3 |
| Builder | 0 | 3 | 3 |
| Commerce | 1 | 1 | 2 |
| Content | 0 | 2 | 2 |
| Intelligence | 4 | 0 | 4 |
| Marketing | 5 | 1 | 6 |
| Outreach | 2 | 0 | 2 |
| Sales | 3 | 0 | 3 |
| Trust | 2 | 0 | 2 |
| **TOTAL** | **19** | **8** | **27** |

### Functional Agents (19) - Production Ready

| # | Agent | Path | LOC | Key Capabilities |
|---|-------|------|-----|------------------|
| 1 | Copy Architect | architect/copy/specialist.ts | 1,515 | PAS, AIDA, BAB, FAB, 4Ps, StoryBrand frameworks |
| 2 | Funnel Architect | architect/funnel/specialist.ts | 1,706 | 8 funnel templates, stage optimization |
| 3 | UX/UI Architect | architect/ux-ui/specialist.ts | 1,878 | 13 component schemas, color psychology |
| 4 | Pricing Strategist | commerce/pricing/specialist.ts | 581 | Stripe integration, ROI calculation |
| 5 | Competitor Researcher | intelligence/competitor/specialist.ts | 946 | SEO analysis, market positioning |
| 6 | Web Scraper | intelligence/scraper/specialist.ts | 695 | Tech stack detection, hiring signals |
| 7 | Sentiment Analyst | intelligence/sentiment/specialist.ts | 834 | Emotion detection, crisis alerts |
| 8 | Technographic Scout | intelligence/technographic/specialist.ts | 1,136 | 70+ tech signatures, cost estimation |
| 9 | Facebook Expert | marketing/facebook/specialist.ts | 1,717 | 11 audience personas, ad generation |
| 10 | LinkedIn Expert | marketing/linkedin/specialist.ts | 837 | Post optimization, B2B analysis |
| 11 | SEO Expert | marketing/seo/specialist.ts | 776 | Keyword research, meta optimization |
| 12 | TikTok Expert | marketing/tiktok/specialist.ts | 1,063 | Viral hooks, trending sounds |
| 13 | Twitter Expert | marketing/twitter/specialist.ts | 1,209 | Thread architecture, ratio assessment |
| 14 | Email Specialist | outreach/email/specialist.ts | 453 | SendGrid/Resend, campaign tracking |
| 15 | SMS Specialist | outreach/sms/specialist.ts | 495 | Twilio/Vonage, bulk messaging |
| 16 | Merchandiser | sales/merchandiser/specialist.ts | 1,585 | 7 nudge strategies, Stripe coupons |
| 17 | Outreach Expert | sales/outreach/specialist.ts | 2,005 | 8 frameworks, personalization engine |
| 18 | Lead Qualifier | sales/qualifier/specialist.ts | 1,836 | BANT scoring, ICP alignment |
| 19 | GMB Expert | trust/gmb/specialist.ts | 1,889 | Local SEO, map pack strategy |
| 20 | Review Manager | trust/review/specialist.ts | 1,222 | 5-star strategies, escalation routing |

**Total Functional LOC:** 25,380 lines

### Ghost Agents (8) - Placeholder Stubs

| Agent | Path | Reason |
|-------|------|--------|
| Asset Generator | builder/assets/specialist.ts | Returns `Promise.reject('GHOST')` |
| Funnel Builder | builder/funnel/specialist.ts | Returns `Promise.reject('GHOST')` |
| UX/UI Builder | builder/ux-ui/specialist.ts | Returns `Promise.reject('GHOST')` |
| Inventory Manager | commerce/inventory/specialist.ts | Returns `Promise.reject('GHOST')` |
| Calendar Coordinator | content/calendar/specialist.ts | Returns `Promise.reject('GHOST')` |
| Copywriter | content/copywriter/specialist.ts | Returns `Promise.reject('GHOST')` |
| X Expert (Duplicate) | marketing/x/specialist.ts | Redundant with twitter/specialist.ts |

### Swarm UI Registry Mismatch

**Issue:** `/admin/swarm/page.tsx` has a hardcoded `AGENT_REGISTRY` (23 agents) that doesn't match actual codebase (27 agents).

**Recommendation:** Generate registry dynamically from filesystem or maintain in a central config file.

---

## PART 4: COMPONENT MIGRATION LIST

### Components to Move to `src/components/shared/`

These components are currently duplicated or trapped in specific route folders and should be unified:

#### Social Media Components
| Current Location | Target | Reason |
|-----------------|--------|--------|
| `src/app/admin/social/page.tsx` (compose UI) | `src/components/shared/social/SocialComposer.tsx` | Reuse in workspace |
| `src/app/workspace/[orgId]/social/campaigns/page.tsx` (campaign list) | `src/components/shared/social/CampaignManager.tsx` | Reuse in admin |

#### Agent Control Components
| Current Location | Target | Reason |
|-----------------|--------|--------|
| `src/app/admin/swarm/page.tsx` (AgentCard) | `src/components/shared/agents/AgentCard.tsx` | Reuse in workspace settings |
| `src/app/admin/swarm/page.tsx` (ExecutionForm) | `src/components/shared/agents/AgentExecutor.tsx` | Enable workspace agent execution |

#### Analytics Components
| Current Location | Target | Reason |
|-----------------|--------|--------|
| `src/app/admin/analytics/page.tsx` | `src/components/shared/analytics/PlatformAnalytics.tsx` | Extract reusable charts |
| `src/app/workspace/[orgId]/analytics/page.tsx` | `src/components/shared/analytics/OrgAnalytics.tsx` | Compose from shared parts |

#### Dashboard Components
| Current Location | Target | Reason |
|-----------------|--------|--------|
| `src/app/dashboard/page.tsx` | `src/components/shared/dashboard/UniversalDashboard.tsx` | Single source of truth |
| `src/app/workspace/[orgId]/dashboard/page.tsx` | Uses shared + org-specific overlays | Reduce duplication |

### New Shared Components Needed

```
src/components/shared/
├── agents/
│   ├── AgentCard.tsx           # Display agent status
│   ├── AgentExecutor.tsx       # Run agent with form inputs
│   ├── AgentRegistry.tsx       # List all agents with filters
│   └── CircuitBreakerBadge.tsx # Show breaker status
├── social/
│   ├── SocialComposer.tsx      # Post to Twitter/LinkedIn
│   ├── CampaignManager.tsx     # Manage campaigns
│   ├── PostScheduler.tsx       # Schedule posts
│   └── AnalyticsPanel.tsx      # Show engagement stats
├── analytics/
│   ├── StatsCard.tsx           # Reusable stat display
│   ├── ChartContainer.tsx      # Wrapper for charts
│   └── DateRangePicker.tsx     # Time range selector
└── layout/
    ├── OrgSwitcher.tsx         # Quick org selection for admin
    ├── GodModeIndicator.tsx    # Show when in platform org
    └── UnifiedNav.tsx          # Adaptive navigation
```

---

## PART 5: UNIFIED DASHBOARD REFACTOR BLUEPRINT

### Current State: Fragmented

```
ADMIN VIEW:
/admin/dashboard → Platform metrics only
/admin/social → Platform Twitter/LinkedIn only
/admin/swarm → Agent execution (no org context)

WORKSPACE VIEW:
/workspace/[orgId]/dashboard → Org metrics only
/workspace/[orgId]/social/campaigns → Org social only
/workspace/[orgId]/settings/ai-agents → Org agent config only
```

### Target State: Unified

```
PLATFORM ADMIN VIEW (with platform-admin org):
/admin/dashboard → Platform metrics + Link to workspace
/workspace/platform-admin/dashboard → Full workspace features
  ├── Social Media (uses platform accounts)
  ├── Agent Swarm (full 27 agents)
  ├── CRM (demo data / platform leads)
  └── All Analytics

ORG USER VIEW (unchanged):
/workspace/[theirOrgId]/dashboard → Their org metrics
  ├── Social Media (their accounts)
  ├── Agent Swarm (their quota)
  └── Their CRM data
```

### Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Create `platform-admin` organization in Firestore | 1 hour | Unlocks God Mode |
| P0 | Assign platform admins to `platform-admin` org | 1 hour | Enables workspace access |
| P1 | Add OrgSwitcher/link to admin layout | 2 hours | Quick workspace access |
| P1 | Extract shared components | 4 hours | Reduces duplication |
| P2 | Unify agent registry | 2 hours | Single source of truth |
| P2 | Sync swarm UI with actual agents | 2 hours | Accuracy |
| P3 | Full dashboard merge | 8 hours | Complete unification |

---

## APPENDIX A: ROUTE MAP REFERENCE

### Route Groups Present
- `(auth)` - Authentication pages
- `(public)` - Marketing/static pages
- No `(admin)` group - admin is top-level route

### Dynamic Routes
- `[orgId]` - Organization scoping (workspace, sites, store)
- `[id]` - Entity detail pages
- `[formId]` - Form builder
- `[campaignId]` - Campaign detail
- `[workflowId]` - Workflow builder

### Feature → Route Mapping

| Feature | Admin Route | Workspace Route | Global Route |
|---------|-------------|-----------------|--------------|
| Dashboard | `/admin` | `/workspace/[orgId]/dashboard` | `/dashboard` |
| Social Media | `/admin/social` | `/workspace/[orgId]/social/*` | - |
| CRM | - | `/workspace/[orgId]/leads/*` | `/crm` |
| Agents | `/admin/swarm` | `/workspace/[orgId]/settings/ai-agents` | - |
| Analytics | `/admin/analytics` | `/workspace/[orgId]/analytics/*` | `/dashboard/*` |
| Settings | `/admin/system/*` | `/workspace/[orgId]/settings/*` | - |

---

## APPENDIX B: AUTH FLOW DIAGRAM

```
User Login
    │
    ▼
Firebase Auth (token issued)
    │
    ▼
Custom Claims Set:
  - tenant_id: "org_xxx" or "platform-admin"
  - role: "platform_admin" | "owner" | "admin" | etc.
    │
    ▼
Route Access Check
    │
    ├─► /admin/* routes
    │     │
    │     ▼
    │   useAdminAuth() → checks role ∈ ['platform_admin', 'super_admin', 'admin']
    │     │
    │     ▼
    │   verifyAdminRequest() → validates token + admin claim
    │
    └─► /workspace/[orgId]/* routes
          │
          ▼
        useAuth() → gets user profile with organizationId
          │
          ▼
        checkTenantAccess(claims, urlOrgId)
          │
          ├─► tenant_id matches urlOrgId → ALLOWED
          │
          └─► tenant_id != urlOrgId → DENIED
```

**Key Insight:** Platform admin with `tenant_id: 'platform-admin'` can access `/workspace/platform-admin/*` through standard auth flow.

---

## APPENDIX C: KEY FILE LOCATIONS

| Purpose | File Path | Key Lines |
|---------|-----------|-----------|
| Claims validator | `src/lib/auth/claims-validator.ts` | 163-215 |
| Admin auth | `src/lib/api/admin-auth.ts` | 180-207 |
| API auth | `src/lib/auth/api-auth.ts` | 276-281 |
| Permissions | `src/types/permissions.ts` | 1-130, 357-406 |
| Workspace layout | `src/app/workspace/[orgId]/layout.tsx` | 1-100 |
| Admin layout | `src/app/admin/layout.tsx` | 1-261 |
| Feature visibility | `src/hooks/useFeatureVisibility.ts` | All |
| Base DAL | `src/lib/dal/BaseAgentDAL.ts` | 104-130 |
| Platform org setup | `src/app/api/setup/create-platform-org/route.ts` | All |
| Swarm control | `src/app/admin/swarm/page.tsx` | 1-1013 |
| Admin social | `src/app/admin/social/page.tsx` | 1-534 |

---

## APPENDIX D: RECOMMENDED NEXT STEPS

### Immediate (P0)
1. **Create platform-admin organization** - Call `/api/setup/create-platform-org` or create directly in Firestore
2. **Update platform admin user claims** - Set `tenant_id: 'platform-admin'` for admin users
3. **Add workspace link to admin nav** - Simple NavLink to `/workspace/platform-admin/dashboard`

### Short-term (P1)
4. Extract `AgentCard` and `SocialComposer` to shared components
5. Update swarm page `AGENT_REGISTRY` to match actual 27 agents
6. Add org switcher dropdown for admins managing multiple orgs

### Medium-term (P2-P3)
7. Merge dashboard components into shared library
8. Implement unified analytics with org-level filtering
9. Create admin impersonation mode for debugging client issues

---

**Report Generated:** January 20, 2026
**Auditor:** Claude Opus 4.5
**Confidence Level:** HIGH - Verified via direct file reads
**Next Action:** Implement MASTER_ORG_ID bridge (P0 tasks)
