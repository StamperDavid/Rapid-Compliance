# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 13, 2026 (Session 12)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **173 physical routes**, **268 API endpoints**, **430K+ lines of TypeScript**
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
| **LinkedIn** | PARTIAL | RapidAPI wrapper. Needs official API (blocked: app approval). Fallback now correctly returns `success: false`. |
| **Facebook/Instagram** | NOT BUILT | Blocked: Meta Developer Portal approval |
| **Stripe** | REAL | PaymentElement (3DS), intents, products, prices, webhooks. Cart clearing on payment. Canonical order path. |
| **Email** | REAL | SendGrid/Resend/SMTP, open/click tracking. CAN-SPAM unsubscribe route live. |
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

### Session History (1-9)
**Sessions 1-8:** All prior stabilization work is complete: saga persistence, kill switch, revenue attribution pipeline, Twitter engagement, E2E tests, CI/CD cleanup, Stripe checkout, social OAuth, website auth fixes, DALL-E 3, AI page builder, video pipeline wiring, and 33+ TODO resolutions. Details in git history.

**Session 9 (February 13, 2026):** Full production readiness QA audit. Ran 4 QA agents (Revenue, Data Integrity, Growth, Platform) in parallel — discovered 14 Critical / 45 Major / 40 Minor / 23 Info issues. All 14 Critical issues resolved and committed (`3b1f5ea3`).

**Session 10 (February 13, 2026):** Resolved all 45 Major issues across 35 files (659 insertions, 190 deletions). Stripe webhook idempotency, OAuth CSRF fixes, webhook fail-closed pattern, referential integrity guards, analytics accuracy, social media validation, CRM merge safety. Committed (`a3667b8c`). Merged to main.

**Session 11 (February 13, 2026):** Phase 2-4 production readiness audits. Ran 4 parallel QA agents (security, user flows, infrastructure, minors). Found 6 Critical + 8 Major + 12 Minor issues. Fixed: cart path mismatch (Stripe checkout/webhook aligned to workspace-scoped path), cron fail-open auth, voice AI signature bypass, voice fallback zero auth, wildcard CORS on 3 authenticated routes, HSTS/Permissions-Policy global headers, CORS placeholder domain. Deferred: Redis rate limiting (infrastructure), env var documentation, missing Firestore indexes.

**Session 12 (February 13, 2026):** Infrastructure hardening session. Added 9 missing Firestore composite indexes (deals, activities, workflowExecutions, emailActivities, sequenceEnrollments, pages). Documented all ~103 env vars in `.env.example` (was 18). Wired `performHealthCheck()` to `/api/health` endpoint. Converted ~45 console.* calls to structured logger across 24 files. Merged all Session 11-12 commits to main.

---

## Production Readiness Progress

### Phase 1: QA Audit — COMPLETE ✅

All 4 QA agents ran. Results:

| Agent | Critical | Major | Minor | Info |
|-------|----------|-------|-------|------|
| QA Revenue | 4 | 10 | 8 | 5 |
| QA Data Integrity | 4 | 16 | 10 | 5 |
| QA Growth | 4 | 9 | 12 | 6 |
| QA Platform | 2 | 10 | 10 | 7 |
| **TOTAL** | **14** | **45** | **40** | **23** |

### Phase 5 (Critical Fixes) — COMPLETE ✅

All 14 Critical issues resolved (commit `3b1f5ea3`):

| # | Domain | Issue | Fix |
|---|--------|-------|-----|
| CRIT-1 | Revenue | Dollar/cent conversion heuristic | Removed — prices treated as cents |
| CRIT-2 | Revenue | Cart not cleared after payment | Webhook clears cart via cartId metadata |
| CRIT-3 | Revenue | Order created before payment | Order now created after Stripe session |
| CRIT-4 | Revenue | Orders in 3 Firestore paths | Consolidated to `organizations/{id}/orders` |
| CRIT-5 | Data | No Zod on sequences POST | Full Zod schema with step validation |
| CRIT-6 | Data | No Zod on custom-tools POST/PUT | Zod schemas replace manual type guards |
| CRIT-7 | Data | No schema concurrency control | Optimistic locking via `expectedVersion` |
| CRIT-8 | Data | Analytics fetch ALL documents | 10K limits + date-range constraints on 5 routes |
| CRIT-9 | Growth | LinkedIn false `success: true` | Returns `success: false` with message |
| CRIT-10 | Growth | Public form GET no rate limit | `rateLimitMiddleware` added |
| CRIT-11 | Growth | CAPTCHA enabled but not enforced | reCAPTCHA v3 verification when enabled |
| CRIT-12 | Growth | No `/unsubscribe` route | Created `/api/public/unsubscribe` (GET+POST) |
| CRIT-13 | Platform | OAuth CSRF state not validated | Firestore-backed tokens with TTL |
| CRIT-14 | Platform | OAuth encryption fails open | Fails closed — throws on failure |

---

## PRIMARY TASK: Fix Remaining Major Issues (45)

### Highest Priority Majors

**Revenue & E-Commerce:**

| # | Issue | File(s) |
|---|-------|---------|
| MAJ-1 | Subscription webhooks only logged, not processed | `src/app/api/webhooks/stripe/route.ts` |
| MAJ-2 | Webhook returns 200 on processing errors (silent loss) | `src/app/api/webhooks/stripe/route.ts` |
| MAJ-3 | Three different Stripe key retrieval mechanisms | Multiple checkout/payment files |
| MAJ-4 | Cart discounts not applied during Stripe checkout | `src/app/api/ecommerce/checkout/create-session/route.ts` |
| MAJ-5 | Cart ID mismatch between cart ops and checkout | `src/app/api/ecommerce/checkout/create-session/route.ts` |
| MAJ-6 | No stock validation in Stripe checkout path | `src/app/api/ecommerce/checkout/create-session/route.ts` |
| MAJ-7 | No feature gating enforcement in API | No middleware exists |
| MAJ-8 | Subscription cancel/downgrade doesn't call Stripe API | `src/app/api/subscriptions/route.ts` |
| MAJ-9 | Revenue analytics reads incomplete order set | `src/app/api/analytics/revenue/route.ts` |
| MAJ-10 | Refunds not subtracted from revenue | `src/app/api/analytics/revenue/route.ts` |

**Data Integrity:**

| # | Issue | File(s) |
|---|-------|---------|
| MAJ-11 | Contact delete checks wrong field for activities | `src/lib/crm/contact-service.ts` |
| MAJ-12 | Deal delete checks wrong field for activities | `src/lib/crm/deal-service.ts` |
| MAJ-13 | Workflow delete has no referential integrity checks | `src/app/api/workflows/[workflowId]/route.ts` |
| MAJ-14 | Form delete has no referential check for submissions | `src/app/api/forms/[formId]/route.ts` |
| MAJ-15 | `.passthrough()` on e-commerce types (13 nested objects) | `src/lib/ecommerce/types.ts` |
| MAJ-16 | `.passthrough()` on agent persona and identity routes | `src/app/api/agent/persona/route.ts`, identity |
| MAJ-17 | FirestoreService.set() conditional timestamp may skip createdAt | `src/lib/db/firestore-service.ts` |
| MAJ-18 | Client-side timestamps in form fields | `src/app/api/forms/[formId]/route.ts` |
| MAJ-19 | Sequence docs store steps as unbounded array | `src/app/api/outbound/sequences/route.ts` |
| MAJ-20 | Schema batch updater uses wrong change type | `src/lib/schema/schema-change-debouncer.ts` |
| MAJ-21 | Conversion rate uses wrong denominator | `src/lib/analytics/analytics-service.ts` |
| MAJ-22 | E-commerce customer metrics assume all new customers | `src/lib/analytics/ecommerce-analytics.ts` |
| MAJ-23 | Revenue quota hardcoded at $100,000 | `src/lib/analytics/dashboard/analytics-engine.ts` |
| MAJ-24 | Duplicate detection fetches ALL records | `src/lib/crm/duplicate-detection.ts` |
| MAJ-25 | Merge operation lacks transaction safety | `src/app/api/crm/duplicates/merge/route.ts` |
| MAJ-26 | Field type changes have no data migration | `src/lib/schema/schema-change-tracker.ts` |

**Growth & Outreach:**

| # | Issue | File(s) |
|---|-------|---------|
| MAJ-27 | No LinkedIn char limit on queue/schedule routes | `src/app/api/social/queue/route.ts`, schedule |
| MAJ-28 | UTM appending can truncate tweets with broken links | `src/lib/social/autonomous-posting-agent.ts` |
| MAJ-29 | CAN-SPAM ensureCompliance not used at send endpoint | `src/app/api/email/send/route.ts` |
| MAJ-30 | Sequence enrollment race condition (no transaction) | `src/lib/outbound/sequence-engine.ts` |
| MAJ-31 | No Zod validation on SEO settings input | `src/app/api/admin/growth/seo/route.ts` |
| MAJ-32 | No meta title/description length validation | `src/app/api/admin/growth/seo/route.ts` |

**Platform Infrastructure:**

| # | Issue | File(s) |
|---|-------|---------|
| MAJ-33 | SendGrid webhook fails open when key missing | `src/app/api/webhooks/email/route.ts` |
| MAJ-34 | Gmail webhook fails open when secret missing | `src/app/api/webhooks/gmail/route.ts` |
| MAJ-35 | Twilio SMS webhook fails open when token missing | `src/app/api/webhooks/sms/route.ts` |
| MAJ-36 | Twilio Voice webhook fails open when token missing | `src/app/api/webhooks/voice/route.ts` |
| MAJ-37 | Microsoft OAuth callback uses relative redirects | `src/app/api/integrations/microsoft/callback/route.ts` |
| MAJ-38 | QuickBooks OAuth callback uses relative redirects | `src/app/api/integrations/quickbooks/callback/route.ts` |
| MAJ-39 | Slack OAuth callback uses relative redirects | `src/app/api/integrations/slack/callback/route.ts` |
| MAJ-40 | Workflow engine has no execution timeout | `src/lib/workflows/workflow-engine.ts` |
| MAJ-41 | No recursion prevention in workflow triggers | `src/lib/workflows/triggers/firestore-trigger.ts` |
| MAJ-42 | Feature toggle GET endpoint has no authentication | `src/app/api/orchestrator/feature-toggle/route.ts` |
| MAJ-43 | System health uses console.error instead of logger | `src/app/api/orchestrator/system-health/route.ts` |
| MAJ-44 | Workflow routes missing `success` field in response | `src/app/api/workflows/route.ts` |
| MAJ-45 | Workflow routes use different auth pattern | `src/app/api/workflows/route.ts` |

### Phases 2-4: COMPLETE ✅

- **Phase 2:** Critical User Flow Verification — cart path fix, checkout discount fix (Session 11)
- **Phase 3:** Security Audit — voice auth, CORS, HSTS, cron auth (Session 11)
- **Phase 4:** Infrastructure — Firestore indexes, env var docs, health check wiring, structured logging (Session 12)

### Definition of Done

The platform is production ready when:
- [x] All 4 QA agents report zero Critical issues ✅
- [x] All 45 Major issues resolved (Session 10, commit `a3667b8c`) ✅
- [x] 9/10 critical user flows pass (cart path fixed Session 11) ✅
- [x] Security audit Critical findings resolved (Session 11) ✅
- [x] Infrastructure: Firestore indexes added (34 total), env var docs (103 vars), health check wired ✅
- [ ] Redis rate limiting (Upstash) — deferred, requires infrastructure provisioning
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
| `src/app/api/public/unsubscribe/route.ts` | CAN-SPAM email unsubscribe (Session 9) |
| `vercel.json` | Cron jobs, CORS, security headers |
| `firestore.indexes.json` | 34 composite indexes |
| `tsconfig.eslint.json` | ESLint tsconfig scoped to `src/` |
