# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 13, 2026 (Session 3 complete — Revenue Attribution P1 (2.1b) + E2E Agent Integration Testing (1.3))

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **168 physical routes**, **244 API endpoints**, **430K+ lines of TypeScript**
- **Deployed via Vercel** — dev branch → main branch → Vercel auto-deploy

### Code Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES (production build succeeds)**

### Deployment Pipeline
- **Vercel:** Configured with `vercel.json` (7 cron jobs, CORS headers, security headers, US East region)
- **CI/CD:** GitHub Actions on `main`/`dev` — lint, type-check, test, build
- **Deploy scripts:** `verify-env-vars.js` (P0/P1/P2 env validation), `deploy-firebase-rules.js`, `test-production-health.js`
- **Node version:** package.json requires 20.x (CI workflows need update from 18 → 20)

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

---

## PRIMARY TASK: Production Readiness Plan

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
SESSION 4: CI/CD Cleanup (3.4) + any remaining items

EXTERNAL (start immediately, no code dependency):
  - Meta Developer Portal sandbox application (3.2)
  - LinkedIn Marketing Developer Platform application (3.3)
  - Build when approvals arrive
```

---

## Integration Status (Verified February 13, 2026)

| Integration | Status | Notes |
|---|---|---|
| **Twitter/X** | REAL | Direct API v2, OAuth2 PKCE, posting, media upload, timeline, search |
| **LinkedIn** | PARTIAL | Unofficial RapidAPI wrapper + manual task fallback. Needs official API. |
| **Facebook** | NOT BUILT | No code exists |
| **Instagram** | NOT BUILT | No code exists |
| **Stripe** | REAL | Full API — checkout sessions, products, prices, payment links |
| **Email (SendGrid/Resend/SMTP)** | REAL | Multiple providers, open/click tracking |
| **Voice (Twilio/Telnyx)** | REAL | Call initiation, control, conferencing |
| **TTS (ElevenLabs/Unreal)** | REAL | 20+ premium voices via ElevenLabs |
| **Video (HeyGen/Sora/Runway)** | CONDITIONAL | Real API calls if keys configured; returns "Coming Soon" otherwise |
| **Social Engagement (POST)** | REAL | Twitter works, LinkedIn partial |
| **Social Engagement (REPLY/LIKE/FOLLOW/REPOST)** | REAL (Twitter) | Wired to Twitter API v2: likeTweet, retweet, followUser, reply via postTweet |
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
| Node version mismatch | CI uses 18, package.json requires 20 (Tier 3.4) |
| `/api/crm/deals/[dealId]/recommendations` | Auth implementation incomplete |
| Render pipeline mocked | `render-pipeline.ts` returns fake responses for video |
| Asset Generator is a shell | Returns placeholder URLs, no actual image generation |
| Social accounts UI is mock | Hardcoded connected/disconnected status, no real OAuth |
| ~40 TODO comments remaining | Auth context TODOs reduced but some remain |

---

## Secondary Tasks (Lower Priority)

### Video Production Pipeline
**Goal:** Tell Jasper "create a video" and receive a polished video in the library.

**What's Built:** Video Specialist, Director Service, HeyGen/Sora/Runway API integrations, multi-engine selector, Video Studio UI (7-step pipeline), storyboard preview, Jasper tools, TTS generation, video library, Academy page.

**What Still Needs Building:** Screenshot capture (Puppeteer/Playwright), scene-level editing, avatar/voice picker UI, storyboard → HeyGen bridge, scene stitching (ffmpeg), AI auto-selection, Luma/Kling integrations.

### Other Platform Work
- E-commerce: Stripe checkout flow completion
- Website Builder: AI-powered page generation, template system

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
| `vercel.json` | 7 cron entries for autonomous operations |
