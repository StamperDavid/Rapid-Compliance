# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 13, 2026 (Session 8)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **173 physical routes**, **267 API endpoints**, **430K+ lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Pre-commit hooks — **PASSES** (bypass ratchet 25/26)

### Deployment Pipeline
- **Vercel:** `vercel.json` (7 cron jobs, CORS headers, security headers, US East)
- **CI/CD:** GitHub Actions on `main`/`dev` — lint, type-check, test, build (Node 20, actions v4)
- **Deploy scripts:** `verify-env-vars.js`, `deploy-firebase-rules.js`, `test-production-health.js`

### Integration Status

| Integration | Status | Notes |
|---|---|---|
| **Twitter/X** | REAL | API v2, OAuth2 PKCE, posting, media, engagement (like/retweet/follow/reply) |
| **LinkedIn** | PARTIAL | RapidAPI wrapper. Needs official API (blocked: app approval) |
| **Facebook/Instagram** | NOT BUILT | Blocked: Meta Developer Portal approval |
| **Stripe** | REAL | PaymentElement (3DS), intents, products, prices, webhooks |
| **Email** | REAL | SendGrid/Resend/SMTP, open/click tracking |
| **Voice** | REAL | Twilio/Telnyx — call initiation, control, conferencing |
| **TTS** | REAL | ElevenLabs — 20+ premium voices |
| **Video** | REAL | HeyGen/Sora/Runway APIs via render pipeline |
| **AI Images** | REAL | DALL-E 3 with size mapping and graceful fallback |
| **Firebase** | REAL | Auth + Firestore, single-tenant |
| **OpenRouter** | REAL | AI gateway, 100+ models |

### Known Open Issues

| Issue | Details |
|-------|---------|
| Facebook/Instagram missing | Blocked: Meta Developer Portal (Tier 3.2) |
| LinkedIn unofficial | Uses RapidAPI, blocked: Marketing Developer Platform (Tier 3.3) |
| ~15 TODO comments | All external deps: i18n (6 langs), Outlook webhooks, vector embeddings, web scraping, DM feature |

### Session History (1-8)
All prior stabilization work is complete: saga persistence, kill switch, revenue attribution pipeline, Twitter engagement, E2E tests, CI/CD cleanup, Stripe checkout, social OAuth, website auth fixes, DALL-E 3, AI page builder, video pipeline wiring, and 33+ TODO resolutions. Details in git history.

---

## PRIMARY TASK: Production Readiness

**The code compiles. That doesn't mean it works.** Production ready means a real user can sign up, use every critical feature, pay money, and not hit errors. This plan verifies that.

### Phase 1: QA Audit — Discover What's Broken

Run all 4 QA agents in parallel to generate a comprehensive defect list.

| Agent | Scope | What It Checks |
|-------|-------|----------------|
| **QA Revenue** | Stripe, checkout, pricing | Can a user browse → cart → checkout → pay → receive order confirmation? Do webhooks fire and process? Are prices enforced? |
| **QA Data Integrity** | Zod, Firestore, schemas | Does every API endpoint validate input with Zod? Are Firestore collections structured correctly? Any orphaned data patterns? |
| **QA Growth** | Social, email, SEO, forms, website | Can a user create a post and publish it? Send an email? Submit a form that creates a lead? Build a page? |
| **QA Platform** | OAuth, integrations, webhooks, cron, APIs | Do OAuth flows complete? Do cron jobs actually run? Are all API contracts honored? Do webhook endpoints respond? |

**Output:** A prioritized defect list with severity ratings. Fix all Critical/High before anything else.

### Phase 2: Critical User Flow Verification

Test these end-to-end flows. Each must work without errors:

| # | Flow | Steps to Verify |
|---|------|-----------------|
| 1 | **Signup → Dashboard** | Firebase Auth signup → onboarding → dashboard loads with real data |
| 2 | **CRM Pipeline** | Create lead → convert to deal → move through stages → close won |
| 3 | **E-commerce** | Browse store → add to cart → Stripe checkout → payment succeeds → order confirmation |
| 4 | **Social Publishing** | Connect Twitter → compose post → schedule → verify it publishes |
| 5 | **Email Outreach** | Compose email → send via API → verify delivery → track open/click |
| 6 | **Form → Lead** | Create form → share URL → submit form → verify lead created with UTM attribution |
| 7 | **Website Builder** | Create page → edit content → publish → verify public access |
| 8 | **AI Features** | Generate image (DALL-E 3) → Generate page (AI builder) → Jasper chat response |
| 9 | **Agent Orchestration** | Trigger saga → verify checkpoint → pause swarm → verify halt → resume |
| 10 | **Video Pipeline** | Create project → generate script → render → save to library |

### Phase 3: Security Audit

| Check | What to Verify |
|-------|----------------|
| **Auth gating** | Every `/api/*` route (except `/api/public/*`) requires valid Firebase auth token |
| **Rate limiting** | All public and AI endpoints have rate limits configured |
| **Input validation** | Every POST/PUT/PATCH endpoint validates body with Zod schema |
| **Firestore rules** | Rules deployed and restrict read/write to authenticated users within org |
| **CORS** | Only allowed origins can make requests |
| **Security headers** | CSP, X-Frame-Options, X-Content-Type-Options set in `vercel.json` |
| **Secrets** | No API keys in client-side code. All secrets in env vars only |
| **OAuth redirects** | Production redirect URLs configured for Twitter, LinkedIn |

### Phase 4: Infrastructure Verification

| Check | What to Verify |
|-------|----------------|
| **Env vars** | Run `verify-env-vars.js` against Vercel production — all P0/P1 vars present |
| **Firestore indexes** | All 25 composite indexes from `firestore.indexes.json` deployed |
| **Cron jobs** | All 7 cron entries in `vercel.json` are firing on schedule |
| **Stripe webhooks** | Webhook endpoint registered in Stripe dashboard, receiving events, processing correctly |
| **Firebase rules** | Run `deploy-firebase-rules.js` — rules deployed and enforced |
| **Health check** | Run `test-production-health.js` — all critical endpoints responding |
| **Error monitoring** | Logger output visible in Vercel logs, errors surfaced |

### Phase 5: Fix & Harden

Based on findings from Phases 1-4:
1. Fix all Critical severity issues
2. Fix all High severity issues
3. Add error boundaries to any pages missing them
4. Add graceful fallbacks for any feature that fails silently
5. Verify all toast/error messages are user-friendly (no raw stack traces)

### Definition of Done

The platform is production ready when:
- [ ] All 4 QA agents report zero Critical issues
- [ ] All 10 critical user flows pass end-to-end
- [ ] Security audit passes with zero Critical findings
- [ ] All infrastructure checks pass
- [ ] A real user can sign up, use core features, and pay — without hitting a single error

---

## Blocked (External — No Code Work Possible)

| Item | Blocker |
|------|---------|
| Facebook/Instagram integration | Meta Developer Portal sandbox + app review |
| LinkedIn official API | Marketing Developer Platform approval |
| i18n translations (6 languages) | Need professional translation |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestration/event-router.ts` | Event rules engine with persistence |
| `src/lib/orchestration/saga-persistence.ts` | Saga checkpoint/resume + event dedup |
| `src/lib/orchestration/swarm-control.ts` | Global kill switch + per-manager pause |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication |
| `src/lib/agents/orchestrator/manager.ts` | Master Orchestrator — Saga Pattern |
| `src/lib/social/autonomous-posting-agent.ts` | Social agent — posting, engagement, UTM |
| `src/lib/integrations/twitter-service.ts` | Twitter API v2 — full CRUD |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 36+ function-calling tools |
| `vercel.json` | Cron jobs, CORS, security headers |
| `firestore.indexes.json` | 25 composite indexes |
| `tsconfig.eslint.json` | ESLint tsconfig scoped to `src/` |
