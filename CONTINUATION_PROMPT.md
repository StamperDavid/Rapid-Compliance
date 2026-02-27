# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 27, 2026 (System-wide code review + documentation cleanup)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **169 physical routes**, **298 API endpoints**, **1,397 TypeScript files** (~330K LOC)
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- `@ts-ignore` / `@ts-expect-error` — **0**
- `any` type violations — **0** (Zero-Any Policy enforced)
- `eslint-disable` comments — **16** (all justified, within budget)

### Production Readiness: ~97%
- Sessions 1-44 completed all stabilization, feature buildout, audit fixes, and deployment
- 78 Jest test files + 19 Playwright E2E specs, all passing
- CI/CD pipeline: 6 jobs (lint+typecheck, unit tests, Playwright, build, security, deploy)

---

## Integration Status (Verified February 27, 2026)

### Real Integrations (26)

| Category | Integrations |
|----------|-------------|
| **Payments** | Stripe (Checkout, webhooks, subscriptions), PayPal (orders, payouts) |
| **Email** | SendGrid (bulk + transactional), Gmail (OAuth, sync-to-CRM), Outlook (Microsoft Graph) |
| **Voice/TTS** | Twilio (calls, SMS, verification), Telnyx (calls, SMS, 60-70% cheaper), ElevenLabs (20+ voices) |
| **Social** | Twitter/X (full API v2, OAuth2 PKCE), Slack (Web API), Microsoft Teams (Graph API) |
| **AI** | OpenRouter (100+ models, tool calling) |
| **SEO** | DataForSEO (domain metrics, keywords, backlinks), Serper (SERP), PageSpeed Insights, Google Search Console |
| **CRM** | HubSpot (contact sync), Salesforce (lead sync) |
| **Accounting** | Xero (OAuth, invoices, contacts), QuickBooks (OAuth, invoices, customers) |
| **E-Commerce** | Shopify (inventory, cart, products) |
| **Video** | HeyGen, Sora, Runway (real API calls when keys configured, graceful "coming soon" fallback) |
| **Calendar** | Google Calendar (OAuth), Zoom (meetings, recording) |

### Blocked / Partial

| Integration | Status | Blocker |
|-------------|--------|---------|
| **Facebook/Instagram** | NOT BUILT | Meta Developer Portal approval required |
| **LinkedIn** | PARTIAL | RapidAPI wrapper; official Marketing Developer Platform approval needed |
| **Stripe Live** | TEST MODE | Bank account setup required for live keys |

### Type Defs Only (Not Implemented)

Square, Vonage, Resend, SMTP, Calendly, Kling, Luma — type definitions exist but no implementation.

---

## Jasper AI Assistant

**43 tools** across delegation, intelligence, admin, and platform categories. All stream live to Mission Control via SSE.

### Delegation Tools (9) → Domain Managers
`delegate_to_intelligence`, `delegate_to_marketing`, `delegate_to_builder`, `delegate_to_architect`, `delegate_to_commerce`, `delegate_to_outreach`, `delegate_to_content`, `delegate_to_sales`, `delegate_to_trust`

### Specialist Tools (3) → Direct Agent Access
`scrape_website`, `research_competitors`, `scan_tech_stack`

### Content & Media Tools
`save_blog_draft`, `research_trending_topics`, `migrate_website`, `create_video`, `get_video_status`, `generate_content`, `social_post`

### Platform & Admin Tools
`query_docs`, `get_platform_stats`, `get_system_state`, `get_analytics`, `generate_report`, `scan_leads`, `enrich_lead`, `score_leads`, `inspect_agent_logs`, `recall_conversation_history`, `voice_agent`, org/user/coupon/pricing management

---

## Known Issues & Technical Debt

| Issue | Severity | Details |
|-------|----------|---------|
| **Placeholder tests** | HIGH | 115 `expect(true).toBe(true)` across 11 files inflate pass counts (worst: `playbook-engine.test.ts` with 94 stubs) |
| **Skipped tests** | MEDIUM | 52 `it.skip` (31 need Firestore emulator, 16 obsolete multi-tenant tests) |
| **Zod validation gaps** | MEDIUM | ~49% of API routes have Zod schemas; video/social/webhook routes need coverage |
| **Facebook/Instagram** | BLOCKED | No implementation — requires Meta Developer Portal approval |
| **LinkedIn** | BLOCKED | Unofficial RapidAPI wrapper — requires Marketing Developer Platform approval |
| **Stripe live keys** | BLOCKED | Test mode only — bank account setup required |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 43 function-calling tools |
| `src/lib/orchestrator/mission-persistence.ts` | Mission CRUD — Admin SDK, Firestore-backed |
| `src/lib/orchestrator/jasper-command-authority.ts` | Delegation + briefings + approval gateway |
| `src/hooks/useMissionStream.ts` | SSE streaming hook for Mission Control |
| `src/components/admin/AdminSidebar.tsx` | 9-section sidebar with feature module gating |
| `src/lib/constants/subpage-nav.ts` | 18 centralized tab arrays for SubpageNav |

---

## Session History (Archived)

Sessions 1-44 completed all platform stabilization, feature buildout, nav consolidation, production audits, deployment, SEO data integration, Jasper delegation wiring, Mission Control live streaming, Admin SDK migration, workspace path eradication, feature module toggle system, and consultative onboarding.

Key milestones:
- Sessions 1-8: Core infrastructure (saga persistence, kill switch, revenue attribution, integrations)
- Sessions 9-13: QA audits (14 Critical + 45 Major resolved)
- Sessions 14-18: Auth fixes, website editor, Playwright E2E infrastructure
- Sessions 19-24: Feature completion (8 sprints, 36 features, all dashboard modules)
- Session 25: Nav consolidation (13 sections → 8) + full production audit
- Sessions 26-27: All 28 audit blockers resolved (commerce, fake data, Zod, workflows)
- Sessions 28-29: Test suite + CI/CD pipeline overhaul
- Session 30: Production deployment — merged to main, Vercel auto-deploy
- Session 31: Final code readiness audit — all 13 items resolved
- Sessions 32-35: SEO Intelligence planning + domain analysis hardening
- Sessions 36-38: Jasper delegation audit + Mission Control SSE streaming
- Sessions 39-41: Admin SDK migration (64 API routes), system page rewrite
- Sessions 42-43: Workspace path eradication (53 files), nav redundancy cleanup
- Session 44: Feature module toggle system + consultative onboarding + demo seed data
