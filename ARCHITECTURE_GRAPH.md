# ARCHITECTURE GRAPH

## AI Sales Platform - Complete System Dependency Map
**Version:** 1.0.0
**Last Updated:** 2026-01-14
**Status:** SYNCHRONIZED WITH CODEBASE

---

## Executive Summary

This document maps exactly how **Jasper (The COO)** connects to **Department Managers** and their **Sub-Agents**. Use this as the definitive reference for understanding data flow and system dependencies.

---

## 1. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                     (Next.js 15 / React Components)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (224 Routes)                             │
│                     /api/orchestrator/chat (Jasper Entry)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                         JASPER - THE COO                                     │
│                    (Central Orchestration Brain)                            │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Thought Partner │  │ Proactive Intel │  │   Tool Router   │             │
│  │ (State Memory)  │  │ (Recommendations)│  │ (23 Tools)      │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
┌─────────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│   SIGNAL BUS        │ │  WORKFORCE    │ │  ACTION HANDLER     │
│ (SignalCoordinator) │ │  ORCHESTRATOR │ │  (Feature Toggles)  │
│                     │ │               │ │                     │
│ - 60+ Signal Types  │ │ - Deploy      │ │ - Parse Actions     │
│ - Real-time Events  │ │ - Activate    │ │ - Toggle Features   │
│ - Circuit Breaker   │ │ - Hibernate   │ │ - Deploy Specialist │
└─────────┬───────────┘ └───────┬───────┘ └──────────┬──────────┘
          │                     │                    │
          └─────────────────────┼────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPARTMENT MANAGERS                                   │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   SOCIAL     │ │    SALES     │ │   FINANCE    │ │  OPERATIONS  │       │
│  │   MANAGER    │ │   MANAGER    │ │   MANAGER    │ │   MANAGER    │       │
│  │              │ │              │ │              │ │              │       │
│  │ Autonomous   │ │ Sequence     │ │ Stripe       │ │ Workflow     │       │
│  │ Posting      │ │ Engine       │ │ Service      │ │ Service      │       │
│  │ Agent        │ │              │ │              │ │              │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │               │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUB-AGENTS / SERVICES                              │
│                                                                              │
│  Social:          Sales:           Finance:         Operations:             │
│  - Twitter        - Lead Service   - Payment        - Schema Manager        │
│  - LinkedIn*      - Contact Svc    - Cart           - Import Service        │
│  - Instagram*     - Deal Service   - Checkout       - Search Service        │
│  - TikTok*        - Enrichment     - Tax/Shipping   - Notification          │
│                   - Nurture                                                  │
│                                                                              │
│  * = Service exists but not wired to specialist framework                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Firestore)                               │
│                                                                              │
│  Root Collections:           Organization Sub-Collections:                   │
│  - organizations             - records, workspaces, sequences               │
│  - users                     - campaigns, workflows, products               │
│  - platform_coupons          - conversations, signals, apiKeys              │
│  - platform_pricing          - merchant_coupons, members, settings          │
│                                                                              │
│  Total: 60+ Collections with Multi-Tenant Isolation                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. JASPER INTERNAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JASPER (COO)                                    │
│                                                                              │
│  Entry Point: /api/orchestrator/chat/route.ts (696 lines)                   │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     THOUGHT PARTNER LAYER                              │  │
│  │                 jasper-thought-partner.ts (400+ lines)                 │  │
│  │                                                                        │  │
│  │  Responsibilities:                                                     │  │
│  │  - Conversation state memory                                          │  │
│  │  - Feature-specific query detection (social, email, status)           │  │
│  │  - Contextual response generation                                     │  │
│  │  - Anti-hallucination enforcement                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                  PROACTIVE INTELLIGENCE LAYER                          │  │
│  │             jasper-proactive-intelligence.ts (450+ lines)              │  │
│  │                                                                        │  │
│  │  Responsibilities:                                                     │  │
│  │  - Data-driven strategic recommendations                              │  │
│  │  - User intent detection (launch, list, explore)                      │  │
│  │  - Feature list deflection → actionable recommendations               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         TOOL EXECUTION LAYER                           │  │
│  │                    jasper-tools.ts (1,735 lines)                       │  │
│  │                                                                        │  │
│  │  Tool Categories:                                                      │  │
│  │  ┌────────────────┬────────────────┬────────────────┬───────────────┐ │  │
│  │  │ Knowledge (3)  │ Org Mgmt (4)   │ Pricing (5)    │ Leads (3)     │ │  │
│  │  │ FUNCTIONAL     │ 3 FUNCTIONAL   │ 4 FUNCTIONAL   │ INCOMPLETE    │ │  │
│  │  ├────────────────┼────────────────┼────────────────┼───────────────┤ │  │
│  │  │ Content (2)    │ Users (2)      │ Agents (2)     │ Reports (2)   │ │  │
│  │  │ INCOMPLETE     │ FUNCTIONAL     │ 1 FUNCTIONAL   │ INCOMPLETE    │ │  │
│  │  └────────────────┴────────────────┴────────────────┴───────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         ACTION HANDLER LAYER                           │  │
│  │                     action-handler.ts (10.7KB)                         │  │
│  │                                                                        │  │
│  │  Action Types:                                                         │  │
│  │  - [ACTION:HIDE_FEATURE:xxx] → FeatureToggleService                   │  │
│  │  - [ACTION:DEPLOY_SPECIALIST:xxx] → WorkforceOrchestrator             │  │
│  │  - [ACTION:CONFIGURE:xxx] → Settings navigation                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SIGNAL BUS ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SIGNAL COORDINATOR                                     │
│                  src/lib/orchestration/SignalCoordinator.ts                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SIGNAL FLOW                                   │   │
│  │                                                                      │   │
│  │    EMITTER                    FIRESTORE                  OBSERVER   │   │
│  │   (Any Service)              (Signal Store)            (Any Service) │   │
│  │        │                          │                          │       │   │
│  │        │  emitSignal({           │                          │       │   │
│  │        │    type: 'lead.discovered',                        │       │   │
│  │        │    orgId: 'org_acme',   │                          │       │   │
│  │        │    payload: {...}       │                          │       │   │
│  │        │  })                     │                          │       │   │
│  │        │─────────────────────────▶                          │       │   │
│  │        │                         │   onSnapshot()           │       │   │
│  │        │                         │─────────────────────────▶│       │   │
│  │        │                         │                          │       │   │
│  │        │                         │         Handler          │       │   │
│  │        │                         │         Callback         │       │   │
│  │        │                         │            │             │       │   │
│  │        │                         │            ▼             │       │   │
│  │        │                         │    NotificationService   │       │   │
│  │        │                         │    AnalyticsService      │       │   │
│  │        │                         │    WorkflowTrigger       │       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  SIGNAL TYPES (60+):                                                        │
│  ┌──────────────────┬──────────────────┬──────────────────┐                │
│  │ Lead Intelligence│ Deal Scoring     │ Engagement       │                │
│  │ - lead.discovered│ - deal.risk.*    │ - email.opened   │                │
│  │ - lead.qualified │ - deal.won       │ - email.clicked  │                │
│  │ - lead.intent.*  │ - deal.lost      │ - call.completed │                │
│  ├──────────────────┼──────────────────┼──────────────────┤                │
│  │ Workforce        │ Sequence         │ Performance      │                │
│  │ - agent.activated│ - sequence.*     │ - quota.at_risk  │                │
│  │ - platform.*     │ - step.executed  │ - top_performer  │                │
│  └──────────────────┴──────────────────┴──────────────────┘                │
│                                                                              │
│  SAFETY CONTROLS:                                                           │
│  - Circuit Breaker: Opens after 5 consecutive failures                      │
│  - Throttler: Max 100 signals/minute per org                               │
│  - TTL: Signals auto-expire after 30 days                                  │
│  - Audit: All signals logged to signal_logs subcollection                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. DEPARTMENT MANAGER CONNECTIONS

### 4.1 SOCIAL MEDIA DEPARTMENT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SOCIAL MEDIA DEPARTMENT                                │
│                                                                              │
│  MANAGER: AutonomousPostingAgent                                            │
│  FILE: src/lib/social/autonomous-posting-agent.ts (979 lines)               │
│  STATUS: FUNCTIONAL                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA FLOW                                        │   │
│  │                                                                      │   │
│  │  Jasper                                                             │   │
│  │     │                                                               │   │
│  │     │  delegate_to_agent('linkedin', 'generate_post')               │   │
│  │     │  [INCOMPLETE - queues but doesn't execute]                    │   │
│  │     │                                                               │   │
│  │     ▼                                                               │   │
│  │  AutonomousPostingAgent                                             │   │
│  │     │                                                               │   │
│  │     ├──▶ TwitterService [FUNCTIONAL]                               │   │
│  │     │       └──▶ Twitter API v2                                    │   │
│  │     │                                                               │   │
│  │     ├──▶ LinkedIn [INCOMPLETE - read only]                         │   │
│  │     │                                                               │   │
│  │     ├──▶ Instagram [INCOMPLETE - not wired]                        │   │
│  │     │                                                               │   │
│  │     └──▶ Firestore: social_queue collection                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  CAPABILITIES:                                                              │
│  - Multi-platform content queue                                             │
│  - Approval workflows (approvalRequired flag)                               │
│  - Auto-hashtag generation                                                  │
│  - Daily post limits (maxDailyPosts)                                        │
│  - Scheduling with timezone support                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 SALES/CRM DEPARTMENT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SALES/CRM DEPARTMENT                                 │
│                                                                              │
│  MANAGERS:                                                                   │
│  - SequenceEngine (src/lib/outbound/sequence-engine.ts)                     │
│  - CampaignManager (src/lib/email/campaign-manager.ts)                      │
│  STATUS: FUNCTIONAL                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA FLOW                                        │   │
│  │                                                                      │   │
│  │  Jasper Tools                                                       │   │
│  │     │                                                               │   │
│  │     ├──▶ scan_leads [INCOMPLETE - returns random numbers]          │   │
│  │     ├──▶ enrich_lead [INCOMPLETE - status string only]             │   │
│  │     └──▶ score_leads [INCOMPLETE - no algorithm]                   │   │
│  │                                                                      │   │
│  │  BUT: Direct Services ARE Functional:                               │   │
│  │     │                                                               │   │
│  │     ├──▶ LeadService [FUNCTIONAL]                                  │   │
│  │     │       ├──▶ getLeads(), createLead(), updateLead()            │   │
│  │     │       └──▶ Firestore: leads collection                       │   │
│  │     │                                                               │   │
│  │     ├──▶ ContactService [FUNCTIONAL]                               │   │
│  │     │       ├──▶ getContacts(), recordInteraction()                │   │
│  │     │       └──▶ Firestore: contacts collection                    │   │
│  │     │                                                               │   │
│  │     ├──▶ DealService [FUNCTIONAL]                                  │   │
│  │     │       ├──▶ getDeals(), closeDeal()                           │   │
│  │     │       └──▶ Firestore: deals collection                       │   │
│  │     │                                                               │   │
│  │     └──▶ EnrichmentService [FUNCTIONAL]                            │   │
│  │             ├──▶ enrichCompany() with web scraping                 │   │
│  │             └──▶ Firestore: enrichmentCache                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  KEY INSIGHT: The underlying services work; the Jasper tools are stubs.     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 FINANCE/BILLING DEPARTMENT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FINANCE/BILLING DEPARTMENT                             │
│                                                                              │
│  MANAGER: StripeService                                                      │
│  FILE: src/lib/billing/stripe-service.ts                                    │
│  STATUS: FUNCTIONAL                                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA FLOW                                        │   │
│  │                                                                      │   │
│  │  Jasper Tools                                                       │   │
│  │     │                                                               │   │
│  │     ├──▶ list_coupons [FUNCTIONAL]                                 │   │
│  │     │       └──▶ Firestore: platform_coupons                       │   │
│  │     │                                                               │   │
│  │     ├──▶ create_coupon [FUNCTIONAL]                                │   │
│  │     │       └──▶ Firestore: platform_coupons                       │   │
│  │     │                                                               │   │
│  │     ├──▶ get_pricing_tiers [FUNCTIONAL]                            │   │
│  │     │       └──▶ Firestore: platform_pricing + hardcoded fallback  │   │
│  │     │                                                               │   │
│  │     └──▶ update_pricing [INCOMPLETE - defers to Stripe sync]       │   │
│  │                                                                      │   │
│  │  Direct Services:                                                   │   │
│  │     │                                                               │   │
│  │     ├──▶ StripeService [FUNCTIONAL]                                │   │
│  │     │       ├──▶ createSubscription(), cancelSubscription()        │   │
│  │     │       ├──▶ handleWebhook()                                   │   │
│  │     │       └──▶ Stripe API + Firestore                            │   │
│  │     │                                                               │   │
│  │     ├──▶ PaymentService [FUNCTIONAL]                               │   │
│  │     │       ├──▶ processStripePayment()                            │   │
│  │     │       ├──▶ processPayPalPayment()                            │   │
│  │     │       └──▶ Multiple payment providers                        │   │
│  │     │                                                               │   │
│  │     └──▶ CartService, CheckoutService [FUNCTIONAL]                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 COMMUNICATIONS DEPARTMENT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMUNICATIONS DEPARTMENT                               │
│                                                                              │
│  MANAGERS:                                                                   │
│  - EmailService (src/lib/email/email-service.ts)                            │
│  - SMSService (src/lib/sms/sms-service.ts)                                  │
│  - SlackService (src/lib/integrations/slack-service.ts)                     │
│  STATUS: ALL FUNCTIONAL                                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA FLOW                                        │   │
│  │                                                                      │   │
│  │  Jasper Tools                                                       │   │
│  │     │                                                               │   │
│  │     ├──▶ draft_outreach_email [INCOMPLETE - defers to API]         │   │
│  │     └──▶ generate_content [INCOMPLETE - defers to API]             │   │
│  │                                                                      │   │
│  │  BUT: Direct Services ARE Functional:                               │   │
│  │     │                                                               │   │
│  │     ├──▶ EmailService [FUNCTIONAL]                                 │   │
│  │     │       ├──▶ sendEmail(), sendBulkEmails()                     │   │
│  │     │       ├──▶ SendGrid, Resend, SMTP                            │   │
│  │     │       └──▶ Firestore: emailTracking                          │   │
│  │     │                                                               │   │
│  │     ├──▶ SMSService [FUNCTIONAL]                                   │   │
│  │     │       ├──▶ sendSMS(), sendBulkSMS()                          │   │
│  │     │       └──▶ Twilio, Vonage                                    │   │
│  │     │                                                               │   │
│  │     └──▶ SlackService [FUNCTIONAL]                                 │   │
│  │             ├──▶ sendMessage(), listChannels()                     │   │
│  │             └──▶ Slack Web API                                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. THE 11 SPECIALISTS - CONNECTION STATUS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    11 SPECIALISTS - TRUTH TABLE                              │
│                                                                              │
│  DEFINITION: src/lib/orchestrator/feature-manifest.ts                       │
│  DELEGATION: src/lib/orchestrator/jasper-tools.ts (delegate_to_agent)       │
│                                                                              │
│  ┌────────────────────┬─────────────────┬─────────────────┬───────────────┐ │
│  │ SPECIALIST         │ DEFINITION      │ SERVICE EXISTS  │ WIRED TO      │ │
│  │                    │ STATUS          │                 │ JASPER        │ │
│  ├────────────────────┼─────────────────┼─────────────────┼───────────────┤ │
│  │ YouTube            │ TypeScript only │ No              │ No            │ │
│  │ TikTok             │ TypeScript only │ No              │ No            │ │
│  │ Instagram          │ TypeScript only │ No              │ No            │ │
│  │ Pinterest          │ TypeScript only │ No              │ No            │ │
│  │ X/Twitter          │ TypeScript only │ YES (Service)   │ No            │ │
│  │ Truth Social       │ TypeScript only │ No              │ No            │ │
│  │ LinkedIn           │ TypeScript only │ Partial (read)  │ No            │ │
│  │ Facebook           │ TypeScript only │ No              │ No            │ │
│  │ Newsletter         │ TypeScript only │ YES (Campaign)  │ No            │ │
│  │ Web Migrator       │ TypeScript only │ No              │ No            │ │
│  │ Lead Hunter        │ TypeScript only │ YES (Enrich)    │ Mock data     │ │
│  └────────────────────┴─────────────────┴─────────────────┴───────────────┘ │
│                                                                              │
│  WHAT THIS MEANS:                                                           │
│  - All 11 specialists have beautiful TypeScript definitions                 │
│  - Some have underlying services that work (Twitter, Email, Enrichment)     │
│  - NONE are fully wired to Jasper's delegation system                       │
│  - delegate_to_agent returns { status: 'queued' } but nothing processes it  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. DATA LAYER - FIRESTORE COLLECTIONS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIRESTORE ARCHITECTURE                                │
│                                                                              │
│  firestore/                                                                 │
│  │                                                                          │
│  ├── ROOT COLLECTIONS (11)                                                  │
│  │   ├── organizations          # Tenant data                              │
│  │   ├── users                  # Global user accounts                     │
│  │   ├── platform_coupons       # Platform-wide discounts                  │
│  │   ├── platform_pricing       # Pricing tier config                      │
│  │   ├── health                 # System health checks                     │
│  │   ├── admin                  # Admin configuration                      │
│  │   ├── discoveryQueue         # Lead discovery jobs                      │
│  │   ├── slack_workspaces       # Slack integrations                       │
│  │   ├── slack_oauth_states     # OAuth state management                   │
│  │   ├── slack_channels         # Channel cache                            │
│  │   └── slack_messages         # Message history                          │
│  │                                                                          │
│  └── ORGANIZATION SUB-COLLECTIONS (35)                                      │
│      └── organizations/{orgId}/                                             │
│          ├── members            # Organization members                      │
│          ├── settings           # Org settings                              │
│          │   ├── workforceIdentity                                         │
│          │   └── onboardingProgress                                        │
│          ├── records            # Dynamic entity records                    │
│          ├── workspaces         # Org workspaces                           │
│          ├── sequences          # Email sequences                          │
│          ├── campaigns          # Email campaigns                          │
│          ├── workflows          # Automation workflows                      │
│          ├── products           # E-commerce products                       │
│          ├── orders             # E-commerce orders                         │
│          ├── conversations      # AI conversation history                   │
│          ├── signals            # Signal bus events                         │
│          ├── signal_logs        # Signal audit trail                        │
│          ├── apiKeys            # API key storage                           │
│          ├── integrations       # Third-party integrations                  │
│          ├── merchant_coupons   # Per-org coupons                          │
│          ├── agentConfig        # Agent configuration                       │
│          ├── goldenMasters      # Trained agent versions                    │
│          └── ... (17 more)                                                  │
│                                                                              │
│  TOTAL: 60+ Collections with Multi-Tenant Isolation                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. AI PROVIDER CHAIN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI PROVIDER CHAIN                                    │
│                                                                              │
│  Primary Entry: /api/orchestrator/chat (Jasper)                             │
│  Fallback Entry: /api/agent/chat (Merchant agents)                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MODEL FALLBACK CHAIN                             │   │
│  │                                                                      │   │
│  │  OpenRouter (Primary)                                               │   │
│  │     │                                                               │   │
│  │     ├──▶ Claude 3.5 Sonnet (preferred)                             │   │
│  │     ├──▶ GPT-4 Turbo (fallback 1)                                  │   │
│  │     ├──▶ Gemini Pro (fallback 2)                                   │   │
│  │     └──▶ Llama 3.1 70B (fallback 3)                                │   │
│  │                                                                      │   │
│  │  If OpenRouter fails:                                               │   │
│  │     │                                                               │   │
│  │     ├──▶ Direct OpenAI API                                         │   │
│  │     ├──▶ Direct Anthropic API                                      │   │
│  │     └──▶ Direct Google Gemini API                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  TOOL CALLING:                                                              │
│  - Max 3 iterations per conversation turn                                   │
│  - Tools defined in jasper-tools.ts                                         │
│  - Results added to conversation history                                    │
│  - Anti-hallucination: MUST call tool before claiming data                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. DELEGATION FLOW (Current State)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DELEGATION FLOW - CURRENT STATE                           │
│                                                                              │
│  USER: "Jasper, have LinkedIn write a post about our Q4 results"            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: User Message → Jasper Chat API                              │   │
│  │          /api/orchestrator/chat                                      │   │
│  │          [FUNCTIONAL]                                                │   │
│  └────────────────────────────────────────┬────────────────────────────┘   │
│                                           │                                 │
│                                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: OpenRouter processes, decides to call delegate_to_agent    │   │
│  │          Tool call: delegate_to_agent('linkedin', 'generate_post')  │   │
│  │          [FUNCTIONAL]                                                │   │
│  └────────────────────────────────────────┬────────────────────────────┘   │
│                                           │                                 │
│                                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: executeDelegateToAgent() validates specialist              │   │
│  │          - Checks: Does 'linkedin' exist in SPECIALISTS? YES       │   │
│  │          - Checks: Does 'generate_post' capability exist? YES      │   │
│  │          [FUNCTIONAL]                                                │   │
│  └────────────────────────────────────────┬────────────────────────────┘   │
│                                           │                                 │
│                                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 4: Returns { status: 'queued', result: 'Task queued...' }     │   │
│  │          [THIS IS WHERE IT STOPS]                                    │   │
│  │                                                                      │   │
│  │          ██████████████████████████████████████████████████████     │   │
│  │          █  NO QUEUE PROCESSOR EXISTS                          █     │   │
│  │          █  Task stays 'queued' forever                        █     │   │
│  │          █  LinkedIn specialist never actually runs            █     │   │
│  │          ██████████████████████████████████████████████████████     │   │
│  │                                                                      │   │
│  └────────────────────────────────────────┬────────────────────────────┘   │
│                                           │                                 │
│                                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 5: Jasper responds to user with queued status                 │   │
│  │          "I've queued that task for the LinkedIn specialist..."     │   │
│  │          [MISLEADING - nothing will actually happen]                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  WHAT'S NEEDED TO FIX:                                                      │
│  1. Queue Processor (cron job or cloud function)                            │
│  2. Agent Executor (maps agentId → actual implementation)                   │
│  3. Status Updates (queued → executing → completed)                         │
│  4. Result Callback (return results to Jasper)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. FILE REFERENCE INDEX

### Core Orchestrator
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/orchestrator/jasper-tools.ts` | 1,735 | Tool definitions & execution |
| `src/lib/orchestrator/jasper-thought-partner.ts` | 400+ | Conversation state |
| `src/lib/orchestrator/jasper-proactive-intelligence.ts` | 450+ | Recommendations |
| `src/lib/orchestrator/action-handler.ts` | 10.7KB | Action parsing |
| `src/lib/orchestrator/feature-manifest.ts` | ~300 | 11 specialist definitions |
| `src/lib/orchestrator/system-blueprint.md` | 500+ | This reference doc |

### Signal Bus
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/orchestration/SignalCoordinator.ts` | ~500 | Event bus implementation |
| `src/lib/orchestration/types.ts` | ~200 | Signal type definitions |

### Department Managers
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/social/autonomous-posting-agent.ts` | 979 | Social media automation |
| `src/lib/outbound/sequence-engine.ts` | ~400 | Email sequence management |
| `src/lib/email/campaign-manager.ts` | ~300 | Email campaign orchestration |
| `src/lib/billing/stripe-service.ts` | ~500 | Subscription management |

### API Entry Points
| File | Lines | Purpose |
|------|-------|---------|
| `src/app/api/orchestrator/chat/route.ts` | 696 | Jasper chat endpoint |
| `src/app/api/agent/chat/route.ts` | 236 | Merchant agent endpoint |

---

## 10. QUICK REFERENCE - WHAT WORKS VS WHAT DOESN'T

### WORKS (Use Confidently)
- Organization CRUD (list, get, update)
- Coupon management (list, create, toggle)
- User management (list, update roles)
- Platform stats and system state
- Email sending (via direct EmailService)
- SMS sending (via direct SMSService)
- Voice calls (Twilio/Telnyx)
- Stripe subscriptions
- OAuth integrations (Google, Microsoft, Slack)
- 180+ API routes

### DOESN'T WORK (Be Honest)
- Lead scanning (returns random numbers)
- Lead enrichment via Jasper tool (status only)
- Lead scoring via Jasper tool (no algorithm)
- Content generation via Jasper tool (defers to API)
- Agent delegation (queues but never executes)
- Report generation (estimated time only)
- 11 Specialists autonomous operation

### PARTIAL (Explain Limitations)
- Twitter posting (service works, not wired to specialist)
- Analytics (only 'overview' metric functional)
- Pricing updates (requires separate Stripe sync)

---

**END OF ARCHITECTURE GRAPH v1.0.0**
