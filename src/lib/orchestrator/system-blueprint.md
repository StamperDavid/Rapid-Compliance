# SalesVelocity.ai — System Blueprint

> **Purpose:** This is Jasper's authoritative knowledge base. The `query_docs` tool reads this file.
> **Last Updated:** February 25, 2026
> **Architecture:** Single-Tenant (Penthouse Model) — NOT a SaaS platform
> **Organization:** rapid-compliance-root
> **Domain:** rapidcompliance.us (future: SalesVelocity.ai)

---

## Platform Identity

SalesVelocity.ai is a single-tenant AI-powered business operations platform. It is NOT a SaaS tool. The platform serves one company (David's organization) and its clients purchase services and products — they do not receive SaaS tenants.

The platform combines a 52-agent AI swarm, full CRM, e-commerce, marketing automation, voice AI, website builder, SEO tools, video generation, workflow engine, and analytics into a unified command center.

---

## AI Agent Swarm (52 Agents)

The platform runs a hierarchical AI agent swarm: 1 Master Orchestrator, 9 Domain Managers, 38 Specialists, and 4 Standalone Agents.

### Master Orchestrator (L1)
- **Role:** Swarm CEO — routes commands to the 9 domain managers
- **Capabilities:** Command dispatch, saga workflows, intent-based domain routing, cross-domain synchronization
- **Direct Reports:** Intelligence, Marketing, Builder, Architect, Commerce, Outreach, Content, Revenue, Reputation managers

### Intelligence Manager (L2) — 5 Specialists
Handles market research, competitive analysis, and data gathering.
- **Scraper Specialist** — Website scraping, content extraction, contact discovery, business signal detection
- **Competitor Researcher** — Competitor discovery, SEO analysis, market positioning, feature comparison, gap analysis
- **Technographic Scout** — Tech stack detection, platform identification, analytics/pixel detection
- **Sentiment Analyst** — Sentiment scoring, trend detection, social listening, crisis detection
- **Trend Scout** — Market trends, emerging patterns, opportunity identification

### Marketing Manager (L2) — 6 Specialists
Handles social media strategy, SEO, and growth analytics across all platforms.
- **TikTok Expert** — Viral hooks, video pacing, trending sounds, retention optimization
- **Twitter/X Expert** — Thread architecture, engagement replies, viral detection
- **Facebook Expert** — Ad creative, audience matching, A/B testing variations
- **LinkedIn Expert** — B2B targeting, thought leadership, connection strategy
- **SEO Expert** — Keyword research, on-page optimization, SERP analysis, link building
- **Growth Analyst** — Metrics aggregation, KPI tracking, pattern identification, weekly reports

### Builder Manager (L2) — 4 Specialists
Handles website construction, UX design, and deployment.
- **UX/UI Architect** — Interface design, component libraries, accessibility, design tokens
- **Funnel Engineer** — Conversion funnels, landing page optimization, A/B test setup
- **Asset Generator** — Image generation, logo creation, banner design, social graphics
- **Workflow Optimizer** — Process automation, efficiency metrics, bottleneck detection

### Architect Manager (L2) — 3 Specialists
Handles strategic site architecture and conversion optimization.
- **UX/UI Specialist** — Component selection, wireframes, responsive layout, accessibility audit
- **Funnel Pathologist** — Funnel architecture (Lead Magnet → Tripwire → Core Offer → Upsell), 8 business templates
- **Copy Specialist** — 6 copywriting frameworks (PAS, AIDA, BAB, FAB, 4Ps, StoryBrand), headline formulas, CTA optimization

### Commerce Manager (L2) — 4 Specialists
Handles all e-commerce operations from product catalog to checkout.
- **Payment Specialist** — Stripe checkout sessions, payment intents, refunds, webhook handling
- **Catalog Manager** — Product CRUD, variant management, inventory tracking
- **Pricing Strategist** — Dynamic pricing, discount strategies, margin optimization
- **Inventory Manager** — Stock tracking, reorder automation, demand forecasting

### Outreach Manager (L2) — 2 Specialists
Handles multi-channel communication campaigns.
- **Email Specialist** — Email campaigns, sequence building, template rendering, deliverability
- **SMS Specialist** — SMS campaigns, two-way messaging, compliance, E.164 validation

### Content Manager (L2) — 3 Specialists
Handles content production across all formats.
- **Copywriter** — Headlines, ad copy, landing pages, email copy, brand voice
- **Calendar Coordinator** — Content scheduling, cross-platform sync, publishing automation
- **Video Specialist** — Video scripts, storyboards, audio cues, video SEO, thumbnails

### Revenue Director (L2) — 5 Specialists
Handles the full sales pipeline from lead qualification to deal closing.
- **Lead Qualifier** — BANT scoring (Budget/Authority/Need/Timeline), ICP alignment, qualification tiers (HOT/WARM/COLD)
- **Outreach Specialist** — 8 outreach frameworks (cold intro, competitor displacement, trigger event, referral, etc.)
- **Merchandiser** — 7 nudge strategies (engagement, cart abandonment, win-back, trial conversion, referral, seasonal, loyalty)
- **Deal Closer** — Closing strategies, deal progression, win/loss analysis
- **Objection Handler** — Objection response strategies, battlecard generation, pain point resolution

### Reputation Manager (L2) — 4 Specialists
Handles brand trust, reviews, and local SEO.
- **Review Specialist** — Star-rating response logic (1-5 star templates), platform-specific responses (Google/Yelp/Facebook/Trustpilot/G2)
- **GMB Specialist** — Google My Business optimization, map pack ranking, NAP consistency, local keyword optimization
- **Review Manager** — Review response management, crisis handling, review solicitation
- **Case Study Specialist** — Case study creation, testimonial synthesis, success story formatting

### Standalone Agents (4)
- **Jasper** — Platform AI assistant, primary human interface, delegates to all 9 domain managers
- **Voice Agent** — AI phone conversations with prospector and closer modes, warm transfer to humans
- **Autonomous Posting Agent** — Scheduled social media posting across LinkedIn and Twitter/X
- **Chat Session Service** — Agent instance lifecycle management, Golden Master spawning

---

## Feature Categories (16 Systems)

### 1. CRM (Fully Operational)
Complete contact and deal management system.
- **Contacts:** Full CRUD, VIP tagging, company/owner filtering, pagination
- **Deals:** Pipeline stages (Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost)
- **Activities:** Activity logging, timeline view, statistics, AI-powered insights
- **Deal Health:** AI deal health scoring, recommendations, pipeline health checks
- **Duplicates:** Detection and merging
- **Analytics:** Sales velocity tracking
- **API Routes:** 14 endpoints under /api/contacts/, /api/deals/, /api/crm/
- **Dashboard:** Contacts list/detail/edit, deals pipeline, CRM dashboard

### 2. Lead Generation & Scoring (Fully Operational)
AI-powered lead discovery, enrichment, and scoring.
- **Lead Management:** Full CRUD with status tracking (new/contacted/qualified/converted/lost)
- **AI Scoring:** 0-100 scale — Company Fit (40pts), Person Fit (30pts), Intent Signals (20pts), Engagement (10pts)
- **Enrichment:** Company and person discovery via Discovery Engine
- **Nurture Sequences:** Automated multi-step lead nurturing
- **Research:** AI-powered lead research tools
- **Web Scraper:** Built-in scraper for lead discovery
- **API Routes:** 6 endpoints under /api/leads/
- **Dashboard:** Lead list, scoring dashboard, research tools, scraper

### 3. Email & Campaigns (Fully Operational)
Multi-provider email system with campaign management.
- **Providers:** SendGrid (REST API), Resend (REST API), SMTP
- **Campaigns:** Full CRUD, bulk sending with batching and rate limiting
- **Tracking:** Open tracking (pixel), click tracking, link tracking
- **Compliance:** CAN-SPAM compliance service
- **Webhooks:** Email event processing, inbound email handling, Gmail push notifications
- **API Routes:** 5 routes + 3 webhook handlers
- **Dashboard:** Campaign list/detail/create, email writer, email builder

### 4. Social Media (Fully Operational)
Multi-platform social media management with AI coaching.
- **Platforms:** Twitter/X (OAuth 2.0 PKCE + API v2), LinkedIn (OAuth)
- **Posting:** Create, schedule, queue, approve/reject workflow
- **Content Calendar:** Visual calendar for planned content
- **Social Listening:** Monitor mentions, keywords, trends
- **AI Coaching:** Playbook system with performance coaching
- **Brand Training:** Brand DNA integration for content generation
- **Media:** Upload and manage media assets
- **Cron Jobs:** Scheduled publisher, metrics collector, listening collector
- **API Routes:** 25 endpoints under /api/social/
- **Dashboard:** Playbook, training pages

### 5. E-Commerce & Payments (Fully Operational)
Full e-commerce with multi-provider payment processing.
- **Payment Providers:** Stripe (primary), PayPal, Square, Authorize.net, 2Checkout, Mollie
- **Checkout:** Cart management, discount/coupon application, tax calculation, shipping calculation
- **Subscriptions:** 4 tiers — Free ($0), Starter ($29/mo), Professional ($99/mo), Enterprise ($299/mo)
- **Orders:** Full order management with status tracking
- **Product Catalog:** Full CRUD with variants, SKU, stock tracking, digital products, categories, images, SEO metadata
- **Stripe Integration:** PaymentIntent, Checkout Sessions, webhooks (payment success, subscription lifecycle, refunds)
- **API Routes:** 10+ endpoints under /api/checkout/, /api/ecommerce/, /api/subscriptions/
- **Dashboard:** Orders, storefront settings, product management

### 6. Website Builder (Fully Operational)
Full CMS and page builder with blog, templates, and custom domains.
- **Pages:** CRUD, publishing, preview, version history
- **Blog:** Post CRUD, publishing, categories, RSS feed
- **Templates:** Page template system
- **Navigation:** Navigation menu management
- **Domains:** Custom domain management with Vercel, subdomain support, DNS verification
- **SEO:** XML sitemap, robots.txt, LLMs.txt for AI crawlers
- **AI Content:** AI-powered content generation
- **Migration:** Content migration tools
- **Audit Log:** Edit trail tracking
- **API Routes:** 26 endpoints under /api/website/
- **Dashboard:** Page editor, page list

### 7. Voice AI & TTS (Fully Operational)
Multi-provider voice system with AI phone conversations.
- **TTS Providers:** ElevenLabs, Unreal Speech
- **Voice Calls:** Twilio integration for outbound calls, TwiML response generation
- **AI Conversation:** Real-time AI phone agent powered by Gemini with <2s latency
- **Conversation Modes:** Prospector (lead qualification) and Closer (deal closing)
- **State Machine:** GREETING → QUALIFYING → PITCHING → OBJECTION_HANDLING → TRANSFER/CLOSE
- **Human Transfer:** Warm transfer to human agents when needed
- **CRM Integration:** All calls logged as CRM activities
- **Speech-to-Text:** Whisper integration for transcription
- **API Routes:** 7 endpoints + webhook under /api/voice/
- **Dashboard:** Call history, make a call, voice settings

### 8. Video Generation (Operational — Provider Keys Required)
AI video creation with storyboard pipeline.
- **Providers:** HeyGen (avatar videos), Runway ML (AI generation), Sora
- **Pipeline:** Script decomposition → Scene generation → Multi-model rendering → Stitching → Upload
- **Storyboard:** AI-powered storyboard creation with Brand DNA integration
- **Project Management:** Save, list, track video projects
- **Style Guide:** Automatic Brand DNA integration for consistent branding
- **API Routes:** 13 endpoints under /api/video/
- **Dashboard:** Video content page
- **Note:** Fully functional when provider API keys are configured; shows waitlist when absent

### 9. SEO Suite (Fully Operational)
Comprehensive SEO analysis and optimization tools.
- **Domain Analysis:** Full domain audit via Serper, PageSpeed Insights, DataForSEO
- **Google Search Console:** Property listing, performance data
- **Keyword Tracking:** SERP position tracking with caching
- **Strategy Generation:** AI-powered SEO strategy recommendations
- **AI Search Optimization:** Optimize for AI search engines
- **API Routes:** 5 endpoints under /api/seo/, /api/admin/seo/, /api/admin/growth/seo/
- **Dashboard:** SEO training page

### 10. Workflow & Automation Engine (Fully Operational)
Visual workflow builder with rich action library.
- **Trigger Types:** Scheduled (cron), webhook (HMAC-verified), Firestore entity changes
- **Action Types:** Send email, send SMS, send Slack message, HTTP requests, delays, entity operations (CRM), conditional branching, loops, AI agent invocation
- **Visual Builder:** Drag-and-drop workflow designer
- **Execution:** Manual and automated execution with run history
- **API Routes:** 6 endpoints under /api/workflows/
- **Dashboard:** Workflow list, visual builder, execution history, settings

### 11. Forms (Fully Operational)
Form builder with CRM integration.
- **Builder:** Create forms with custom field definitions
- **Publishing:** Publish forms for external access
- **Submissions:** Response mapping, view tracking, submission analytics
- **CRM Integration:** Form submissions automatically create leads
- **API Routes:** 3 endpoints under /api/forms/
- **Dashboard:** Form list, form editor

### 12. Analytics & Reporting (Fully Operational)
Comprehensive analytics across all business functions.
- **Revenue:** Revenue by period, source, product, sales rep
- **Pipeline:** Pipeline stage analysis, trends
- **Forecasting:** Conservative, moderate, and aggressive sales forecasts
- **Win/Loss:** Deal outcome analysis
- **Attribution:** Marketing attribution tracking
- **E-Commerce:** E-commerce performance metrics
- **Lead Scoring:** Lead quality analytics
- **Workflow:** Workflow execution analytics
- **API Routes:** 9 endpoints under /api/analytics/
- **Dashboard:** Revenue, pipeline, attribution, e-commerce, sales, workflow analytics, main dashboard, performance metrics

### 13. Brand DNA (Fully Operational)
Central brand identity system that feeds all AI agents.
- **Profile:** Company description, unique value proposition, target audience, tone of voice, communication style
- **Vocabulary:** Key phrases to use, phrases to avoid
- **Context:** Industry, competitors
- **Integration:** Syncs to voice AI, social media, SEO, content generation, video storyboards
- **Per-Tool Overrides:** Tool-specific training contexts
- **API Routes:** /api/identity/
- **Dashboard:** Brand DNA refinement, persona config, agent training, onboarding

### 14. Calendar & Scheduling (Fully Operational)
Google Calendar and Outlook integration with smart scheduling.
- **Google Calendar:** OAuth integration, event creation, attendees, Google Meet conferencing
- **Outlook:** Calendar sync service
- **Meeting Scheduler:** Auto-assignment via scheduler engine
- **Social Calendar:** Content calendar for social media scheduling
- **API Routes:** Meeting scheduling, Google OAuth, social calendar
- **Dashboard:** Meeting scheduler settings

### 15. SMS (Fully Operational)
Multi-provider SMS messaging.
- **Providers:** Twilio, Vonage
- **Features:** Two-way messaging, webhook handling
- **Compliance:** DNC list management, frequency throttling

### 16. Integrations Hub (Fully Operational)
OAuth integrations with major business platforms.
- **Connected:** Google (Calendar, Search Console), Microsoft/Outlook, Slack, HubSpot, Zoom, QuickBooks, Xero, Shopify
- **OAuth Flows:** 18 integration routes with token management
- **API Routes:** Under /api/integrations/

---

## Additional Systems

| System | Status | Description |
|--------|--------|-------------|
| A/B Testing | Operational | Test service with variant management |
| Proposals | Operational | Proposal builder with templates |
| Academy/Training | Operational | Courses, certifications, learning paths |
| Coaching | Operational | Team coaching and performance tracking |
| Backup | Operational | Firestore backup service with admin controls |
| Sequences | Operational | Multi-step outbound sequences |
| Cron Jobs | Operational | 6 scheduled jobs: intelligence sweep, process sequences, scheduled publisher, social metrics, social listening, operations cycle |

---

## Platform Scale

| Metric | Count |
|--------|-------|
| API Endpoints | 281 |
| Dashboard Pages | 177 |
| AI Agents | 52 (48 swarm + 4 standalone) |
| Service Files | 90+ |
| Cron Jobs | 6 |
| Integration OAuth Flows | 18 |

---

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (serverless, auto-deploy from main branch)
- **Database:** Firebase Firestore (Admin SDK for server, client SDK for frontend)
- **Authentication:** Firebase Auth with custom claims (admin/user RBAC)
- **AI Gateway:** OpenRouter (100+ models), direct OpenAI, Anthropic, Gemini support
- **Voice:** Twilio (calls), ElevenLabs + Unreal Speech (TTS), Gemini (conversation AI), Whisper (STT)
- **Payments:** Stripe (primary), PayPal, Square, Mollie, Authorize.net, 2Checkout
- **Email:** SendGrid, Resend, SMTP
- **SMS:** Twilio, Vonage
- **Video:** HeyGen, Runway ML, Sora
- **SEO:** Serper API, Google Search Console, PageSpeed Insights, DataForSEO
- **Storage:** Firebase Storage (uploads, video assets)
- **Domains:** Vercel API for custom domain management

---

## Architecture

### Penthouse Model (Single-Tenant)
- One organization: `rapid-compliance-root`
- All data in single Firestore project: `rapid-compliance-65f87`
- No org-switching, no tenant isolation, no multi-org logic
- Binary RBAC: admin or user
- Clients purchase services — they do NOT receive SaaS tenants

### Service Layer Architecture
- Business logic in service files under `src/lib/`
- API routes are thin wrappers with Zod validation
- Firebase Admin SDK for all server-side Firestore operations
- Client SDK only for frontend real-time listeners

### Golden Master Pattern
- Each AI agent instance spawns from a Golden Master configuration
- Golden Master includes: Brand DNA, persona, behavior config, knowledge base (FAQs, docs, products)
- RAG enhancement from uploaded knowledge documents
- Vector search for semantic knowledge retrieval

### Agent Delegation
Jasper (the platform AI) delegates work to domain managers via tool calls:
- `scrape_website` → Intelligence Manager → Scraper Specialist
- `research_competitors` → Intelligence Manager → Competitor Researcher
- `scan_tech_stack` → Intelligence Manager → Technographic Scout
- `delegate_to_marketing` → Marketing Manager → TikTok/Twitter/Facebook/LinkedIn/SEO/Growth specialists
- `delegate_to_architect` → Architect Manager → UX/UI/Funnel/Copy specialists
- `delegate_to_builder` → Builder Manager → UX/UI/Funnel/Asset/Workflow specialists
- `delegate_to_commerce` → Commerce Manager → Payment/Catalog/Pricing/Inventory specialists
- `delegate_to_outreach` → Outreach Manager → Email/SMS specialists
- `delegate_to_content` → Content Manager → Copywriter/Calendar/Video specialists
- `delegate_to_sales` → Revenue Director → Lead Qualifier/Outreach/Merchandiser/Deal Closer/Objection Handler
- `delegate_to_trust` → Reputation Manager → Review/GMB/Review Manager/Case Study specialists

---

## Security Model

- Firebase Auth for authentication (email/password, Google OAuth)
- Custom claims for RBAC (admin/user)
- All API routes verify auth tokens via Firebase Admin SDK
- Zod validation on all API inputs
- Stripe webhook signature verification
- Twilio webhook signature verification
- Social OAuth with PKCE and encrypted tokens
- Rate limiting on public endpoints
- CAN-SPAM compliance for email
- DNC list management for SMS/voice
