# AI Sales Platform - System Blueprint

**Version:** 1.0.0
**Last Updated:** 2025-01-14
**Status:** PRODUCTION

> This document is the SINGLE SOURCE OF TRUTH for Jasper. All factual claims about system capabilities MUST be derived from this document.

---

## Platform Identity

**Name:** AI Sales Platform
**Purpose:** Multi-tenant SaaS providing AI-powered sales and marketing automation
**Owner:** David
**AI Partner:** Jasper (Internal Business Partner)

---

## Architecture Overview

### Deployment Model
- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (serverless functions)
- **Database:** Firebase Firestore (multi-tenant)
- **Authentication:** Firebase Auth
- **AI Gateway:** OpenRouter (100+ model access)
- **Voice:** Text-to-Speech via VoiceEngineFactory

### Multi-Tenancy
- Each organization has isolated data in Firestore
- Organizations identified by unique `organizationId`
- Feature visibility configurable per-organization
- Agents inherit organization context

---

## The 11 Specialized Agents

### Creative Agents (3)
1. **YouTube (The Broadcaster)**
   - Role: YouTube Content Strategist
   - Capabilities: Video scripts, thumbnails, metadata optimization, scheduling
   - Connection Required: YouTube Channel

2. **TikTok (The Short-Form Lead)**
   - Role: TikTok Viral Content Creator
   - Capabilities: Viral hooks, trend analysis, short scripts, hashtag optimization
   - Connection Required: TikTok Account

3. **Instagram (The Visual Storyteller)**
   - Role: Instagram Content Curator
   - Capabilities: Posts, Stories, Reels scripts, carousels
   - Connection Required: Instagram Account

### Social Engagement Agents (5)
4. **X/Twitter (Real-Time Voice - Global)**
   - Role: X/Twitter Engagement Specialist
   - Capabilities: Threads, mention engagement, scheduling, analytics
   - Connection Required: X/Twitter Account

5. **Truth Social (Real-Time Voice - Community)**
   - Role: Truth Social Engagement Manager
   - Capabilities: Posts, community engagement, content scheduling
   - Connection Required: Truth Social Account

6. **LinkedIn (The Professional Networker)**
   - Role: LinkedIn B2B Strategist
   - Capabilities: Posts, articles, connection outreach, network engagement
   - Connection Required: LinkedIn Profile

7. **Pinterest (Visual Discovery Engine)**
   - Role: Pinterest SEO Specialist
   - Capabilities: Pin creation, board organization, SEO optimization
   - Connection Required: Pinterest Account

8. **Facebook (The Community Builder)**
   - Role: Facebook Community Manager
   - Capabilities: Posts, group management, events, ad copy
   - Connection Required: Facebook Page

### Technical Agents (3)
9. **Newsletter (The Direct Line)**
   - Role: Email Newsletter Strategist
   - Capabilities: Newsletter writing, subject optimization, segmentation, automation
   - Connection Required: Email Provider

10. **Web Migrator (The Digital Architect)**
    - Role: Website Builder & Migrator
    - Capabilities: Landing pages, site migration, SEO audit, speed optimization
    - Connection Required: None

11. **Lead Hunter (The Intelligence Gatherer)**
    - Role: Lead Research & Enrichment
    - Capabilities: Lead scanning, enrichment, scoring, segmentation
    - Connection Required: None

---

## Feature Categories

1. **Command Center** - Dashboard, analytics overview
2. **CRM** - Contact management, deal tracking
3. **Lead Generation** - Lead Hunter, prospect discovery
4. **Outbound** - Email sequences, outreach campaigns
5. **Automation** - Workflows, triggers, automated actions
6. **Content Factory** - Social content creation, scheduling
7. **AI Workforce** - Agent management, golden masters
8. **E-Commerce** - Product management, Stripe/Shopify integration
9. **Analytics** - Performance metrics, reports
10. **Website** - Landing pages, web presence
11. **Settings** - Organization config, integrations

---

## Provisioner System

### Purpose
Automatic setup of organization infrastructure when new tenants sign up.

### Process
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
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: Timestamp;
  trialEndsAt?: Timestamp;
  features: FeatureVisibilitySettings;
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

## API Endpoints

### Orchestrator Chat
- **Path:** `/api/orchestrator/chat`
- **Method:** POST
- **Auth:** Firebase ID Token (admin/owner roles)
- **Purpose:** Jasper conversation handling via OpenRouter

### Agent Chat
- **Path:** `/api/agent/chat`
- **Method:** POST
- **Auth:** Session-based
- **Purpose:** Customer conversations with merchant agents

### Platform Stats
- **Path:** `/api/admin/stats`
- **Method:** GET
- **Auth:** Admin role required
- **Purpose:** Real-time platform metrics

---

## Integration Support

### Native Integrations
- Stripe (payments)
- Calendly (scheduling)
- Shopify (e-commerce)
- Gmail/Outlook (email)
- Slack/Teams (notifications)

### Planned Integrations
- Salesforce
- HubSpot
- QuickBooks/Xero
- PayPal/Square
- Zoom

---

## Metrics & Analytics

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

### Authentication
- Firebase Auth with custom claims
- Role-based access: super_admin, admin, owner, member
- API routes protected by `requireRole` middleware

### Data Isolation
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

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-14 | Initial blueprint creation |
