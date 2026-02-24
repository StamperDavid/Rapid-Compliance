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
- **176 physical routes**, **281 API endpoints**, **330K+ lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Pre-commit hooks — **PASSES** (bypass ratchet 23/26, Windows-safe tsc runner)

### Production Readiness: ~95%
- Sessions 1-38 completed all stabilization, feature buildout, audit fixes, and deployment
- 49 Jest suites (1,289 tests), 18 Playwright E2E specs (~165 tests), all passing
- Zero TODO comments, zero console statements in src/, zero `@ts-ignore`
- CI/CD pipeline: 4 parallel jobs (lint+typecheck, unit tests, Playwright, build)

### Integration Status

| Integration | Status | Notes |
|---|---|---|
| **Twitter/X** | REAL | API v2, OAuth2 PKCE, posting, media, engagement |
| **LinkedIn** | PARTIAL | RapidAPI wrapper. Blocked: official Marketing Developer Platform approval |
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

| Issue | Severity | Details |
|-------|----------|---------|
| Facebook/Instagram missing | BLOCKED | Requires Meta Developer Portal approval |
| LinkedIn unofficial | BLOCKED | Uses RapidAPI, requires Marketing Developer Platform approval |
| 16 eslint-disable comments | LOW | Budget 16/26 — 2 are `no-implied-eval` (sandboxed), rest are legitimate suppressions |

---

## Jasper Capabilities (All Delegation Tools Wired)

Jasper has **13 instrumented delegation tools** — all stream live to Mission Control with tool args/results:

| Tool | Target | Capability |
|------|--------|------------|
| `delegate_to_builder` | Architect Manager | Website/funnel blueprints, design systems, copy |
| `delegate_to_sales` | Revenue Director | Lead qualification, outreach, pipeline, deal closing |
| `delegate_to_marketing` | Marketing Manager | Campaigns, viral hooks, threads, ad creatives |
| `delegate_to_trust` | Reputation Manager | Reviews, GMB, brand health, crisis handling |
| `delegate_to_content` | Content Manager | Brand DNA, SEO injection, content calendar, video |
| `delegate_to_architect` | Architect Manager | Strategic blueprints, UX specs, funnel architecture |
| `delegate_to_outreach` | Outreach Manager | Email/SMS sequences with compliance checks |
| `delegate_to_intelligence` | Intelligence Manager | Competitor, market, tech, sentiment research |
| `delegate_to_commerce` | Commerce Manager | Checkout, catalog, pricing, inventory |
| `delegate_to_agent` | Any Specialist | YouTube, TikTok, Instagram, Twitter, LinkedIn, etc. |
| `save_blog_draft` | Firestore Blog | Generate → save as draft → editor link |
| `research_trending_topics` | Serper/DataForSEO | Trending topics by industry/keyword with volume |
| `migrate_website` | Migration Pipeline | Deep scrape → blueprint → AI page gen → assemble |

Additional tools: `create_video`, `get_video_status`, `get_analytics`, `generate_report`, `scan_leads`, `enrich_lead`, `score_leads`, `query_docs`, `get_platform_stats`, `inspect_agent_logs`, `generate_content`, `scrape_website`, `research_competitors`, `scan_tech_stack`, org/user/coupon/pricing management.

---

## Completed Sprints (18-23)

| Sprint | Summary |
|--------|---------|
| **18** | Mission Control — 3-panel live delegation tracker, approval gates, history, auto-nav from chat |
| **19** | Full delegation coverage — 5 new `delegate_to_*` tools + `save_blog_draft` + `research_trending_topics` |
| **20** | AI Search Optimization — `llms.txt`, AI bot access, schema markup service, monitoring dashboard |
| **21** | Website Migration Pipeline — deep scrape → blueprint → AI page gen → assemble site from URL |
| **22** | Security Hardening — webhooks fail-closed (503), workflow 60s timeout + depth limit 15, SMS wiring |
| **23** | Mission Control Live Stream — SSE via Firestore onSnapshot, cancel button, tool args/results in step detail |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 32+ function-calling tools |
| `src/lib/orchestrator/mission-persistence.ts` | Mission types, CRUD, cancel — Firestore-backed |
| `src/lib/orchestrator/jasper-command-authority.ts` | Jasper delegation + briefings + approval gateway |
| `src/hooks/useMissionStream.ts` | SSE streaming hook for Mission Control |
| `src/app/(dashboard)/mission-control/page.tsx` | Mission Control UI (SSE + cancel + tool detail) |
| `src/app/api/orchestrator/chat/route.ts` | Jasper chat API |

---

## Session History (Archived)

Sessions 1-38 completed all platform stabilization, feature buildout, nav consolidation, production audits, deployment, SEO data integration, Jasper delegation wiring, and Mission Control live streaming. Details in git history and `docs/archive/`.

Key milestones:
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
- Sessions 36-37: Jasper delegation audit + Mission Control planning
- Session 38: Sprint 23 — Mission Control Live Stream (SSE, cancel, tool detail)
