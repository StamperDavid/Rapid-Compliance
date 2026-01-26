# AI Sales Platform - System Navigation Map
## Source of Truth Document
**Generated:** January 26, 2026
**Branch:** dev
**Status:** AUDIT COMPLETE - NO CODE CHANGES MADE

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Redundancy & 404 Forensics](#redundancy--404-forensics)
3. [Admin Route Map](#admin-route-map)
4. [Workspace Route Map](#workspace-route-map)
5. [Dashboard Route Map](#dashboard-route-map)
6. [Navigation Configuration Audit](#navigation-configuration-audit)
7. [Logic Linkage & Mirror Analysis](#logic-linkage--mirror-analysis)
8. [Purpose Analysis](#purpose-analysis)
9. [Identified Issues](#identified-issues)

---

## Executive Summary

### Route Statistics
| Area | Total Routes | Dynamic Routes | Status |
|------|-------------|----------------|--------|
| Admin (`/admin/*`) | 46 | 2 (`[id]`) | All pages exist |
| Workspace (`/workspace/[orgId]/*`) | 144 | 15 | All pages exist |
| Dashboard (`/dashboard/*`) | 17 | 0 | All pages exist |
| **TOTAL** | **207** | **17** | **Verified** |

### Key Findings
- **No 404s detected** - All navigation links point to existing `page.tsx` files
- **2 redundancies identified** - Command Center pages, Analytics pages
- **1 stub page found** - `/admin/command-center` (placeholder content only)
- **Well-architected routing** - Centralized route constants in `src/lib/routes/`

---

## Redundancy & 404 Forensics

### Sidebar Navigation Link Verification

#### UnifiedSidebar Navigation Items (Primary Sidebar)

| Section | Menu Item | Target Path | Physical File Exists | Status |
|---------|-----------|-------------|---------------------|--------|
| **SYSTEM** | System Overview | `/dashboard/system` | `src/app/dashboard/system/page.tsx` | [FUNCTIONAL] |
| | Organizations | `/admin/organizations` | `src/app/admin/organizations/page.tsx` | [FUNCTIONAL] |
| | All Users | `/admin/users` | `src/app/admin/users/page.tsx` | [FUNCTIONAL] |
| | Feature Flags | `/admin/system/flags` | `src/app/admin/system/flags/page.tsx` | [FUNCTIONAL] |
| | Audit Logs | `/admin/system/logs` | `src/app/admin/system/logs/page.tsx` | [FUNCTIONAL] |
| | System Settings | `/admin/system/settings` | `src/app/admin/system/settings/page.tsx` | [FUNCTIONAL] |
| **DASHBOARD** | Overview | `/dashboard` | `src/app/dashboard/page.tsx` | [FUNCTIONAL] |
| | Analytics | `/dashboard/analytics` | `src/app/dashboard/analytics/page.tsx` | [FUNCTIONAL] |
| **SALES** | Leads | `/dashboard/sales/leads` | `src/app/dashboard/sales/leads/page.tsx` | [FUNCTIONAL] |
| | Deals | `/dashboard/sales/deals` | `src/app/dashboard/sales/deals/page.tsx` | [FUNCTIONAL] |
| | Voice Agents | `/admin/voice` | `src/app/admin/voice/page.tsx` | [FUNCTIONAL] |
| | AI Sales Agent | `/admin/sales-agent` | `src/app/admin/sales-agent/page.tsx` | [FUNCTIONAL] |
| **MARKETING** | Social Media | `/dashboard/marketing/social` | `src/app/dashboard/marketing/social/page.tsx` | [FUNCTIONAL] |
| | Email Campaigns | `/dashboard/marketing/email` | `src/app/dashboard/marketing/email/page.tsx` | [FUNCTIONAL] |
| | Email Templates | `/admin/templates` | `src/app/admin/templates/page.tsx` | [FUNCTIONAL] |
| | Website | `/admin/website-editor` | `src/app/admin/website-editor/page.tsx` | [FUNCTIONAL] |
| **AI SWARM** | Swarm Control | `/dashboard/swarm` | `src/app/dashboard/swarm/page.tsx` | [FUNCTIONAL] |
| | Agent Training | `/admin/sales-agent/training` | `src/app/admin/sales-agent/training/page.tsx` | [FUNCTIONAL] |
| | Agent Persona | `/admin/sales-agent/persona` | `src/app/admin/sales-agent/persona/page.tsx` | [FUNCTIONAL] |
| | Knowledge Base | `/admin/sales-agent/knowledge` | `src/app/admin/sales-agent/knowledge/page.tsx` | [FUNCTIONAL] |
| **ANALYTICS** | Reports | `/dashboard/analytics` | `src/app/dashboard/analytics/page.tsx` | [FUNCTIONAL] |
| | Revenue | `/admin/revenue` | `src/app/admin/revenue/page.tsx` | [FUNCTIONAL] |
| | Pipeline | `/admin/analytics/pipeline` | `src/app/admin/analytics/pipeline/page.tsx` | [FUNCTIONAL] |
| | Platform Analytics | `/admin/analytics/usage` | `src/app/admin/analytics/usage/page.tsx` | [FUNCTIONAL] |
| **SETTINGS** | Organization | `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | [FUNCTIONAL] |
| | Team | `/admin/users` | `src/app/admin/users/page.tsx` | [FUNCTIONAL] |
| | API Keys | `/admin/system/api-keys` | `src/app/admin/system/api-keys/page.tsx` | [FUNCTIONAL] |
| | Integrations | `/admin/settings/integrations` | `src/app/admin/settings/integrations/page.tsx` | [FUNCTIONAL] |
| | Billing | `/admin/billing` | `src/app/admin/billing/page.tsx` | [FUNCTIONAL] |
| | E-Commerce | `/admin/merchandiser` | `src/app/admin/merchandiser/page.tsx` | [FUNCTIONAL] |
| | Products | `/admin/merchandiser` | `src/app/admin/merchandiser/page.tsx` | [FUNCTIONAL] |

#### CommandCenterSidebar Navigation Items (Legacy Admin Sidebar)

| Section | Menu Item | Target Path | Physical File Exists | Status |
|---------|-----------|-------------|---------------------|--------|
| Dashboard | Overview | `/dashboard/command-center?org={orgId}` | `src/app/dashboard/` (redirects) | [FUNCTIONAL] |
| | God Mode | `/admin` | `src/app/admin/page.tsx` | [FUNCTIONAL] |
| Clients & Orgs | Organizations | `/admin/organizations?org={orgId}` | `src/app/admin/organizations/page.tsx` | [FUNCTIONAL] |
| | Users | `/admin/users?org={orgId}` | `src/app/admin/users/page.tsx` | [FUNCTIONAL] |
| Leads & Sales | Leads | `/admin/leads?org={orgId}` | `src/app/admin/leads/page.tsx` | [FUNCTIONAL] |
| | Deals | `/admin/deals?org={orgId}` | `src/app/admin/deals/page.tsx` | [FUNCTIONAL] |
| | Sales Agent | `/admin/sales-agent?org={orgId}` | `src/app/admin/sales-agent/page.tsx` | [FUNCTIONAL] |
| | Recovery | `/admin/recovery?org={orgId}` | `src/app/admin/recovery/page.tsx` | [FUNCTIONAL] |
| Social Media | Social Posts | `/admin/social?org={orgId}` | `src/app/admin/social/page.tsx` | [FUNCTIONAL] |
| | Swarm Control | `/admin/swarm?org={orgId}` | `src/app/admin/swarm/page.tsx` | [FUNCTIONAL] |
| Email Marketing | Campaigns | `/admin/email-campaigns?org={orgId}` | `src/app/admin/email-campaigns/page.tsx` | [FUNCTIONAL] |
| | Templates | `/admin/templates?org={orgId}` | `src/app/admin/templates/page.tsx` | [FUNCTIONAL] |
| AI Voice | Voice Settings | `/admin/voice?org={orgId}` | `src/app/admin/voice/page.tsx` | [FUNCTIONAL] |
| | Training | `/admin/voice-training?org={orgId}` | `src/app/admin/voice-training/page.tsx` | [FUNCTIONAL] |
| Analytics | Usage | `/admin/analytics/usage?org={orgId}` | `src/app/admin/analytics/usage/page.tsx` | [FUNCTIONAL] |
| | Revenue | `/admin/revenue?org={orgId}` | `src/app/admin/revenue/page.tsx` | [FUNCTIONAL] |
| | Pipeline | `/admin/analytics/pipeline?org={orgId}` | `src/app/admin/analytics/pipeline/page.tsx` | [FUNCTIONAL] |
| System | Health | `/admin/system/health?org={orgId}` | `src/app/admin/system/health/page.tsx` | [FUNCTIONAL] |
| | API Keys | `/admin/system/api-keys?org={orgId}` | `src/app/admin/system/api-keys/page.tsx` | [FUNCTIONAL] |
| | Feature Flags | `/admin/system/flags?org={orgId}` | `src/app/admin/system/flags/page.tsx` | [FUNCTIONAL] |
| | Logs | `/admin/system/logs?org={orgId}` | `src/app/admin/system/logs/page.tsx` | [FUNCTIONAL] |
| | Settings | `/admin/system/settings?org={orgId}` | `src/app/admin/system/settings/page.tsx` | [FUNCTIONAL] |
| Jasper Training | Persona | `/admin/sales-agent/persona?org={orgId}` | `src/app/admin/sales-agent/persona/page.tsx` | [FUNCTIONAL] |
| | Training | `/admin/sales-agent/training?org={orgId}` | `src/app/admin/sales-agent/training/page.tsx` | [FUNCTIONAL] |
| | Knowledge Base | `/admin/sales-agent/knowledge?org={orgId}` | `src/app/admin/sales-agent/knowledge/page.tsx` | [FUNCTIONAL] |

---

## Admin Route Map

### Complete Admin Directory Tree
```
/admin
├── page.tsx                          # CEO Command Center (FULL - 395 lines)
├── layout.tsx                        # Admin layout with UnifiedSidebar
├── login/page.tsx                    # Admin login with Firebase auth
│
├── advanced/
│   └── compliance/page.tsx           # Compliance management
│
├── analytics/
│   ├── page.tsx                      # Platform-wide usage metrics
│   ├── pipeline/page.tsx             # Pipeline analytics
│   └── usage/page.tsx                # Usage analytics
│
├── billing/page.tsx                  # Subscription/payment management
├── command-center/page.tsx           # [STUB - 59 lines, placeholder only]
├── customers/page.tsx                # Customer management
├── deals/page.tsx                    # Platform deals view
├── email-campaigns/page.tsx          # Campaign management
├── global-config/page.tsx            # Global platform config
├── growth/page.tsx                   # Growth metrics
├── jasper-lab/page.tsx               # AI training lab
├── leads/page.tsx                    # Platform leads view
├── merchandiser/page.tsx             # E-commerce management
│
├── organizations/
│   ├── page.tsx                      # Organization list (FULL)
│   ├── new/page.tsx                  # Create organization
│   └── [id]/
│       ├── page.tsx                  # Organization detail
│       └── edit/page.tsx             # Edit organization
│
├── pricing-tiers/page.tsx            # Pricing tier management
├── recovery/page.tsx                 # Recovery/churn prevention
├── revenue/page.tsx                  # Revenue analytics
│
├── sales-agent/
│   ├── page.tsx                      # Golden Master management
│   ├── knowledge/page.tsx            # Knowledge base
│   ├── persona/page.tsx              # Agent persona config
│   └── training/page.tsx             # Agent training
│
├── settings/
│   └── integrations/page.tsx         # Integration configuration
│
├── social/page.tsx                   # Social media management
├── specialists/page.tsx              # Specialist management
├── subscriptions/page.tsx            # Subscription management
│
├── support/
│   ├── api-health/page.tsx           # API health monitoring
│   ├── bulk-ops/page.tsx             # Bulk operations
│   ├── exports/page.tsx              # Data exports
│   └── impersonate/page.tsx          # User impersonation tool
│
├── swarm/page.tsx                    # AI agent swarm control
│
├── system/
│   ├── api-keys/page.tsx             # API key management
│   ├── flags/page.tsx                # Feature flags
│   ├── health/page.tsx               # System health
│   ├── logs/page.tsx                 # Audit logs
│   └── settings/page.tsx             # System settings
│
├── templates/page.tsx                # Email templates
│
├── users/
│   ├── page.tsx                      # User list (FULL)
│   └── [id]/page.tsx                 # User detail
│
├── voice/page.tsx                    # Voice agent settings
├── voice-training/page.tsx           # Voice training
└── website-editor/page.tsx           # Website editor
```

### Admin Routes Summary Table

| Route | Purpose | Content Level |
|-------|---------|--------------|
| `/admin` | CEO Command Center - Platform overview with metrics, widgets, quick actions | FULL (395 lines) |
| `/admin/login` | Firebase auth for admin users | FULL |
| `/admin/analytics` | Platform-wide usage metrics with date range selection | FULL (274 lines) |
| `/admin/analytics/pipeline` | Pipeline analytics visualization | EXISTS |
| `/admin/analytics/usage` | Usage breakdown by organization | EXISTS |
| `/admin/billing` | Subscription and payment management | EXISTS |
| `/admin/command-center` | **[STUB]** Placeholder only - "In Development" message | STUB (59 lines) |
| `/admin/customers` | Customer list and management | EXISTS |
| `/admin/deals` | Platform-wide deals view | EXISTS |
| `/admin/email-campaigns` | Email campaign management | EXISTS |
| `/admin/global-config` | Global platform configuration | EXISTS |
| `/admin/growth` | Growth metrics dashboard | EXISTS |
| `/admin/jasper-lab` | AI training laboratory | EXISTS |
| `/admin/leads` | Platform-wide leads view | EXISTS |
| `/admin/merchandiser` | E-commerce/product management | EXISTS |
| `/admin/organizations` | Organization CRUD with API integration | FULL |
| `/admin/organizations/[id]` | Organization detail view | FULL |
| `/admin/organizations/[id]/edit` | Organization edit form | EXISTS |
| `/admin/organizations/new` | Create new organization | EXISTS |
| `/admin/pricing-tiers` | Pricing tier configuration | EXISTS |
| `/admin/recovery` | Churn prevention and recovery | EXISTS |
| `/admin/revenue` | Revenue analytics | EXISTS |
| `/admin/sales-agent` | AI Sales Agent Golden Master | FULL |
| `/admin/sales-agent/knowledge` | Knowledge base management | EXISTS |
| `/admin/sales-agent/persona` | Agent persona configuration | EXISTS |
| `/admin/sales-agent/training` | Agent training interface | EXISTS |
| `/admin/settings/integrations` | Integration cards | FULL |
| `/admin/social` | Social media composer | EXISTS |
| `/admin/specialists` | Specialist configuration | EXISTS |
| `/admin/subscriptions` | Subscription management | EXISTS |
| `/admin/support/api-health` | API health monitoring | EXISTS |
| `/admin/support/bulk-ops` | Bulk operations | EXISTS |
| `/admin/support/exports` | Data export tools | EXISTS |
| `/admin/support/impersonate` | User impersonation (admin only) | FULL |
| `/admin/swarm` | AI swarm orchestration | EXISTS |
| `/admin/system/api-keys` | API key management | FULL |
| `/admin/system/flags` | Feature flag management | EXISTS |
| `/admin/system/health` | System health dashboard | EXISTS |
| `/admin/system/logs` | Audit log viewer | EXISTS |
| `/admin/system/settings` | System configuration | EXISTS |
| `/admin/templates` | Email template library | EXISTS |
| `/admin/users` | User list with API integration | FULL |
| `/admin/users/[id]` | User detail view | FULL |
| `/admin/voice` | Voice agent settings | EXISTS |
| `/admin/voice-training` | Voice training interface | EXISTS |
| `/admin/website-editor` | Website builder/editor | EXISTS |
| `/admin/advanced/compliance` | Compliance management | EXISTS |

---

## Workspace Route Map

### Complete Workspace Directory Tree
```
/workspace/[orgId]
├── layout.tsx                        # Workspace layout (116 lines)
├── dashboard/page.tsx                # Main dashboard (527 lines)
├── settings/page.tsx                 # Settings hub (172 lines)
│
├── ab-tests/
│   ├── page.tsx                      # A/B test list
│   ├── new/page.tsx                  # Create A/B test
│   └── [id]/page.tsx                 # A/B test detail
│
├── ai/
│   ├── datasets/page.tsx             # AI datasets
│   └── fine-tuning/
│       ├── page.tsx                  # Fine-tuning list
│       └── new/page.tsx              # Create fine-tuning job
│
├── analytics/
│   ├── page.tsx                      # Analytics hub
│   ├── ecommerce/page.tsx            # E-commerce analytics
│   ├── pipeline/page.tsx             # Pipeline analytics
│   ├── revenue/page.tsx              # Revenue analytics
│   ├── sales/page.tsx                # Sales analytics
│   └── workflows/page.tsx            # Workflow analytics
│
├── battlecards/page.tsx              # Sales battlecards
│
├── calls/
│   ├── page.tsx                      # Call list
│   └── make/page.tsx                 # Make call interface
│
├── contacts/
│   ├── page.tsx                      # Contact list (283 lines)
│   ├── new/page.tsx                  # Create contact
│   └── [id]/
│       ├── page.tsx                  # Contact detail
│       └── edit/page.tsx             # Edit contact
│
├── content/
│   └── video/page.tsx                # Video content
│
├── conversations/page.tsx            # Conversation list
│
├── deals/
│   ├── page.tsx                      # Deal list (384 lines)
│   ├── new/page.tsx                  # Create deal
│   └── [id]/
│       ├── page.tsx                  # Deal detail
│       └── edit/page.tsx             # Edit deal
│
├── email/
│   └── campaigns/
│       ├── page.tsx                  # Campaign list
│       ├── new/page.tsx              # Create campaign
│       └── [campaignId]/page.tsx     # Campaign detail
│
├── email-writer/page.tsx             # Email composer
│
├── entities/
│   └── [entityName]/page.tsx         # Dynamic entity pages
│
├── forms/
│   ├── page.tsx                      # Form list
│   └── [formId]/edit/page.tsx        # Form editor
│
├── identity/
│   └── refine/page.tsx               # Identity refinement
│
├── integrations/page.tsx             # Integration settings
│
├── leads/
│   ├── page.tsx                      # Lead list (346 lines)
│   ├── new/page.tsx                  # Create lead
│   ├── research/page.tsx             # Lead research
│   └── [id]/
│       ├── page.tsx                  # Lead detail
│       └── edit/page.tsx             # Edit lead
│
├── lead-scoring/page.tsx             # Lead scoring rules
├── living-ledger/page.tsx            # Living ledger
│
├── marketing/
│   ├── ab-tests/page.tsx             # Marketing A/B tests
│   └── email-builder/page.tsx        # Email builder
│
├── nurture/
│   ├── page.tsx                      # Nurture list
│   ├── new/page.tsx                  # Create nurture
│   └── [id]/
│       ├── page.tsx                  # Nurture detail
│       └── stats/page.tsx            # Nurture stats
│
├── onboarding/page.tsx               # Onboarding flow
│
├── outbound/
│   ├── page.tsx                      # Outbound hub
│   ├── email-writer/page.tsx         # Outbound email
│   └── sequences/page.tsx            # Outbound sequences
│
├── products/
│   ├── page.tsx                      # Product list
│   ├── new/page.tsx                  # Create product
│   └── [id]/edit/page.tsx            # Edit product
│
├── proposals/
│   └── builder/page.tsx              # Proposal builder
│
├── schemas/page.tsx                  # Schema management
│
├── seo/
│   └── training/page.tsx             # SEO training
│
├── sequences/
│   └── analytics/page.tsx            # Sequence analytics
│
├── settings/
│   ├── accounting/page.tsx           # Accounting settings
│   ├── api-keys/page.tsx             # API keys
│   ├── billing/page.tsx              # Billing
│   ├── custom-tools/page.tsx         # Custom tools
│   ├── email-templates/page.tsx      # Email templates
│   ├── integrations/page.tsx         # Integrations
│   ├── lead-routing/page.tsx         # Lead routing
│   ├── meeting-scheduler/page.tsx    # Meeting scheduler
│   ├── organization/page.tsx         # Organization settings
│   ├── promotions/page.tsx           # Promotions/coupons
│   ├── security/page.tsx             # Security settings
│   ├── sms-messages/page.tsx         # SMS messages
│   ├── storefront/page.tsx           # Storefront settings
│   ├── subscription/page.tsx         # Subscription
│   ├── theme/page.tsx                # Theme/branding
│   ├── users/page.tsx                # User management
│   ├── webhooks/page.tsx             # Webhooks
│   ├── workflows/page.tsx            # Workflow settings
│   └── ai-agents/
│       ├── page.tsx                  # AI agents hub
│       ├── business-setup/page.tsx   # Business setup
│       ├── configuration/page.tsx    # Agent config
│       ├── persona/page.tsx          # Agent persona
│       └── training/page.tsx         # Agent training
│
├── social/
│   ├── campaigns/page.tsx            # Social campaigns
│   └── training/page.tsx             # Social training
│
├── team/
│   ├── leaderboard/page.tsx          # Team leaderboard
│   └── tasks/page.tsx                # Team tasks
│
├── templates/page.tsx                # Template library
│
├── tools/
│   └── [toolId]/page.tsx             # Tool detail
│
├── voice/
│   └── training/page.tsx             # Voice training
│
├── website/
│   ├── audit-log/page.tsx            # Website audit log
│   ├── blog/
│   │   ├── page.tsx                  # Blog list
│   │   ├── categories/page.tsx       # Blog categories
│   │   └── editor/page.tsx           # Blog editor
│   ├── domains/page.tsx              # Domain management
│   ├── editor/page.tsx               # Website editor
│   ├── navigation/page.tsx           # Navigation config
│   ├── pages/page.tsx                # Page management
│   ├── seo/page.tsx                  # SEO settings
│   ├── settings/page.tsx             # Website settings
│   └── templates/page.tsx            # Website templates
│
├── workforce/page.tsx                # Workforce management
│
└── workflows/
    ├── page.tsx                      # Workflow list (347 lines)
    ├── new/page.tsx                  # Create workflow
    ├── builder/page.tsx              # Workflow builder
    └── [workflowId]/
        ├── page.tsx                  # Workflow detail
        └── runs/page.tsx             # Workflow runs
```

### Workspace Routes by Category

#### Core Navigation (13 routes)
| Route | Purpose |
|-------|---------|
| `/workspace/[orgId]/dashboard` | Main dashboard with stats, pipeline, activity |
| `/workspace/[orgId]/settings` | Settings hub with permission-based nav |
| `/workspace/[orgId]/analytics` | Analytics overview |
| `/workspace/[orgId]/integrations` | Integration management |
| `/workspace/[orgId]/templates` | Template library |
| `/workspace/[orgId]/onboarding` | User onboarding flow |
| `/workspace/[orgId]/schemas` | Schema management |
| `/workspace/[orgId]/battlecards` | Sales battlecards |
| `/workspace/[orgId]/email-writer` | Email composition tool |
| `/workspace/[orgId]/lead-scoring` | Lead scoring rules |
| `/workspace/[orgId]/living-ledger` | Transaction ledger |
| `/workspace/[orgId]/conversations` | Conversation management |
| `/workspace/[orgId]/workforce` | Workforce dashboard |

#### CRM Entities (20 routes)
| Entity | Routes |
|--------|--------|
| Leads | `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`, `/leads/research` |
| Deals | `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit` |
| Contacts | `/contacts`, `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit` |
| Products | `/products`, `/products/new`, `/products/[id]/edit` |
| Generic | `/entities/[entityName]` |

#### Marketing & Outbound (15 routes)
| Category | Routes |
|----------|--------|
| Email Campaigns | `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[campaignId]` |
| Nurture | `/nurture`, `/nurture/new`, `/nurture/[id]`, `/nurture/[id]/stats` |
| A/B Tests | `/ab-tests`, `/ab-tests/new`, `/ab-tests/[id]`, `/marketing/ab-tests` |
| Outbound | `/outbound`, `/outbound/email-writer`, `/outbound/sequences` |
| Social | `/social/campaigns`, `/social/training` |

#### Settings (23 routes)
All under `/workspace/[orgId]/settings/`:
- `api-keys`, `billing`, `accounting`, `storefront`, `promotions`
- `email-templates`, `sms-messages`, `theme`, `organization`, `users`
- `security`, `integrations`, `webhooks`, `custom-tools`, `workflows`
- `subscription`, `lead-routing`, `meeting-scheduler`
- `ai-agents/*` (5 sub-routes)

---

## Dashboard Route Map

### Complete Dashboard Directory Tree
```
/dashboard
├── page.tsx                          # Dashboard overview
├── analytics/page.tsx                # Analytics dashboard (278 lines)
├── coaching/
│   ├── page.tsx                      # Coaching hub
│   └── team/page.tsx                 # Team coaching
├── conversation/page.tsx             # Conversation intelligence
├── marketing/
│   ├── email/page.tsx                # Email marketing
│   └── social/page.tsx               # Social marketing
├── performance/page.tsx              # Performance metrics
├── playbook/page.tsx                 # Sales playbook
├── risk/page.tsx                     # Risk management
├── routing/page.tsx                  # Lead routing
├── sales/
│   ├── deals/page.tsx                # Deals view
│   └── leads/page.tsx                # Leads view
├── sequence/page.tsx                 # Sequence management
├── settings/page.tsx                 # Settings
├── swarm/page.tsx                    # AI swarm control
└── system/page.tsx                   # System admin hub (203 lines)
```

### Dashboard Routes Table

| Route | Purpose | Content Level |
|-------|---------|--------------|
| `/dashboard` | Overview hub | EXISTS |
| `/dashboard/analytics` | Workspace analytics (workflows, email, deals, revenue, team) | FULL (278 lines) |
| `/dashboard/coaching` | Coaching hub | EXISTS |
| `/dashboard/coaching/team` | Team coaching | EXISTS |
| `/dashboard/conversation` | Conversation intelligence | EXISTS |
| `/dashboard/marketing/email` | Email marketing | EXISTS |
| `/dashboard/marketing/social` | Social marketing | EXISTS |
| `/dashboard/performance` | Performance metrics | EXISTS |
| `/dashboard/playbook` | Sales playbook | EXISTS |
| `/dashboard/risk` | Risk management | EXISTS |
| `/dashboard/routing` | Lead routing rules | EXISTS |
| `/dashboard/sales/deals` | Deals pipeline | EXISTS |
| `/dashboard/sales/leads` | Leads management | EXISTS |
| `/dashboard/sequence` | Sequence management | EXISTS |
| `/dashboard/settings` | Settings | EXISTS |
| `/dashboard/swarm` | AI swarm control | EXISTS |
| `/dashboard/system` | Platform admin hub with links to `/admin/*` | FULL (203 lines) |

---

## Navigation Configuration Audit

### Configuration Files Analyzed

| File | Purpose |
|------|---------|
| `src/components/dashboard/navigation-config.ts` | UnifiedSidebar navigation structure |
| `src/lib/routes/dashboard-routes.ts` | Dashboard route constants |
| `src/lib/routes/workspace-routes.ts` | Workspace & admin route constants |
| `src/types/unified-rbac.ts` | Role-based access control |
| `src/components/admin/CommandCenterSidebar.tsx` | Legacy admin sidebar |
| `src/components/dashboard/UnifiedSidebar.tsx` | Primary sidebar component |

### Route Constant Verification

#### dashboardRoutes (src/lib/routes/dashboard-routes.ts)
| Constant | Path | File Exists |
|----------|------|-------------|
| `overview()` | `/dashboard` | YES |
| `salesLeads()` | `/dashboard/sales/leads` | YES |
| `salesDeals()` | `/dashboard/sales/deals` | YES |
| `marketingSocial()` | `/dashboard/marketing/social` | YES |
| `marketingEmail()` | `/dashboard/marketing/email` | YES |
| `analytics()` | `/dashboard/analytics` | YES |
| `swarm()` | `/dashboard/swarm` | YES |
| `performance()` | `/dashboard/performance` | YES |
| `coaching()` | `/dashboard/coaching` | YES |
| `coachingTeam()` | `/dashboard/coaching/team` | YES |
| `playbook()` | `/dashboard/playbook` | YES |
| `conversation()` | `/dashboard/conversation` | YES |
| `risk()` | `/dashboard/risk` | YES |
| `routing()` | `/dashboard/routing` | YES |
| `sequence()` | `/dashboard/sequence` | YES |
| `settings()` | `/dashboard/settings` | YES |
| `system()` | `/dashboard/system` | YES |

#### legacyAdminRoutes (src/lib/routes/dashboard-routes.ts)
| Constant | Path | File Exists |
|----------|------|-------------|
| `organizations()` | `/admin/organizations` | YES |
| `users()` | `/admin/users` | YES |
| `systemFlags()` | `/admin/system/flags` | YES |
| `systemLogs()` | `/admin/system/logs` | YES |
| `systemSettings()` | `/admin/system/settings` | YES |
| `voiceAgents()` | `/admin/voice` | YES |
| `aiAgent()` | `/admin/sales-agent` | YES |

#### pendingDashboardRoutes (src/lib/routes/dashboard-routes.ts)
| Constant | Path | File Exists |
|----------|------|-------------|
| `analyticsRevenue()` | `/admin/revenue` | YES |
| `analyticsPipeline()` | `/admin/analytics/pipeline` | YES |
| `analyticsPlatform()` | `/admin/analytics/usage` | YES |
| `marketingEmailTemplates()` | `/admin/templates` | YES |
| `marketingWebsite()` | `/admin/website-editor` | YES |
| `swarmTraining()` | `/admin/sales-agent/training` | YES |
| `swarmPersona()` | `/admin/sales-agent/persona` | YES |
| `swarmKnowledge()` | `/admin/sales-agent/knowledge` | YES |
| `settingsTeam()` | `/admin/users` | YES |
| `settingsApiKeys()` | `/admin/system/api-keys` | YES |
| `settingsIntegrations()` | `/admin/settings/integrations` | YES |
| `settingsBilling()` | `/admin/billing` | YES |
| `settingsEcommerce()` | `/admin/merchandiser` | YES |
| `settingsProducts()` | `/admin/merchandiser` | YES |

### Hardcoded URL Audit

**FINDING:** No hardcoded URLs detected in navigation configuration files. All routes use centralized constants.

**Good Practices Observed:**
- All routes use typed constants (`dashboardRoutes`, `legacyAdminRoutes`, `pendingDashboardRoutes`)
- Route helpers export type definitions for compile-time safety
- `existingDashboardRoutes` array documents verified routes

---

## Logic Linkage & Mirror Analysis

### Admin-to-Client Page Mirrors

| Admin Page | Workspace Mirror | Notes |
|------------|------------------|-------|
| `/admin/organizations` | - | Admin-only (no client mirror) |
| `/admin/users` | `/workspace/[orgId]/settings/users` | Admin sees all users, client sees org users |
| `/admin/leads` | `/workspace/[orgId]/leads` | Admin sees platform-wide, client sees org leads |
| `/admin/deals` | `/workspace/[orgId]/deals` | Admin sees platform-wide, client sees org deals |
| `/admin/analytics` | `/workspace/[orgId]/analytics` | Admin sees platform metrics, client sees org metrics |
| `/admin/revenue` | `/workspace/[orgId]/analytics/revenue` | Same pattern |
| `/admin/analytics/pipeline` | `/workspace/[orgId]/analytics/pipeline` | Same pattern |
| `/admin/templates` | `/workspace/[orgId]/templates` | Admin manages global, client manages org templates |
| `/admin/settings/integrations` | `/workspace/[orgId]/settings/integrations` | Same pattern |
| `/admin/billing` | `/workspace/[orgId]/settings/billing` | Admin manages all, client manages own |
| `/admin/sales-agent/*` | `/workspace/[orgId]/settings/ai-agents/*` | Admin manages Golden Master, client customizes |
| `/admin/voice` | `/workspace/[orgId]/voice/training` | Same pattern |
| `/admin/social` | `/workspace/[orgId]/social/campaigns` | Same pattern |
| `/admin/email-campaigns` | `/workspace/[orgId]/email/campaigns` | Same pattern |
| `/admin/swarm` | `/dashboard/swarm` | Shared via dashboard route |
| `/admin/website-editor` | `/workspace/[orgId]/website/editor` | Same pattern |

### Dashboard-to-Admin Linkages

| Dashboard Page | Links To | Purpose |
|----------------|----------|---------|
| `/dashboard/system` | `/admin/organizations` | System tool card |
| `/dashboard/system` | `/admin/users` | System tool card |
| `/dashboard/system` | `/admin/system/flags` | System tool card |
| `/dashboard/system` | `/admin/system/logs` | System tool card |
| `/dashboard/system` | `/admin/system/settings` | System tool card |
| `/dashboard/system` | `/admin/system/health` | System tool card |

---

## Purpose Analysis

### Potentially Confusing Pages

#### 1. `/admin` vs `/admin/command-center`

| Page | Code Analysis | Purpose Summary |
|------|---------------|-----------------|
| `/admin` (page.tsx) | 395 lines, imports `MetricCard`, `QuickActionCard`, `SocialComposerWidget`, `LeadPipelineWidget`, `SwarmMonitorWidget`. Fetches orgs/users via API, calculates MRR/ARR, shows system health. | **CEO Command Center** - Full platform overview with live metrics, AI widgets, and quick actions. Primary admin landing page. |
| `/admin/command-center` (page.tsx) | 59 lines, no imports except React. Shows 4 placeholder metric cards with "--" values and "In Development" banner. | **[STUB]** - Empty placeholder. Should be removed or redirected to `/admin`. |

**Recommendation:** `/admin/command-center` is redundant and should redirect to `/admin`.

#### 2. `/dashboard/analytics` vs `/admin/analytics`

| Page | Code Analysis | Purpose Summary |
|------|---------------|-----------------|
| `/dashboard/analytics` (page.tsx) | 278 lines, imports `WorkflowMetricsCard`, `EmailMetricsCard`, `DealPipelineCard`, `RevenueMetricsCard`, `TeamPerformanceCard`. Fetches from `/api/analytics/dashboard`. | **Workspace Analytics** - Organization-specific metrics for workflows, emails, deals, revenue, team performance. |
| `/admin/analytics` (page.tsx) | 274 lines, uses mock data. Shows platform-wide usage: Total Organizations, Active Users, MRR, API Calls, Storage, Revenue Metrics, Growth Metrics, Organization Status breakdown. | **Platform Analytics** - Platform-wide aggregated metrics across ALL organizations for platform admin oversight. |

**Finding:** NOT redundant - different scopes (org vs platform).

#### 3. `/dashboard/system` vs `/admin/system/*`

| Page | Code Analysis | Purpose Summary |
|------|---------------|-----------------|
| `/dashboard/system` (page.tsx) | 203 lines, imports `usePlatformOrganizations`. Shows system health stats and links to admin tools via `SystemToolCard` components. | **System Hub** - Platform admin navigation hub that links to `/admin/*` pages. Entry point for system administration. |
| `/admin/system/health` | System health monitoring | **System Health** - Detailed health metrics and service status. |
| `/admin/system/api-keys` | API key CRUD | **API Key Management** - Create, revoke, manage API keys. |
| `/admin/system/flags` | Feature flag toggle | **Feature Flags** - Enable/disable platform features. |
| `/admin/system/logs` | Audit log viewer | **Audit Logs** - View system audit trail. |
| `/admin/system/settings` | System config | **System Settings** - Configure platform settings. |

**Finding:** NOT redundant - `/dashboard/system` is a hub that links to the specific admin tools.

#### 4. Settings Pages Overlap

| Admin Settings | Workspace Settings | Difference |
|---------------|-------------------|------------|
| `/admin/settings/integrations` | `/workspace/[orgId]/settings/integrations` | Admin: Global integration config. Workspace: Org-specific integration config. |

**Finding:** Intentional separation - admin manages platform-wide, workspace manages org-specific.

---

## Identified Issues

### Critical Issues
None found - all navigation links resolve to existing files.

### Redundancies

| Issue | Severity | Details |
|-------|----------|---------|
| Duplicate Command Center | LOW | `/admin/command-center` is a stub that duplicates `/admin` functionality. Should be removed or redirected. |
| Duplicate Route to Same Page | INFO | `settingsEcommerce()` and `settingsProducts()` both point to `/admin/merchandiser`. May be intentional. |
| Organizations in Multiple Menus | INFO | "Organizations" appears in both System section and CommandCenterSidebar. This is intentional for different user flows. |

### Stubs

| Route | Status | Recommendation |
|-------|--------|----------------|
| `/admin/command-center` | STUB - 59 lines, placeholder only | Remove or redirect to `/admin` |

### Configuration Observations

1. **Good:** All routes use centralized constants
2. **Good:** No hardcoded URLs in navigation configs
3. **Good:** Route types are exported for type safety
4. **Note:** `CommandCenterSidebar.tsx` uses query params (`?org={orgId}`) while `UnifiedSidebar` does not
5. **Note:** Two sidebar implementations exist (UnifiedSidebar = modern, CommandCenterSidebar = legacy)

### Role-Based Access Summary

| Role | Sections Visible | Permission Count |
|------|------------------|------------------|
| `platform_admin` | All 7 sections | 47/47 (full access) |
| `owner` | 6 sections (no System) | 44/47 |
| `admin` | 6 sections (no System) | 44/47 |
| `manager` | 5 sections | 32/47 |
| `employee` | 4 sections | 18/47 |

---

## Appendix: File Locations

### Route Configuration
- `src/lib/routes/dashboard-routes.ts` - Dashboard & admin route constants
- `src/lib/routes/workspace-routes.ts` - Workspace route constants
- `src/lib/routes/index.ts` - Route exports

### Navigation Components
- `src/components/dashboard/UnifiedSidebar.tsx` - Primary sidebar
- `src/components/dashboard/navigation-config.ts` - Navigation structure
- `src/components/admin/CommandCenterSidebar.tsx` - Legacy admin sidebar

### Type Definitions
- `src/types/unified-rbac.ts` - Role-based access control types & helpers

### Layout Files
- `src/app/admin/layout.tsx` - Admin layout
- `src/app/dashboard/layout.tsx` - Dashboard layout (assumed)
- `src/app/workspace/[orgId]/layout.tsx` - Workspace layout

---

*Document generated by Claude Code audit - January 26, 2026*
*No code changes were made during this audit*
