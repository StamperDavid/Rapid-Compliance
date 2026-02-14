# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 13, 2026 (Session 8 — Systematic TODO resolution: 25+ stubs replaced with real logic across 13 files)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **173 physical routes**, **267 API endpoints**, **430K+ lines of TypeScript**
- **Deployed via Vercel** — dev branch → main branch → Vercel auto-deploy

### Code Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)** — runs reliably in ~1m42s after OOM fix
- `npm run build` — **PASSES (production build succeeds)**

### Deployment Pipeline
- **Vercel:** Configured with `vercel.json` (7 cron jobs, CORS headers, security headers, US East region)
- **CI/CD:** GitHub Actions on `main`/`dev` — lint, type-check, test, build (Node 20, actions v4)
- **Deploy scripts:** `verify-env-vars.js` (P0/P1/P2 env validation), `deploy-firebase-rules.js`, `test-production-health.js`
- **Node version:** 20.x (CI + package.json aligned)

### Build Tooling
- **ESLint:** Uses `tsconfig.eslint.json` (scoped to `src/` only — excludes `.next`, build artifacts)
- **Memory:** All lint scripts use `cross-env NODE_OPTIONS=--max-old-space-size=8192`
- **Pre-commit:** `.husky/pre-commit` — lint-staged + tsc + bypass ratchet (8GB heap)

### What's Complete
- All 8 social media pages (Command Center, Content Studio, Approval Queue, Activity Feed, Analytics, Agent Rules, Training, Golden Playbook)
- Golden Playbook system (4 phases: correction capture, coaching, performance patterns, explicit rules)
- Stabilization roadmap Tiers 1-3 (15/15 tasks DONE)
- 158 demo documents seeded
- Autonomous Business Operations (8 phases — Event Router, manager authority, revenue pipeline, outreach autonomy, content production, builder/commerce loops, artifact generation, Jasper command authority)
- Social Media Growth Engine (6 phases — metrics collector, Growth Analyst, LISTEN/ENGAGE, GROWTH_LOOP, content recycling)
- CSS variable theme system, SalesVelocity.ai rebrand, single-tenant conversion
- **Saga State Persistence (Tier 1.1)** — Firestore-backed checkpoint/resume for all sagas, event deduplication, event replay, cron-triggered saga resume
- **Global Kill Switch (Tier 1.2)** — Swarm-wide pause/resume, per-manager toggles, guards on EventRouter + MasterOrchestrator + SignalBus + BaseManager, Command Center UI controls, `/api/orchestrator/swarm-control` API
- **Revenue Attribution P0 (Tier 2.1)** — Full UTM→Lead→Deal→Order→Stripe chain wired. Attribution fields added to Lead (formId, formSubmissionId, utmSource/Medium/Campaign), Deal (leadId), Order (dealId, leadId, formId, attributionSource, utmSource/Medium/Campaign). Auto-lead creation from form submissions. Deal source inheritance from lead. Stripe metadata attribution. Auto UTM on social post links.
- **Twitter Engagement (Tier 3.1)** — REPLY/LIKE/FOLLOW/REPOST wired to real Twitter API v2. 7 new methods in TwitterService (likeTweet, unlikeTweet, retweet, unretweet, followUser, unfollowUser + reply via postTweet). Autonomous agent stubs replaced with real API calls.
- **Revenue Attribution P1 (Tier 2.1b)** — Attribution analytics endpoint (`/api/analytics/attribution`) with revenue by source/campaign/medium, funnel metrics. Dashboard page (`/analytics/attribution`) with overview cards, conversion funnel visualization, breakdowns. "Source" column added to Leads, Deals, and Orders tables.
- **E2E Agent Integration Testing (Tier 1.3)** — Playwright tests (`tests/e2e/agent-chain.spec.ts`) for swarm control API, attribution API, kill switch verification, CRM page loads. Jest integration tests: `tests/integration/saga-workflow.test.ts` (checkpoint/resume, crash simulation, event dedup, replay), `tests/integration/signal-propagation.test.ts` (SignalBus communication, swarm control state, pause/queue/resume/dequeue, guard functions).
- **CI/CD Cleanup (Tier 3.4)** — Node 18→20 in both workflows (`ci.yml`, `api-integrity.yml`). Actions `checkout@v3`→`v4`, `setup-node@v3`→`v4`. Branch trigger `develop`→`dev`. Vercel CLI deploy step (pull → build → deploy --prebuilt --prod). Deals recommendations route auth fix (user extraction + workspaceId query param).
- **Quick Wins (Session 5):**
  - Playbook engine: threaded authenticated `userId` through `generatePlaybook()` (replaces hardcoded `'system'`)
  - Signal bus: wired all 18 notification signal handlers to `SignalCoordinator.observeSignals()` with single subscription dispatch
  - Email writer: added `showSuccessToast('Email copied to clipboard!')` on copy action
  - Firestore: added 4 composite indexes for `activities` collection (`type`, `createdBy`, `direction` + `occurredAt`)
- **ESLint OOM Fix (Session 5):** Created `tsconfig.eslint.json` scoped to `src/` (excludes `.next` 5.3GB build cache + root artifacts). Added `cross-env NODE_OPTIONS=--max-old-space-size=8192` to all lint scripts. Updated `.husky/pre-commit` with 8GB heap. `npm run lint` now completes reliably (~1m42s, zero OOM).
- **Stripe Checkout Flow Completion (Session 6):** Created `StripeProvider.tsx` with Elements wrapper + dark theme. Rewrote checkout page: 2-step flow (info → Stripe PaymentElement), removes raw card inputs (PCI vulnerability), uses `create-payment-intent` API, `stripe.confirmPayment()`, `/api/checkout/complete`. Enriched success page with real order data + 3DS redirect handling. Created `/store/checkout/cancelled` cart recovery page. Enhanced `payment_intent.succeeded` webhook as order status safety net.
- **Social Accounts OAuth UI (Session 6):** Added `SocialOAuthState`/`SocialOAuthTokenResult` types. Created `social-oauth-service.ts`: Twitter PKCE flow (code challenge, auth URL, code exchange, profile fetch), LinkedIn OAuth 2.0, AES-256-GCM token encryption. New API routes: `/api/social/oauth/auth/[provider]` (GET), `/api/social/oauth/callback/[provider]` (GET), `/api/social/accounts/verify` (POST). Created `TwitterIntegration.tsx` and `LinkedInIntegration.tsx` components. Added "Social Media" category to integrations settings with deep-link support.
- **Website Editor & Pages Auth Fix (Session 6):** Fixed 401 Unauthorized on `/website/pages` and `/website/editor` — all fetch calls were missing Firebase auth headers. Added `Authorization: Bearer ${token}` to all 10 fetch calls. Fixed infinite console error loop caused by `toast` in `useCallback` dependency array (replaced with `toastRef` pattern).
- **Asset Generator — Real DALL-E 3 (Session 7):** New `image-generation-service.ts` wrapping DALL-E 3 API. New `/api/ai/generate-image` endpoint with Zod validation and rate limiting (20/min). AssetGenerator specialist's 5 generate methods now async, calling real DALL-E 3 with graceful placeholder fallback. Smart size mapping (logos→1024x1024, banners→1792x1024, stories→1024x1792).
- **Website Builder — AI Page Generation (Session 7):** New `ai-page-generator.ts` with structured prompts for page generation. New `/api/website/ai/generate` endpoint (10/min rate limit). "Generate with AI" button + modal added to Pages management UI. AI generates title, slug, sections with widgets, and SEO metadata. Retry logic (up to 3 attempts) for JSON parse failures.
- **Video Pipeline — Real Provider Wiring (Session 7):** Wired render-pipeline.ts to real video-service.ts implementations. callRunwayAPI/callSoraAPI/callHeyGenAPI now delegate to real API calls. checkProviderStatus uses getVideoStatus. isProviderConfigured switched from process.env to Firestore apiKeyService. Updated Runway endpoints to api.dev.runwayml.com/v1 with gen3a_turbo model. Veo/Kling/Pika/StableVideo throw clear "not yet available" errors.
- **Systematic TODO Resolution (Session 8):** Resolved 25+ TODO stubs across 13 files with real implementations:
  - **Firestore queries:** workflow-service (getWorkflows, getWorkflowExecutions), workflow-coordinator (findMatchingWorkflows), conversation-engine (getConversation), playbook-engine (savePlaybook)
  - **Competitive monitor:** Daily tracking counters (checks, changes, alerts), Firestore profile loading, change detection + Signal Bus alerting, midnight counter reset
  - **Notification service:** Timezone-aware quiet hours check (IANA TZ, overnight wrap), Firestore-backed batch queue, quiet hours rescheduling
  - **Risk engine:** Historical pattern matching by deal archetype, risk trend analysis with in-memory assessment cache
  - **Smart sequencer:** Score-based lead-to-sequence matching (hot→aggressive, warm→standard, cold→nurture)
  - **Email writer:** Wired to real `/api/email-writer/send` endpoint with loading state and error handling
  - **FormBuilder:** QR code SVG-to-PNG download via canvas
  - **Coaching analytics:** Real team metrics from Firestore deal queries within date range
  - **Deal monitor:** Session lifecycle management with Maps tracking + DELETE handler for stopping monitors
  - **Playbook engine:** extractKeyPhrasesFromTranscript() extracting from objections, key moments, coaching insights

---

## PRIMARY TASK: Production Readiness Plan (COMPLETE)

### Overview

A forensic audit (February 13, 2026) identified 6 critical gaps that must be resolved before the platform can be considered production-ready. These are organized into 3 tiers by priority.

### Tier 1 — Trust & Safety (Must complete first)

These gaps make the platform unreliable for autonomous operation. Fix before anything else.

#### 1.1 Saga State Persistence & Checkpoint/Resume — COMPLETE
**Severity:** CRITICAL (RESOLVED)
**Problem:** The orchestrator's Saga Pattern (`src/lib/agents/orchestrator/manager.ts`) stores all saga state in an **in-memory Map** (`private activeSagas: Map<string, Saga>`). If the process crashes or Vercel cold-starts, all active sagas are lost. There is no checkpoint persistence, no replay mechanism, and no resumption logic. The Event Router (`src/lib/orchestration/event-router.ts`) also processes events ephemerally with no persistence.

**Impact:** A 4-hour operational cycle failing at hour 3 restarts from scratch. Multi-manager workflows (FULL_BUSINESS_LAUNCH, MARKETING_CAMPAIGN, SALES_ACCELERATION) lose all context on failure.

**Implementation:**
1. Create `src/lib/orchestration/saga-persistence.ts` — Firestore-backed saga state store
2. Add checkpoint markers at each saga step completion (persist `currentStepIndex`, `results`, `status` to Firestore)
3. Add `resumeSaga(sagaId)` method to MasterOrchestrator that loads state from Firestore and continues from last successful step
4. Add event persistence to Event Router — store processed events in Firestore with deduplication IDs
5. Add replay logic for events that were dispatched but not confirmed as completed
6. Wire the Operations Cycle cron (`/api/cron/operations-cycle`) to check for incomplete sagas on startup

**Key Files:**
- `src/lib/agents/orchestrator/manager.ts` (lines 108-144: Saga interface, line 591: in-memory Map)
- `src/lib/orchestration/event-router.ts` (lines 165-255: ephemeral event processing)
- `src/app/api/cron/operations-cycle/route.ts`

**New Firestore Collections:**
- `organizations/{orgId}/sagaState/{sagaId}` — checkpoint data
- `organizations/{orgId}/eventLog/{eventId}` — event persistence with dedup

---

#### 1.2 Global Kill Switch & Per-Agent Controls — COMPLETE
**Severity:** CRITICAL (RESOLVED)
**Problem:** The current kill switch (`agentEnabled` boolean) only gates the `AutonomousPostingAgent.executeAction()`. The Event Router, Master Orchestrator, Signal Bus, and all 9 managers have **zero awareness** of it. If the Revenue Director starts spamming outbound emails, the social kill switch does nothing.

**Impact:** No way to stop all agents with one button. No way to stop individual agents independently. In-flight Event Router signals continue processing even when kill switch is active.

**Implementation:**
1. Create `src/lib/orchestration/swarm-control.ts` — global swarm state service
   - `getSwarmState()` → `{ globalPause: boolean, pausedAgents: string[], pausedManagers: string[] }`
   - `pauseSwarm()` / `resumeSwarm()` — global freeze
   - `pauseAgent(agentId)` / `resumeAgent(agentId)` — per-agent control
   - Firestore-backed at `organizations/{orgId}/settings/swarm_control`
2. Add guard to `EventRouter.processEvent()` — check global pause before dispatching
3. Add guard to `MasterOrchestrator.execute()` — check global pause before saga execution
4. Add guard to `SignalBus.send()` — check global pause, queue signals if paused (don't drop them)
5. Add per-manager pause check in `BaseManager.execute()` — check if this manager is individually paused
6. Update Command Center UI (`/social/command-center`) — add "Pause All Agents" button + individual manager toggles
7. Create API endpoint: `/api/orchestrator/swarm-control` (GET/POST/PUT)

**Key Files:**
- `src/lib/social/autonomous-posting-agent.ts` (lines 274-289: current kill switch)
- `src/lib/orchestration/event-router.ts` (no pause check)
- `src/lib/agents/orchestrator/manager.ts` (no pause check)
- `src/lib/orchestrator/signal-bus.ts` (no pause check)
- `src/lib/agents/base-manager.ts` (no per-manager pause)
- `src/app/(dashboard)/social/command-center/page.tsx`

---

#### 1.3 E2E Agent Integration Testing
**Severity:** HIGH
**Problem:** No test validates the full chain: user action → API → orchestrator → manager → specialist → UI. A change to BaseManager delegation logic or Event Router signal format could silently break 38 specialists.

**Implementation:**
1. Create `tests/e2e/agent-chain.spec.ts` — Playwright tests for:
   - User triggers orchestrator via Jasper chat → verify manager receives task → verify specialist executes
   - Event Router signal → manager action → specialist result → Firestore update
   - Kill switch activation → verify all agent execution halts (depends on 1.2)
2. Create `tests/integration/saga-workflow.test.ts` — Jest tests for:
   - Saga creation → step execution → checkpoint persistence → crash simulation → resume
   - Compensation logic on failure (rollback previous steps)
3. Create `tests/integration/signal-propagation.test.ts` — Jest tests for:
   - Signal sent from one manager → received by another → correct action taken
   - Signal pause → queue → resume → dequeue

---

### Tier 2 — Revenue & Attribution (Business value)

These features prove ROI and are required for investor/buyer credibility.

#### 2.1 Revenue Attribution Pipeline
**Severity:** HIGH
**Problem:** The chain from content to revenue is broken at every junction. UTM params are captured on forms but not passed to leads. Leads have a `source` field that's never auto-populated. Deals have an optional `leadId` that's never set. Orders have no attribution fields. Stripe payments carry no source metadata.

**Current State (40% wired):**
```
Social Post (no click tracking)
     ↓ BROKEN
Website Visit (UTM captured on forms but not passed to lead)
     ↓ BROKEN
Lead Created (source field exists but not populated from UTM)
     ↓ BROKEN
Deal Created (no link back to lead/form)
     ↓ BROKEN
Stripe Payment (no attribution metadata)
     ↓ BROKEN
Revenue (can calculate total, cannot attribute by source)
```

**Implementation — P0 (Complete the Chain):**
1. Add attribution fields to types:
   - `Lead`: add `formId`, `formSubmissionId` fields
   - `Deal`: ensure `leadId` is populated on creation from lead
   - `Order` (`src/types/ecommerce.ts`): add `dealId`, `leadId`, `formId`, `attributionSource`
2. Wire form submission → lead creation:
   - In `/api/public/forms/[formId]/route.ts`: pass `utm_source` → `Lead.source`, `formId` → `Lead.formId`
3. Wire lead → deal conversion:
   - In `src/lib/crm/deal-service.ts`: when creating deal from lead, inherit `source`, set `leadId`
4. Wire checkout → attribution:
   - In `/api/checkout/create-payment-intent/route.ts`: pass `leadId`, `dealId`, `formId`, `utm_source`, `utm_campaign` to Stripe metadata
   - In `/api/checkout/complete/route.ts`: write attribution fields to Order document
5. Add social post UTM auto-generation:
   - In `autonomous-posting-agent.ts`: append `?utm_source=social&utm_medium={platform}&utm_campaign=post_{id}` to all links in posts

**Implementation — P1 (Analytics & Reporting):**
6. Create `/api/analytics/attribution` endpoint:
   - Revenue by source (utm_source, utm_medium, utm_campaign)
   - Funnel metrics (form → lead → deal → order conversion rates)
7. Create Attribution Dashboard page at `/analytics/attribution`
8. Add "Source" column to existing Orders, Leads, and Deals tables

**Key Files to Modify:**
- `src/types/crm-entities.ts` — Lead and Deal types
- `src/types/ecommerce.ts` — Order type (lines 779-830)
- `src/app/api/public/forms/[formId]/route.ts` — form submission handler
- `src/lib/crm/lead-service.ts` — lead creation
- `src/lib/crm/deal-service.ts` — deal creation
- `src/app/api/checkout/create-payment-intent/route.ts` — Stripe metadata
- `src/app/api/checkout/complete/route.ts` — order creation
- `src/lib/social/autonomous-posting-agent.ts` — UTM link injection

---

### Tier 3 — Platform Integrations (Feature completeness)

These close the gap between "demo" and "production" for external platform connections.

#### 3.1 Wire Twitter/X Engagement Actions
**Severity:** MEDIUM
**Problem:** POST/RECYCLE actions are real (Twitter API), but REPLY, LIKE, FOLLOW, and REPOST return fake success with placeholder IDs.

**Implementation:**
1. In `autonomous-posting-agent.ts`, replace TODO stubs at:
   - Line ~460 (REPLY): call `twitterService.replyToTweet()`
   - Line ~495 (LIKE): call `twitterService.likeTweet()`
   - Line ~529 (FOLLOW): call `twitterService.followUser()`
   - Line ~563 (REPOST): call `twitterService.retweet()`
2. Add missing methods to `src/lib/integrations/twitter-service.ts` if they don't exist:
   - `replyToTweet(tweetId, text)`
   - `likeTweet(tweetId)`
   - `followUser(userId)`
   - `retweet(tweetId)`
3. Respect rate limits and compliance checks already in place

**Key Files:**
- `src/lib/social/autonomous-posting-agent.ts` (lines 460-563)
- `src/lib/integrations/twitter-service.ts`

---

#### 3.2 Facebook/Instagram Integration (Meta Graph API)
**Severity:** MEDIUM
**Blocked by:** Meta Developer account sandbox access + app review submission

**Pre-work (can start immediately):**
1. Register app on Meta Developer Portal
2. Request sandbox access for Instagram Graph API and Facebook Pages API
3. Submit app review for `pages_manage_posts`, `instagram_basic`, `instagram_content_publish` permissions

**Implementation (after sandbox access):**
1. Create `src/lib/integrations/meta-service.ts`:
   - Facebook Pages API: post creation, scheduling, insights
   - Instagram Graph API: media publishing, stories, insights
   - OAuth 2.0 flow for connected accounts
2. Add Facebook/Instagram as platform options in `autonomous-posting-agent.ts`
3. Add connected account UI for Meta platforms in social settings
4. Add platform-specific content formatting (Instagram: image-first, character limits; Facebook: longer form)

---

#### 3.3 LinkedIn Official API
**Severity:** MEDIUM
**Blocked by:** LinkedIn Marketing Developer Platform application approval

**Pre-work (can start immediately):**
1. Apply for LinkedIn Marketing Developer Platform access
2. Request `w_member_social` and `r_basicprofile` scopes

**Implementation (after approval):**
1. Replace RapidAPI calls in `autonomous-posting-agent.ts` (lines 838-919) with official LinkedIn API
2. Create `src/lib/integrations/linkedin-service.ts` with official OAuth 2.0 flow
3. Remove RapidAPI dependency for LinkedIn

---

#### 3.4 CI/CD Cleanup
**Severity:** LOW

1. Update `.github/workflows/ci.yml` Node version from 18 → 20
2. Update `.github/workflows/api-integrity.yml` Node version from 18 → 20
3. Implement actual Vercel deploy step in CI deploy job (currently echoes placeholder)

---

## Execution Order & Parallelization

```
SESSION 1: ✅ COMPLETE — Saga Persistence (1.1) + Global Kill Switch (1.2)
SESSION 2: ✅ COMPLETE — Revenue Attribution P0 (2.1) + Twitter Engagement (3.1)
SESSION 3: ✅ COMPLETE — Revenue Attribution P1 (2.1b analytics/dashboard) + E2E Testing (1.3)
SESSION 4: ✅ COMPLETE — CI/CD Cleanup (3.4) + deals recommendations auth fix + SSOT updates
SESSION 5: ✅ COMPLETE — Quick wins (4 TODOs) + ESLint OOM fix (tsconfig.eslint.json + cross-env + 8GB heap)
SESSION 6: ✅ COMPLETE — Stripe checkout flow completion + Social OAuth UI (Twitter PKCE, LinkedIn) + Website editor/pages 401 auth fix
SESSION 7: ✅ COMPLETE — DALL-E 3 image generation (Asset Generator), AI page builder (Website Builder), video pipeline wired to real HeyGen/Sora/Runway providers
SESSION 7b: ✅ COMPLETE — 8 TODO quick-wins resolved, video "Save to Library" wired to Firestore, save route schema extended (generatedScenes, finalVideoUrl)
SESSION 8: ✅ COMPLETE — 25+ TODO stubs resolved across 13 files (Firestore queries, notification service, competitive monitor, risk engine, smart sequencer, email writer, QR code, coaching analytics, deal monitor lifecycle)

BLOCKED (external — no code work possible):
  - Meta Developer Portal sandbox application (3.2)
  - LinkedIn Marketing Developer Platform application (3.3)
```

---

## Integration Status (Verified February 13, 2026)

| Integration | Status | Notes |
|---|---|---|
| **Twitter/X** | REAL | Direct API v2, OAuth2 PKCE, posting, media upload, timeline, search |
| **LinkedIn** | PARTIAL | Unofficial RapidAPI wrapper + manual task fallback. Needs official API. |
| **Facebook** | NOT BUILT | No code exists |
| **Instagram** | NOT BUILT | No code exists |
| **Stripe** | REAL | Full API — checkout sessions, PaymentElement (3DS), payment intents, products, prices, payment links, webhooks |
| **Email (SendGrid/Resend/SMTP)** | REAL | Multiple providers, open/click tracking |
| **Voice (Twilio/Telnyx)** | REAL | Call initiation, control, conferencing |
| **TTS (ElevenLabs/Unreal)** | REAL | 20+ premium voices via ElevenLabs |
| **Video (HeyGen/Sora/Runway)** | REAL | Render pipeline wired to real API calls via video-service.ts; Runway gen3a_turbo; returns "Coming Soon" if keys not configured |
| **Social Engagement (POST)** | REAL | Twitter works, LinkedIn partial |
| **Social Engagement (REPLY/LIKE/FOLLOW/REPOST)** | REAL (Twitter) | Wired to Twitter API v2: likeTweet, retweet, followUser, reply via postTweet |
| **Social OAuth (Twitter)** | REAL | PKCE flow — code challenge, auth URL, code exchange, profile fetch, AES-256-GCM token encryption |
| **Social OAuth (LinkedIn)** | REAL | OAuth 2.0 authorization code flow, token exchange, profile fetch, AES-256-GCM token encryption |
| **Firebase** | REAL | Auth + Firestore, single-tenant `rapid-compliance-65f87` |
| **OpenRouter** | REAL | AI gateway, 100+ models |

---

## Known Issues

| Issue | Details |
|-------|---------|
| ~~Saga state is in-memory only~~ | **FIXED** — Firestore-backed checkpoint/resume with dedup |
| ~~Kill switch is social-only~~ | **FIXED** — Global swarm control with per-manager toggles |
| ~~Revenue attribution chain broken~~ | **FIXED** — Full UTM→Lead→Deal→Order→Stripe chain wired with auto-lead creation from forms |
| ~~Social engagement stubs~~ | **FIXED** — Twitter REPLY/LIKE/FOLLOW/REPOST wired to real API v2 |
| ~~No attribution analytics~~ | **FIXED** — `/api/analytics/attribution` endpoint + `/analytics/attribution` dashboard + Source columns in CRM tables |
| ~~No agent integration tests~~ | **FIXED** — Playwright E2E agent-chain tests + Jest saga-workflow + signal-propagation integration tests |
| Facebook/Instagram missing | No implementation (Tier 3.2) |
| LinkedIn unofficial | Uses RapidAPI, not official API (Tier 3.3) |
| ~~Node version mismatch~~ | **FIXED** — CI updated to Node 20, actions v4, Vercel deploy step implemented |
| ~~`/api/crm/deals/[dealId]/recommendations`~~ | **FIXED** — Auth user extraction added, workspaceId from query param |
| ~~ESLint OOM on full lint~~ | **FIXED** — `tsconfig.eslint.json` scoped to `src/`, `cross-env` 8GB heap, `.husky/pre-commit` updated |
| ~~Playbook createdBy hardcoded~~ | **FIXED** — `generatePlaybook()` now receives authenticated `userId` from API route |
| ~~Notification signal handlers disconnected~~ | **FIXED** — All 18 handlers wired to `SignalCoordinator.observeSignals()` |
| ~~Email writer missing toast feedback~~ | **FIXED** — Copy-to-clipboard shows success toast |
| ~~Activities missing Firestore indexes~~ | **FIXED** — 4 composite indexes added to `firestore.indexes.json` |
| ~~Render pipeline mocked~~ | **FIXED** — render-pipeline.ts wired to real HeyGen/Sora/Runway APIs via video-service.ts |
| ~~Asset Generator is a shell~~ | **FIXED** — Uses real DALL-E 3 image generation with graceful placeholder fallback |
| ~~Social accounts UI is mock~~ | **FIXED** — Real OAuth flows for Twitter (PKCE) and LinkedIn, AES-256-GCM token encryption, verify endpoint, manual credential fallback |
| ~~Website editor/pages 401~~ | **FIXED** — All fetch calls now include Firebase auth headers. Infinite error loop resolved (toastRef pattern) |
| ~~Stripe checkout incomplete~~ | **FIXED** — Full PaymentElement flow with 3DS, cart recovery page, enriched success page |
| ~~~27 TODO comments remaining~~ | **REDUCED to ~15** — Session 8 resolved 25+ stubs (Firestore queries, notifications, competitive monitor, risk engine, sequencer, email writer, QR code, coaching analytics, deal monitor). Remaining 15 are external deps (i18n translations, Outlook webhooks, vector embeddings, DM feature, web scraping) |
| ~~Video "Save to Library" stub~~ | **FIXED** — Wired to `/api/video/project/save` with full Firestore persistence |

---

## Next Up: Secondary Tasks

These are the remaining buildable items, ordered by impact:

### Completed (Session 6)
| Task | Status |
|------|--------|
| ~~**E-commerce**~~ | **DONE** — Full Stripe PaymentElement checkout with 3DS, cart recovery, enriched success page |
| ~~**Social Accounts UI**~~ | **DONE** — Real OAuth for Twitter (PKCE) + LinkedIn, token encryption, verify, manual credential fallback |

### Completed (Session 7)
| Task | Status |
|------|--------|
| ~~**Website Builder**~~ | **DONE** — AI-powered page generation from natural language prompts, "Generate with AI" button + modal |
| ~~**Asset Generator**~~ | **DONE** — Real DALL-E 3 image generation with smart size mapping and graceful fallback |
| ~~**Video Pipeline (Core)**~~ | **DONE** — Render pipeline wired to real HeyGen/Sora/Runway APIs, Runway gen3a_turbo, Firestore key management |

### Medium Priority (Remaining)
| Task | What Needs Building |
|------|---------------------|
| **Video Pipeline Polish** | Scene editing improvements, screenshot capture, scene stitching (Save to Library now wired) |

### Low Priority
| Task | What Needs Building |
|------|---------------------|
| **~15 TODO comments** | External deps only: i18n translations (6 languages), Outlook webhooks, vector embeddings, web scraping, DM feature, real-time notifications |

### Video Production Pipeline (Details)
**Goal:** Tell Jasper "create a video" and receive a polished video in the library.

**What's Built:** Video Specialist, Director Service, HeyGen/Sora/Runway API integrations, multi-engine selector, Video Studio UI (7-step pipeline), storyboard preview, Jasper tools, TTS generation, video library, Academy page.

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestration/event-router.ts` | Declarative rules engine — 25+ event rules, event persistence |
| `src/lib/orchestration/saga-persistence.ts` | **NEW** — Firestore-backed saga checkpoint/resume + event dedup |
| `src/lib/orchestration/swarm-control.ts` | **NEW** — Global kill switch + per-manager pause controls |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication, signal queuing on pause |
| `src/lib/agents/orchestrator/manager.ts` | Master Orchestrator — Saga Pattern, command dispatch |
| `src/lib/agents/base-manager.ts` | Base manager class — delegation, authority |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge store (Firestore-backed) |
| `src/lib/social/autonomous-posting-agent.ts` | Core social agent — posting, queue, compliance, playbook, engagement actions, UTM auto-append |
| `src/lib/integrations/twitter-service.ts` | Twitter API v2 — OAuth 2.0, posting, media, search, like, retweet, follow |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 36+ function-calling tools |
| `src/lib/orchestrator/feature-manifest.ts` | 11 specialists + capabilities + trigger phrases |
| `src/lib/agent/golden-master-builder.ts` | Golden Master versioning + deployment |
| `src/types/agent-memory.ts` | Golden Master, GoldenPlaybook, CustomerMemory types |
| `src/types/crm-entities.ts` | Lead, Deal, Contact types (attribution fields wired) |
| `src/types/ecommerce.ts` | Order type (attribution fields wired) |
| `src/lib/crm/lead-service.ts` | Lead creation with attribution (formId, UTM, source) |
| `src/lib/crm/deal-service.ts` | Deal creation with lead attribution inheritance |
| `src/app/api/analytics/attribution/route.ts` | **NEW** — Attribution analytics (revenue by source/campaign/medium, funnel metrics) |
| `src/app/(dashboard)/analytics/attribution/page.tsx` | **NEW** — Attribution dashboard (funnel viz, breakdown tables) |
| `tests/e2e/agent-chain.spec.ts` | **NEW** — Playwright E2E: swarm control, attribution API, kill switch, CRM pages |
| `tests/integration/saga-workflow.test.ts` | **NEW** — Jest: saga checkpoint/resume, crash simulation, event dedup/replay |
| `tests/integration/signal-propagation.test.ts` | **NEW** — Jest: SignalBus, swarm control, pause/queue/dequeue, guard functions |
| `tsconfig.eslint.json` | ESLint-specific tsconfig scoped to `src/` (excludes `.next`, build artifacts) |
| `src/lib/notifications/signal-handlers.ts` | Notification signal dispatch — 18 handlers wired to SignalCoordinator |
| `firestore.indexes.json` | Firestore composite indexes (25 indexes including activities) |
| `vercel.json` | 7 cron entries for autonomous operations |
| `src/components/StripeProvider.tsx` | **NEW** — Stripe Elements wrapper with loadStripe + dark theme |
| `src/lib/social/social-oauth-service.ts` | **NEW** — Twitter PKCE + LinkedIn OAuth 2.0 flows, AES-256-GCM token encryption |
| `src/lib/social/social-oauth-schemas.ts` | **NEW** — Zod schemas for OAuth providers, callbacks, manual credentials |
| `src/app/api/social/oauth/auth/[provider]/route.ts` | **NEW** — OAuth initiation (Twitter PKCE, LinkedIn) |
| `src/app/api/social/oauth/callback/[provider]/route.ts` | **NEW** — OAuth callback handler with token exchange |
| `src/app/api/social/accounts/verify/route.ts` | **NEW** — Social account connection verification |
| `src/components/integrations/TwitterIntegration.tsx` | **NEW** — Twitter OAuth + manual credential UI |
| `src/components/integrations/LinkedInIntegration.tsx` | **NEW** — LinkedIn OAuth + manual credential UI |
| `src/app/store/checkout/cancelled/page.tsx` | **NEW** — Cart recovery page for cancelled checkouts |
| `src/lib/ai/image-generation-service.ts` | **NEW** — DALL-E 3 image generation wrapper (size/quality/style options) |
| `src/app/api/ai/generate-image/route.ts` | **NEW** — Image generation endpoint with Zod validation, rate limiting |
| `src/lib/website-builder/ai-page-generator.ts` | **NEW** — AI page generation from natural language prompts |
| `src/app/api/website/ai/generate/route.ts` | **NEW** — Website AI generation endpoint with rate limiting |
