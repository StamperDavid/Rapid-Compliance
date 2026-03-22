# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 21, 2026 (V1A Clone Wizard + V2 table-stakes complete — captions, simple mode, music, progress)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (46 swarm + 6 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions enforced on 36+ API routes, set-claims supports all 4 roles
- **184 pages**, **393 API routes**, **1,628 TypeScript files**, **~350K+ lines**
- **212 React components**, **54 type definition files**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health (Verified March 21, 2026 — Post Phase 3B)
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run test:ci` — **81/81 suites pass, 1,706 tests (1,700 pass, 5 skipped, 0 flaky)**
- Phase 3B added **205 new unit tests** across 8 critical systems (video, payments, Jasper, agents)
- Phase 3A rewrote **9 E2E spec files** with 10 real user journeys (CRUD, checkout, workflows)
- Zero `eslint-disable` comments — **CLEAN** (Phase 1 removed all 24)
- Zero `Promise.resolve(null/[])` stubs — **CLEAN** (Phase 1 replaced all)
- Zero `any` type annotations — Zero-Any Policy enforced
- Zero `@ts-ignore` / `@ts-expect-error` — clean
- Zero `TODO` / `FIXME` comments in source

### Production Readiness (Honest Assessment)

| Domain | Score | Verified Status |
|--------|-------|-----------------|
| Video System (Hedra) | 9.5/10 | Real API calls, scene grading, editor, avatars — cleanest code in codebase |
| AI Orchestration (Jasper) | 9.5/10 | 50 real tools, OpenRouter calls, 3-layer prompt, mission tracking |
| API Routes (399 total) | 9.5/10 | 100% auth, 100% Zod, 100% try/catch, Mollie HMAC verified, granular RBAC on 36+ sensitive routes |
| CRM & Sales | 9/10 | Contacts, deals, leads, pipeline — fully implemented |
| Website Builder | 9/10 | Editor, pages, blog, domains, SEO, navigation — all real |
| Email & SMS | 8.5/10 | CAN-SPAM/TCPA compliant — delivery tests skipped (need API keys) |
| Public Pages & Onboarding | 9/10 | 4-step onboarding, Stripe checkout, live AI demo — all working |
| Analytics & Growth | 8.5/10 | Dashboard, pipeline, growth strategy — all real implementations |
| Payments & Commerce | 9/10 | Stripe integrated, cart/checkout real, billing portal via Stripe Customer Portal |
| Authentication | 9.5/10 | Firebase Admin SDK, granular RBAC enforced, MFA/TOTP, password change, GDPR account deletion |
| Social Media | 6/10 | Twitter works, Facebook/Instagram/TikTok/LinkedIn are stubs |
| **E2E Testing** | **6/10** | **14 spec files, 10 real user journeys (CRUD, checkout, workflows), 104 tests** |
| **Unit/Integration Testing** | **8/10** | **81 files, 1,700 passing — video, Jasper, payments, agents, scene grading all covered (Phase 3B)** |

---

## System Health Report (Code Review — March 20, 2026)

This section documents every real issue found by reading actual source code. No claims from docs.

### Critical Issues

#### 1. E2E Tests — Page-Load Verification Only (~5% Coverage)

14 spec files exist but every test follows the same pattern: navigate to page → assert element exists → done. Zero complete user workflows tested.

**What's covered (shallow):** Login form elements, signup first 2 steps, dashboard layout, CRM table structure, social page loads, video stepper presence, analytics card presence, commerce page structure, website builder panels, settings cards, forms page, outreach page.

**What has ZERO coverage (170+ pages):** Content studio, voice lab, image generator, lead discovery/research/ICP, deal detail/edit, contact detail/edit, mission control execution, workflows execution, email campaigns, social posting, website editing, growth strategy, coaching, schemas, onboarding completion, checkout payment flow, video generation end-to-end.

**Auth setup depends on** `seed-e2e-users.mjs` which is NOT in git.

#### 2. eslint-disable Comments (24 across 19 files)

Per CLAUDE.md zero-tolerance rule, these must be removed. Breakdown by type:
- `react-hooks/exhaustive-deps` — 7 occurrences (StepStoryboard ×3, VoiceRecorderStudio ×2, EditorMediaPanel, website editor, subscription, training)
- `@next/next/no-img-element` — 3 occurrences (OptimizedImage, theme, email-templates)
- `@typescript-eslint/no-require-imports` — 2 occurrences (ffmpeg-utils)
- `@typescript-eslint/no-implied-eval` — 2 occurrences (formula-engine, distillation-engine)
- `no-console` — 2 occurrences (logger, orphaned-files-report)
- `no-template-curly-in-string` — 3 occurrences (notifications/templates ×2, translations)
- `require-atomic-updates` — 2 occurrences (gemini-service, ai-agent-action)
- `@next/next/no-html-link-for-pages` — 1 occurrence (public form)

#### 3. Promise.resolve(null/[]) Stubs (11 in production code)

| File | Count | Impact |
|------|-------|--------|
| `src/lib/agent/instance-manager.ts` | 2 | `getActiveInstance()` + `removeActiveInstance()` are NOPs — agent lifecycle broken |
| `src/lib/enrichment/enrichment-service.ts` | 3 | Conditional fallbacks when features disabled — acceptable pattern |
| `src/lib/agents/marketing/facebook/specialist.ts` | 1 | Returns null on persona miss → caller throws |
| `src/lib/scraper-intelligence/scraper-queue.ts` | 3 | Dequeue edge cases return null — callers can't distinguish empty vs error |
| `src/lib/scraper-intelligence/scraper-cache.ts` | 2 | Cache miss returns — arguably correct behavior |

**Verdict:** instance-manager.ts and facebook/specialist.ts are real violations. enrichment-service.ts and scraper-cache.ts are defensible patterns.

#### 4. RBAC Enforcement Gap — FIXED (Phase 4, commit 134ee9f7)

**Resolution:** Added `requirePermission()` middleware to `api-auth.ts`. Applied granular RBAC to 36+ API routes:
- Owner-only: create-platform-org
- Admin-only (owner/admin): API keys, webhooks, schemas, entity-config, feature flags, brand DNA, custom tools, golden masters, fine-tuning, A/B tests, swarm control, social training, website settings/domains/migrate, notifications
- Manager+ (owner/admin/manager): bulk delete, lead import, merge duplicates, report execution, schema edit
- Fixed 4 unprotected routes (score-session, lead-scoring CRUD)
- Standardized /admin/ path routes to verifyAdminRequest
- set-claims already accepts all 4 roles (fixed in Phase 2)

#### 5. Six Failing Test Suites (18 tests)

| Suite | Path |
|-------|------|
| BrowserController | `tests/integration/BrowserController.test.ts` |
| Discovery Engine | `tests/integration/discovery-engine.test.ts` |
| Team Coaching Engine | `tests/lib/coaching/team-coaching-engine.test.ts` |
| Phase 5 Backward Compat | `tests/integration/phase5-backward-compatibility.test.ts` |
| Training Manager | `tests/integration/scraper-intelligence/training-manager-integration.test.ts` |
| Temporary Scrapes | `tests/integration/scraper-intelligence/temporary-scrapes-integration.test.ts` |

These need immediate diagnosis and fix.

### Medium Issues

| Issue | File | Fix |
|-------|------|-----|
| Mollie webhook — no signature verification | `src/app/api/webhooks/mollie/route.ts` | Add `x-mollie-signature` HMAC check |
| Admin templates inconsistent auth | `src/app/api/admin/templates/route.ts` | Replace `requireUserRole()` with `verifyAdminRequest()` |
| Scraper start missing rate limiting | `src/app/api/admin/growth/scraper/start/route.ts` | Add `rateLimitMiddleware()` |
| Workflow schemas too loose | `src/app/api/workflows/route.ts` | Replace `z.record(z.unknown())` with strict action/trigger schemas |
| `as unknown as Firestore` casts | `src/lib/workflow/workflow-service.ts` | Type the DAL correctly for Admin SDK |
| IP-based rate limiting | `src/lib/auth/` | Switch to user-ID-based (Redis when wired) |
| Email sender `from` not validated | `src/app/api/email/send/route.ts` | Verify `from` is org-owned address |

---

## Remediation Plan

### Phase 1: Fix Broken Things — COMPLETE (commit 7917747e)

**Goal:** Green test suite, zero eslint-disable violations, no stub functions.
**Result:** 74/74 suites passing, 0 eslint-disable, 0 stubs. All verified.

#### 1A. Fix 6 Failing Test Suites
- `BrowserController.test.ts` — extractTechStack eval error
- `discovery-engine.test.ts` — likely stale mock or API change
- `team-coaching-engine.test.ts` — likely stale mock or signature mismatch
- `phase5-backward-compatibility.test.ts` — 66s timeout, likely integration dependency
- `training-manager-integration.test.ts` — scraper intelligence service change
- `temporary-scrapes-integration.test.ts` — scraper intelligence service change
- Target: 74/74 suites passing, 0 failures

#### 1B. Remove All 24 eslint-disable Comments
Work through each file, fix the underlying code:
- **react-hooks/exhaustive-deps (7):** Add proper dependency arrays or extract stable refs with useCallback/useRef
- **@next/next/no-img-element (3):** Replace `<img>` with `next/image` or document legitimate exception with comment justification (user-uploaded blob URLs)
- **@typescript-eslint/no-require-imports (2):** Convert to dynamic `import()` in ffmpeg-utils
- **@typescript-eslint/no-implied-eval (2):** Use `Function` constructor with explicit typing or restructure formula evaluation
- **no-console (2):** Replace with logger utility (logger.ts is the logger itself — restructure to avoid circular dep)
- **no-template-curly-in-string (3):** Use string concatenation or template tag functions
- **require-atomic-updates (2):** Add explicit variable scoping or mutex
- **@next/next/no-html-link-for-pages (1):** Replace with Next.js `Link` component

#### 1C. Fix Promise.resolve Stubs
- **instance-manager.ts:** Implement real Firestore-backed instance tracking (or Redis if available)
- **facebook/specialist.ts:** Return a sensible default persona instead of null (prevent downstream crash)
- Leave enrichment-service.ts and scraper-cache.ts as-is (defensible conditional patterns)

### Phase 2: Security & Auth Hardening — COMPLETE (commit ecab543e)

**Result:** All items completed and verified (lint clean, type-check clean, 74/74 tests pass).

#### 2A. Enforce Granular RBAC — DONE
- set-claims expanded to all 4 roles (owner/admin/manager/member) with correct admin claim logic
- admin/templates switched to verifyAdminRequest for consistency with other admin routes

#### 2B. Webhook & API Security — DONE
- Mollie webhook: HMAC signature verification + rate limiting
- Email send: from-address domain allowlist (salesvelocity.ai, rapidcompliance.us)
- Rate limiting added to 5 admin routes: templates, scraper/start, test-api-connection, promotions, pricing-tiers

#### 2C. Strengthen Loose Schemas — DONE
- Workflow POST/PUT bodies: replaced 5x z.record(z.unknown()) with strict Zod schemas from validation.ts
- ActionConfigSchema: replaced z.record(z.unknown()) fallback with typed CustomActionConfigSchema
- BaseAgentDAL: constructor widened to accept Admin SDK Firestore, eliminating 7 unsafe casts

### Phase 3: Test Coverage (Critical Gaps)

#### 3B. Unit Tests for Untested Critical Systems — COMPLETE (commits 665af0c3 + 6804102a)

**Result:** 205 new tests across 8 critical systems. 81/81 suites passing.

| System | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Scene grading (LCS algorithm) | `tests/lib/video/scene-grading-service.test.ts` | 24 | PASS |
| Hedra video generation | `tests/lib/video/hedra-service.test.ts` | 28 | PASS |
| Avatar profiles (Character Studio) | `tests/lib/video/avatar-profile-service.test.ts` | 48 | PASS |
| Transcription (Deepgram) | `tests/lib/video/transcription-service.test.ts` | 14 | PASS |
| Scene generator | `tests/lib/video/scene-generator.test.ts` | 31 | PASS |
| Jasper tools (50 tools) | `tests/lib/orchestrator/jasper-tools.test.ts` | 17 | PASS |
| Agent swarm (BaseManager) | `tests/lib/agents/base-manager.test.ts` | 24 | PASS |
| Payment service (Stripe/PayPal/Square) | `tests/payment-service.test.ts` | 19 | PASS |

**Also fixed:**
- Jasper REVIEW_LINK_MAP: all delegate_to_* → /mission-control (was /analytics)
- System prompt example: /analytics → /mission-control
- Added DELETE /api/orchestrator/missions/[missionId] + deleteMission() + UI button
- Fixed temporary-scrapes integration tests for parallel-safety

#### 3A. E2E Test Rewrite — Real User Journeys
Priority user flows that need end-to-end Playwright tests:

| Flow | What to Test |
|------|-------------|
| **Complete signup** | Industry → niche → account creation → API key → dashboard |
| **Lead CRUD** | Create lead → edit → view detail → delete |
| **Deal pipeline** | Create deal → drag between stages → verify persistence |
| **Video generation** | Create project → storyboard → generate (mock Hedra) → review |
| **E-commerce checkout** | Add to cart → checkout → Stripe payment (test mode) → order confirmation |
| **Email sequence** | Create sequence → enroll lead → verify sends |
| **Social posting** | Compose → schedule → verify in queue |
| **Website builder** | Create page → edit content → publish → verify public |
| **Workflow execution** | Create workflow → trigger → verify actions fire |
| **Settings changes** | Change API key → verify persistence |

Also: commit `seed-e2e-users.mjs` to git or replace with programmatic user creation in auth.setup.ts.

### Phase 4: Launch Gaps — COMPLETE (commit 134ee9f7)

**Result:** All 5 deliverable gaps closed. Facebook/Instagram/TikTok remains blocked on Meta approval (external dependency).

| Gap | Status | Implementation |
|-----|--------|----------------|
| **RBAC Enforcement** | DONE | `requirePermission()` middleware + 36+ routes gated by role |
| **Billing portal UI** | DONE | POST /api/subscriptions/portal (Stripe Customer Portal session), "Manage Billing" button on billing page |
| **In-app password change** | DONE | POST /api/user/password-change (Firebase REST verify + Admin SDK update, rate-limited 5/15min) |
| **Account deletion (GDPR)** | DONE | POST /api/user/delete-account (password confirm, Firestore + Auth deletion, owner blocked) |
| **MFA/2FA setup** | DONE | POST /api/user/mfa/setup (TOTP RFC 6238 — generate/verify/disable, Firestore-backed, 10min pending TTL) |
| **Email invites** | DONE | POST /api/users/invite (role hierarchy enforcement, duplicate detection, email delivery via email-service) |
| **Account settings page** | DONE | /settings/account (password change form + danger zone deletion UI) |
| **Facebook/Instagram/TikTok** | BLOCKED | Meta Developer Portal approval required (external dependency) |

### Phase 5: Polish (Post-Launch)

| Item | Details |
|------|---------|
| Redis-backed rate limiting | Wire up REDIS_URL (exists in env) for multi-instance scaling |
| Bundle size tracking | 4.4 GB .next build — add webpack-bundle-analyzer to CI |
| React Query adoption | Direct fetch() at component level — React Query installed but not adopted |
| Firestore composite indexes | Document all needed indexes for sorted queries at scale |
| Light mode support | Dark-only by design currently |
| Login history / session management | lastLoginAt field exists, not queried |

---

## Completed Work (Summary)

These features are BUILT and VERIFIED by code review. Condensed from full build logs.

### Cinematic Content Engine (March 16, 2026)
RenderZero-caliber cinematic controls integrated into video pipeline. 250+ presets, 5-section control panel, character elements tool, visual preset picker, render queue. Pipeline: Studio → Storyboard → Generate → Assembly → Post-Production. 7 API routes at `/api/studio/*`. Provider chain: Hedra → Fal.ai → Google Imagen → OpenAI DALL-E → Kling.

### Jasper Orchestration Pipeline (March 16, 2026)
6-step orchestration chain: Research → Strategy → Script → Cinematic Design → Thumbnails → Review. Mission Control UI with step-level tracking, rich output previews, SSE streaming, 8 agent avatars. Each step writes independently for real-time progress.

### Hedra Integration (March 17, 2026)
Hedra as sole video engine. Two modes: Kling O3 T2V (prompt-only, native audio) + Character 3 (avatar + inline TTS). Image generation via same API. CDN URL handling, model caching, asset polling. Media library auto-integration.

### Scene Grading & Review (March 19, 2026)
Deepgram Nova-3 transcription → word-level LCS diff → accuracy/pacing/confidence scoring. Training Center integration. Shot continuity system (shotGroupId). Phonetic speech rules for TTS. Structured revision notes for regeneration.

---

## Hedra API Reference

- **Base URL:** `https://api.hedra.com/web-app/public` (auth: `x-api-key`)
- **Image generation:** `POST /generations { type: "image", ai_model_id, text_prompt, aspect_ratio }` — model from `GET /models` (type=image). Result as asset via `GET /assets?type=image`.
- **Prompt-only video:** Kling O3 Standard T2V (`b0e156da...`) — characters + audio natively. No `audio_generation`. Up to 15s 720p.
- **Avatar video:** Character 3 (`d1dd37a3...`) — portrait + inline TTS, up to 1080p.
- **Inline TTS (Character 3 ONLY):** `audio_generation: { type: "text_to_speech", voice_id, text }`
- **Voice cloning:** `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **87 models** (58 video, 29 image), **69 voices**
- **Image model:** `Nano Banana Pro T2I` (`96d9d17d...`) — cached 10min
- **CDN:** `imagedelivery.net` — signed URLs with `exp=` (expire ~1hr)

---

## Blocked (External)

| Item | Blocker |
|------|---------|
| Facebook/Instagram | Meta Developer Portal approval |
| LinkedIn official | Marketing Developer Platform approval |
| Stripe go-live | Production API keys (bank account setup) |

---

## VIDEO PIPELINE: BULLETPROOF END-TO-END PLAN

> **Priority: HIGH — This is the product's core value proposition**
> **Created: March 20, 2026**
> **Goal:** Transform the video pipeline from "technically impressive engine" into "a paying customer's first video in under 5 minutes, every time, no confusion."
>
> The core promise: **"Clone your face, clone your voice, push a button, get daily video content at 1/10th the cost."** Every item below is judged by how directly it serves that promise.

### Assessment Summary

The video pipeline engineering is solid — Hedra integration, dual-mode generation, auto-grading, Jasper orchestration with approval gates. The gaps are in **user experience, missing table-stakes features, dead code, and disconnected tools.** The system was built inside-out (engine first, experience second). This plan works backwards from the first-time user.

---

### Phase V1: First Video in 5 Minutes (P0) — COMPLETE (commit a91f1fe8)

**All done:** V1A Clone Wizard (face+voice capture, webcam/upload, MediaRecorder, ElevenLabs clone, auto-link, auto-default), V1A Jasper avatar awareness (list_avatars tool + nudge prompt), V1B URL permanence fix, V1C 5 starter templates + picker modal, V5 dead code cleanup (-1,422 lines). V2B (list_avatars) pulled forward into V1A.

#### V1A. "Clone Yourself" — In-Pipeline Wizard + Jasper Nudge

**Problem:** Creating an AI clone requires navigating to Character Studio, understanding avatars, uploading reference images in the right format, configuring a voice separately, then navigating back to Video Studio. Too many steps, too much domain knowledge required.

**Solution:** A guided wizard accessible from the **video pipeline** (avatar picker / Character Studio), NOT from onboarding. Jasper contextually nudges users to clone themselves when they interact with video features but don't have a custom avatar — similar to how Jasper reminds about other setup tasks. Onboarding stays clean (industry → niche → account → dashboard).

**Clone Wizard (accessible from avatar picker + Character Studio):**
1. **Welcome screen** — "Create your AI clone in 2 minutes"
2. **Face capture** — Webcam snapshot OR file upload. Crop to portrait. Upload as Hedra asset → create avatar profile with `frontalImageUrl`
3. **Voice capture** — Record 30-second script reading (browser MediaRecorder API) OR upload audio file. Submit to Hedra voice clone endpoint
4. **Processing screen** — Animated progress while voice clone processes (poll Hedra status)
5. **Preview** — Show the user their avatar card with voice preview player. "This is your AI clone."
6. **Set as default** — Auto-set this avatar as the user's default `avatarId` and `voiceId` on their profile

**Jasper Nudge:**
- When user asks about video or opens video pipeline without a custom avatar, Jasper proactively suggests: "I noticed you haven't created your AI clone yet. Want to set that up? It takes 2 minutes and means your videos feature YOU."
- Add to Jasper system prompt / feature manifest: awareness of default avatar state
- Add `check_avatar_status` tool or check within existing `list_avatars` tool

**Key Files to Create/Modify:**
| File | Action |
|------|--------|
| `src/components/video/CloneWizard.tsx` | NEW — Multi-step clone wizard (modal or inline) |
| `src/app/api/video/voice-clone/route.ts` | MODIFY — Ensure Hedra voice clone support |
| `src/lib/video/avatar-profile-service.ts` | MODIFY — Add `createFromCloneWizard()` method |
| `src/lib/video/hedra-service.ts` | MODIFY — Add `cloneVoice()` method |
| `src/app/(dashboard)/content/video/components/AvatarPicker.tsx` | MODIFY — Add "Create Your AI Clone" CTA |
| `src/lib/orchestrator/jasper-tools.ts` | MODIFY — Add avatar status awareness |
| `src/lib/orchestrator/jasper-thought-partner.ts` | MODIFY — Add clone nudge guidance |

**Acceptance Criteria:**
- [ ] Clone wizard accessible from avatar picker and Character Studio
- [ ] User goes from zero to working avatar + cloned voice in under 2 minutes
- [ ] Default avatar auto-selected in all future video projects
- [ ] Flow works with webcam OR file upload (not everyone has a webcam)
- [ ] Voice clone polling handles the full Hedra lifecycle
- [ ] Jasper nudges users to clone when they engage video features without a custom avatar
- [ ] Onboarding is NOT modified — no extra steps before dashboard

---

#### V1B. Fix Video URL Permanence

**Problem:** Hedra CDN URLs expire after ~1 hour. The persistence layer uploads to Firebase Storage with 365-day signed URLs, but it's fallback logic — if Firebase Storage is unavailable (common in Vercel serverless cold starts), the user gets a dead link the next morning. For a paying customer, this is a deal-breaker.

**Solution:** Make Firebase Storage persistence the **primary** path, not a fallback. Fail the generation step if persistence fails (don't silently degrade to expiring URLs).

**Changes:**
1. In `video-persistence.ts` — Remove fallback-to-CDN logic. If Firebase Storage upload fails, retry up to 3 times with exponential backoff. Only then mark the scene as `failed` with a clear error message ("Video generated but could not be saved — click Retry").
2. In `poll-scenes/route.ts` — Don't return a scene as `completed` until the permanent URL is confirmed. Add a new composite status: `persisting` (between Hedra `completed` and our `completed`).
3. In `StepGeneration.tsx` — Show "Saving..." status during persistence phase so user knows it's not stuck.
4. Add a **video proxy endpoint** `GET /api/video/stream/[generationId]` that re-fetches from Hedra if the permanent URL is somehow broken (defense in depth, not primary path).

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/video/video-persistence.ts` | MODIFY — Make persistence primary, add retry logic |
| `src/app/api/video/poll-scenes/route.ts` | MODIFY — Add `persisting` status, block `completed` until permanent URL confirmed |
| `src/types/video-pipeline.ts` | MODIFY — Add `'persisting'` to `SceneStatus` |
| `src/app/(dashboard)/content/video/components/StepGeneration.tsx` | MODIFY — Show "Saving..." during persistence |

**Acceptance Criteria:**
- [ ] Every completed video has a permanent URL that works 24 hours, 7 days, 365 days later
- [ ] No silent degradation to expiring CDN URLs
- [ ] User sees clear status during persistence phase
- [ ] Retry logic handles transient Firebase Storage failures

---

#### V1C. Starter Templates (5 Templates)

**Problem:** When a user opens Video Studio for the first time, they face a blank brief with no guidance. Blank-page paralysis kills conversion. Every competitor has templates.

**Solution:** Ship 5 starter templates that pre-populate the brief, scene structure, and cinematic presets:

| Template | Scenes | Duration | Use Case |
|----------|--------|----------|----------|
| **Weekly Sales Update** | 3 (hook → metrics → CTA) | 45s | Sales teams, weekly cadence |
| **Product Demo** | 4 (problem → solution → demo → CTA) | 60s | Product marketing |
| **Testimonial/Case Study** | 3 (challenge → solution → results) | 45s | Social proof |
| **Social Media Ad (Short)** | 2 (hook → CTA) | 15s | TikTok/Reels/Shorts |
| **Company Announcement** | 3 (news → details → next steps) | 30s | Internal/external comms |

Each template includes:
- Pre-written brief description
- Scene structure with placeholder scripts (user replaces specifics)
- Suggested cinematic preset (e.g., "corporate-clean" for sales update, "vibrant-pop" for social ad)
- Recommended aspect ratio and platform
- Default duration per scene

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/video/templates.ts` | NEW — Template definitions with scene structures |
| `src/app/(dashboard)/content/video/components/TemplatePickerModal.tsx` | NEW — Template selection modal |
| `src/app/(dashboard)/content/video/page.tsx` | MODIFY — Show template picker on empty state / new project |
| `src/lib/stores/video-pipeline-store.ts` | MODIFY — Add `loadTemplate(templateId)` action |

**Acceptance Criteria:**
- [ ] Templates visible on first visit and via "New Project" flow
- [ ] Selecting a template pre-populates brief, scenes, presets, and aspect ratio
- [ ] User can customize everything after template loads (not locked in)
- [ ] Templates are data-driven (easy to add more later without code changes)

---

### Phase V2: Table-Stakes Features (P1) — COMPLETE (commit a91f1fe8)

V2A (auto-captions), V2B (list_avatars — done in V1A), V2C (simple/advanced mode), V2D (background music), V2E (assembly progress) — all built and passing lint+types.

#### V2A. Auto-Captions / Subtitles from Deepgram Data — DONE

**Problem:** Auto-captions are the #1 expected feature in short-form video. The system already has Deepgram transcription with word-level timestamps from auto-grading. The data exists — it's just not rendered as subtitles.

**Solution:** After scene generation and auto-grading, offer "Add Captions" toggle. When enabled, burn captions into the assembled video via FFmpeg `drawtext` filter using the word-level timestamps from Deepgram.

**Implementation:**
1. Store `TranscriptionResult` (with word-level timestamps) alongside auto-grade data per scene
2. Add "Captions" toggle in Assembly step and Post-Production step
3. When assembly runs with captions enabled:
   - For each scene, generate SRT/ASS subtitle track from word timestamps
   - FFmpeg `drawtext` or `subtitles` filter burns text into video
   - Support 3 caption styles: "Bold Center" (TikTok-style), "Bottom Bar" (YouTube), "Karaoke" (word-by-word highlight)
4. Caption font/color should pull from Brand Kit (Phase V3) when available, otherwise use sensible defaults (white text, black outline, sans-serif)

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/video/caption-service.ts` | NEW — Generate SRT/ASS from Deepgram word timestamps |
| `src/lib/video/ffmpeg-utils.ts` | MODIFY — Add `burnCaptions()` function using drawtext/subtitles filter |
| `src/app/api/video/assemble/route.ts` | MODIFY — Accept `captionStyle` param, integrate caption burn |
| `src/app/(dashboard)/content/video/components/StepAssembly.tsx` | MODIFY — Add captions toggle + style picker |
| `src/types/video-pipeline.ts` | MODIFY — Add `captionStyle` to assembly config |

**Acceptance Criteria:**
- [ ] Captions auto-generated from existing Deepgram transcription data (no additional API cost)
- [ ] 3 caption styles available
- [ ] Captions toggle is off by default (opt-in)
- [ ] Caption timing matches actual speech (word-level precision)
- [ ] Works with both avatar and prompt-only generation modes

---

#### V2B. Jasper `list_avatars` Tool — DONE (pulled into V1A)

**Problem:** Jasper can assign avatars to scenes but has no tool to list available avatars. When a user says "use my avatar" or "what characters do I have?", Jasper is blind. This breaks the conversational flow at the most critical moment.

**Solution:** Add a `list_avatars` tool to Jasper that queries the avatar_profiles Firestore collection.

**Implementation:**
1. Add tool definition to `jasper-tools.ts`:
   - Name: `list_avatars`
   - Parameters: `{ filter?: 'custom' | 'hedra' | 'all', includeVoiceInfo?: boolean }`
   - Returns: Array of `{ id, name, source, role, styleTag, voiceId, voiceName, voiceProvider, thumbnailUrl, isDefault, isFavorite }`
2. Add handler in `executeToolCall()`:
   - Query `organizations/${PLATFORM_ID}/avatar_profiles` via Admin SDK
   - Filter by source if specified
   - Return formatted list with enough info for Jasper to recommend characters
3. Update Jasper's system prompt to know about this tool:
   - "When a user asks about available characters, avatars, or who they can use in a video, call `list_avatars` first"
   - "Recommend the user's default avatar for personal videos, stock characters for variety"

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/orchestrator/jasper-tools.ts` | MODIFY — Add `list_avatars` tool definition + handler |
| `src/lib/orchestrator/jasper-thought-partner.ts` | MODIFY — Add guidance on when to use list_avatars |
| `src/lib/orchestrator/feature-manifest.ts` | MODIFY — Document avatar browsing capability |

**Acceptance Criteria:**
- [ ] Jasper can list all available avatars when asked
- [ ] Jasper can filter by custom vs stock characters
- [ ] Jasper recommends the user's default avatar for personal videos
- [ ] Works in conversational flow: "Who can star in my video?" → avatar list → user picks → Jasper assigns

---

#### V2C. Simple / Advanced Mode Toggle for Cinematic Controls — DONE

**Problem:** `CinematicControlsPanel` has 6 sections with camera models, film stocks, aperture settings, focal lengths, composition rules (97 preset IDs across 7 dimensions). Incredible for power users, overwhelming for someone who just wants "make me a product video."

**Solution:** Two modes:

**Simple Mode (default for new users):**
- Single dropdown: "Visual Style" → shows 8-10 presets with preview thumbnails (Photorealistic, Cinematic, Anime, Corporate Clean, etc.)
- Selecting a preset auto-fills ALL cinematic fields behind the scenes
- No camera model, no film stock, no focal length visible
- Just: style + aspect ratio + duration

**Advanced Mode (opt-in):**
- Full 6-section panel as currently implemented
- All 97 preset options visible
- Manual control over every parameter

**Implementation:**
1. Add `studioMode: 'simple' | 'advanced'` to user preferences (or localStorage)
2. Create `SimpleStylePicker.tsx` — grid of 8-10 style cards with thumbnails and one-line descriptions
3. Each style card maps to a complete `CinematicConfig` preset (shot type, lighting, camera, film stock, art style, focal length, composition)
4. Wrap `CinematicControlsPanel` — if `studioMode === 'simple'`, render `SimpleStylePicker` instead
5. "Advanced Controls" link at bottom of simple picker toggles to full panel
6. Remember user's preference across sessions

**Key Files:**
| File | Action |
|------|--------|
| `src/components/studio/SimpleStylePicker.tsx` | NEW — Grid of style preset cards |
| `src/components/studio/CinematicControlsPanel.tsx` | MODIFY — Wrap with mode check |
| `src/app/(dashboard)/content/video/components/StepStoryboard.tsx` | MODIFY — Pass mode prop |
| `src/lib/ai/cinematic-presets.ts` | MODIFY — Export "simple preset bundles" (complete configs per style) |

**Acceptance Criteria:**
- [ ] New users see simple mode by default
- [ ] Simple mode has 8-10 visual style options with clear thumbnails
- [ ] Selecting a simple style fills all cinematic fields automatically
- [ ] Users can switch to advanced mode at any time without losing selections
- [ ] Preference persists across sessions

---

#### V2D. Background Music + Auto-Duck — DONE

**Problem:** The pipeline generates video with speech but no background music. Output feels raw compared to competitors. The editor has `EditorAudioTrack` support, but it's disconnected from the pipeline. Even a simple "add background music" option would transform output quality.

**Solution:** Integrate background music selection into the Assembly step with auto-ducking (music volume drops when speech is playing).

**Implementation:**
1. **Music Library:** Curate 10-15 royalty-free background tracks, stored in Firebase Storage, categorized:
   - Upbeat / Corporate / Chill / Dramatic / Inspirational / Ambient
   - Each track: 60-second loop, stems optional
2. **UI in StepAssembly:** "Background Music" section with:
   - Track selector (card grid with play preview)
   - Volume slider (default 20%)
   - "Auto-duck" toggle (default ON) — drops music to 10% during speech
3. **FFmpeg Assembly:** When music is selected:
   - Mix speech track + music track
   - If auto-duck enabled: use `sidechaincompress` or volume keyframes timed to Deepgram word timestamps
   - Output mixed audio in final video
4. **MiniMax Integration (optional/future):** If `audioCue` per-scene is set (per the existing NEXT BUILD plan), use MiniMax-generated audio instead of library tracks

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/video/audio-mixing-service.ts` | NEW — Audio mix with ducking logic |
| `src/lib/video/ffmpeg-utils.ts` | MODIFY — Add `mixAudioWithDucking()` |
| `src/app/(dashboard)/content/video/components/StepAssembly.tsx` | MODIFY — Add music picker + volume + duck toggle |
| `src/app/api/video/assemble/route.ts` | MODIFY — Accept music params, call audio mixing |
| `src/lib/video/music-library.ts` | NEW — Track metadata + Firebase Storage URLs |

**Acceptance Criteria:**
- [ ] 10-15 royalty-free tracks available in Assembly step
- [ ] Auto-duck reduces music volume during speech segments
- [ ] Volume slider gives manual control
- [ ] Music is optional (off by default, opt-in)
- [ ] Final assembled video has professional-sounding audio mix

---

#### V2E. Assembly Progress Feedback — DONE

**Problem:** FFmpeg assembly (downloading N scenes, probing durations, stitching with transitions, uploading) can take 30-60 seconds. The UI shows "Assembling..." with no progress bar, no percentage. User thinks it's frozen.

**Solution:** Server-Sent Events (SSE) or polling-based progress updates during assembly.

**Implementation:**
1. Break assembly into trackable steps: "Downloading scenes (2/5)" → "Probing durations" → "Stitching video" → "Uploading final" → "Complete"
2. Store assembly progress in Firestore (or return via SSE from the assembly endpoint)
3. `StepAssembly.tsx` shows a multi-step progress indicator with the current phase + percentage
4. If SSE is too complex for the Vercel serverless environment, use polling (every 2 seconds to a `/api/video/assembly-status/[projectId]` endpoint)

**Key Files:**
| File | Action |
|------|--------|
| `src/app/api/video/assemble/route.ts` | MODIFY — Write progress to Firestore at each phase |
| `src/app/api/video/assembly-status/[projectId]/route.ts` | NEW — Return current assembly progress |
| `src/app/(dashboard)/content/video/components/StepAssembly.tsx` | MODIFY — Poll and display multi-step progress |

**Acceptance Criteria:**
- [ ] User sees which phase assembly is in (downloading, stitching, uploading)
- [ ] Progress updates at least every 5 seconds
- [ ] Errors at any phase show clear message with retry option

---

### Phase V3: Professional Output Quality (P2 — Differentiators)

These features move output from "AI-generated video" to "professional content I'd post under my brand."

#### V3A. Brand Kit (Logo, Colors, Fonts, Intro/Outro)

**Problem:** Every video looks like a one-off. No logo watermark, no consistent colors for captions, no intro/outro. Professional content creators need brand consistency across all output.

**Solution:** A Brand Kit settings page where users configure their visual identity once, and it's automatically applied to every video.

**Brand Kit Contents:**
- **Logo** — PNG/SVG upload, position picker (corner placement), opacity slider
- **Colors** — Primary, secondary, accent (used for caption text, backgrounds, overlays)
- **Fonts** — Select from 10 web-safe fonts (used for captions and text overlays)
- **Intro template** — 3-5 second branded intro (logo animation). Choose from 3-5 templates or upload custom.
- **Outro template** — 3-5 second branded outro (CTA + logo). Choose from 3-5 templates or upload custom.

**Application:**
- Assembly step auto-applies brand kit if configured
- Logo watermark burned in via FFmpeg `overlay` filter
- Caption colors/fonts pulled from brand kit
- Intro/outro prepended/appended during assembly

**Key Files:**
| File | Action |
|------|--------|
| `src/app/(dashboard)/settings/brand-kit/page.tsx` | NEW — Brand Kit configuration page |
| `src/lib/video/brand-kit-service.ts` | NEW — CRUD for brand kit in Firestore |
| `src/lib/video/ffmpeg-utils.ts` | MODIFY — Add logo overlay, intro/outro concat |
| `src/app/api/video/assemble/route.ts` | MODIFY — Load and apply brand kit during assembly |
| `src/app/api/settings/brand-kit/route.ts` | NEW — API route for brand kit CRUD |
| `src/types/brand-kit.ts` | NEW — BrandKit type definition |

---

#### V3B. Wire Editor into Pipeline (Two-Way)

**Problem:** The standalone editor at `/content/video/editor` is well-built but completely disconnected from the pipeline. User finishes generation, assembles, then can't send it to the editor for fine-tuning. Edits don't flow back.

**Solution:** Two integration points:

1. **Pipeline → Editor:** Add "Open in Editor" button in Post-Production step. Pre-loads all scene clips + assembled video into the editor timeline. URL: `/content/video/editor?project={projectId}`.
2. **Editor → Pipeline:** When editor exports a final video, offer "Save back to project" which updates the pipeline project's `finalVideoUrl` and `postProductionVideoUrl`. The project then reflects the edited version.

**Key Files:**
| File | Action |
|------|--------|
| `src/app/(dashboard)/content/video/components/StepPostProduction.tsx` | MODIFY — Add "Open in Editor" button |
| `src/app/(dashboard)/content/video/editor/page.tsx` | MODIFY — Add "Save to Project" action when loaded from project |
| `src/app/api/video/project/save/route.ts` | MODIFY — Accept `postProductionVideoUrl` update |
| `src/lib/stores/video-pipeline-store.ts` | MODIFY — Add `setPostProductionVideoUrl()` |

---

#### V3C. Cost Estimation Before Generation

**Problem:** Each Hedra generation costs real money. Nowhere does the system say "this will cost approximately $X." Users burn credits without understanding cost implications.

**Solution:** Before generation starts, show an estimated cost based on:
- Number of scenes
- Duration per scene
- Generation mode (avatar vs prompt-only — different pricing)
- Resolution

Display in `StepGeneration.tsx` as a cost summary card: "Estimated cost: ~$X.XX for 5 scenes (3 avatar, 2 cinematic)." Requires knowing Hedra's per-generation pricing (store as config, update manually when pricing changes).

**Key Files:**
| File | Action |
|------|--------|
| `src/lib/video/cost-estimator.ts` | NEW — Calculate estimated cost from scene config |
| `src/app/(dashboard)/content/video/components/StepGeneration.tsx` | MODIFY — Show cost estimate before "Generate" button |
| `src/types/video-pipeline.ts` | MODIFY — Add cost tracking fields |

---

### Phase V4: Growth & Retention (P3 — Moat Builders)

These features deliver on the "daily content" promise and build habits that prevent churn.

#### V4A. Auto-Publish / Scheduling

**Problem:** The pipeline ends at "Save to Library." For a product promising daily content, there's no "publish to YouTube at 9am tomorrow." Social media integration exists elsewhere but isn't connected to video output.

**Solution:** After Post-Production, add a "Publish" step:
- Platform picker (YouTube, TikTok, Instagram, LinkedIn, Twitter — depending on what integrations are live)
- Schedule picker (now, or date/time)
- Title, description, tags auto-filled from brief
- Calls existing social posting APIs with the video URL

**Key Files:**
| File | Action |
|------|--------|
| `src/app/(dashboard)/content/video/components/StepPublish.tsx` | NEW — Publish/schedule step |
| `src/app/api/video/publish/route.ts` | NEW — Orchestrate publishing to selected platforms |
| `src/lib/stores/video-pipeline-store.ts` | MODIFY — Add publish step to pipeline |
| `src/types/video-pipeline.ts` | MODIFY — Add `'publish'` to PipelineStep |

---

#### V4B. Batch Video Generation ("Content Calendar")

**Problem:** The pipeline creates one video at a time. A customer wanting 7 videos for the week must run the pipeline 7 times manually. The "daily content" promise requires batch capability.

**Solution:** "Content Calendar" mode:
- User enters a week's worth of topics (or Jasper generates them from a theme)
- System creates 7 storyboards in one operation
- User reviews all 7, approves in batch
- Generation runs sequentially (to manage API costs) but autonomously
- Results land in library, ready for scheduled publishing

This connects naturally to Jasper's campaign orchestration — a campaign could include 7 video deliverables auto-generated.

**Key Files:**
| File | Action |
|------|--------|
| `src/app/(dashboard)/content/video/calendar/page.tsx` | NEW — Content calendar view |
| `src/lib/video/batch-generator.ts` | NEW — Queue and process multiple projects |
| `src/lib/orchestrator/jasper-tools.ts` | MODIFY — Add `batch_produce_videos` tool |

---

### Phase V5: Codebase Cleanup (P3 — Hygiene)

These don't affect users but reduce confusion, dead code, and technical debt.

#### V5A. Delete Dead Step Components

Remove 4 unused step components (~46KB of dead code):
- `StepRequest.tsx` — superseded by StudioModePanel
- `StepDecompose.tsx` — superseded by StepStoryboard
- `StepPreProduction.tsx` — never wired into stepper
- `StepApproval.tsx` — never wired into stepper

Check for any imports before deleting. If none, remove entirely.

#### V5B. Consolidate Studio Routes

Current state:
- `/content/studio` → redirects to `/content/image-generator`
- `/content/image-generator` → renders `StudioModePanel` (same component used in video pipeline)

Fix: Either remove the redirect chain and give image generation a proper dedicated page, or merge image generation into the video pipeline's creative controls (which is where `StudioModePanel` already lives). Don't have 3 routes pointing at the same component.

#### V5C. Clean Up Legacy Render Pipeline

`/api/video/generate` (legacy endpoint) creates a VideoJob but doesn't populate clips. All real generation goes through `/api/video/generate-scenes`. Either remove the legacy endpoint or redirect it to the current flow.

---

### Build Order (Recommended Sequence)

```
V1A  Clone Yourself In-Pipeline Wizard + Jasper ─── Week 1-2
V1B  Fix Video URL Permanence ───────────────────── Week 1 (parallel)
V1C  Starter Templates (5) ─────────────────────── Week 2 (parallel)
V5A  Delete Dead Step Components ────────────────── Week 2 (30 min)
V5B  Consolidate Studio Routes ──────────────────── Week 2 (1 hour)
V5C  Clean Up Legacy Render Pipeline ────────────── Week 2 (30 min)
     ─── MILESTONE: First-time user can create a clone and make a video from a template ───
V2B  Jasper list_avatars Tool ───────────────────── Week 3 (small)
V2E  Assembly Progress Feedback ─────────────────── Week 3 (small)
V2C  Simple/Advanced Mode Toggle ────────────────── Week 3
V2A  Auto-Captions from Deepgram ────────────────── Week 3-4
V2D  Background Music + Auto-Duck ───────────────── Week 4
     ─── MILESTONE: Output quality matches competitor baseline ───
V3A  Brand Kit ──────────────────────────────────── Week 5
V3B  Wire Editor into Pipeline ──────────────────── Week 5 (parallel)
V3C  Cost Estimation ────────────────────────────── Week 5 (small, parallel)
     ─── MILESTONE: Professional-grade branded output ───
V4A  Auto-Publish / Scheduling ──────────────────── Week 6
V4B  Batch Video Generation ─────────────────────── Week 7-8
     ─── MILESTONE: Daily content promise delivered ───
```

### Success Criteria (End State)

- [ ] New user creates AI clone (face + voice) in under 2 minutes
- [ ] First video generated from template in under 5 minutes total
- [ ] All video URLs permanent (survive 365 days)
- [ ] Auto-captions available in 3 styles
- [ ] Background music with auto-ducking
- [ ] Brand kit auto-applied to all output
- [ ] Jasper can browse avatars and recommend characters conversationally
- [ ] Simple mode hides complexity for new users; advanced mode available for power users
- [ ] Editor integrated into pipeline (not a separate island)
- [ ] Cost shown before generation
- [ ] Publish to social platforms directly from pipeline
- [ ] Batch generation for weekly content calendars
- [ ] Zero dead code in video pipeline directory
