# AI Sales Platform - Single Source of Truth

**Generated:** January 26, 2026
**Last Updated:** January 27, 2026 (Client UI Restoration Verified - All 60 Routes Confirmed)
**Branch:** dev
**Status:** AUTHORITATIVE - All architectural decisions MUST reference this document
**Audit Method:** Multi-agent parallel scan with verification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Verified Live Route Map](#verified-live-route-map)
3. [Agent Registry](#agent-registry)
4. [Unified RBAC Matrix](#unified-rbac-matrix)
5. [Security Audit Findings](#security-audit-findings)
6. [Tooling Inventory](#tooling-inventory)
7. [Integration Status](#integration-status)
8. [Firestore Collections](#firestore-collections)
9. [Architecture Notes](#architecture-notes)
10. [Document Maintenance](#document-maintenance)

---

## Executive Summary

### Platform Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Physical Routes (page.tsx) | 199 | Verified |
| API Endpoints (route.ts) | 227 | Functional |
| AI Agents | 44 | 36 FUNCTIONAL, 8 SHELL |
| RBAC Roles | 5 | Implemented |
| Permissions per Role | 47 | Defined |
| Firestore Collections | 60+ | Active |

### Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (serverless)
- **Database:** Firebase Firestore (multi-tenant)
- **Authentication:** Firebase Auth with custom claims
- **AI Gateway:** OpenRouter (100+ models)
- **Voice:** VoiceEngineFactory (Native, ElevenLabs, Unreal)
- **Payments:** Stripe

---

## Verified Live Route Map

### Route Distribution

| Area | Routes | Dynamic Params | Status |
|------|--------|----------------|--------|
| Admin (`/admin/*`) | 46 | 2 (`[id]`) | All pages exist |
| Workspace (`/workspace/[orgId]/*`) | 95 | 15 | All pages exist |
| Dashboard (`/dashboard/*`) | 17 | 0 | All pages exist |
| Public (`/(public)/*`) | 15 | 0 | All pages exist |
| Sites (`/sites/[orgId]/*`) | 12 | 2 | Multi-tenant websites |
| Onboarding (`/onboarding/*`) | 4 | 0 | All pages exist |
| Other | 10 | 2 | All pages exist |
| **TOTAL** | **199** | **21** | **Verified** |

### Admin Routes (46)

```
/admin                              # CEO Command Center [FULL - 395 lines]
/admin/login                        # Firebase admin auth
/admin/analytics                    # Platform-wide usage metrics
/admin/analytics/pipeline           # Pipeline analytics
/admin/analytics/usage              # Usage analytics by org
/admin/billing                      # Subscription management
/admin/command-center               # [DEPRECATED - redirects to /admin]
/admin/customers                    # Customer management
/admin/deals                        # Platform deals view
/admin/email-campaigns              # Campaign management
/admin/global-config                # Global platform config
/admin/growth                       # Growth metrics
/admin/jasper-lab                   # AI training laboratory
/admin/leads                        # Platform leads view
/admin/merchandiser                 # E-commerce management
/admin/organizations                # Organization CRUD
/admin/organizations/new            # Create organization
/admin/organizations/[id]           # Organization detail
/admin/organizations/[id]/edit      # Edit organization
/admin/pricing-tiers                # Pricing tier config
/admin/recovery                     # Churn prevention
/admin/revenue                      # Revenue analytics
/admin/sales-agent                  # Golden Master AI config
/admin/sales-agent/knowledge        # Knowledge base
/admin/sales-agent/persona          # Agent persona
/admin/sales-agent/training         # Agent training
/admin/settings/integrations        # Integration cards
/admin/social                       # Social composer
/admin/specialists                  # Specialist config
/admin/subscriptions                # Subscription management
/admin/support/api-health           # API health monitoring
/admin/support/bulk-ops             # Bulk operations
/admin/support/exports              # Data exports
/admin/support/impersonate          # User impersonation
/admin/swarm                        # AI swarm control
/admin/system/api-keys              # API key management
/admin/system/flags                 # Feature flags
/admin/system/health                # System health
/admin/system/logs                  # Audit logs
/admin/system/settings              # System settings
/admin/templates                    # Email templates
/admin/users                        # User management
/admin/users/[id]                   # User detail
/admin/voice                        # Voice settings
/admin/voice-training               # Voice training
/admin/website-editor               # Website editor
/admin/advanced/compliance          # Compliance management
```

### Workspace Routes (95 in /workspace/[orgId]/*)

**Core Navigation:**
- `/dashboard`, `/settings`, `/analytics`, `/integrations`, `/templates`
- `/onboarding`, `/schemas`, `/battlecards`, `/email-writer`
- `/lead-scoring`, `/living-ledger`, `/conversations`, `/workforce`

**CRM Entities:**
- `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`, `/leads/research`
- `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit`
- `/contacts`, `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit`
- `/products`, `/products/new`, `/products/[id]/edit`
- `/entities/[entityName]`

**Marketing & Outbound:**
- `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[campaignId]`
- `/nurture`, `/nurture/new`, `/nurture/[id]`, `/nurture/[id]/stats`
- `/ab-tests`, `/ab-tests/new`, `/ab-tests/[id]`, `/marketing/ab-tests`
- `/outbound`, `/outbound/email-writer`, `/outbound/sequences`
- `/social/campaigns`, `/social/training`

**Settings (23 sub-routes):**
- `api-keys`, `billing`, `accounting`, `storefront`, `promotions`
- `email-templates`, `sms-messages`, `theme`, `organization`, `users`
- `security`, `integrations`, `webhooks`, `custom-tools`, `workflows`
- `subscription`, `lead-routing`, `meeting-scheduler`
- `ai-agents/*` (5 routes: hub, business-setup, configuration, persona, training)

**Website Builder:**
- `/website/editor`, `/website/pages`, `/website/domains`, `/website/seo`
- `/website/settings`, `/website/templates`, `/website/navigation`, `/website/audit-log`
- `/website/blog`, `/website/blog/categories`, `/website/blog/editor`

### Dashboard Routes (17)

```
/dashboard                          # Overview hub
/dashboard/analytics                # Workspace analytics [FULL - 278 lines]
/dashboard/coaching                 # Coaching hub
/dashboard/coaching/team            # Team coaching
/dashboard/conversation             # Conversation intelligence
/dashboard/marketing/email          # Email marketing
/dashboard/marketing/social         # Social marketing
/dashboard/performance              # Performance metrics
/dashboard/playbook                 # Sales playbook
/dashboard/risk                     # Risk management
/dashboard/routing                  # Lead routing
/dashboard/sales/deals              # Deals pipeline
/dashboard/sales/leads              # Leads management
/dashboard/sequence                 # Sequence management
/dashboard/settings                 # Settings
/dashboard/swarm                    # AI swarm control
/dashboard/system                   # Platform admin hub [FULL - 203 lines]
```

### Public Routes (15)

```
/(public)/                          # Landing page
/(public)/about                     # About page
/(public)/blog                      # Blog
/(public)/contact                   # Contact form
/(public)/demo                      # Demo request
/(public)/docs                      # Documentation
/(public)/faq                       # FAQ
/(public)/features                  # Features
/(public)/forgot-password           # Password reset
/(public)/login                     # User login
/(public)/pricing                   # Pricing page
/(public)/privacy                   # Privacy policy
/(public)/security                  # Security page
/(public)/signup                    # User signup
/(public)/terms                     # Terms of service
```

### Route Issues

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| ~~Stub Page~~ | `/admin/command-center` | ~~LOW~~ | ✅ RESOLVED - Proper 308 redirect to `/admin` |
| Duplicate Destination | `settingsEcommerce` + `settingsProducts` → `/admin/merchandiser` | INFO | Intentional (per design) |

---

## Agent Registry

### Agent Swarm Overview

**Total Agents:** 44 (9 managers + 35 specialists)

| Status | Count | Description |
|--------|-------|-------------|
| FUNCTIONAL | 36 | Complete implementation with logic |
| SHELL | 8 | Managers - orchestration layer only |
| GHOST | 0 | All specialists have been implemented |

### Managers (9) - L2 Orchestrators

| Agent ID | Class Name | Domain | Status |
|----------|------------|--------|--------|
| INTELLIGENCE_MANAGER | IntelligenceManager | Research & Analysis | SHELL |
| MARKETING_MANAGER | MarketingManager | Social & Ads | SHELL |
| BUILDER_MANAGER | BuilderManager | Site Building | SHELL |
| COMMERCE_MANAGER | CommerceManager | E-commerce | SHELL |
| OUTREACH_MANAGER | OutreachManager | Email & SMS | SHELL |
| CONTENT_MANAGER | ContentManager | Content Creation | SHELL |
| ARCHITECT_MANAGER | ArchitectManager | Site Architecture | SHELL |
| REVENUE_DIRECTOR | RevenueDirector | Sales Ops | SHELL |
| REPUTATION_MANAGER | ReputationManager | Trust & Reviews | SHELL |

### Specialists (35) - L3 Workers

#### Intelligence Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COMPETITOR_RESEARCHER | CompetitorResearcher | Competitor analysis, SWOT | FUNCTIONAL |
| SENTIMENT_ANALYST | SentimentAnalyst | Sentiment scoring, trend detection | FUNCTIONAL |
| TECHNOGRAPHIC_SCOUT | TechnographicScout | Tech stack analysis | FUNCTIONAL |
| SCRAPER_SPECIALIST | ScraperSpecialist | Web scraping, data extraction | FUNCTIONAL |
| TREND_SCOUT | TrendScout | Market trends, emerging patterns | FUNCTIONAL |

#### Marketing Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| TIKTOK_EXPERT | TikTokExpert | Viral content, trends | FUNCTIONAL |
| TWITTER_EXPERT | TwitterExpert | Threads, engagement | FUNCTIONAL |
| FACEBOOK_EXPERT | FacebookAdsExpert | Ad copy, targeting | FUNCTIONAL |
| LINKEDIN_EXPERT | LinkedInExpert | B2B posts, outreach | FUNCTIONAL |
| SEO_EXPERT | SEOExpert | Keywords, optimization | FUNCTIONAL |

#### Builder Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_ARCHITECT | UxUiArchitect | Interface design | FUNCTIONAL |
| FUNNEL_ENGINEER | FunnelEngineer | Conversion funnels | FUNCTIONAL |
| ASSET_GENERATOR | AssetGenerator | Graphics, assets | FUNCTIONAL |
| WORKFLOW_OPTIMIZER | WorkflowOptimizer | Process automation | FUNCTIONAL |

#### Architect Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_SPECIALIST | UXUISpecialist | Site UX/UI | FUNCTIONAL |
| FUNNEL_PATHOLOGIST | FunnelPathologist | Funnel analysis | FUNCTIONAL |
| COPY_SPECIALIST | CopySpecialist | Website copy | FUNCTIONAL |

#### Commerce Domain (2)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| PRICING_STRATEGIST | PricingStrategist | Dynamic pricing | FUNCTIONAL |
| INVENTORY_MANAGER | InventoryManagerAgent | Stock management | FUNCTIONAL |

#### Outreach Domain (2)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| EMAIL_SPECIALIST | EmailSpecialist | Email campaigns | FUNCTIONAL |
| SMS_SPECIALIST | SmsSpecialist | SMS outreach | FUNCTIONAL |

#### Content Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COPYWRITER | Copywriter | Marketing copy | FUNCTIONAL |
| CALENDAR_COORDINATOR | CalendarCoordinator | Content scheduling | FUNCTIONAL |
| VIDEO_SPECIALIST | VideoSpecialist | Video scripts | FUNCTIONAL |

#### Sales Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| MERCHANDISER | MerchandiserSpecialist | Product merchandising | FUNCTIONAL |
| OUTREACH_SPECIALIST | OutreachSpecialist | Sales outreach | FUNCTIONAL |
| LEAD_QUALIFIER | LeadQualifierSpecialist | Lead scoring | FUNCTIONAL |
| DEAL_CLOSER | DealCloserSpecialist | Closing strategies | FUNCTIONAL |
| OBJ_HANDLER | ObjectionHandlerSpecialist | Objection handling | FUNCTIONAL |

#### Trust Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| GMB_SPECIALIST | GMBSpecialist | Google My Business, local SEO | FUNCTIONAL |
| REVIEW_SPECIALIST | ReviewSpecialist | Review management | FUNCTIONAL |
| REV_MGR | ReviewManagerSpecialist | Review response | FUNCTIONAL |
| CASE_STUDY | CaseStudyBuilderSpecialist | Case study creation | FUNCTIONAL |

### Agent File Locations

```
src/lib/agents/
├── index.ts                    # Swarm registry & exports
├── types.ts                    # Agent type definitions
├── base-specialist.ts          # Base specialist class
├── base-manager.ts             # Base manager class
├── shared/
│   ├── index.ts
│   └── tenant-memory-vault.ts  # Cross-agent memory
├── intelligence/
│   ├── manager.ts
│   ├── competitor/specialist.ts
│   ├── sentiment/specialist.ts
│   ├── technographic/specialist.ts
│   ├── scraper/specialist.ts
│   └── trend/specialist.ts
├── marketing/
│   ├── manager.ts
│   ├── tiktok/specialist.ts
│   ├── twitter/specialist.ts
│   ├── facebook/specialist.ts
│   ├── linkedin/specialist.ts
│   └── seo/specialist.ts
├── builder/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   ├── assets/specialist.ts
│   └── workflow/specialist.ts
├── architect/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   └── copy/specialist.ts
├── commerce/
│   ├── manager.ts
│   ├── pricing/specialist.ts
│   └── inventory/specialist.ts
├── outreach/
│   ├── manager.ts
│   ├── email/specialist.ts
│   └── sms/specialist.ts
├── content/
│   ├── manager.ts
│   ├── copywriter/specialist.ts
│   ├── calendar/specialist.ts
│   └── video/specialist.ts
├── sales/
│   ├── revenue/manager.ts
│   ├── merchandiser/specialist.ts
│   ├── outreach/specialist.ts
│   ├── qualifier/specialist.ts
│   ├── deal-closer/specialist.ts
│   └── objection-handler/specialist.ts
└── trust/
    ├── reputation/manager.ts
    ├── gmb/
    │   ├── index.ts
    │   ├── specialist.ts
    │   └── README.md
    ├── review/specialist.ts
    ├── review-manager/specialist.ts
    └── case-study/specialist.ts
```

---

## Unified RBAC Matrix

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `platform_admin` | 5 | Full platform access + system administration |
| `owner` | 4 | Full access within their organization |
| `admin` | 3 | Most permissions except billing and org deletion |
| `manager` | 2 | Team-level management |
| `employee` | 1 | Individual contributor access |

### Permission Categories (47 Total)

#### Platform Administration (8 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canAccessPlatformAdmin | YES | - | - | - | - |
| canManageAllOrganizations | YES | - | - | - | - |
| canViewSystemHealth | YES | - | - | - | - |
| canManageFeatureFlags | YES | - | - | - | - |
| canViewAuditLogs | YES | - | - | - | - |
| canManageSystemSettings | YES | - | - | - | - |
| canImpersonateUsers | YES | - | - | - | - |
| canAccessSupportTools | YES | - | - | - | - |

#### Organization Management (5 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canManageOrganization | YES | YES | YES | - | - |
| canManageBilling | YES | YES | - | - | - |
| canManageAPIKeys | YES | YES | YES | - | - |
| canManageTheme | YES | YES | YES | - | - |
| canDeleteOrganization | YES | YES | - | - | - |

#### User Management (4 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canInviteUsers | YES | YES | YES | YES | - |
| canRemoveUsers | YES | YES | YES | - | - |
| canChangeUserRoles | YES | YES | YES | - | - |
| canViewAllUsers | YES | YES | YES | YES | - |

#### Data Management (7 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canCreateSchemas | YES | YES | YES | - | - |
| canEditSchemas | YES | YES | YES | - | - |
| canDeleteSchemas | YES | YES | YES | - | - |
| canExportData | YES | YES | YES | YES | - |
| canImportData | YES | YES | YES | YES | - |
| canDeleteData | YES | YES | YES | - | - |
| canViewAllRecords | YES | YES | YES | YES | - |

#### CRM Operations (5 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canCreateRecords | YES | YES | YES | YES | YES |
| canEditRecords | YES | YES | YES | YES | YES |
| canDeleteRecords | YES | YES | YES | - | - |
| canViewOwnRecordsOnly | - | - | - | - | YES |
| canAssignRecords | YES | YES | YES | YES | - |

#### Workflows & Automation (3 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canCreateWorkflows | YES | YES | YES | YES | - |
| canEditWorkflows | YES | YES | YES | YES | - |
| canDeleteWorkflows | YES | YES | YES | - | - |

#### AI Agents & Swarm (4 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canTrainAIAgents | YES | YES | YES | - | - |
| canDeployAIAgents | YES | YES | YES | - | - |
| canManageAIAgents | YES | YES | YES | - | - |
| canAccessSwarmPanel | YES | YES | YES | - | - |

#### Marketing (3 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canManageSocialMedia | YES | YES | YES | YES | - |
| canManageEmailCampaigns | YES | YES | YES | YES | - |
| canManageWebsite | YES | YES | YES | - | - |

#### Sales (5 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canViewLeads | YES | YES | YES | YES | YES |
| canManageLeads | YES | YES | YES | YES | - |
| canViewDeals | YES | YES | YES | YES | YES |
| canManageDeals | YES | YES | YES | YES | - |
| canAccessVoiceAgents | YES | YES | YES | YES | - |

#### Reports & Analytics (4 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canViewReports | YES | YES | YES | YES | YES |
| canCreateReports | YES | YES | YES | YES | - |
| canExportReports | YES | YES | YES | YES | - |
| canViewPlatformAnalytics | YES | - | - | - | - |

#### Settings (2 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canAccessSettings | YES | YES | YES | - | - |
| canManageIntegrations | YES | YES | YES | - | - |

#### E-Commerce (3 permissions)

| Permission | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| canManageEcommerce | YES | YES | YES | - | - |
| canProcessOrders | YES | YES | YES | YES | YES |
| canManageProducts | YES | YES | YES | YES | - |

### Navigation Section Visibility (12 Sections - God-Mode Structure)

**11 Operational Sections** (available to client roles with permission gating)
**1 System Section** (platform_admin only)

| Section | platform_admin | owner | admin | manager | employee | Key Permission |
|---------|----------------|-------|-------|---------|----------|----------------|
| 1. Command Center | YES | YES | YES | YES | YES | - |
| 2. CRM | YES | YES | YES | YES | YES* | canViewLeads, canViewDeals |
| 3. Lead Gen | YES | YES | YES | YES | - | canManageLeads |
| 4. Outbound | YES | YES | YES | YES | YES* | canManageEmailCampaigns |
| 5. Automation | YES | YES | YES | - | - | canCreateWorkflows |
| 6. Content Factory | YES | YES | YES | YES | - | canManageSocialMedia |
| 7. AI Workforce | YES | YES | YES | - | - | canTrainAIAgents, canManageAIAgents |
| 8. E-Commerce | YES | YES | YES | - | - | canManageProducts, canManageEcommerce |
| 9. Analytics | YES | YES | YES | YES | YES* | canViewReports |
| 10. Website | YES | YES | YES | - | - | canManageWebsite |
| 11. Settings | YES | YES | YES** | - | - | canManageOrganization |
| 12. System | YES | - | - | - | - | canViewSystemHealth (platform_admin only) |

*Limited items visible based on specific permissions
**Admin cannot see Billing (requires canManageBilling)

**God-Mode Verification:** Platform admin sees all 12 sections simultaneously

### RBAC Source Files

- **Definitions:** `src/types/unified-rbac.ts`
- **Middleware:** `src/middleware.ts` (role-based segment routing)
- **Layouts:** `src/app/admin/layout.tsx`, `src/app/workspace/[orgId]/layout.tsx`

---

## Security Audit Findings

### Authentication Flow

#### Client-Side (`useUnifiedAuth` hook)

```
1. Firebase user signs in
   ↓
2. Get Firebase ID token
   ↓
3. Check if user is platform_admin via /api/admin/verify
   ├─ If YES → UnifiedUser with role='platform_admin', tenantId=null
   └─ If NO → Check Firestore USERS collection
      ├─ If document exists → Load tenant user profile
      │  └─ Extract tenantId, role (owner|admin|manager|employee)
      └─ If document missing → User is unauthenticated
   ↓
4. Set permissions via getUnifiedPermissions(role)
   ↓
5. Return UnifiedUser + UnifiedPermissions
```

#### Server-Side (`src/lib/auth/api-auth.ts`)

```
1. Extract Bearer token from Authorization header
   ↓
2. Verify token using Firebase Admin SDK
   ↓
3. Extract custom claims from decoded token
   ├─ role, organizationId, admin flag
   ↓
4. If no role in claims → Try Firestore lookup
   ├─ Check USERS collection for user document
   ↓
5. Return AuthenticatedUser with uid, email, organizationId, role
   ↓
6. Route-level checks (requireRole, requireOrganization) enforce access
```

### API Protection Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireAuth(request)` | Basic authentication | 401 if invalid token |
| `requireRole(request, allowedRoles[])` | Role-based access | 403 if role not in whitelist |
| `requireOrganization(request, orgId?)` | Organization membership | 403 if org mismatch |
| `optionalAuth(request)` | Non-blocking authentication | User or null |

### Security Strengths

| Strength | Implementation | Files |
|----------|----------------|-------|
| Tenant Isolation | Claims-validator enforces tenant_id on ALL requests | `claims-validator.ts`, `api-auth.ts` |
| No Admin Bypass | platform_admin respects organization boundaries | `claims-validator.ts` |
| Token Verification | Firebase Admin SDK validates ID tokens server-side | `api-auth.ts` |
| Layout-Level Auth | Admin routes protected at layout level before render | `admin/layout.tsx` |
| Permission Matrix | Comprehensive 47-permission definitions per role | `unified-rbac.ts` |

### Security Concerns

| Severity | Issue | Location | Status |
|----------|-------|----------|--------|
| ~~MEDIUM~~ | ~~Demo mode fallback in useAuth.ts~~ | `src/hooks/useAuth.ts` | ✅ RESOLVED - Wrapped in `NODE_ENV === 'development'` check |
| ~~LOW~~ | ~~Inconsistent role naming (super_admin vs platform_admin)~~ | Multiple files | ✅ RESOLVED - Fully standardized to `platform_admin` across codebase. All source files updated, claims-validator provides runtime normalization for any legacy data. |
| LOW | Token claim extraction lacks strict validation | `api-auth.ts` | Add runtime type guards |
| LOW | Manual organization check in agent routes | `/api/agent/chat` | Create decorator pattern for auto org validation |

### Admin Account Bootstrap

To properly configure a platform admin account, Firebase custom claims must be set:

```bash
# Run the bootstrap script (one-time setup)
node scripts/bootstrap-platform-admin.js
```

This script:
- Sets Firebase custom claims: `{ role: "platform_admin", admin: true }`
- Updates Firestore user document with standardized role
- Verifies claims were successfully applied

**Note:** Custom claims are required for `/api/admin/verify` to recognize admin status. Firestore document alone is insufficient.

### Protected Route Patterns

#### Middleware Routing (`src/middleware.ts`)

| Route Pattern | Authentication | Enforcement |
|---------------|----------------|-------------|
| `/admin/*` | Any user (layout enforces role) | Admin Layout |
| `/workspace/platform-admin/*` | N/A | 308 redirect to `/admin/*` |
| `/sites/{orgId}/*` | Not required | Middleware rewrite |
| `/api/*` | Skipped at middleware | Per-route enforcement |

#### Admin Layout Enforcement (`src/app/admin/layout.tsx`)

- Unauthenticated → `/admin-login`
- Non-platform-admin → `/workspace/{orgId}/dashboard`
- Only `isPlatformAdmin()` users allowed through

### Public Routes (No Auth Required)

```
/                    # Landing page
/login               # User login
/admin-login         # Admin login
/signup              # User signup
/security            # Security page
/privacy             # Privacy policy
/terms               # Terms of service
```

### Files Containing RBAC Logic

**Authentication & Authorization:**
- `src/lib/auth/api-auth.ts` - API endpoint auth middleware
- `src/lib/auth/auth-service.ts` - Firebase auth operations
- `src/lib/auth/claims-validator.ts` - Claims-based authorization
- `src/lib/auth/server-auth.ts` - Server-side auth utilities

**Type Definitions:**
- `src/types/unified-rbac.ts` - Unified role/permission definitions
- `src/types/admin.ts` - Admin-specific types
- `src/types/permissions.ts` - Legacy permission types

**Client Hooks:**
- `src/hooks/useUnifiedAuth.ts` - Primary client-side auth hook
- `src/hooks/useAuth.ts` - Legacy auth hook (has demo mode)
- `src/hooks/useAdminAuth.ts` - Admin-specific auth hook

---

## Tooling Inventory

### API Routes (227 Total)

| Category | Count | Path Pattern | Status |
|----------|-------|--------------|--------|
| Admin | 21 | `/api/admin/*` | Mostly functional |
| Analytics | 8 | `/api/analytics/*` | Functional |
| Agent | 4 | `/api/agent/*` | Partial |
| Battlecard | 4 | `/api/battlecard/*` | Functional |
| Billing | 3 | `/api/billing/*` | Functional |
| Coaching | 2 | `/api/coaching/*` | Functional |
| CRM | 9 | `/api/crm/*` | Functional |
| Discovery | 1 | `/api/discovery/*` | Functional |
| E-commerce | 5 | `/api/ecommerce/*` | Functional |
| Email | 4 | `/api/email-writer/*`, `/api/email/*` | Functional |
| Health | 2 | `/api/health/*` | Functional |
| Integrations | 18 | `/api/integrations/*` | Functional |
| Lead Scoring | 3 | `/api/lead-scoring/*` | Functional |
| Leads | 3 | `/api/leads/*` | Functional |
| Learning | 2 | `/api/learning/*` | Partial |
| Meetings | 1 | `/api/meetings/*` | Functional |
| Onboarding | 1 | `/api/onboarding/*` | Functional |
| Orchestrator | 3 | `/api/orchestrator/*` | Functional |
| Outbound | 3 | `/api/outbound/*` | Functional |
| Performance | 1 | `/api/performance/*` | Functional |
| Playbook | 1 | `/api/playbook/*` | Functional |
| Proposals | 1 | `/api/proposals/*` | Functional |
| Recovery | 1 | `/api/recovery/*` | Functional |
| Reports | 1 | `/api/reports/*` | Partial |
| Risk | 1 | `/api/risk/*` | Functional |
| Schemas | 6 | `/api/schema*/*` | Functional |
| Other | ~125 | Various | Mixed |

### Key API Endpoints

#### Orchestrator (Jasper AI)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/orchestrator/chat` | POST | Jasper conversation | FUNCTIONAL |
| `/api/orchestrator/system-health` | GET | System health | FUNCTIONAL |
| `/api/orchestrator/feature-toggle` | POST | Feature flags | FUNCTIONAL |

#### Admin Operations

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/admin/organizations` | GET/POST | Organization CRUD | FUNCTIONAL |
| `/api/admin/users` | GET | User listing | FUNCTIONAL |
| `/api/admin/provision` | POST | Provision new org | FUNCTIONAL |
| `/api/admin/platform-pricing` | GET/PUT | Pricing config | FUNCTIONAL |
| `/api/admin/platform-coupons` | GET/POST | Coupon management | FUNCTIONAL |

#### Voice & AI

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/voice/*` | Various | Voice agent operations | FUNCTIONAL |
| `/api/agent/config` | GET/PUT | Agent configuration | FUNCTIONAL |
| `/api/agent/knowledge/upload` | POST | Knowledge base upload | FUNCTIONAL |

---

## Integration Status

### Native Integrations (FUNCTIONAL)

| Integration | Type | Features |
|-------------|------|----------|
| **Stripe** | Payments | Subscriptions, invoices, webhooks |
| **Firebase** | Auth + DB | Authentication, Firestore |
| **OpenRouter** | AI Gateway | 100+ model access |
| **Calendly** | Scheduling | Meeting booking |
| **Shopify** | E-commerce | Product sync |

### OAuth Integrations (FUNCTIONAL)

| Provider | Scope | Features |
|----------|-------|----------|
| **Google** | Calendar, Gmail | Read/send emails, calendar events |
| **Microsoft** | Outlook, Teams | Email, channel messaging |
| **Slack** | Messaging | Channel notifications |
| **QuickBooks** | Accounting | Invoice sync |
| **Twitter/X** | Social | Post/schedule |

### Voice Engines (FUNCTIONAL)

| Engine | Provider | Status |
|--------|----------|--------|
| Native | Browser TTS | Default |
| ElevenLabs | ElevenLabs API | Premium |
| Unreal | Unreal Speech | Alternative |

### Planned Integrations (INCOMPLETE)

- Salesforce CRM
- HubSpot
- Xero Accounting
- PayPal Payments

---

## Firestore Collections

### Root Collections (11)

| Collection | Purpose |
|------------|---------|
| `organizations` | Tenant definitions |
| `users` | User profiles |
| `health` | System health records |
| `admin` | Admin configurations |
| `platform_metrics` | Platform-wide metrics |
| `platform_settings` | Global settings |
| `discoveryQueue` | Lead discovery queue |
| `slack_workspaces` | Slack workspace configs |
| `slack_oauth_states` | OAuth state tokens |
| `slack_channels` | Slack channel mappings |
| `slack_messages` | Message history |

### Organization Sub-Collections (35)

```
organizations/{orgId}/
├── records/                  # CRM records
├── workspaces/               # Workspace definitions
├── sequences/                # Email sequences
├── campaigns/                # Marketing campaigns
├── workflows/                # Automation workflows
├── products/                 # E-commerce products
├── orders/                   # Order history
├── conversations/            # Chat history
├── trainingData/             # AI training data
├── baseModels/               # AI model configs
├── schemas/                  # Custom schemas
├── apiKeys/                  # API keys
├── integrations/             # Integration configs
├── merchant_coupons/         # Merchant coupons
├── members/                  # Organization members
├── settings/                 # Org settings
├── agentConfig/              # Agent configurations
├── goldenMasters/            # Golden master agents
├── signals/                  # Agent signals
├── forms/                    # Form builder forms
│   ├── fields/               # Form fields
│   ├── submissions/          # Form submissions
│   ├── analytics/            # Form analytics
│   └── views/                # View events
├── formTemplates/            # Form templates
├── websites/                 # Website configs
├── pages/                    # Website pages
├── domains/                  # Custom domains
├── blogPosts/                # Blog content
├── brandDNA/                 # Brand configuration
└── provisionerLogs/          # Provisioning logs
```

### Total: 60+ Collections

---

## Architecture Notes

### Multi-Tenancy Model

- Each organization has isolated data in Firestore
- Organizations identified by unique `organizationId`
- Feature visibility configurable per-organization
- Agents inherit organization context
- Environment-aware collection prefixing (test_ prefix in non-production)

### Middleware Routing Strategy

The middleware (`src/middleware.ts`) uses **Role-Based Segment Routing**:

1. All `/admin/*` paths allowed through middleware
2. Authentication & authorization handled by `/admin/layout.tsx`
3. Non-admin users redirected to workspace by layout, not middleware
4. Prevents 404s from middleware redirecting to non-existent paths

### Sidebar Architecture

**Forensic Investigation Completed:** January 26, 2026
**Legacy Client UI Restored:** January 27, 2026 (1/25/2026 Baseline)

> **IMPORTANT:** The "Unified Dashboard" logic has been SCRAPPED for the client view.
> The legacy client navigation with 11 operational sections has been restored.
> System tools are now HARD-GATED and isolated from the standard client navigation array.

#### Current Implementation (ISOLATED ARCHITECTURE)

| Component | Location | Status |
|-----------|----------|--------|
| **UnifiedSidebar** | `src/components/dashboard/UnifiedSidebar.tsx` | ACTIVE - Uses `getNavigationForRole()` |
| **Navigation Config** | `src/components/dashboard/navigation-config.ts` | ACTIVE - Exports `CLIENT_SECTIONS` and `SYSTEM_SECTION` separately |
| **Role Filtering** | `src/types/unified-rbac.ts` → `filterNavigationByRole()` | ACTIVE - Permission-based filtering |
| **Hard-Gate Function** | `navigation-config.ts` → `getNavigationForRole()` | ACTIVE - Explicit platform_admin check |

#### Navigation Exports

```typescript
// CLIENT_SECTIONS - 11 operational sections (available to all client roles)
// SYSTEM_SECTION - Isolated platform_admin tools (NEVER in client array)
// getNavigationForRole(role) - Returns CLIENT_SECTIONS, appends SYSTEM_SECTION ONLY for platform_admin
```

#### Client Navigation Structure (11 Sections)

Clients see ONLY these 11 sections (NO System tools):

1. **Command Center** - Workforce HQ, Dashboard, Conversations
2. **CRM** - Leads, Deals, Contacts, Living Ledger
3. **Lead Gen** - Forms, Lead Research, Lead Scoring
4. **Outbound** - Sequences, Campaigns, Email Writer, Nurture, Calls
5. **Automation** - Workflows, A/B Tests
6. **Content Factory** - Video Studio, Social Media, Proposals, Battlecards
7. **AI Workforce** - Agent Training, Voice AI Lab, Social AI Lab, SEO AI Lab, Datasets, Fine-Tuning
8. **E-Commerce** - Products, Orders, Storefront
9. **Analytics** - Overview, Revenue, Pipeline, Sequences
10. **Website** - Pages, Blog, Domains, SEO, Site Settings
11. **Settings** - Organization, Team, Integrations, API Keys, Billing

#### Platform Admin Tools (HARD-GATED)

Platform admins see all 11 client sections PLUS the System section (12 total):

12. **System** (platform_admin ONLY) - System Overview, Organizations, All Users, Feature Flags, Audit Logs, System Settings

**CRITICAL:** The System section is NOT part of `CLIENT_SECTIONS`. It is a separate `SYSTEM_SECTION` export
that is conditionally appended ONLY when `user.role === 'platform_admin'` via `getNavigationForRole()`.

#### Route Pattern

- **Workspace Routes:** `/workspace/:orgId/*` (11 operational sections)
- **Admin Routes:** `/admin/*` (System section only)
- Route resolution: `resolveWorkspaceRoute(href, orgId)` replaces `:orgId` placeholder

#### Bug Fix (January 27, 2026)

**Issue:** UnifiedSidebar href resolution was checking for `[orgId]` placeholder but navigation-config.ts uses `:orgId`.
**Fix:** Updated UnifiedSidebar.tsx to correctly replace `:orgId` placeholder in all 3 locations:
- `NavItemComponent` href builder (line 72-77)
- `NavSectionComponent` active item check (line 119-126)
- Section items active state check (line 166-170)

**All 109 workspace routes and 46 admin routes verified as valid.**

#### Key Finding: Unified Navigation System

**Investigation Result:** There are **NO separate CLIENT_NAV or WORKSPACE_NAV arrays**. The codebase uses a fully unified navigation system where:

1. Both `/admin` layout and `/workspace/[orgId]` layout use the **same `UnifiedSidebar` component**
2. Navigation items are filtered at runtime by `filterNavigationByRole(UNIFIED_NAVIGATION, user.role)`
3. Each navigation item can specify a `requiredPermission` that gates visibility
4. All 11 operational sections ARE present in the unified config with permission gates
5. Platform admin (God-Mode) sees all 12 sections simultaneously

#### Navigation Item Locations (Key Routes)

| Feature | Section | Permission Required | Route Pattern |
|---------|---------|---------------------|---------------|
| Leads | CRM | `canViewLeads` | `/workspace/:orgId/leads` |
| Deals | CRM | `canViewDeals` | `/workspace/:orgId/deals` |
| Forms | Lead Gen | `canManageLeads` | `/workspace/:orgId/forms` |
| Sequences | Outbound | `canManageEmailCampaigns` | `/workspace/:orgId/outbound/sequences` |
| Workflows | Automation | `canCreateWorkflows` | `/workspace/:orgId/workflows` |
| Video Studio | Content Factory | `canManageSocialMedia` | `/workspace/:orgId/content/video` |
| Agent Training | AI Workforce | `canTrainAIAgents` | `/workspace/:orgId/settings/ai-agents/training` |
| Products | E-Commerce | `canManageProducts` | `/workspace/:orgId/products` |
| Analytics | Analytics | `canViewReports` | `/workspace/:orgId/analytics` |
| Pages | Website | `canManageWebsite` | `/workspace/:orgId/website/pages` |
| Organization | Settings | `canManageOrganization` | `/workspace/:orgId/settings` |
| System Overview | System | `canViewSystemHealth` | `/admin/system/health` |

#### Deleted Components (Forensic Record)

| File | Commit | Date | Reason |
|------|--------|------|--------|
| `CommandCenterSidebar.tsx` | `f2d2497b` | Jan 26, 2026 | UI consolidation - migrated to UnifiedSidebar |

**CommandCenterSidebar Contents (437 lines):** 10 navigation categories (Dashboard, Clients, Leads & Sales, Social Media, Email Marketing, AI Voice, Analytics, System, Jasper Lab), collapsible sections, badge support, role display. All functionality migrated to unified system.

#### Section Visibility by Role (12 Sections)

| # | Section | platform_admin | owner | admin | manager | employee |
|---|---------|----------------|-------|-------|---------|----------|
| 1 | Command Center | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | CRM | ✅ | ✅ | ✅ | ✅ | ✅* |
| 3 | Lead Gen | ✅ | ✅ | ✅ | ✅ | - |
| 4 | Outbound | ✅ | ✅ | ✅ | ✅ | ✅* |
| 5 | Automation | ✅ | ✅ | ✅ | - | - |
| 6 | Content Factory | ✅ | ✅ | ✅ | ✅ | - |
| 7 | AI Workforce | ✅ | ✅ | ✅ | - | - |
| 8 | E-Commerce | ✅ | ✅ | ✅ | - | - |
| 9 | Analytics | ✅ | ✅ | ✅ | ✅ | ✅* |
| 10 | Website | ✅ | ✅ | ✅ | - | - |
| 11 | Settings | ✅ | ✅ | ✅** | - | - |
| 12 | System | ✅ | - | - | - | - |

*Employee sees limited items based on specific permissions
**Admin cannot see Billing (requires canManageBilling)

#### Files for Navigation Debugging

```
src/components/dashboard/
├── UnifiedSidebar.tsx          # Sidebar component (use for ALL layouts)
├── navigation-config.ts        # UNIFIED_NAVIGATION constant
├── README.md                   # Migration documentation
├── MIGRATION.md                # Migration guide
└── IMPLEMENTATION_SUMMARY.md   # Implementation details

src/types/
└── unified-rbac.ts             # filterNavigationByRole() at lines 699-714
```

#### Orphaned Code Status: ✅ CLEAN

No disconnected navigation references, unused arrays, or orphaned code found during forensic audit.

### Agent Communication

Agents communicate via **TenantMemoryVault**:
- Cross-agent memory sharing
- Signal broadcasting
- Insight sharing
- Location: `src/lib/agents/shared/tenant-memory-vault.ts`

---

## Document Maintenance

### Update Protocol

This document MUST be updated when:

1. **Route Changes:** New pages added, routes removed, or paths changed
2. **Agent Changes:** New agents added, agents deprecated, or status changed
3. **RBAC Changes:** New permissions, role modifications, or access changes
4. **Integration Changes:** New integrations added or existing ones modified
5. **Collection Changes:** Firestore schema modifications

### Mandatory Cleanup Rule

**All temporary audit logs, discovery documents, or draft architecture files MUST be deleted or archived within 24 hours of creation.**

This prevents documentation drift and ensures single_source_of_truth.md remains the sole authoritative reference.

### Update Procedure

```bash
# After any codebase change affecting this document:
1. Verify change against this document
2. Update relevant section(s)
3. Update "Generated" date at top
4. Commit with message: "docs: update single_source_of_truth.md - [change description]"

# For temporary audit/discovery documents:
1. Create in project root during session
2. Extract relevant findings into this document
3. Move original to docs/archive/legacy/ within 24 hours
4. Update archive README.md
```

### Archived Documents

Legacy documentation moved to: `docs/archive/legacy/`

**Forensic Audits:**
- `GROUND_TRUTH_DISCOVERY.md` - Jan 20, 2026 forensic audit
- `FEATURE_PARITY_AUDIT.md` - Admin vs workspace parity audit
- `FORENSIC_AUDIT_V3.md` - God Mode removal record
- `FORENSIC_AUDIT_BRIEFING.md` - Initial forensic briefing

**Architecture:**
- `SYSTEM_MAP_JAN_2026.md` - Previous route audit
- `SYSTEM_BLUEPRINT.md` - Previous architecture guide
- `ARCHITECTURE_GRAPH.md` - Previous dependency map
- `orchestrator-system-blueprint.md` - Jasper AI blueprint

**Operational:**
- `REDIRECT_*.md` - Redirect implementation docs
- `VERIFIED.md` - Progress log
- `workflow_state.md` - Temporary state

See `docs/archive/legacy/README.md` for full archive index.

---

**END OF SINGLE SOURCE OF TRUTH**

*Document generated by Claude Code multi-agent audit - January 26, 2026*
*Last updated: January 27, 2026 - Client UI 11-Section Restoration Verified (60/60 routes confirmed, RESTORED_CLIENT_UI_v1 marker active)*
