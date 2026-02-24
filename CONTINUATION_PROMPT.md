# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 20, 2026 (Session 32 — SEO & AI Search Optimization Planning)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **173 physical routes**, **271 API endpoints**, **330K+ lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Pre-commit hooks — **PASSES** (bypass ratchet 23/26, Windows-safe tsc runner)

### Production Readiness: ~95%
- Sessions 1-31 completed all stabilization, feature buildout, audit fixes, and deployment
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
| **Search** | PARTIAL | Serper.dev wired (needs API key), Google Custom Search (needs keys) |

---

## Known Open Issues

| Issue | Details |
|-------|---------|
| Facebook/Instagram missing | Blocked: Meta Developer Portal |
| LinkedIn unofficial | Uses RapidAPI, blocked: Marketing Developer Platform |
| 23 eslint-disable comments | Budget 23/26 — 2 are `no-implied-eval` (sandboxed with input sanitization) |
| SEO agent data | SEO Expert agent has analysis engines but external data requires API integration |
| Competitor Researcher data | Discovery/search returns empty without API keys (Serper, Google Custom Search) |

---

## SESSION 32+: SEO Intelligence & AI Search Optimization

### Overview

Build a production-grade SEO competitive intelligence system with two entry points:
1. **Jasper-initiated** — natural language command triggers delegation, user auto-navigated to SEO page
2. **Manual mode** — user enters competitor domain, iterative analyze → enrich → re-run loop

Simultaneously implement AI Search Optimization (AIO/GEO) to prepare for AI-driven search replacing traditional browser search.

### Why This Matters

| Metric | Value |
|--------|-------|
| Consumers starting searches with AI | 37% |
| Google results showing AI Overviews | 47% |
| AI referral conversion rate vs Google organic | 15.9% vs 1.76% (9x higher) |
| AI traffic growth vs organic traffic growth | 165x faster |
| B2B AI search adoption vs consumers | 3x higher |
| Projected AI-Google conversion parity | Late 2027 - Early 2028 |

---

### Sprint 14: Wire Real SEO Data APIs

**Goal:** Replace simulated/placeholder data in SEO Expert and Competitor Researcher agents with real external data.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 14.1 | **Serper.dev integration** | Add `SERPER_API_KEY` to env, verify `search-service.ts` integration works end-to-end. Test SERP data retrieval (organic results, People Also Ask, related searches). | ~2h |
| 14.2 | **DataForSEO integration** | Create `src/lib/integrations/dataforseo-service.ts`. Endpoints: keyword volume/difficulty, domain metrics, backlink summary, competitor keywords, SERP position tracking. Pay-per-task (~$0.01-0.05/task). | ~6h |
| 14.3 | **Google PageSpeed Insights** | Wire free Google API into SEO Expert's `crawl_analysis` action for real Core Web Vitals, speed scores, and performance metrics. | ~2h |
| 14.4 | **Google Search Console API** | Create `src/lib/integrations/gsc-service.ts`. OAuth2 flow to connect user's GSC property. Pull own rankings, impressions, clicks, indexing status. Add to Settings/Integrations page. | ~4h |
| 14.5 | **Wire agents to real data** | Update `seo/specialist.ts` and `competitor/specialist.ts` to call real APIs instead of returning simulated data. Replace estimated domain authority with DataForSEO metrics. | ~4h |

---

### Sprint 15: Competitor SEO Analysis Page

**Goal:** Build the iterative competitor analysis UI at `/seo/competitors` (or `/website/seo/competitors`).

| # | Task | Details | Effort |
|---|------|---------|--------|
| 15.1 | **Competitor input form** | Domain entry field + "Analyze" button. Support bulk entry (comma-separated domains). Store competitor list in Firestore. | ~2h |
| 15.2 | **Analysis results dashboard** | Per-competitor cards showing: top keywords, domain metrics, backlink count, content strategy summary, technical SEO score, Core Web Vitals. | ~4h |
| 15.3 | **Keyword gap analysis** | Side-by-side view: your keywords vs competitor keywords. Highlight gaps (keywords they rank for that you don't). Filter by difficulty, volume, intent. | ~4h |
| 15.4 | **Enrich & re-run loop** | "Enrich" button triggers deeper analysis (backlink breakdown, content audit, tech stack detection). "Re-run" refreshes data. Results update in real-time via polling or SSE. | ~3h |
| 15.5 | **Cost-to-compete estimate** | For each gap keyword, estimate: content needed, backlinks needed, time to rank, approximate cost. Aggregate into "beat this competitor" budget estimate. | ~3h |
| 15.6 | **Strategy generator** | "Generate Plan" button triggers SEO Expert's `30_day_strategy` action with competitor data as context. Display phased action plan with daily tasks. | ~2h |
| 15.7 | **SubpageNav integration** | Add "Competitors" tab to `/website/seo` SubpageNav. Update sidebar routing. | ~1h |

---

### Sprint 16: Jasper → SEO Delegation Pipeline

**Goal:** Enable natural language commands to Jasper that trigger SEO analysis and auto-navigate the user to results.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 16.1 | **Jasper SEO delegation tool** | Add `delegate_to_seo_analysis` tool to `jasper-tools.ts`. Input: competitor domain(s), analysis depth, focus areas. Output: analysis ID for tracking. | ~3h |
| 16.2 | **Intelligence Manager → SEO Expert wiring** | Ensure Intelligence Manager correctly routes SEO research tasks to both Competitor Researcher and SEO Expert in parallel. Results merge via Memory Vault. | ~3h |
| 16.3 | **Real-time result streaming** | Create `/api/seo/analysis/[analysisId]/status` SSE endpoint. Streams agent progress (started → scraping → analyzing → enriching → complete). UI subscribes and shows live progress. | ~4h |
| 16.4 | **Auto-navigation from chat** | When Jasper completes delegation, response includes a link/action that navigates user to `/website/seo/competitors?analysis={id}`. Results pre-populated. | ~2h |
| 16.5 | **Jasper context injection** | Jasper's response synthesizes key findings: "Your competitor ranks for 47 keywords you're missing. Top opportunity: [keyword] with 2,400 monthly searches and low difficulty. View full analysis →" | ~2h |

---

### Sprint 17: AI Search Optimization (AIO/GEO)

**Goal:** Implement technical optimizations and monitoring for AI search visibility.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 17.1 | **robots.txt AI crawler allowlist** | Update `/api/website/robots.txt` to allow GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, cohere-ai. Add dashboard toggle per crawler. | ~2h |
| 17.2 | **Create /llms.txt route** | New route at `/api/website/llms.txt` serving Markdown description of the site for LLM inference. Auto-generate from site pages/blog/products. Dashboard editor. | ~3h |
| 17.3 | **JSON-LD schema markup** | Add structured data components: Organization (site-wide), SoftwareApplication (product pages), FAQPage (pricing/features), Article (blog posts), BreadcrumbList (all pages), AggregateRating (testimonials). | ~4h |
| 17.4 | **SSR audit for marketing pages** | Verify all public-facing pages (pricing, features, blog, about, contact) use SSR/SSG, not client-only rendering. Fix any that AI crawlers can't parse. | ~2h |
| 17.5 | **AI visibility monitoring** | Create `/seo/ai-visibility` dashboard page. Integration with Otterly AI or similar API ($29/mo) to track brand mentions across ChatGPT, Perplexity, Gemini, Google AI Overviews. Share-of-voice vs competitors. | ~6h |
| 17.6 | **Content optimization scoring** | Add AIO score to blog post editor: checks for front-loaded answers (first 60 words), heading structure, entity density, semantic completeness, FAQ schema, author E-E-A-T signals. | ~4h |
| 17.7 | **AI search referral tracking** | Add Google Analytics segment for AI referral traffic (chat.openai.com, perplexity.ai, etc.). Dashboard widget showing AI vs organic conversion rates. | ~2h |

---

### Execution Order

```
Sprint 14 (Next):    Wire real SEO data APIs (Serper, DataForSEO, PageSpeed, GSC)
Sprint 15:           Build competitor SEO analysis page with iterative loop
Sprint 16:           Jasper → SEO delegation pipeline with auto-navigation
Sprint 17:           AI Search Optimization (robots.txt, llms.txt, schema, monitoring)
```

Sprints 14-15 can partially overlap (API wiring feeds into UI).
Sprint 17 tasks are independent and can be interleaved with Sprints 15-16.

---

### API Cost Estimates

| Service | Cost Model | Estimated Monthly |
|---------|-----------|-------------------|
| **Serper.dev** | $5 / 1,000 searches | ~$10-25 |
| **DataForSEO** | Pay-per-task ($0.01-0.05) | ~$20-50 |
| **Google PageSpeed Insights** | Free | $0 |
| **Google Search Console** | Free | $0 |
| **Otterly AI** (AI visibility monitoring) | $29/mo flat | $29 |
| **Total** | | ~$60-100/mo |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/agents/marketing/seo/specialist.ts` | SEO Expert agent (1,380 LOC) |
| `src/lib/agents/intelligence/competitor/specialist.ts` | Competitor Researcher agent |
| `src/lib/battlecard/battlecard-engine.ts` | Competitive intelligence engine |
| `src/lib/enrichment/search-service.ts` | Multi-API search (Serper, Google, fallback) |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's function-calling tools |
| `src/lib/orchestrator/jasper-command-authority.ts` | Jasper delegation + briefings |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication |
| `src/lib/agents/orchestrator/manager.ts` | Master Orchestrator — Saga Pattern |
| `src/app/(dashboard)/website/seo/page.tsx` | SEO management dashboard |
| `src/app/(dashboard)/seo/training/page.tsx` | SEO training lab |
| `vercel.json` | Cron jobs, CORS, security headers |

---

## Session History (Archived)

Sessions 1-31 completed all platform stabilization, feature buildout, nav consolidation, production audits, and deployment. Details in git history and `docs/archive/`. Key milestones:
- Sessions 1-8: Core infrastructure (saga persistence, kill switch, revenue attribution, integrations)
- Sessions 9-13: QA audits (14 Critical + 45 Major resolved)
- Sessions 14-18: Auth fixes, website editor, Playwright E2E infrastructure
- Sessions 19-24: Feature completion (8 sprints, 36 features, all dashboard modules)
- Session 25: Nav consolidation (13 sections → 8) + full production audit
- Sessions 26-27: All 28 audit blockers resolved (commerce, fake data, Zod, workflows)
- Sessions 28-29: Test suite (1,289 Jest + 165 Playwright tests), CI/CD pipeline overhaul
- Session 30: Production deployment — merged to main, Vercel auto-deploy
- Session 31: Final code readiness audit — all 13 items resolved, 123 new tests
