# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 14, 2026 (Session 16)

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
- Pre-commit hooks — **PASSES** (bypass ratchet 22/26)

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
| **Stripe** | REAL | PaymentElement (3DS), intents, products, prices, webhooks. Cart clearing on payment. **ORDER PATH ISSUES — see Session 15 findings.** |
| **Email** | REAL | SendGrid/Resend/SMTP, open/click tracking. CAN-SPAM unsubscribe route live. |
| **Voice** | REAL | Twilio/Telnyx — call initiation, control, conferencing |
| **TTS** | REAL | ElevenLabs — 20+ premium voices |
| **Video** | REAL | HeyGen/Sora/Runway APIs via render pipeline |
| **AI Images** | REAL | DALL-E 3 with size mapping and graceful fallback |
| **Firebase** | REAL | Auth + Firestore, single-tenant |
| **OpenRouter** | REAL | AI gateway, 100+ models |

---

## Session History

**Sessions 1-8:** All prior stabilization work is complete: saga persistence, kill switch, revenue attribution pipeline, Twitter engagement, E2E tests, CI/CD cleanup, Stripe checkout, social OAuth, website auth fixes, DALL-E 3, AI page builder, video pipeline wiring, and 33+ TODO resolutions. Details in git history.

**Session 9:** Full production readiness QA audit. 14 Critical / 45 Major / 40 Minor / 23 Info. All 14 Critical resolved (`3b1f5ea3`).

**Session 10:** Resolved all 45 Major issues across 35 files. Committed (`a3667b8c`). Merged to main.

**Session 11:** Phase 2-4 audits. 6 Critical + 8 Major + 12 Minor. Fixed cart path, cron auth, voice auth, CORS, HSTS.

**Session 12:** Infrastructure hardening. 9 Firestore indexes, 103 env vars documented, health check wired, structured logging.

**Session 13:** E2E user flow audit + Firebase cleanup. 3 Critical: signup race condition, order path mismatch, cart ID mismatch. All fixed (`bf706c8a`).

**Session 14:** Website editor 401 fix + TODO resolution. Auth race condition fixed (`30857e1b`). Redis rate limiting (`75b638ba`). Website editor still shows blank — suspected Firestore path mismatch.

**Session 15 (February 14, 2026):** Full system-wide code audit via 5 parallel sub-agents. Comprehensive findings below. This session established the master testing plan.

**Session 16 (February 14, 2026):** Phase 1 — Fixed all 7 critical/high bugs (`a831c43c`). Details:
- 1.1: Website editor path — added diagnostic logging for empty page queries
- 1.2: Order path split — consolidated all order CRUD to canonical `organizations/{PLATFORM_ID}/orders` (checkout-service, payment-service, ecommerce-analytics)
- 1.3: Auth race condition — added `authLoading` guard to 6 dashboard pages (analytics, analytics/ecommerce, orders, leads, deals, contacts)
- 1.4: Missing order fields — added `userId` and `paymentIntentId` to Order type + checkout flow
- 1.5: Hardcoded IP — replaced `127.0.0.1` with `customerIp` field in PaymentRequest
- 1.6: Discount race condition — replaced non-atomic increment with Firestore `runTransaction`
- 1.7: Duplicate detection cap — replaced 100-record limit with cursor-based full pagination

---

## SESSION 15: SYSTEM-WIDE AUDIT FINDINGS

### Audit Methodology
Ran 5 specialized sub-agents in parallel:
1. **Website Editor Deep Dive** — Root cause analysis of blank editor
2. **Revenue & E-Commerce Audit** — Stripe, orders, cart, checkout, analytics
3. **CRM & Outbound Audit** — Contacts, deals, sequences, forms, social, analytics
4. **Auth, Workflows & Integrations Audit** — Firebase auth, RBAC, OAuth, webhooks, cron, voice, AI agents
5. **Test Infrastructure Audit** — Playwright, Jest, CI/CD, test coverage gaps

---

### CRITICAL FINDING 1: Website Editor — Firestore Collection Path Mismatch

**Status:** ROOT CAUSE CONFIRMED

**The Problem:**
`src/lib/firebase/collections.ts` (lines 17-25) resolves collection paths based on `NEXT_PUBLIC_APP_ENV`:

| Scenario | NEXT_PUBLIC_APP_ENV | PREFIX | Pages Collection |
|----------|-------------------|--------|------------------|
| Production | `production` | (none) | `organizations/rapid-compliance-root/website/pages/items` |
| Development | unset/`development` | `test_` | `test_organizations/rapid-compliance-root/test_website/pages/items` |

Pages were created in dev mode (with `test_` prefix) but the production build queries without the prefix. Result: **empty page list, silent failure, "No pages yet" shown**.

**Key Files:**
- `src/lib/firebase/collections.ts:17-25` — PREFIX logic
- `src/lib/firebase/collections.ts:116-120` — `getSubCollection()` builds path
- `src/app/api/website/pages/route.ts:64` — Queries `getSubCollection('website')/pages/items`
- `src/app/(dashboard)/website/editor/page.tsx:194-228` — Falls back to blank page on empty result
- `src/app/(dashboard)/website/pages/page.tsx:50-76` — Shows "No pages yet" on empty array

**Fix Required:**
1. Verify `NEXT_PUBLIC_APP_ENV` on Vercel (must be `production`)
2. Check Firebase Console for where pages actually exist
3. If pages in `test_` path, migrate them OR ensure consistent env var
4. Add logging when pages query returns empty (currently silent)

---

### CRITICAL FINDING 2: E-Commerce Order Path Split (PRODUCTION-BREAKING)

**Status:** Orders written to TWO different Firestore paths — checkout succeeds but orders are invisible.

**The Split:**
| Operation | Path Used | File |
|-----------|-----------|------|
| Checkout session creation | `organizations/{PLATFORM_ID}/orders` | `checkout/create-session/route.ts:177` |
| Checkout service order write | `organizations/{PLATFORM_ID}/workspaces/{workspaceId}/orders` | `checkout-service.ts:255` |
| Stripe webhook order update | `organizations/{PLATFORM_ID}/orders` | `webhooks/stripe/route.ts:236` |
| Order listing API | `organizations/{PLATFORM_ID}/orders` | `ecommerce/orders/route.ts:69` |
| Payment service refunds | `organizations/{PLATFORM_ID}/workspaces/{workspaceId}/orders` | `payment-service.ts:527` |
| E-commerce analytics | `organizations/{PLATFORM_ID}/workspaces/{workspaceId}/orders` | `ecommerce-analytics.ts:57` |

**Impact:**
- User pays → checkout-service writes order to workspace path → webhook tries to update at root path → order never marked "completed"
- Order list API queries root path → user sees "no orders"
- Analytics queries workspace path → revenue shows $0
- Refund service can't find orders → refunds fail

**Fix Required:** Consolidate ALL order operations to canonical path `organizations/{PLATFORM_ID}/orders`. Update: `checkout-service.ts`, `payment-service.ts`, `ecommerce-analytics.ts`.

---

### CRITICAL FINDING 3: Dashboard Auth Race Condition (Beyond Website Editor)

**Status:** Analytics dashboard page makes API calls BEFORE Firebase auth resolves.

**File:** `src/app/(dashboard)/analytics/page.tsx:76-102`
- `useEffect` fires `Promise.all([fetch(...), fetch(...), ...])` without checking auth state first
- Same bug pattern that was fixed in the website editor in Session 14
- Likely affects other dashboard pages too

**Fix Required:** Add `if (authLoading) return;` guard to analytics and audit ALL dashboard pages for this pattern.

---

### HIGH FINDING 4: Additional E-Commerce Issues

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Hardcoded 127.0.0.1 IP | HIGH | `payment-providers.ts:225` | 2Checkout fraud detection broken |
| Missing `paymentIntentId` on orders | HIGH | `checkout-service.ts:164-283` | Webhook can't correlate payment → order |
| Missing `userId` on orders | HIGH | `checkout-service.ts` | Order listing filter by userId returns nothing |
| Discount race condition | MEDIUM | `cart-service.ts:300-309` | Concurrent discount usage can exceed limit |
| Order access control field mismatch | MEDIUM | `orders/[orderId]/route.ts:45` | Checks `customerEmail` vs `customer.email` |

---

### HIGH FINDING 5: CRM & Data Integrity Issues

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| Duplicate detection capped at 100 records | HIGH | `duplicate-detection.ts:147-151` | Fuzzy match misses records beyond first 100 |
| Pipeline summary fetches ALL deals | MEDIUM | `deal-service.ts:378` | No pagination, memory risk |
| Sequence enrollment race condition | LOW | `sequence-engine.ts:51-92` | Check-then-create without transaction |
| Inconsistent Firestore paths across services | HIGH | Multiple | Some use `entities/{type}/records`, others direct |
| Gmail email sends lack metadata tracking | MEDIUM | `sequence-engine.ts:321-331` | Enrollments not tracked for Gmail path |

---

### POSITIVE FINDINGS (Working Correctly)

| Area | Status | Notes |
|------|--------|-------|
| All cron jobs | EXCELLENT | Fail-closed with CRON_SECRET |
| Admin impersonation | EXCELLENT | Owner-only, audit trail, prevents self/owner impersonation |
| OAuth state management | EXCELLENT | Crypto-secure, one-time tokens, 10min TTL |
| Workflow engine | GOOD | 30s timeout per action, recursion-safe loop limits |
| RBAC system | GOOD | 4-role model with 47 permissions |
| CAN-SPAM compliance | GOOD | `ensureCompliance()` injected before send |
| Social media agent | GOOD | Velocity limits, sentiment check, human escalation |
| Form security | GOOD | Honeypot, timing check, CAPTCHA, XSS sanitization |
| Dashboard layout auth guard | GOOD | Redirects unauthenticated users |

---

## MASTER TESTING PLAN

### Existing Test Infrastructure

| Component | Status | Details |
|-----------|--------|---------|
| **Playwright** | Configured | `playwright.config.ts` — Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari |
| **Jest** | Configured | `jest.config.js` — Node env, Admin SDK, path aliases |
| **E2E Tests** | 9 specs | `tests/e2e/` — admin routes, agent chain, checkout, email, voice, website, CRM pages |
| **Integration Tests** | 12+ files | `tests/integration/` — signals, sagas, enrichment, email, payment, sequencer |
| **Unit Tests** | 4 files | `src/lib/**/__tests__/` — event router, jasper, mutation engine, analytics |
| **Test Helpers** | 3 files | `tests/helpers/` — cleanup tracker, utils, e2e cleanup |
| **CI/CD** | Active | `.github/workflows/ci.yml` — lint, type-check, Jest, build |
| **Playwright UI** | Available | `npm run test:playwright:ui` — visual mode for watching tests |

### Test Commands
```bash
npm test                    # Jest unit/integration tests
npm run test:watch          # Jest watch mode
npm run test:coverage       # Jest with coverage
npm run test:e2e:full       # Full E2E pipeline (emulators + seed + tests)
npm run test:playwright     # Playwright headless
npm run test:playwright:ui  # Playwright visual UI mode (WATCH AGENTS TEST)
npx playwright test --headed  # Playwright with visible browser
```

---

### Phase 1: Fix Critical Bugs (Before Testing)

These must be fixed first — testing broken features wastes time.

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1.1 | **Fix website editor Firestore path** — Verify env vars, check actual data location in Firebase Console, migrate data or fix path | `collections.ts`, `website/pages/route.ts` | P0 |
| 1.2 | **Consolidate order paths** — All order CRUD to `organizations/{PLATFORM_ID}/orders` | `checkout-service.ts`, `payment-service.ts`, `ecommerce-analytics.ts` | P0 |
| 1.3 | **Fix analytics dashboard auth race** — Add `authLoading` guard | `analytics/page.tsx` + audit all dashboard pages | P0 |
| 1.4 | **Add `paymentIntentId` and `userId` to orders** — Webhook + listing depend on these | `checkout-service.ts` | P0 |
| 1.5 | **Fix hardcoded 127.0.0.1 IP** | `payment-providers.ts:225` | P1 |
| 1.6 | **Fix discount race condition** — Use Firestore transaction | `cart-service.ts:300-309` | P1 |
| 1.7 | **Remove duplicate detection 100-record cap** | `duplicate-detection.ts` | P1 |

---

### Phase 2: Playwright E2E Test Suite — Feature-by-Feature Walkthrough

These are the Playwright tests you can **watch in real-time** via `npm run test:playwright:ui` or `npx playwright test --headed`. Each test walks through the feature as a real user would.

#### Test Group A: Authentication & Onboarding
| Test | What It Validates |
|------|-------------------|
| `auth-signup.spec.ts` | Create account → verify email → land on dashboard |
| `auth-login.spec.ts` | Login with email/password → dashboard loads → correct role displayed |
| `auth-rbac.spec.ts` | Admin sees admin routes, member cannot access admin pages |
| `auth-session.spec.ts` | Refresh page → session persists → no re-login required |

#### Test Group B: Website Builder
| Test | What It Validates |
|------|-------------------|
| `website-pages-list.spec.ts` | Navigate to Website → pages list loads → shows created pages |
| `website-create-page.spec.ts` | Create new page → title/slug → save → appears in list |
| `website-editor-visual.spec.ts` | Open editor → drag section → edit text → preview → save |
| `website-publish.spec.ts` | Publish page → public URL accessible → content renders |

#### Test Group C: E-Commerce & Checkout
| Test | What It Validates |
|------|-------------------|
| `ecommerce-products.spec.ts` | Create product → set price → add to catalog → visible in store |
| `ecommerce-cart.spec.ts` | Add to cart → adjust quantity → apply discount → cart total correct |
| `ecommerce-checkout.spec.ts` | Cart → Stripe checkout → payment completes → order created → order visible |
| `ecommerce-orders.spec.ts` | Order history loads → order details accessible → status correct |

#### Test Group D: CRM
| Test | What It Validates |
|------|-------------------|
| `crm-contacts.spec.ts` | Create contact → edit fields → search → delete (with referential check) |
| `crm-deals.spec.ts` | Create deal → move through pipeline stages → deal value updates |
| `crm-leads.spec.ts` | Create lead → qualify → convert to contact → verify conversion |
| `crm-duplicates.spec.ts` | Import duplicate contacts → detection fires → merge → verify merged record |

#### Test Group E: Email & Outbound
| Test | What It Validates |
|------|-------------------|
| `email-compose.spec.ts` | Compose email → add recipient → send → verify in sent list |
| `email-sequence.spec.ts` | Create sequence → add steps → enroll prospect → verify step execution |
| `email-unsubscribe.spec.ts` | Click unsubscribe link → confirm → verify contact opted out |
| `email-compliance.spec.ts` | Send email → verify CAN-SPAM footer present → physical address shown |

#### Test Group F: Social Media
| Test | What It Validates |
|------|-------------------|
| `social-compose.spec.ts` | Compose post → platform selector → character count → schedule |
| `social-queue.spec.ts` | View queue → reorder posts → delete post → queue updates |
| `social-analytics.spec.ts` | Social analytics dashboard loads → metrics displayed → date range works |

#### Test Group G: Voice & AI
| Test | What It Validates |
|------|-------------------|
| `voice-call.spec.ts` | Initiate call → TCPA check → call record created |
| `ai-agents.spec.ts` | View agent list → agent status → trigger agent task → verify execution |
| `ai-jasper.spec.ts` | Open Jasper chat → send command → verify tool execution |

#### Test Group H: Workflows & Automation
| Test | What It Validates |
|------|-------------------|
| `workflow-create.spec.ts` | Create workflow → add trigger → add actions → save → activate |
| `workflow-execute.spec.ts` | Trigger workflow → verify each action executed → check execution log |
| `workflow-webhook.spec.ts` | Send webhook → workflow fires → action completes |

#### Test Group I: Admin & Settings
| Test | What It Validates |
|------|-------------------|
| `admin-users.spec.ts` | View users list → change role → verify permission change |
| `admin-integrations.spec.ts` | View integrations → connect/disconnect → status updates |
| `admin-analytics.spec.ts` | Analytics dashboard loads → revenue chart → pipeline metrics → date filters |
| `admin-settings.spec.ts` | Update company settings → save → verify persistence |

#### Test Group J: Forms
| Test | What It Validates |
|------|-------------------|
| `forms-create.spec.ts` | Create form → add fields → set validation → save |
| `forms-publish.spec.ts` | Publish form → access public URL → submit as visitor |
| `forms-submissions.spec.ts` | View submissions list → submission details → lead auto-created |

---

### Phase 3: Automated Regression Suite

After all Phase 2 tests pass, configure continuous regression:

1. **Pre-commit hook integration** — Run critical path tests before push
2. **CI/CD Playwright integration** — Add Playwright to GitHub Actions workflow
3. **Nightly full suite** — All 35+ tests across 5 browsers
4. **Visual regression** — Screenshot baselines for key pages
5. **Performance benchmarks** — Page load times, API response times

---

### Phase 4: Manual Verification Checklist

Items that require human eyes or external service validation:

- [ ] Verify `NEXT_PUBLIC_APP_ENV=production` on Vercel dashboard
- [ ] Confirm Stripe keys are live mode (`sk_live_*` / `pk_live_*`)
- [ ] Set `NEXT_PUBLIC_APP_URL=https://salesvelocity.ai`
- [ ] Generate strong `CRON_SECRET` (32+ chars)
- [ ] Verify Firebase Admin private key newlines (`\n` not `\\n`)
- [ ] Open Firebase Console → check where website pages actually live
- [ ] Test Stripe webhook delivery in Stripe dashboard
- [ ] Verify email delivery (SendGrid/Resend) with real inbox
- [ ] Test Twitter OAuth flow end-to-end
- [ ] Verify voice call initiation with real Twilio credentials

---

## EXECUTION ORDER

```
Session 15:            Audit complete, plan written
Session 16 (Done):     Phase 1 — Fix critical bugs (1.1-1.7) ✓
Session 17:            Phase 2A-B — Auth + Website Builder tests
Session 18:            Phase 2C-D — E-Commerce + CRM tests
Session 19:            Phase 2E-G — Email + Social + Voice/AI tests
Session 20:            Phase 2H-J — Workflows + Admin + Forms tests
Session 21:            Phase 3 — CI/CD integration + regression suite
Session 22:            Phase 4 — Manual verification + production deploy
```

---

## Known Open Issues

| Issue | Details |
|-------|---------|
| Facebook/Instagram missing | Blocked: Meta Developer Portal (Tier 3.2) |
| LinkedIn unofficial | Uses RapidAPI, blocked: Marketing Developer Platform (Tier 3.3) |
| ~15 TODO comments | All external deps: i18n (6 langs), Outlook webhooks, vector embeddings, web scraping, DM feature |

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
| `src/lib/firebase/collections.ts` | Firestore collection paths with env-aware prefix |
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
| `playwright.config.ts` | Playwright test configuration (5 browsers) |
| `jest.config.js` | Jest test configuration |
| `tests/e2e/` | 9 existing Playwright E2E specs |
| `tests/integration/` | 12+ Jest integration tests |
