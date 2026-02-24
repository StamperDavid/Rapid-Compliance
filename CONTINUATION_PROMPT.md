# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 24, 2026 (Session 38 — Sprint 23: Mission Control Live Stream)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **174 physical routes**, **277 API endpoints**, **330K+ lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Pre-commit hooks — **PASSES** (bypass ratchet 23/26, Windows-safe tsc runner)

### Production Readiness: ~95%
- Sessions 1-37 completed all stabilization, feature buildout, audit fixes, and deployment
- 49 Jest suites (1,289 tests), 18 Playwright E2E specs (~165 tests), all passing
- Zero TODO comments, zero console statements in src/, zero `@ts-ignore`
- CI/CD pipeline: 4 parallel jobs (lint+typecheck, unit tests, Playwright, build)

### Integration Status

| Integration | Status | Notes |
|---|---|---|
| **Twitter/X** | REAL | API v2, OAuth2 PKCE, posting, media, engagement |
| **LinkedIn** | PARTIAL | RapidAPI wrapper. Needs official API (blocked: app approval) |
| **Facebook/Instagram** | NOT BUILT | Blocked: Meta Developer Portal approval |
| **Stripe** | REAL | PaymentElement (3DS), webhooks, subscriptions via Checkout Sessions |
| **Mollie** | REAL | Webhook handler, payment status updates, order reconciliation |
| **Email** | REAL | SendGrid/Resend/SMTP, open/click tracking, CAN-SPAM unsubscribe |
| **Voice** | REAL | Twilio/Telnyx — call initiation, control, conferencing |
| **TTS** | REAL | ElevenLabs — 20+ premium voices |
| **Video** | REAL | HeyGen/Sora/Runway APIs via render pipeline |
| **AI Images** | REAL | DALL-E 3 with size mapping and graceful fallback |
| **Firebase** | REAL | Auth + Firestore, single-tenant |
| **OpenRouter** | REAL | AI gateway, 100+ models |
| **SEO Data** | REAL | DataForSEO, Serper, PageSpeed Insights, Google Search Console |

---

## Known Open Issues

| Issue | Details |
|-------|---------|
| Facebook/Instagram missing | Blocked: Meta Developer Portal |
| LinkedIn unofficial | Uses RapidAPI, blocked: Marketing Developer Platform |
| 23 eslint-disable comments | Budget 23/26 — 2 are `no-implied-eval` (sandboxed with input sanitization) |
| 4 webhook endpoints fail open | SendGrid, Gmail, Twilio SMS/Voice skip signature verification if env var missing |
| Feature toggle GET unauthenticated | Exposes feature list without auth |
| Workflow engine no timeout | Workflows can hang indefinitely or trigger infinite loops |

---

## Jasper Delegation Status (Audited February 23, 2026)

### What Jasper CAN Do Today
- **Research companies/competitors** — `scrape_website`, `research_competitors`, `scan_tech_stack` (via Intelligence Manager)
- **Generate content** — `generate_content` tool (blog articles, social posts, emails, ad copy, newsletters, landing pages)
- **Delegate to Marketing** — `delegate_to_marketing` (campaigns, viral hooks, threads, ad creatives)
- **Delegate to Builder** — `delegate_to_builder` (website/funnel blueprints, design systems, copy)
- **Delegate to Sales** — `delegate_to_sales` (lead qualification, outreach, pipeline analysis, deal closing)
- **Delegate to Trust** — `delegate_to_trust` (reputation, reviews, GMB, brand health, crisis handling)
- **Delegate to specialist agents** — `delegate_to_agent` (YouTube, TikTok, Instagram, Twitter, LinkedIn, Pinterest, Facebook, Newsletter, Web Migrator, Lead Hunter, Truth Social)
- **Video creation** — `create_video`, `get_video_status`
- **Analytics & reporting** — `get_analytics`, `generate_report`
- **Lead management** — `scan_leads`, `enrich_lead`, `score_leads`
- **Platform management** — organizations, users, coupons, pricing tiers

### What Jasper CANNOT Do Yet (Gaps)

| Gap | Missing Tool | Impact |
|-----|-------------|--------|
| No broad trend research | No web search/trend scanning tool | Can't "research trending topics in agentic AI" |
| No Content Manager delegation | No `delegate_to_content` tool | Can't invoke full Content Manager pipeline (Brand DNA, SEO injection, calendar) |
| No Architect delegation | No `delegate_to_architect` tool | Can't trigger strategic blueprints, UX specs, funnel architecture |
| No Outreach delegation | No `delegate_to_outreach` tool | Can't trigger email/SMS sequence orchestration |
| No Intelligence delegation | No `delegate_to_intelligence` tool | Can't invoke full Intelligence Manager (only individual tools) |
| No Commerce delegation | No `delegate_to_commerce` tool | Can't invoke Commerce Manager for checkout orchestration |
| No blog save-as-draft bridge | `generate_content` generates text but doesn't save to Firestore blog system | Can't complete generate → draft → publish loop |
| No live delegation tracking UI | No "follow along" / mission control view | User can't watch multi-step delegations in real-time |
| `web_migrator` is a stub | `migrate_website` action declared but returns `status: 'queued'` with no implementation | Can't clone/replicate external websites into the builder — **Sprint 21** |

---

## NEXT: Sprint 18 — Jasper Mission Control (Live Delegation Tracker)

### Overview

Build a general-purpose **Mission Control** UI that lets users watch Jasper's delegation chains in real-time. When Jasper breaks a complex request into sub-tasks and delegates to managers/specialists, the user sees a live timeline with status updates, the ability to intervene, and auto-navigation to relevant pages when work completes.

**Why:** Transparency builds trust. Users won't rely on Jasper for complex multi-step workflows if they can't see what's happening. The Social Command Center already proves this pattern works — this extends it to ALL 9 domain managers.

### Feature Name: **Mission Control**

**Route:** `/(dashboard)/mission-control`
**Concept:** "Air Traffic Control for your AI workforce"

### Architecture

The backend infrastructure already exists:
- **Saga Persistence** (`src/lib/orchestration/saga-persistence.ts`) — checkpoints, steps, finalization, event logging
- **Signal Bus** (`src/lib/agents/shared/tenant-memory-vault.ts`) — cross-agent signals (BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN)
- **Jasper Command Authority** (`src/lib/orchestrator/jasper-command-authority.ts`) — command dispatch, approval gateway, command history
- **Social Command Center** (`/social/command-center`) — existing proof of concept for agent observation

### Sprint Plan

| # | Task | Details | Effort |
|---|------|---------|--------|
| 18.1 | **Mission event API** | Create `POST /api/orchestrator/missions` to create a mission (saga wrapper) when Jasper starts a complex delegation. Create `GET /api/orchestrator/missions/[missionId]` SSE endpoint streaming mission events in real-time. Event types: `mission.started`, `step.delegated`, `step.in_progress`, `step.completed`, `step.failed`, `step.awaiting_approval`, `mission.completed`. | ~4h |
| 18.2 | **Jasper tool instrumentation** | Update each `delegate_to_*` tool handler in `jasper-tools.ts` to: (1) create a mission if one doesn't exist for this conversation, (2) emit `step.delegated` events with manager name, task description, and expected outputs, (3) emit `step.completed` or `step.failed` when the delegation returns. | ~3h |
| 18.3 | **Mission Control page** | Build `/(dashboard)/mission-control/page.tsx`. Shows: active missions list (left panel), selected mission timeline (center), step detail panel (right). Timeline renders vertically with status icons (pending/running/done/failed), agent avatars, timestamps, and step descriptions. Auto-scrolls to latest event. | ~6h |
| 18.4 | **Mission detail timeline component** | `MissionTimeline.tsx` — SSE-connected component subscribing to `/api/orchestrator/missions/[missionId]`. Renders saga steps as a vertical timeline. Each step shows: agent name + avatar, task description, status badge, duration, outputs summary. Animated transitions between states. | ~4h |
| 18.5 | **Auto-navigation from Jasper chat** | When Jasper creates a mission, the chat response includes a "Watch Live →" action button that navigates to `/mission-control?mission={id}`. Jasper says something like: "I'm on it. I've kicked off a 3-step mission — research → content → publish. [Watch Live →]" | ~2h |
| 18.6 | **Approval gates in timeline** | When a step reaches `awaiting_approval` (from Jasper Command Authority approval gateway), the timeline shows an interactive approval card with: action description, risk level, approve/reject buttons. Approval updates the mission and continues the saga. | ~3h |
| 18.7 | **Mission history & replay** | `GET /api/orchestrator/missions` returns paginated list of past missions. Mission Control page has a "History" tab showing completed missions with outcome badges (success/partial/failed), total duration, and step count. Clicking opens the full timeline in read-only mode. | ~3h |
| 18.8 | **Sidebar + SubpageNav integration** | Add "Mission Control" to the Home section in `AdminSidebar.tsx` (between Dashboard and Conversations). Add as a tab option on the Dashboard SubpageNav. | ~1h |

### Sprint 19: Complete Jasper's Delegation Coverage — COMPLETE (Feb 24, 2026)

All delegation gaps closed. 7 new tools added to `jasper-tools.ts`:

| # | Task | Details | Effort |
|---|------|---------|--------|
| 19.1 | **`delegate_to_content` tool** | Wire Jasper → Content Manager. Input: content type, topic, Brand DNA context, SEO keywords. Triggers full Content Manager pipeline (Copywriter + Calendar + Video + Assets). | ~3h |
| 19.2 | **`delegate_to_architect` tool** | Wire Jasper → Architect Manager. Input: site type, industry, audience, funnel goals. Triggers SiteArchitecture + TechnicalBrief generation. | ~3h |
| 19.3 | **`delegate_to_outreach` tool** | Wire Jasper → Outreach Manager. Input: lead list, sequence type, channel preference. Triggers multi-step sequence orchestration with compliance checks. | ~3h |
| 19.4 | **`delegate_to_intelligence` tool** | Wire Jasper → Intelligence Manager as a unified entry point. Input: research type (competitor, market, tech, sentiment, trend), targets. Returns aggregated intelligence brief. | ~3h |
| 19.5 | **`delegate_to_commerce` tool** | Wire Jasper → Commerce Manager. Input: action type (checkout, catalog update, price change, inventory check). Triggers appropriate specialist. | ~2h |
| 19.6 | **Blog draft bridge** | Create `save_blog_draft` tool in Jasper that takes generated content and saves it as a blog post draft in Firestore (`blog-posts/{id}` with status: 'draft'). Returns the draft ID and a link to the blog editor. | ~2h |
| 19.7 | **Web trend research tool** | Add `research_trending_topics` tool that uses Serper/DataForSEO to find trending topics by industry/keyword, returns top trending themes with search volume and relevance scoring. | ~3h |

### End State

After Sprints 18-19, the full loop works:

```
User: "Jasper, research a trending topic in agentic AI, find how it relates to our business, and create a blog post about it"

Jasper: "I'm on it. I've created a 4-step mission:
1. Research trending agentic AI topics (→ Intelligence Manager)
2. Analyze relevance to SalesVelocity.ai (→ Jasper internal)
3. Generate blog article with SEO optimization (→ Content Manager)
4. Save as draft for your review (→ Blog system)
[Watch Live →]"

Mission Control shows each step executing in real-time.
User can watch, approve, or intervene at any point.
Blog draft appears in /website/blog when complete.
```

---

### Sprint 21 — Website Migration Pipeline ("Clone This Site")

#### Overview

Wire a fully functional pipeline that lets a user tell Jasper "I have a website I want you to duplicate" with just a URL, and have the system scrape, analyze, and reconstruct that site in the Website Builder. The `web_migrator` specialist and its `migrate_website` action already exist as stubs — this sprint makes them real.

**Why:** Instant website migration is a massive competitive differentiator. Prospects can see their existing site rebuilt inside SalesVelocity.ai in minutes, dramatically shortening the sales cycle. All building blocks already exist (scraper, AI page generator, website builder) — they just need to be connected.

#### Architecture

The pipeline follows this flow:

```
User → Jasper ("clone example.com")
  → Step 1: Deep Scrape (enhanced web-scraper.ts)
       Extract: page structure, section layout, copy, colors, fonts, CTAs, images, nav structure, meta/SEO
  → Step 2: Site Blueprint (new site-blueprint-extractor.ts)
       Normalize scraped data into a structured SiteBlueprint: pages[], globalStyles, navigation, brand
  → Step 3: Page Generation Loop (ai-page-generator.ts, enhanced)
       For each page in the blueprint, call generatePageFromPrompt() with the extracted structure/copy as context
  → Step 4: Assembly & Save (website-builder page API)
       Save all generated pages to Firestore, set homepage, configure nav, apply brand colors
  → Step 5: Report back to user with link to /website/editor
```

If Mission Control (Sprint 18) is complete, the entire pipeline streams live via SSE.

#### Sprint Plan

| # | Task | Details | Effort |
|---|------|---------|--------|
| 21.1 | **Enhanced deep scraper** | Extend `src/lib/enrichment/web-scraper.ts` with a new `deepScrape(url)` mode that extracts: HTML section structure (hero, features, testimonials, CTA, footer), all visible text per section, inline/computed styles (colors, fonts, spacing), image URLs, navigation links, meta tags, and Open Graph data. Returns a `DeepScrapeResult` typed object. | ~4h |
| 21.2 | **Multi-page crawler** | Add `crawlSite(url, maxPages)` that follows internal links from the homepage (same domain only, respecting robots.txt), runs `deepScrape` on each page, and returns a `SiteCrawlResult` with all pages and their relationships. Default max: 10 pages. | ~4h |
| 21.3 | **Site Blueprint Extractor** | New service `src/lib/website-builder/site-blueprint-extractor.ts`. Takes `SiteCrawlResult` → calls AI to normalize into a `SiteBlueprint` schema: `{ brand: { name, colors, fonts, logo }, pages: [{ type, title, sections: [{ type, heading, body, cta, images }] }], navigation: { items[] }, seo: { title, description, keywords } }`. Uses structured output from GPT-4o. | ~5h |
| 21.4 | **AI Page Generator enhancement** | Extend `ai-page-generator.ts` to accept an optional `SiteBlueprintPage` input that provides exact section structure, copy, and styling hints instead of generating from scratch. The AI replicates the layout and copy while adapting it to the website builder's widget system. | ~3h |
| 21.5 | **Migration orchestration service** | New service `src/lib/website-builder/site-migration-service.ts`. Orchestrates the full pipeline: `deepScrape` → `crawlSite` → `extractBlueprint` → loop `generatePage` → save all pages via website API → configure nav + brand. Emits saga events at each step for Mission Control visibility. Returns `MigrationResult` with page count, success/failure per page, and editor link. | ~5h |
| 21.6 | **Wire `web_migrator` specialist** | Replace the stub in `jasper-tools.ts` `executeDelegateToAgent` for `web_migrator` / `migrate_website`. Instead of returning `status: 'queued'`, call the migration orchestration service. Create mission events so the user can watch via Mission Control. | ~3h |
| 21.7 | **Migration API endpoint** | `POST /api/website/migrate` — accepts `{ sourceUrl, maxPages?, includeImages? }`, validates with Zod, authenticates, calls migration service. `GET /api/website/migrate/[migrationId]` SSE endpoint for progress streaming. | ~3h |
| 21.8 | **Migration UI (optional)** | Add a "Migrate Existing Site" button/card to the Website Builder dashboard that opens a modal: paste URL → confirm → watch progress. Falls back to Jasper chat if user prefers conversational approach. | ~3h |

**Total estimated effort: ~30h**

#### Dependencies

- **Hard dependency on Sprint 19.2** (`delegate_to_architect`) — the Architect Manager generates site blueprints; the migration pipeline's blueprint step benefits from the same infrastructure.
- **Soft dependency on Sprint 18** (Mission Control) — migration works without it, but live progress tracking is a much better UX.
- **No dependency on Sprint 20** (AI Search Optimization) — fully independent.

#### End State

```
User: "Jasper, I want you to clone example.com and rebuild it in our website builder"

Jasper: "On it. I'm launching a website migration mission:
1. Deep-scraping example.com and all linked pages (up to 10)
2. Extracting the site blueprint — layout, copy, brand colors, nav structure
3. Regenerating each page in our website builder
4. Assembling the full site with navigation and branding
[Watch Live →]"

Mission Control shows each page being scraped, analyzed, and generated.
~2-5 minutes later, user has a fully editable replica in /website/editor.
```

---

## Execution Order (Current Roadmap)

```
Sprint 18: COMPLETE  Jasper Mission Control — live delegation tracker UI
Sprint 19: COMPLETE  Complete Jasper delegation coverage (5 missing tools + blog bridge + trend research)
Sprint 20: COMPLETE  AI Search Optimization (robots.txt, llms.txt, schema markup, monitoring)
Sprint 21: COMPLETE  Website Migration Pipeline — "clone this site" via Jasper + web_migrator
Sprint 22: COMPLETE  Security Hardening — webhook fail-closed, workflow timeouts + depth limits
Sprint 23: COMPLETE  Mission Control Live Stream — SSE replaces polling, cancel button, tool args/results
```

All 6 sprints (18-23) are complete. Mission Control now has sub-second SSE streaming via Firestore onSnapshot, user-initiated mission cancellation, and full tool args/results visibility in step detail panels.

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 32 function-calling tools |
| `src/lib/orchestrator/jasper-command-authority.ts` | Jasper delegation + briefings + approval gateway |
| `src/lib/orchestration/saga-persistence.ts` | Saga checkpoints, event logging (Mission Control backend) |
| `src/lib/agents/orchestrator/manager.ts` | Master Orchestrator — Saga Pattern |
| `src/lib/agents/shared/tenant-memory-vault.ts` | Signal Bus — cross-agent communication |
| `src/app/(dashboard)/social/command-center/page.tsx` | Social Command Center (Mission Control prototype) |
| `src/app/api/orchestrator/chat/route.ts` | Jasper chat API |

---

## Session History (Archived)

Sessions 1-37 completed all platform stabilization, feature buildout, nav consolidation, production audits, deployment, SEO data integration, and Jasper delegation audit. Details in git history and `docs/archive/`. Key milestones:
- Sessions 1-8: Core infrastructure (saga persistence, kill switch, revenue attribution, integrations)
- Sessions 9-13: QA audits (14 Critical + 45 Major resolved)
- Sessions 14-18: Auth fixes, website editor, Playwright E2E infrastructure
- Sessions 19-24: Feature completion (8 sprints, 36 features, all dashboard modules)
- Session 25: Nav consolidation (13 sections → 8) + full production audit
- Sessions 26-27: All 28 audit blockers resolved (commerce, fake data, Zod, workflows)
- Sessions 28-29: Test suite (1,289 Jest + 165 Playwright tests), CI/CD pipeline overhaul
- Session 30: Production deployment — merged to main, Vercel auto-deploy
- Session 31: Final code readiness audit — all 13 items resolved, 123 new tests
- Sessions 32-35: SEO Intelligence planning + domain analysis hardening
- Sessions 36-37: Sprint 14/15 completion (competitor SEO analysis), Jasper delegation audit + Mission Control planning
