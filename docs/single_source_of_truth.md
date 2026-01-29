# AI Sales Platform - Single Source of Truth

**Generated:** January 26, 2026
**Last Updated:** January 29, 2026 (INTELLIGENCE_MANAGER - Dynamic orchestration engine implemented)
**Branch:** dev
**Status:** AUTHORITATIVE - All architectural decisions MUST reference this document
**Audit Method:** Multi-agent parallel scan with verification + Deep-dive forensic analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Verified Live Route Map](#verified-live-route-map)
3. [Agent Registry](#agent-registry)
4. [Unified RBAC Matrix](#unified-rbac-matrix)
5. [Security Audit Findings](#security-audit-findings)
6. [Tooling Inventory](#tooling-inventory)
7. [Infrastructure Systems](#infrastructure-systems)
8. [Integration Status](#integration-status)
9. [Firestore Collections](#firestore-collections)
10. [Architecture Notes](#architecture-notes)
11. [Data Contracts Reference](#data-contracts-reference)
12. [Document Maintenance](#document-maintenance)

---

## Executive Summary

### Platform Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Physical Routes (page.tsx) | 199 | Verified |
| API Endpoints (route.ts) | 227 | 221 Functional, 6 Partial* |
| AI Agents | 44 | 36 FUNCTIONAL, 3 ENHANCED SHELL, 5 SHELL |
| RBAC Roles | 5 | Implemented |
| Permissions per Role | 47 | Defined |
| Firestore Collections | 60+ | Active |

*Partial endpoints have working infrastructure but use mock data for core logic (see [Implementation Notes](#api-implementation-notes))

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
| ENHANCED SHELL | 3 | Managers with substantial orchestration logic |
| SHELL | 5 | Managers - basic orchestration layer only |
| GHOST | 0 | All specialists have been implemented |

### Managers (9) - L2 Orchestrators

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| INTELLIGENCE_MANAGER | IntelligenceManager | Research & Analysis | FUNCTIONAL | Dynamic orchestration engine with parallel execution, graceful degradation |
| MARKETING_MANAGER | MarketingManager | Social & Ads | ENHANCED SHELL | 450+ LOC with campaign orchestration logic |
| BUILDER_MANAGER | BuilderManager | Site Building | SHELL | Basic orchestration only |
| COMMERCE_MANAGER | CommerceManager | E-commerce | SHELL | Basic orchestration only |
| OUTREACH_MANAGER | OutreachManager | Email & SMS | SHELL | Basic orchestration only |
| CONTENT_MANAGER | ContentManager | Content Creation | SHELL | Basic orchestration only |
| ARCHITECT_MANAGER | ArchitectManager | Site Architecture | ENHANCED SHELL | 100+ LOC with analysis logic |
| REVENUE_DIRECTOR | RevenueDirector | Sales Ops | ENHANCED SHELL | Functional sales ops orchestration |
| REPUTATION_MANAGER | ReputationManager | Trust & Reviews | SHELL | Basic orchestration only |

> **Note:** "ENHANCED SHELL" managers have substantial internal logic but may not fully delegate to all specialists yet.

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

### API Implementation Notes

The following endpoints have working infrastructure (rate limiting, caching, auth) but use **mock data** for core business logic:

| Endpoint | Issue | Priority |
|----------|-------|----------|
| `/api/coaching/team` | Team member query returns hardcoded IDs | HIGH |
| `/api/crm/deals/[dealId]/recommendations` | Auth implementation incomplete | MEDIUM |
| `/api/crm/deals/monitor/start` | Monitor lifecycle not fully implemented | LOW |
| `/api/webhooks/gmail` | Auto-meeting booking has TODO | LOW |
| `/api/admin/social/post` | Dev mode returns fake success | LOW |
| `/api/voice/twiml` | Audio fallback uses placeholder URL | LOW |

---

## Infrastructure Systems

> **Audit Note (January 27, 2026):** These systems are fully implemented but were previously undocumented.

### Rate Limiting

**Implementation:** In-memory rate limiting with configurable windows per endpoint.

| Endpoint Category | Limit | Window | File |
|-------------------|-------|--------|------|
| Health endpoints | 10 req | 60s | `src/lib/rate-limit/rate-limiter.ts` |
| Billing webhooks | 100 req | 60s | `/api/billing/webhook/route.ts` |
| Coaching/team | 20 req | 60s | `/api/coaching/team/route.ts` |
| Lead routing | 10 req | 60s | `/api/routing/route-lead/route.ts` |
| Notifications | 50 req | 60s | `/api/notifications/send/route.ts` |

**Response:** HTTP 429 with `Retry-After` header when limit exceeded.

### Notification System

**Location:** `src/lib/notifications/notification-service.ts`

| Feature | Description |
|---------|-------------|
| **Multi-Channel** | Slack, Email, Webhook, In-App |
| **Templates** | Template-based notification content |
| **Preferences** | User preference respect (quiet hours, channels, categories) |
| **Retry Logic** | Exponential backoff with configurable retries |
| **Smart Batching** | Batches notifications for efficiency |
| **Delivery Tracking** | Analytics for sent/delivered/failed |

**API Endpoints:**
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/list` - List notifications
- `GET/PUT /api/notifications/preferences` - Manage preferences

### Background Processing

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/cron/scheduled-publisher` | CRON_SECRET env var | Scheduled content publishing |

**Note:** Vercel cron jobs can trigger this endpoint on a schedule.

### Response Caching

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| `/api/coaching/team` | 1 hour | `team-insights-{teamId}-{period}` |

**Implementation:** In-memory cache with automatic TTL expiration.

### Lead Routing System (FUNCTIONAL)

**Location:** `src/app/api/routing/route-lead/route.ts`, `src/lib/crm/lead-routing.ts`

**Status:** PRODUCTION - Fully implemented with Firestore-backed routing rules

**Algorithm:** Priority-based rule evaluation with configurable strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Round Robin** | Cycles through assigned users sequentially | Fair distribution |
| **Territory** | Routes by state/country/industry match | Geographic assignment |
| **Skill-based** | Matches lead language to rep skills | Specialized handling |
| **Load Balance** | Assigns to rep with lowest workload | Capacity optimization |
| **Default** | Round-robin across active org members | Fallback when no rules match |

**Process Flow:**
1. Authenticate via `requireOrganization` (Bearer token)
2. Verify `canAssignRecords` permission (RBAC)
3. Fetch lead from Firestore (`organizations/{orgId}/workspaces/{workspaceId}/entities/leads/records`)
4. Evaluate routing rules by priority (`organizations/{orgId}/leadRoutingRules`)
5. Apply matching strategy (round-robin → territory → skill → load-balance)
6. Update `lead.ownerId` with assigned rep
7. Create audit log entry via `logStatusChange()`
8. Emit `lead.routed` signal to Signal Bus

**Rate Limiting:** 10 requests/minute per organization+lead combination

**Required Permission:** `canAssignRecords` (available to: platform_admin, owner, admin, manager)

**Routing Rules Collection Schema:**
```typescript
{
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  priority: number;  // Higher = evaluated first
  routingType: 'round-robin' | 'territory' | 'skill-based' | 'load-balance' | 'custom';
  assignedUsers: string[];  // User IDs eligible for assignment
  conditions?: RoutingCondition[];
  metadata?: {
    territories?: { userId, states?, countries?, industries? }[];
    skills?: { userId, skills[] }[];
    maxLeadsPerUser?: number;
    balancingPeriod?: 'day' | 'week' | 'month';
  };
}
```

### Error Tracking & Logging

**Location:** `src/lib/logger/logger.ts`, `src/lib/logging/api-logger.ts`

- Structured logging with context (file, function, metadata)
- Error tracking with stack traces
- Logger instance passed to every API endpoint
- Activity logging for CRM operations (`src/lib/crm/activity-logger.ts`)

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
**Dynamic Theming Enabled:** January 27, 2026 - Hardcoded hex colors replaced with CSS variables

> **IMPORTANT:** The "Unified Dashboard" logic has been SCRAPPED for the client view.
> The legacy client navigation with 11 operational sections has been restored.
> System tools are now HARD-GATED and isolated from the standard client navigation array.

#### Current Implementation (DUAL-LAYOUT ARCHITECTURE)

| Component | Location | Used By | Status |
|-----------|----------|---------|--------|
| **Workspace Layout** | `src/app/workspace/[orgId]/layout.tsx` | Client Routes | ACTIVE - Built-in adaptive sidebar |
| **useFeatureVisibility** | `src/hooks/useFeatureVisibility.ts` | Workspace Layout | ACTIVE - Client-specific navigation |
| **buildNavigationStructure** | `src/lib/orchestrator/feature-toggle-service.ts` | useFeatureVisibility | ACTIVE - 11 client sections |
| **UnifiedSidebar** | `src/components/dashboard/UnifiedSidebar.tsx` | Admin Layout | ACTIVE - Uses `getNavigationForRole()` |
| **Navigation Config** | `src/components/dashboard/navigation-config.ts` | UnifiedSidebar | ACTIVE - Hard-gated System section |

#### Navigation Architecture

**Client Routes (`/workspace/[orgId]/*`):**
- Uses built-in adaptive sidebar in workspace layout
- Navigation from `buildNavigationStructure()` in feature-toggle-service.ts
- 11 sections, NO System tools
- Dark theme with emoji icons

**Admin Routes (`/admin/*`):**
- Uses UnifiedSidebar component
- Navigation from `getNavigationForRole()` in navigation-config.ts
- Hard-gated System section for platform_admin only

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

#### Key Finding: Dual-Layout Navigation System

**Investigation Result (January 27, 2026 Restoration):** The codebase uses **separate navigation systems** for client vs admin:

1. **Client Routes** (`/workspace/[orgId]/*`) use a **built-in sidebar** in the workspace layout
   - Navigation from `buildNavigationStructure()` with 11 sections
   - `useFeatureVisibility` hook for adaptive per-org feature toggling
   - **Dynamic theming via CSS variables** (replaces hardcoded hex colors as of 1/27/2026):
     - `var(--color-bg-main)` - Main background (was #000000)
     - `var(--color-bg-paper)` - Sidebar/header background (was #0a0a0a)
     - `var(--color-bg-elevated)` - Elevated surfaces like active nav items (was #1a1a1a)
     - `var(--color-border-main)` - Border colors (was #1a1a1a)
   - Emoji icons, section dividers
   - NO System tools (Audit Logs, Feature Flags, etc.) - completely absent

2. **Admin Routes** (`/admin/*`) use `UnifiedSidebar` component
   - Navigation from `getNavigationForRole()` with hard-gated System section
   - Platform admin sees all 12 sections including System tools

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

### Theme Architecture (INDEPENDENT PIPELINES)

**Isolation Implemented:** January 27, 2026

The Admin UI and Client UI now have **completely independent theme-variable pipelines**. This ensures that organization-specific theme customizations in the Client Workspace do NOT affect the Admin Dashboard, and vice versa.

#### Theme Pipeline Comparison

| Aspect | Admin Dashboard | Client Workspace |
|--------|-----------------|------------------|
| **Hook** | `useAdminTheme()` | `useOrgTheme()` |
| **Source** | Platform-level Firestore (`platform_settings/adminTheme`) | Org-level Firestore (`organizations/{orgId}/themes/default`) |
| **Scope** | `.admin-theme-scope` container class | `document.documentElement` |
| **Variable Prefix** | `--admin-color-*` (with standard override) | `--color-*` |
| **Isolation** | CSS cascading via scoped container | Global application |

#### How Isolation Works

1. **Client Workspace** (`/workspace/[orgId]/*`):
   - `useOrgTheme()` loads organization-specific theme from Firestore
   - Applies CSS variables to `document.documentElement` (root level)
   - Each organization can have different colors, fonts, branding

2. **Admin Dashboard** (`/admin/*`):
   - `useAdminTheme()` loads platform-level theme settings
   - Applies CSS variables to a **scoped container** with class `.admin-theme-scope`
   - Admin layout wraps all content in this scoped container
   - Standard CSS variables (`--color-*`) are **overridden within the scope**
   - This means even if `useOrgTheme` modifies root variables, Admin is unaffected

#### CSS Variable Hierarchy

```css
/* Root level (globals.css) - Base defaults */
:root {
  --color-primary: #6366f1;
  --admin-color-primary: #6366f1;  /* Admin-specific fallbacks */
  ...
}

/* Client themes modify :root via useOrgTheme() */
document.documentElement.style.setProperty('--color-primary', orgTheme.primary);

/* Admin scope overrides (cascading) */
.admin-theme-scope {
  --color-primary: var(--admin-color-primary);  /* Ignores root changes */
  ...
}
```

#### Theme Files

| File | Purpose |
|------|---------|
| `src/hooks/useAdminTheme.ts` | Admin theme hook - scoped application |
| `src/hooks/useOrgTheme.ts` | Client theme hook - root application |
| `src/app/globals.css` | Base variables + Admin scope class |
| `src/app/admin/layout.tsx` | Applies `.admin-theme-scope` container |
| `src/app/workspace/[orgId]/settings/theme/page.tsx` | **Org Theme Editor** (UI exists) |

> **Note:** The **Admin Theme Editor UI does NOT exist** yet. Admin themes can only be modified via direct Firestore writes to `platform_settings/adminTheme`. The Org Theme Editor at `/workspace/[orgId]/settings/theme` is fully functional.

#### Admin Sidebar Dynamic Styling (January 27, 2026)

The `UnifiedSidebar.tsx` component now features **100% reactive theming** via CSS variables:

**Active State Highlights:**
- 3px solid left border using `var(--color-primary)` on active navigation items
- Background uses `var(--color-bg-elevated)` for active items
- Smooth transitions on all theme-reactive elements

**Lucide SVG Iconography:**
- Active items: Icons colored with `text-[var(--color-primary)]`
- Inactive items: Icons colored with `text-[var(--color-text-secondary)]`
- Section icons: Dynamically colored based on whether section contains active item
- Hover states: Icons transition to primary color on hover

**Implementation Pattern:**
```tsx
// Dynamic icon color tied to theme variables
const iconColorClass = isActive
  ? "text-[var(--color-primary)]"
  : "text-[var(--color-text-secondary)]";

<Icon className={`w-5 h-5 transition-colors ${iconColorClass}`} />
```

**Reactivity:** Changes made in the Admin Theme Editor (`platform_settings/adminTheme` in Firestore) reflect immediately in the sidebar without requiring a page reload, as CSS variables are applied via `useAdminTheme()` hook to the `.admin-theme-scope` container.

#### Verification Test

To verify isolation:
1. Navigate to `/workspace/{orgId}/settings/theme`
2. Change the organization's primary color to red (`#ff0000`)
3. Navigate to `/admin/*`
4. Confirm Admin sidebar remains purple/indigo (`#6366f1`)

The Admin UI will NOT be affected by organization theme changes.

### State Management Architecture

The platform uses a **layered state management** approach:

| Layer | Technology | Scope | Persistence |
|-------|------------|-------|-------------|
| Component UI | `useState`, `useMemo` | Component | None |
| App-wide Auth | `useUnifiedAuth()` hook | App | Firebase |
| App-wide Theme | `useAdminTheme()`, `useOrgTheme()` | App | Firestore |
| Global UI | Zustand stores | Global | localStorage |
| Route Context | Layout files | Route tree | None |

#### Zustand Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `useOnboardingStore` | `src/lib/stores/onboarding-store.ts` | Multi-step onboarding flow |
| `useOrchestratorStore` | `src/lib/stores/orchestrator-store.ts` | AI assistant UI state |
| `usePendingMerchantStore` | `src/lib/stores/pending-merchants-store.ts` | Lead capture & abandonment tracking |

#### Sidebar Reactivity Pattern

UnifiedSidebar achieves reactivity through:
1. **Memoized navigation filtering:** `useMemo(() => getNavigationForRole(user.role), [user.role])`
2. **Path-based active state:** `usePathname()` from Next.js
3. **CSS variable injection:** Theme changes via `container.style.setProperty()` update instantly
4. **React.memo sub-components:** Prevents unnecessary re-renders

### Agent Communication

Agents communicate via **TenantMemoryVault**:
- Cross-agent memory sharing
- Signal broadcasting
- Insight sharing
- Location: `src/lib/agents/shared/tenant-memory-vault.ts`

### Intelligence Manager - Dynamic Orchestration Engine

**Status:** FUNCTIONAL (January 29, 2026)
**Location:** `src/lib/agents/intelligence/manager.ts`

The Intelligence Manager is the orchestration engine for market intelligence gathering. It coordinates 5 specialist agents with dynamic resolution, parallel execution, and graceful degradation.

#### Orchestration Patterns

| Intent | Specialists Activated | Use Case |
|--------|----------------------|----------|
| `FULL_MARKET_RESEARCH` | All 5 specialists | Complete market analysis |
| `COMPETITOR_ANALYSIS` | COMPETITOR_ANALYST, TECHNOGRAPHIC_SCOUT | Competitive landscape |
| `BRAND_MONITORING` | SENTIMENT_ANALYST, TREND_SCOUT | Brand health tracking |
| `TECH_DISCOVERY` | TECHNOGRAPHIC_SCOUT, SCRAPER_SPECIALIST | Technology stack analysis |
| `TREND_ANALYSIS` | TREND_SCOUT, SENTIMENT_ANALYST | Market signal detection |
| `COMPANY_PROFILE` | SCRAPER_SPECIALIST, COMPETITOR_ANALYST | Company profiling |
| `SINGLE_SPECIALIST` | (Delegation rules) | Targeted single-specialist query |

#### Execution Flow

```
1. Parse Request → Detect Intent from payload keywords
   ↓
2. Resolve Specialists → Dynamic lookup from SwarmRegistry
   ↓
3. Parallel Execution → Promise.allSettled() for isolation
   ↓
4. Graceful Degradation → Partial results on specialist failure
   ↓
5. Synthesize Brief → Aggregate into IntelligenceBrief
   ↓
6. Store in Vault → Share insights via TenantMemoryVault
```

#### IntelligenceBrief Output Structure

```typescript
{
  briefId: string;
  request: IntelligenceRequest;
  competitorAnalysis: { competitors, marketInsights, confidence } | null;
  sentimentAnalysis: { overallSentiment, brandHealth, alerts, confidence } | null;
  technographicAnalysis: { techStack, platforms, summary, confidence } | null;
  trendAnalysis: { signals, forecasts, pivotRecommendations, confidence } | null;
  companyProfile: { keyFindings, contactInfo, businessSignals, confidence } | null;
  synthesis: {
    executiveSummary: string;
    keyFindings: string[];
    opportunities: string[];
    threats: string[];
    recommendedActions: string[];
    overallConfidence: number;
  };
  execution: {
    totalSpecialists: number;
    successfulSpecialists: number;
    failedSpecialists: number;
    skippedSpecialists: number;
    totalExecutionTimeMs: number;
  };
  errors: string[];
}
```

#### Key Features

| Feature | Implementation |
|---------|----------------|
| **Dynamic Resolution** | Specialists resolved from SwarmRegistry at runtime, not hard-coded |
| **Parallel Execution** | All specialists execute via `Promise.allSettled()` |
| **Graceful Degradation** | Returns partial results if some specialists fail |
| **Intent Detection** | Keyword-based intent mapping + explicit intent parameter |
| **Contextual Synthesis** | Weighted confidence scoring, contradiction detection |
| **Vault Integration** | Stores insights and broadcasts signals to TenantMemoryVault |

---

## Data Contracts Reference

### Core Type Definitions

| Type | Location | Purpose |
|------|----------|---------|
| `UnifiedUser` | `src/types/unified-rbac.ts` | Authenticated user with role, tenantId, permissions |
| `UnifiedPermissions` | `src/types/unified-rbac.ts` | 47 permission flags per role |
| `AccountRole` | `src/types/unified-rbac.ts` | `'platform_admin' \| 'owner' \| 'admin' \| 'manager' \| 'employee'` |
| `Organization` | `src/types/organization.ts` | Tenant definition with plan, branding, settings |
| `Lead` | `src/types/crm-entities.ts` | CRM lead with scoring, enrichment |
| `Deal` | `src/types/crm-entities.ts` | CRM deal with stage history, value |
| `Contact` | `src/types/crm-entities.ts` | CRM contact with address, social |
| `Schema` | `src/types/schema.ts` | Custom entity schema definition |
| `AdminThemeConfig` | `src/hooks/useAdminTheme.ts` | Admin theme colors, branding |
| `ThemeConfig` | `src/types/theme.ts` | Full theme with typography, layout |

### Zod Validation Schemas

| Schema | Location | Purpose |
|--------|----------|---------|
| `emailSendSchema` | `src/lib/validation/schemas.ts` | Email delivery request validation |
| `leadScoringSchema` | `src/lib/validation/schemas.ts` | Lead scoring API input |
| `CreateWorkflowSchema` | `src/lib/workflow/validation.ts` | Workflow creation validation |
| `AnalyticsRequestSchema` | `src/lib/analytics/dashboard/validation.ts` | Analytics query parameters |
| `sequenceStepSchema` | `src/lib/sequence/validation.ts` | Email sequence step definition |
| `TriggerConditionSchema` | `src/lib/workflow/validation.ts` | Workflow trigger conditions |

### Key Interfaces

```typescript
// Core user type
interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  tenantId: string | null;  // null for platform_admin
  workspaceId?: string;
  status: 'active' | 'suspended' | 'pending';
  mfaEnabled: boolean;
}

// Theme configuration
interface AdminThemeConfig {
  colors: {
    primary: { main: string; light: string; dark: string; contrast: string };
    secondary: { main: string; light: string; dark: string; contrast: string };
    background: { main: string; paper: string; elevated: string };
    text: { primary: string; secondary: string; disabled: string };
    border: { main: string; light: string; strong: string };
  };
  branding: { platformName: string; logoUrl: string; primaryColor: string };
}
```

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
*Last updated: January 27, 2026 - Deep-Dive Forensic Audit*

### Changelog (January 29, 2026 - Intelligence Manager Implementation)

- **MAJOR:** INTELLIGENCE_MANAGER upgraded from SHELL to FUNCTIONAL
- **Added:** Dynamic orchestration engine with parallel specialist execution
- **Added:** IntelligenceBrief synthesis output structure
- **Added:** 7 orchestration patterns (FULL_MARKET_RESEARCH, COMPETITOR_ANALYSIS, etc.)
- **Added:** Graceful degradation for partial specialist failures
- **Added:** TenantMemoryVault integration for cross-agent insights
- **Updated:** Agent counts (36 FUNCTIONAL, 3 ENHANCED SHELL, 5 SHELL)
- **Added:** Intelligence Manager documentation in Architecture Notes

### Changelog (January 27, 2026 - Forensic Audit)

- **Added:** Infrastructure Systems section (Rate Limiting, Notifications, Caching, Logging)
- **Added:** Data Contracts Reference section (TypeScript interfaces, Zod schemas)
- **Added:** State Management Architecture subsection
- **Added:** API Implementation Notes (endpoints with mock data identified)
- **Updated:** Agent Registry with accurate manager statuses (3 ENHANCED SHELL, 6 SHELL)
- **Updated:** Platform Statistics to reflect partial endpoint implementations
- **Fixed:** Theme Architecture to note Admin Theme Editor UI does not exist
- **Fixed:** Firestore path for Admin theme (`platform_settings/adminTheme` not `platform_config/settings/adminTheme`)
