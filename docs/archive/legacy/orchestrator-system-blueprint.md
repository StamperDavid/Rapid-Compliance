# AI Sales Platform - System Blueprint

**Version:** 2.0.0
**Last Updated:** 2026-01-14
**Status:** PRODUCTION - SYNCHRONIZED WITH CODEBASE
**Audit Source:** SYSTEM_TRUTH_MANIFEST.md

> This document is the SINGLE SOURCE OF TRUTH for Jasper. All factual claims about system capabilities MUST be derived from this document. Features marked [INCOMPLETE] are defined but not fully wired.

---

## Platform Identity

**Name:** AI Sales Platform
**Purpose:** Multi-tenant SaaS providing AI-powered sales and marketing automation
**Owner:** David
**AI Partner:** Jasper (Internal Business Partner / COO)

---

## Architecture Overview

### Deployment Model
- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (serverless functions)
- **Database:** Firebase Firestore (multi-tenant, 60+ collections)
- **Authentication:** Firebase Auth
- **AI Gateway:** OpenRouter (100+ model access)
- **Voice:** Text-to-Speech via VoiceEngineFactory (Native, ElevenLabs, Unreal)

### Multi-Tenancy
- Each organization has isolated data in Firestore
- Organizations identified by unique `organizationId`
- Feature visibility configurable per-organization
- Agents inherit organization context
- Environment-aware collection prefixing (test_ prefix in non-production)

---

## The 11 Specialized Agents

> **IMPORTANT:** All 11 specialists are DEFINED in the Feature Manifest but delegation execution is [INCOMPLETE]. Jasper can describe them but cannot yet execute delegated tasks autonomously.

### Creative Agents (4)
1. **YouTube (The Broadcaster)** [INCOMPLETE - DEFINITION ONLY]
   - Role: YouTube Content Strategist
   - Capabilities: Video scripts, thumbnails, metadata optimization, scheduling
   - Connection Required: YouTube Channel
   - Status: TypeScript interface defined, no execution logic

2. **TikTok (The Short-Form Lead)** [INCOMPLETE - DEFINITION ONLY]
   - Role: TikTok Viral Content Creator
   - Capabilities: Viral hooks, trend analysis, short scripts, hashtag optimization
   - Connection Required: TikTok Account
   - Status: TypeScript interface defined, no execution logic

3. **Instagram (The Visual Storyteller)** [INCOMPLETE - DEFINITION ONLY]
   - Role: Instagram Content Curator
   - Capabilities: Posts, Stories, Reels scripts, carousels
   - Connection Required: Instagram Account
   - Status: TypeScript interface defined, no execution logic

4. **Pinterest (Visual Discovery Engine)** [INCOMPLETE - DEFINITION ONLY]
   - Role: Pinterest SEO Specialist
   - Capabilities: Pin creation, board organization, SEO optimization
   - Connection Required: Pinterest Account
   - Status: TypeScript interface defined, no execution logic

### Social Engagement Agents (4)
5. **X/Twitter (Real-Time Voice - Global)** [PARTIAL - SERVICE EXISTS]
   - Role: X/Twitter Engagement Specialist
   - Capabilities: Threads, mention engagement, scheduling, analytics
   - Connection Required: X/Twitter Account
   - Status: TwitterService exists (`src/lib/integrations/twitter-service.ts`) but not wired to specialist framework

6. **Truth Social (Real-Time Voice - Community)** [INCOMPLETE - DEFINITION ONLY]
   - Role: Truth Social Engagement Manager
   - Capabilities: Posts, community engagement, content scheduling
   - Connection Required: Truth Social Account
   - Status: TypeScript interface defined, no execution logic

7. **LinkedIn (The Professional Networker)** [INCOMPLETE - DEFINITION ONLY]
   - Role: LinkedIn B2B Strategist
   - Capabilities: Posts, articles, connection outreach, network engagement
   - Connection Required: LinkedIn Profile
   - Status: TypeScript interface defined, no execution logic

8. **Facebook (The Community Builder)** [INCOMPLETE - DEFINITION ONLY]
   - Role: Facebook Community Manager
   - Capabilities: Posts, group management, events, ad copy
   - Connection Required: Facebook Page
   - Status: TypeScript interface defined, no execution logic

### Technical Agents (3)
9. **Newsletter (The Direct Line)** [INCOMPLETE - DEFINITION ONLY]
   - Role: Email Newsletter Strategist
   - Capabilities: Newsletter writing, subject optimization, segmentation, automation
   - Connection Required: Email Provider
   - Status: CampaignManager exists but not wired to specialist

10. **Web Migrator (The Digital Architect)** [INCOMPLETE - DEFINITION ONLY]
    - Role: Website Builder & Migrator
    - Capabilities: Landing pages, site migration, SEO audit, speed optimization
    - Connection Required: None
    - Status: TypeScript interface defined, no execution logic

11. **Lead Hunter (The Intelligence Gatherer)** [INCOMPLETE - RETURNS MOCK DATA]
    - Role: Lead Research & Enrichment
    - Capabilities: Lead scanning, enrichment, scoring, segmentation
    - Connection Required: None
    - Status: Tool defined but returns `estimatedResults: Math.random()`

---

## Feature Categories

1. **Command Center** - Dashboard, analytics overview [FUNCTIONAL]
2. **CRM** - Contact management, deal tracking [FUNCTIONAL]
3. **Lead Generation** - Lead Hunter, prospect discovery [INCOMPLETE - MOCK DATA]
4. **Outbound** - Email sequences, outreach campaigns [FUNCTIONAL]
5. **Automation** - Workflows, triggers, automated actions [FUNCTIONAL]
6. **Content Factory** - Social content creation, scheduling [PARTIAL]
7. **AI Workforce** - Agent management, golden masters [FUNCTIONAL]
8. **E-Commerce** - Product management, Stripe/Shopify integration [FUNCTIONAL]
9. **Analytics** - Performance metrics, reports [FUNCTIONAL]
10. **Website** - Landing pages, web presence [FUNCTIONAL]
11. **Settings** - Organization config, integrations [FUNCTIONAL]

---

## Provisioner System

### Purpose
Automatic setup of organization infrastructure when new tenants sign up.

### Process [FUNCTIONAL]
1. New user signs up via Firebase Auth
2. Provisioner creates organization document in Firestore
3. Default feature visibility settings applied
4. Welcome agent (Jasper clone) spawned for organization
5. Initial navigation structure built

### Error Handling
- Provisioner logs stored in `organizations/{orgId}/provisionerLogs`
- Failed provisions retry up to 3 times
- Admin notified of persistent failures

---

## Data Models

### Organization
```typescript
{
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  createdAt: Timestamp;
  trialEndsAt?: Timestamp;
  features: FeatureVisibilitySettings;
  brandDNA?: BrandDNA;
  planLimits: PlanLimits;
}
```

### Agent Instance
```typescript
{
  id: string;
  organizationId: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  status: 'active' | 'inactive';
  metrics: {
    conversationsTotal: number;
    lastActive: Timestamp;
  }
}
```

---

## API Endpoints (224 Total)

### Orchestrator Chat [FUNCTIONAL]
- **Path:** `/api/orchestrator/chat`
- **Method:** POST
- **Auth:** Firebase ID Token (admin/owner roles)
- **Purpose:** Jasper conversation handling via OpenRouter

### Agent Chat [FUNCTIONAL]
- **Path:** `/api/agent/chat`
- **Method:** POST
- **Auth:** Session-based
- **Purpose:** Customer conversations with merchant agents

### Platform Stats [FUNCTIONAL]
- **Path:** `/api/admin/stats`
- **Method:** GET
- **Auth:** Admin role required
- **Purpose:** Real-time platform metrics

### Full API Route Summary
| Category | Routes | Functional | Partial | Stub |
|----------|--------|------------|---------|------|
| Admin | 21 | 18 | 2 | 1 |
| Agent | 4 | 2 | 2 | 0 |
| Analytics | 8 | 8 | 0 | 0 |
| Billing | 3 | 3 | 0 | 0 |
| CRM | 11 | 11 | 0 | 0 |
| Email | 6 | 6 | 0 | 0 |
| Integrations | 18 | 18 | 0 | 0 |
| Lead | 8 | 8 | 0 | 0 |
| Orchestrator | 3 | 3 | 0 | 0 |
| Voice | 7 | 7 | 0 | 0 |
| Workflows | 6 | 6 | 0 | 0 |
| Other | 129 | ~100 | ~25 | ~4 |
| **TOTAL** | **224** | **~180** | **~30** | **~14** |

---

## Integration Support

### Native Integrations [FUNCTIONAL]
- Stripe (payments) - Full subscription management
- Calendly (scheduling) - Meeting booking
- Shopify (e-commerce) - Product sync
- Gmail/Outlook (email) - Read/send operations
- Slack/Teams (notifications) - Channel messaging
- Twitter/X (social) - Post/schedule

### Integrations with OAuth [FUNCTIONAL]
- Google (Calendar, Gmail)
- Microsoft (Outlook, Teams)
- QuickBooks (Accounting)
- Xero (Accounting)
- PayPal (Payments)

### Planned Integrations [INCOMPLETE]
- Salesforce
- HubSpot

---

## Metrics & Analytics [FUNCTIONAL]

### Platform-Level (Admin)
- Total organizations
- Active agents
- Pending support tickets
- Trial organizations
- Conversion rates

### Organization-Level (Merchant)
- Lead counts
- Email engagement
- Social performance
- Revenue attribution

---

## Security Model

### Authentication [FUNCTIONAL]
- Firebase Auth with custom claims
- Role-based access: super_admin, admin, owner, member
- API routes protected by `requireRole` middleware

### Data Isolation [FUNCTIONAL]
- Strict tenant isolation via Firestore security rules
- Organization data only accessible to members
- Admin access requires super_admin role

---

## Configuration Status Patterns

### Configured Feature
Feature is ready for use. Agent can execute operations.
Response: "I'm [action] now. [Expected outcome]."

### Unconfigured Feature
Feature requires setup before use.
Response: "[Feature] isn't set up yet. To [capability], I'll need [requirement]. Want me to walk you through that now, or should I hide it from your dashboard?"

---

## Jasper Tools - TRUTH STATUS

> **CRITICAL:** Tools marked [INCOMPLETE] exist in code but return mock/placeholder data. Do NOT claim these are functional.

### Knowledge & State Tools [ALL FUNCTIONAL]
| Tool | Status | Description | Data Source |
|------|--------|-------------|-------------|
| `query_docs` | FUNCTIONAL | Query system blueprint | File system read |
| `get_platform_stats` | FUNCTIONAL | Real-time platform statistics | Firestore query |
| `get_system_state` | FUNCTIONAL | Comprehensive system state | Firestore + Health Service |

### Organization Management Tools [MOSTLY FUNCTIONAL]
| Tool | Status | Description | Data Source |
|------|--------|-------------|-------------|
| `list_organizations` | FUNCTIONAL | List all organizations with filters | Firestore query |
| `get_organization` | FUNCTIONAL | Get specific organization details | Firestore lookup |
| `update_organization` | FUNCTIONAL | Update organization settings | Firestore update |
| `provision_organization` | [INCOMPLETE] | Provision new organization | Returns "use /api/admin/provision" |

### Coupon & Pricing Tools [MOSTLY FUNCTIONAL]
| Tool | Status | Description | Data Source |
|------|--------|-------------|-------------|
| `list_coupons` | FUNCTIONAL | List platform coupons | Firestore query |
| `create_coupon` | FUNCTIONAL | Create discount coupons | Firestore write |
| `update_coupon_status` | FUNCTIONAL | Enable/disable coupons | Firestore update |
| `get_pricing_tiers` | FUNCTIONAL | Get pricing configuration | Firestore + fallback |
| `update_pricing` | [INCOMPLETE] | Update tier pricing | Returns "Stripe sync required" |

### Lead Generation & CRM Tools [ALL INCOMPLETE - MOCK DATA]
| Tool | Status | Description | Reality |
|------|--------|-------------|---------|
| `scan_leads` | [INCOMPLETE] | Initiate lead discovery scan | Returns `Math.random() * 50 + 10` |
| `enrich_lead` | [INCOMPLETE] | Enrich lead with additional data | Returns status string only |
| `score_leads` | [INCOMPLETE] | Calculate lead scores | No scoring algorithm |

### Content & Outreach Tools [ALL INCOMPLETE]
| Tool | Status | Description | Reality |
|------|--------|-------------|---------|
| `generate_content` | [INCOMPLETE] | Generate marketing content | Defers to external API |
| `draft_outreach_email` | [INCOMPLETE] | Draft personalized emails | Defers to external API |

### User & Access Management Tools [ALL FUNCTIONAL]
| Tool | Status | Description | Data Source |
|------|--------|-------------|-------------|
| `list_users` | FUNCTIONAL | List platform users | Firestore query |
| `update_user_role` | FUNCTIONAL | Update user roles | Firestore update |

### Agent Delegation Tools [PARTIAL]
| Tool | Status | Description | Reality |
|------|--------|-------------|---------|
| `delegate_to_agent` | [INCOMPLETE] | Delegate tasks to specialists | Validates & queues but NO execution |
| `inspect_agent_logs` | FUNCTIONAL | View agent/provisioner logs | Returns summaries |

### Analytics & Reporting Tools [PARTIAL]
| Tool | Status | Description | Reality |
|------|--------|-------------|---------|
| `get_analytics` | PARTIAL | Retrieve analytics data | Only 'overview' metric works |
| `generate_report` | [INCOMPLETE] | Generate comprehensive reports | Returns estimated time only |

### Tool Summary
| Category | Total | Functional | Incomplete |
|----------|-------|------------|------------|
| Knowledge & State | 3 | 3 | 0 |
| Organization Mgmt | 4 | 3 | 1 |
| Pricing & Coupons | 5 | 4 | 1 |
| Lead Generation | 3 | 0 | 3 |
| Content Generation | 2 | 0 | 2 |
| User Management | 2 | 2 | 0 |
| Agent Operations | 2 | 1 | 1 |
| Reporting | 2 | 0 | 2 |
| **TOTAL** | **23** | **13** | **10** |

---

## Standard Operating Procedures

### SOP-001: List Organizations
**Tool:** `list_organizations`
**When to Use:** User asks about organizations, tenants, or accounts

**Step-by-Step:**
1. Call `list_organizations` with optional filters (status, plan)
2. Parse the returned array of organization objects
3. Present summary: total count, breakdown by plan/status
4. If user asks for specific org, use `get_organization` with orgId

**Example Response:**
"I found 47 organizations. Here's the breakdown: 12 on Enterprise, 23 on Pro, 12 on Free. 5 are currently in trial. Would you like details on any specific organization?"

---

### SOP-002: Manage Coupons
**Tool:** `list_coupons`, `create_coupon`, `update_coupon_status`
**When to Use:** User asks about discounts, promotions, or coupon codes

**Step-by-Step:**
1. Call `list_coupons` to see existing coupons
2. To create: Call `create_coupon` with code, discount_type, value, validity dates
3. To toggle: Call `update_coupon_status` with coupon_id and new status
4. Report the action taken and current coupon state

**Example Response:**
"I've created coupon 'SUMMER25' for 25% off, valid until August 31st. It's now active and can be used at checkout."

---

### SOP-003: Check Platform Health
**Tool:** `get_platform_stats`, `get_system_state`
**When to Use:** User asks "how's the platform doing?" or system health

**Step-by-Step:**
1. Call `get_platform_stats` for high-level metrics
2. Call `get_system_state` for detailed health check
3. Identify any issues (high error rates, degraded services)
4. Present summary with actionable insights

**Example Response:**
"The platform is healthy. We have 47 active organizations, 156 agents deployed. All services are operational. I see 3 organizations in trial ending this week - want me to list them?"

---

### SOP-004: View User List
**Tool:** `list_users`
**When to Use:** User asks about team members, users, or access

**Step-by-Step:**
1. Call `list_users` with optional organizationId filter
2. Parse returned user objects
3. Group by role (admin, owner, member)
4. Present count and breakdown

**Example Response:**
"I found 12 users in this organization: 1 owner, 3 admins, 8 members. The owner is david@example.com. Would you like to see the full list?"

---

### SOP-005: Handle Lead Requests [REQUIRES HONESTY]
**Tool:** `scan_leads`, `enrich_lead`, `score_leads`
**When to Use:** User asks about finding leads, enrichment, or scoring

**Step-by-Step:**
1. BE HONEST: These tools currently return placeholder data
2. Explain the current state: "The lead generation tools are defined but not yet connected to real data sources."
3. Offer alternatives: Manual lead import via CSV, or setting up the enrichment service
4. Do NOT claim leads were found if mock data was returned

**Example Response:**
"I can see the lead generation tools are defined, but they're not yet connected to live data sources. Right now, calling scan_leads would return estimated numbers rather than real prospects. Would you like me to help you import leads manually, or should we prioritize wiring up the lead generation service?"

---

### SOP-006: Delegate to Specialist [REQUIRES HONESTY]
**Tool:** `delegate_to_agent`
**When to Use:** User asks a specialist to do something

**Step-by-Step:**
1. BE HONEST: Delegation queues tasks but doesn't execute them
2. Explain: "I can queue this task for the LinkedIn specialist, but the execution pipeline isn't fully wired yet."
3. Offer alternative: "I can help you draft the content directly, or we can track this as a task for when delegation is complete."
4. Do NOT claim the specialist "is working on it" if execution isn't happening

**Example Response:**
"I'd love to have the LinkedIn specialist handle this. Right now, I can queue the task, but the specialist execution system is still being built. In the meantime, let me help you directly - what kind of LinkedIn post would you like to create?"

---

### SOP-007: Generate Reports [REQUIRES HONESTY]
**Tool:** `generate_report`
**When to Use:** User asks for a report or export

**Step-by-Step:**
1. BE HONEST: The generate_report tool returns an estimated time but doesn't produce actual reports
2. Offer alternatives: Use `get_analytics` for 'overview' data, or export data manually
3. For real reports, guide user to the Analytics dashboard

**Example Response:**
"The automated report generator is still in development. However, I can pull live analytics data for you right now using get_analytics. What metrics are you most interested in - revenue, engagement, or conversion?"

---

## Firestore Collections Reference

### Root Collections (11)
- organizations, users, health, admin, platform_metrics, platform_settings
- discoveryQueue, slack_workspaces, slack_oauth_states, slack_channels, slack_messages

### Organization Sub-Collections (35)
- records, workspaces, sequences, campaigns, workflows, products, orders
- conversations, trainingData, baseModels, schemas, apiKeys, integrations
- merchant_coupons, members, settings, agentConfig, goldenMasters, signals

### Total: 60+ Collections

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-14 | Full synchronization with codebase, added [INCOMPLETE] flags, added SOPs |
| 1.1.0 | 2025-01-14 | Added Jasper Tools section with 22 enabled tools |
| 1.0.0 | 2025-01-14 | Initial blueprint creation |

---

**END OF SYSTEM BLUEPRINT v2.0.0**
