# SalesVelocity.ai — Manual QA & Launch Readiness Plan

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: April 10, 2026 (Specialist Rebuild priority added — all other work on hold)
**Status: AGENT SPECIALIST REBUILD IN PROGRESS — all QA and multi-tenant work on hold**

## Mission

Walk through every feature and function of the platform end-to-end. Find and fix bugs. Identify design improvements. Validate launch readiness. Then convert back to multi-tenant and launch.

**CURRENT REALITY (April 10, 2026):** The mission above cannot proceed because the "agent swarm" that Jasper delegates to is not real. See the Current Priority section below. All manual QA and multi-tenant work is on hold until the specialist rebuild is complete.

## How This Works

- David tests each phase manually in the browser at `localhost:3000`
- Reports findings (bugs, broken features, UX observations, design ideas) back to Claude
- Claude diagnoses from code, fixes bugs, implements improvements
- Each phase is marked with metrics as it completes
- After all phases pass, we proceed to multi-tenant conversion and launch

---

## 🚨 CURRENT PRIORITY: Agent Specialist Rebuild (BLOCKS ALL OTHER WORK)

**Discovered April 10, 2026.** The agent swarm Jasper was supposed to delegate to is not real. Auditing `src/lib/agents/` revealed that only 3 files in the entire tree import any LLM infrastructure:

1. `src/lib/agents/growth-strategist/specialist.ts` — uses OpenRouter
2. `src/lib/agents/builder/assets/specialist.ts` — uses image generation (Fal.ai)
3. `src/lib/agents/shared/specialist-improvement-generator.ts` — OpenRouter support code for the Prompt Engineer (not a content producer)

**Every other specialist — Copywriter, Video Specialist, Calendar Coordinator, Asset Generator (copy portions), SEO Expert, LinkedIn Expert, TikTok Expert, Twitter/X Expert, Facebook Ads Expert, Email Specialist, SMS Specialist, Voice AI Specialist, Funnel Engineer, UX/UI Architect, Copy Specialist, Funnel Pathologist — is a hand-coded template engine with no AI in it.** Example: the Copywriter's `generatePageCopy` method is a `switch` on tone that picks from 5 pre-written sentence patterns. The "SEO-injected copy with Brand DNA validation" described in the Content Manager's header is enforcement code checking for `avoidPhrases` — but the "copy" it validates is template output with nothing generated.

**How this was hidden:** Seven tools in `src/lib/orchestrator/jasper-tools.ts` silently bypassed the manager/specialist chain and called `OpenRouterProvider` directly:
- `delegate_to_content` (line 5443)
- `delegate_to_marketing` (line 5278)
- `delegate_to_builder` (line 5072)
- `delegate_to_architect` (line 5585)
- `delegate_to_outreach` (line 5696)
- `produce_video` (line 4023) — 6-step "agent pipeline" with fake agent attribution
- `orchestrate_campaign` (line 6891) — flagship multi-phase campaign tool, all phases bypass managers

Each handler kept the outward shape of delegation: Mission Control steps flipped to COMPLETED, response JSON included `manager: 'CONTENT_MANAGER'`, review links got attached. None of it was real. Server logs showing "delegation successful" reflected direct LLM calls wearing agent costumes, not specialist execution.

**The correctly-wired delegation tools** (for reference, not fixes): `delegate_to_sales` (RevenueDirector), `delegate_to_trust` (ReputationManager), `delegate_to_intelligence` (IntelligenceManager), `delegate_to_commerce` (CommerceManager). These four actually instantiate their manager and call `manager.execute()`.

### What must happen — and nothing before it

**1. Remove all 7 bypasses from `jasper-tools.ts`.** Immediately, before any specialist work. Jasper must honestly report "not yet wired — specialist rebuild in progress" for departments whose specialists aren't rebuilt. No fake completions. No silent LLM calls. No "just in case" hidden paths. OUT MEANS OUT.

**2. Rebuild specialists one at a time, fully.** Each specialist becomes a real AI agent — no stubs, no template fallbacks, no shortcuts. When a specialist is "done," it means:
- Real LLM backend (Claude via OpenRouter; model chosen per specialist's reasoning needs and cost profile)
- System prompt stored in Firestore as a Golden Master, structured for multi-tenancy from day one: `goldenMasters/{specialistType}/{industryTemplate}/v{n}`
- The initial GM (v1) is the `saas_sales_ops` industry template — SalesVelocity.ai's own vertical
- Additional industry templates (real_estate, legal, healthcare, ecommerce, etc.) added later as new template rows; same specialist code, different data
- Loader parameterized by industry key on day one, so multi-tenant conversion is a data migration, not a code rewrite
- Brand DNA injected at runtime (toneOfVoice, keyPhrases, avoidPhrases, companyDescription, uniqueValue, industry)
- Real input contract (what the manager sends it) and output contract (what it returns to the manager), both with concrete example payloads
- Proof-of-life test harness (admin endpoint or CLI script) that shows: Firestore doc loaded with version + timestamp, full resolved system prompt, full OpenRouter request body, full OpenRouter response body, final AgentReport, plus a "compare two GM versions" mode that runs the same input against v1 and v2 and displays the two outputs side by side
- Owner review gate before Firestore seeding: proposed prompt, preferences, model choice, input/output contract with example, proof-of-life surface — owner reviews, edits if needed, approves, then seeding happens
- If the LLM call fails, the specialist fails honestly and returns a real FAILED report — no template fallback

**3. Build order (one at a time, in sequence):**

| # | Department | Specialists |
|---|---|---|
| 1 | Content | Copywriter → Video Specialist → Calendar Coordinator → Asset Generator (copy portions) |
| 2 | Marketing | SEO Expert → LinkedIn Expert → TikTok Expert → Twitter/X Expert → Facebook Ads Expert → Growth Analyst |
| 3 | Builder | UX/UI Architect → Funnel Engineer → Asset Generator (image portions — already uses Fal.ai, needs GM wrapper) |
| 4 | Architect | Copy Specialist → UX/UI Specialist → Funnel Pathologist |
| 5 | Outreach | Email Specialist → SMS Specialist → Voice AI Specialist |

**4. As each department's specialists are rebuilt, rewire its Jasper delegation tool to route through the real manager → real specialists.** `delegate_to_content` comes back online when the Content department is done. `delegate_to_marketing` when Marketing is done. `produce_video` requires the Video Specialist. `orchestrate_campaign` requires all content and marketing specialists (since it spans both) and is the last Jasper tool to come back online.

**5. Rebuild ContentManager dead code cleanup.** Delete `processIncomingBriefs()`, `processProductionQueue()`, and the 7 orphaned `handleXxxxBrief` methods in `src/lib/agents/content/manager.ts` (~500 lines). Per CLAUDE.md's no-half-finished-implementations rule. These methods are unreachable (not called from anywhere) and send action values to specialists that specialists don't implement.

### Successor Workstream: Phase 2 GM Learning Loop — starts ONLY after ALL specialists are rebuilt

The GM learning loop builds the automated feedback flow that takes owner grades/rejections and turns them into prompt edits on the specialists' GMs. **This cannot start until the specialists are real**, because you can't build a prompt editor for prompts that don't exist yet.

When specialist rebuild is complete, build:

- **Prompt Engineer Agent** — a specialist on Claude Opus. Reads a target specialist's current GM + owner's correction/feedback. Identifies the affected section of the prompt. Proposes a section-targeted rewrite that preserves unrelated sections. Can ask clarifying questions before proposing. Model: Claude Opus via OpenRouter (best reasoning for instruction editing; low-frequency so cost is negligible).
- **Prompt Revision Popup UI** — 3-panel component: **Left** (current prompt section highlighted), **Right** (proposed rewrite with diff-style highlights), **Bottom** (chat with Prompt Engineer to refine). Actions: Approve (saves new GM version, deploys immediately, invalidates cache), Reject (discards proposal), Edit Manually (owner tweaks text before approving).
- **Grade → Popup trigger** — when owner submits a star grade + explanation in Mission Control, the popup fires with a proposed GM edit for the graded agent.
- **Deliverable reject → Popup trigger** — when owner rejects a deliverable (blog, video, social post, email) with feedback, the popup fires for the producing specialist's GM.
- **Training Center chat → Popup trigger** — when a Training Center conversation produces a correction, the popup fires for the agent being trained.
- **GM Version Control UI** in the Training Center — version list (v1, v2, v3…) with timestamps and change triggers, diff view between any two versions, one-click rollback to any previous version, active-version indicator.
- **Remove `buildLearnedCorrectionsBlock`** — the layering-corrections approach in `src/app/api/orchestrator/chat/route.ts` is the interim shortcut. Delete it. All learning goes through direct GM edits via the Prompt Engineer Agent.
- **Fix deliverable routing map** — verify `blog → content`, `video → video`, `social_post → social`, `email → email`, `image → video`, `landing_page → content` mappings are correct end-to-end.

**Critical rule:** The learning loop is strictly owner-triggered. No feedback from owner = no changes to any GM. The system only modifies prompts when the owner explicitly provides a correction. Ungraded output is assumed satisfactory.

### What resumes AFTER specialist rebuild + Phase 2 GM learning loop

- Phase 1 Jasper QA (tests 1.8–1.18 + the A.1 power-user validation prompt)
- Phases 2–16 of manual QA (CRM, Email, Social, Website, Video, Voice, Payments, Workflows, Forms, SEO, Analytics, Settings, Team, Public Pages, Cross-System)
- Multi-tenant conversion (the pre-multitenant doc's Phase 9 work — `getSubCollection(orgId, sub)` refactor, AuthUser.orgId, apiKeyService cache keying, OAuth state params, Jasper org identity injection)
- Launch prep, dogfooding as tenant #1, beta customer onboarding

### Why this order is non-negotiable

- **Specialists before learning loop** because you can't edit prompts that don't exist. Build the prompts first.
- **Specialist rebuild before QA** because every QA test in Phases 1–16 that depends on agent output would fail or pass for the wrong reason against the current template swarm. Testing a fake system is worse than not testing — it produces false confidence and the bugs found would be phantom.
- **Specialist rebuild before multi-tenant conversion** because the multi-tenant `getSubCollection(orgId)` refactor cascades through services whose behavior depends on agent output. Rebuild the foundation before pouring the second floor.

---

## Architecture Snapshot

- **162 pages** (143 dashboard + 18 public + 1 auth)
- **429+ API routes**
- **~4 real AI agents** (Jasper + growth-strategist specialist + builder/assets image gen + specialist-improvement-generator). **The other ~55 "agents" are hand-coded template engines awaiting rebuild. See Current Priority above.**
- **16 operational systems**
- **4-role RBAC** (owner/admin/manager/member, 47 permissions)
- **Single-tenant penthouse** (development phase) → will convert to multi-tenant after QA and specialist rebuild
- **Framework:** Next.js 14.2.33 (App Router), React 18.2.0, TypeScript 5.9.3

---

## Phase Tracker

**ALL QA PHASES ON HOLD** pending Agent Specialist Rebuild + Phase 2 GM Learning Loop. See Current Priority section above. Do not resume any phase below until the specialist rebuild and learning loop are complete.

| Phase | System | Tests | Pass | Fail | Observations | Status |
|-------|--------|-------|------|------|-------------|--------|
| 0 | Foundation & Auth | 11 | 10 | 0 | 1 skipped (signup — multi-tenant) | COMPLETE |
| 1 | Jasper & Mission Control | 18 | 7 | 0 | 1.4 partial (content contract — resolved by rebuild); 1.8–1.18 deferred | HOLD — awaiting rebuild |
| 2 | CRM & Sales Pipeline | 22 | — | — | — | HOLD — awaiting rebuild |
| 3 | Email & Communications | 16 | — | — | — | HOLD — awaiting rebuild |
| 4 | Social Media | 14 | — | — | — | HOLD — awaiting rebuild |
| 5 | Website Builder & Blog | 18 | — | — | — | HOLD — awaiting rebuild |
| 6 | Video & Creative Studio | 20 | — | — | — | HOLD — awaiting rebuild |
| 7 | Voice AI & Calls | 10 | — | — | — | HOLD — awaiting rebuild |
| 8 | Payments & E-Commerce | 18 | — | — | — | HOLD — awaiting rebuild |
| 9 | Workflows & Automation | 12 | — | — | — | HOLD — awaiting rebuild |
| 10 | Forms & Data Capture | 10 | — | — | — | HOLD — awaiting rebuild |
| 11 | SEO & Growth | 14 | — | — | — | HOLD — awaiting rebuild |
| 12 | Analytics & Reporting | 12 | — | — | — | HOLD — awaiting rebuild |
| 13 | Settings & Configuration | 16 | — | — | — | HOLD — awaiting rebuild |
| 14 | Team, Coaching & Performance | 10 | — | — | — | HOLD — awaiting rebuild |
| 15 | Public Pages & Onboarding | 14 | — | — | — | HOLD — awaiting rebuild |
| 16 | Cross-System Integration | 10 | — | — | — | HOLD — awaiting rebuild |
| S | Security & Infrastructure | 8 | — | — | — | HOLD — awaiting rebuild |
| **TOTAL** | | **244** | **—** | **—** | **—** | |

---

## Phase 0: Foundation & Auth (12 tests)

**Goal:** Verify the platform boots, auth works, RBAC enforces, and navigation is correct.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 0.1 | App loads | Navigate to `localhost:3000` | Landing page renders, no console errors | PASS | Dev passcode gate shows first (by design), then landing page loads |
| 0.2 | Login flow | Click Login → enter credentials → submit | Redirects to dashboard, user context loaded | PASS | Slow on cold compile (~15s), works after cache warm |
| 0.3 | Dashboard loads | After login, dashboard page renders | Shows widgets, stats, no blank panels | PASS | KPIs render. Recent Activity blank (fresh env, expected). Commerce/Analytics are nav-link cards by design. **Jasper Setup Assistant fixed:** wrong Firestore path for API keys + broken persona/knowledge base links |
| 0.4 | Sidebar navigation | Click each top-level nav item | All 9 sections expand/navigate correctly | PASS | |
| 0.5 | Owner permissions | As owner, visit `/settings/users` | Full access, can manage all users | PASS | **4 bugs fixed:** (1) GET didn't filter soft-deleted users. (2) Pending invites not shown in list. (3) Deleting an invite hit wrong endpoint (404). (4) SendGrid sender identity unverified — recreated and verified `dstamper@salesvelocity.ai` via API. Invite emails now sending. |
| 0.6 | RBAC — restricted page | As member role, visit `/settings/api-keys` | Access denied or appropriate gating | PASS | Tested with admin account — System nav section hidden for non-owner roles. RBAC sidebar gating confirmed working. |
| 0.7 | Logout flow | Click logout | Redirected to login, session cleared | PASS | |
| 0.8 | Signup flow | Visit `/signup`, create new account | Account created, onboarding starts | SKIP | Standalone signup not applicable in single-tenant mode. Invite flow is the correct user-add path. Revisit when multi-tenant is re-enabled. |
| 0.9 | Forgot password | Visit `/forgot-password`, enter email | Reset email sent (or appropriate message) | PASS | Firebase Auth sends reset email. Lands in spam (from noreply@rapid-compliance-65f87.firebaseapp.com). |
| 0.10 | Session persistence | Login, close tab, reopen `localhost:3000` | Still logged in (token not expired) | PASS | Session persists — `/dashboard` loads logged in after closing/reopening tab. |
| 0.11 | API auth enforcement | Open DevTools → hit `/api/orchestrator/chat` without auth | Returns 401, not 500 | PASS | POST returns 401 as expected. GET returns 200 (no GET handler — harmless). |
| ~~0.12~~ | ~~Feature toggle system~~ | REMOVED | N/A | N/A | Feature toggles replaced with nav restructure — no longer applicable. |

---

## BLOCKER: Full Platform Setup (Must Complete Before Phase 1 Continues)

**Problem:** Jasper's agents produce garbage output because brand context, company profile, persona, and many integration accounts are empty or unconfigured. Testing with empty inputs is pointless — every failure looks like a code bug but is actually missing data. We need EVERYTHING filled out before resuming QA.

**Status:** ~65% configured. Brand DNA complete (Section A). Core AI and most integrations work. Social accounts, payment testing, and some API keys still missing.

### Section A: Brand & Identity (Agents read this before producing ANY content)

| # | Data Area | Page URL | Status | What to Fill In |
|---|-----------|----------|--------|-----------------|
| A.1 | Company Profile | `/settings/organization` | DONE | SalesVelocity.ai, 3423 N. Maplestone Ave Meridian ID 83646, support@salesvelocity.ai, SaaS, 1-10 |
| A.2 | AI Persona | `/settings/ai-agents/persona` | DONE | Jasper — friendly, proactive, high empathy, balanced response style, "AI business partner with 59 specialists" |
| A.3 | Brand Settings | `/settings/ai-agents/business-setup` | DONE | Full business DNA: UVP ("we give you a team, not tools"), competitive positioning vs GoHighLevel/Vendasta/agencies, objection handling, discovery frameworks, closing techniques |
| A.4 | Onboarding Details | `/onboarding/industry` | DONE | Replaced demo "Acme" data with real SalesVelocity.ai identity (isDemo: false). Full sales flow, agent rules, sentiment handling |
| A.5 | Knowledge Base | `/settings/ai-agents` | DONE | 15 real FAQs covering product, pricing, features, competitors, security, onboarding, support |
| A.6 | Website SEO | `/website/seo` | DONE | 25 keywords, title, description configured |

### Section B: API Keys & Providers

| # | Service | Page URL | Status | Notes |
|---|---------|----------|--------|-------|
| B.1 | OpenRouter (primary AI) | `/settings/api-keys` | DONE | All AI models via one key |
| B.2 | SendGrid (email) | `/settings/api-keys` | DONE | Sender verified: dstamper@salesvelocity.ai |
| B.3 | Stripe (payments) | `/settings/api-keys` | KEYS SET but .env EMPTY | Keys in Firestore but `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in .env.local are blank — need both for checkout |
| B.4 | Twilio (SMS/Voice) | `/settings/api-keys` | PARTIAL | Account SID + Auth Token set. **Phone number MISSING** — need a Twilio number for calls/SMS |
| B.5 | ElevenLabs (TTS) | `/settings/api-keys` | DONE | Voice synthesis ready |
| B.6 | Hedra (video) | `/settings/api-keys` | DONE | Video generation ready |
| B.7 | Deepgram (transcription) | `/settings/api-keys` | DONE | Speech-to-text ready |
| B.8 | Serper (search/research) | `/settings/api-keys` | DONE | Jasper research tool ready |
| B.9 | DataForSEO | `/settings/api-keys` | PARTIAL | Login set, **password MISSING** |
| B.10 | Google PageSpeed | `/settings/api-keys` | DONE | |
| B.11 | Apollo (enrichment) | `/settings/api-keys` | DONE | Lead enrichment ready |
| B.12 | Fal.ai (image generation) | `/settings/api-keys` | MISSING | Needed for image generator, AI studio |
| B.13 | MiniMax (audio/music) | `/settings/api-keys` | MISSING | Needed for background music in videos |
| B.14 | Clearbit (enrichment) | `/settings/api-keys` | MISSING | Optional — lead enrichment |
| B.15 | NewsAPI | `/settings/api-keys` | MISSING | Optional — trending news for content |

### Section C: Social Media Accounts (Need OAuth connections for posting)

| # | Platform | Connection Method | Status | Notes |
|---|----------|-------------------|--------|-------|
| C.1 | Twitter/X | API keys in Firestore | KEYS SET | Need to test actual posting |
| C.2 | LinkedIn | OAuth flow | NOT CONNECTED | Need LinkedIn app + OAuth |
| C.3 | Facebook/Instagram | OAuth flow | NOT CONNECTED | Need Meta Business app + OAuth |
| C.4 | Bluesky | API key (AT Protocol) | NOT CONNECTED | Need Bluesky app password |
| C.5 | Google Business | OAuth flow | NOT CONNECTED | Optional |

### Section D: Payment & E-Commerce Testing

| # | Item | Status | Notes |
|---|------|--------|-------|
| D.1 | Stripe .env keys | EMPTY | Copy from Firestore or Stripe dashboard to .env.local |
| D.2 | Stripe test mode | NOT TESTED | Need test-mode keys for checkout flow QA |
| D.3 | Stripe webhook | NOT CONFIGURED | Need `stripe listen --forward-to localhost:3000/api/webhooks/stripe` for local testing |
| D.4 | Test products | EXIST | Products collection has data |

### Section E: Feature Config & Modules

| # | Item | Status | Notes |
|---|------|--------|-------|
| E.1 | Feature modules | DONE | Configured |
| E.2 | Base AI models | DONE | Training data exists |
| E.3 | Email templates | DONE | Templates exist |

### Known Bugs to Fix Before Resuming QA

| Bug | Root Cause | Fix Required |
|-----|-----------|--------------|
| ~~Blog editor shows empty content~~ | ~~`save_blog_draft` stored `{type: 'rich-text'}` but editor expects `{type: 'section'}` with columns/widgets~~ | FIXED — save_blog_draft now writes valid PageSection format, SEO keys fixed to metaTitle/metaDescription/metaKeywords (a586271b) |
| ~~Jasper routes blog to delegate_to_content~~ | ~~Feature manifest and tool descriptions pointed blog → delegate_to_content~~ | FIXED — Removed 'blog' from delegate_to_content routing, save_blog_draft is primary blog tool (a586271b) |
| ~~Content agent copywriter placeholder text~~ | ~~Manager passed sections as string[] but copywriter expects {id, name, purpose}[]~~ | FIXED — Added .map() to convert sections to object format (a586271b) |
| ~~Content agent FULL_PACKAGE for single blog~~ | ~~contentType (singular string) vs contentTypes (plural array) with mismatched vocabulary~~ | FIXED — Added translation map: blog_post→copy, video_script→video, social_media→social (a586271b) |
| ~~`/api/version` exposes deployment info without auth~~ | ~~No auth check on endpoint~~ | FIXED — `requireRole(['owner','admin'])` added (3667c0a7) |
| ~~`/api/recovery/track/[merchantId]` wide open~~ | ~~No auth, no Zod validation, no rate limiting~~ | FIXED — Zod + rate limiting added, auth N/A (public tracking endpoint) (3667c0a7) |
| ~~`/api/identity` POST missing role check~~ | ~~Uses `requireAuth` but any user can overwrite identity~~ | FIXED — `requireRole(['owner','admin'])` added (3667c0a7) |
| ~~Jasper `activeStepIds` Map memory leak~~ | ~~Map grows unbounded, no eviction~~ | FIXED — TTL-based eviction (30min) added (3667c0a7) |
| ~~Cron endpoints use simple string comparison for auth~~ | ~~Vulnerable to timing attacks~~ | FIXED — `verifyCronAuth()` with timing-safe XOR, all 12 routes updated (3667c0a7) |
| ~~No cascading deletes for subcollections~~ | ~~Deleting forms/pages orphaned child subcollections~~ | FIXED — `deleteWithSubcollections()` utility created, wired into forms DELETE (fields/analytics/views) and pages DELETE (versions) (65d5f299) |

**Instructions:**
1. ~~Section A~~ — COMPLETE (March 30, 2026). All brand DNA populated in Firestore.
2. ~~Known Bugs~~ — ALL FIXED (March 30, 2026). Blog editor, routing, copywriter, FULL_PACKAGE, cascading deletes.
3. **Section B** — fill in missing API keys as needed per phase. Priority: Fal.ai (B.12), DataForSEO password (B.9), Twilio phone number (B.4), Stripe .env (B.3/D.1).
4. **Section C** — connect at least Twitter and one other platform for social media testing (Phase 4).
5. **Section D** — set up Stripe for payment testing (Phase 8).
6. **CSP** — Deferred to post-launch. Next.js 14 incompatible with nonce-based CSP. Revisit after Next.js 15+ upgrade.
6. Once all sections are green and bugs are fixed, resume Phase 1 testing at test 1.3.

---

## Golden Master & Agent Learning System (April 1, 2026)

**Goal:** Every AI agent learns from graded performance through direct prompt editing. Corrections from grading and training rewrite the agent's actual system prompt — no layering, no appendix blocks.

**STATUS:** Phase 1 (infrastructure) COMPLETE. Phase 2 (Prompt Engineer Agent + learning loop) is NEXT.

### Core Architecture

Every agent has two layers:
- **Golden Master (GM)** — versioned, deployable snapshot of the agent's system prompt + persona + behavior config. The prompt IS the training. When corrections are made, the prompt itself is edited to incorporate them.
- **Ephemeral Spawn** — fresh instance created from the active GM for each task. Dies after completion. No state carries between spawns.

**Critical rule: No feedback from the owner = no changes to the GM.** The system ONLY modifies prompts when the owner explicitly provides a correction. Ungraded output is assumed satisfactory.

### Three Training Entry Points

All three entry points trigger the same mechanism — the Prompt Engineer Agent proposes a prompt edit, the owner approves or rejects it.

1. **Mission Control grading** — owner grades Jasper's orchestration (1-5 stars + explanation). The explanation triggers a prompt revision proposal for Jasper's GM.
2. **Deliverable review** — owner rejects or requests revision on a deliverable (blog, video, social post, email) with feedback. The feedback triggers a prompt revision proposal for the PRODUCING agent's GM (not Jasper's).
3. **Training Center chat** — owner trains an agent via direct conversation. Corrections identified in the chat trigger prompt revision proposals for that agent's GM.

### Prompt Engineer Agent

A dedicated specialist agent responsible for editing other agents' system prompts. This agent:

- **Model:** Claude Opus via OpenRouter (best reasoning for instruction editing, low-frequency so cost is negligible)
- **Input:** The agent's current system prompt + the owner's correction/feedback
- **Process:**
  1. Reads the full current prompt
  2. Identifies the affected section
  3. Rewrites ONLY that section to incorporate the correction
  4. If the correction conflicts with existing instructions, asks the owner for clarification via chat before proposing
  5. Presents a before/after diff for approval
- **Output:** A proposed revised prompt section, shown in the Prompt Revision Popup

### Prompt Revision Popup (3-panel UI)

Triggered whenever the owner submits a grade with explanation, rejects a deliverable with feedback, or when a Training Center chat produces a correction.

| Panel | Content |
|-------|---------|
| **Left: Current** | The affected section of the current prompt, highlighted |
| **Right: Proposed** | The revised section with changes highlighted (diff-style) |
| **Bottom: Chat** | Conversation with the Prompt Engineer Agent — it can ask clarifying questions, the owner can refine the proposal |

**Actions:**
- **Approve** — saves new GM version, deploys immediately, invalidates cache
- **Reject** — discards proposal, current GM stays unchanged
- **Edit Manually** — owner tweaks the proposed text before approving

### GM Version Control

Every approved prompt edit creates a new versioned GM snapshot. The Training Center provides a version management UI:

- **Version list** — v1, v2, v3... with timestamps and what triggered each change (e.g., "Grade correction: always enrich leads before outreach")
- **Diff view** — select any two versions to see exactly what changed between them
- **Rollback** — one-click revert to any previous version (deploys that version, deactivates current)
- **Active indicator** — which version is currently deployed for each agent

This is the safety net. If a prompt edit makes an agent worse, the owner pulls up version history, sees the change, and rolls back.

### Agents That Need GMs

Every agent that produces output the owner reviews needs its own GM with the full correction flow:

| Agent | Domain | What They Produce | Review Surface |
|-------|--------|-------------------|----------------|
| Jasper | `orchestrator` | Mission orchestration decisions | Mission Control grading |
| Content/Copywriter | `content` | Blog posts, landing page copy | Campaign deliverable review |
| Video Agent | `video` | Storyboards, video scripts | Campaign deliverable review |
| Social Agent | `social` | Social media posts | Campaign deliverable review |
| Email Agent | `email` | Email sequences, outreach | Campaign deliverable review |
| Alex | `sales_chat` | Sales conversations, onboarding | Training Center chat |

Swarm specialists that work behind the scenes (scrapers, enrichment, scoring) do NOT need this — their managers handle quality internally.

### Deliverable → Agent Routing

When a deliverable is rejected or revised, the feedback routes to the correct agent's GM:

| Deliverable Type | Producing Agent Domain |
|-----------------|----------------------|
| `blog` | `content` |
| `video` | `video` |
| `social_post` | `social` |
| `email` | `email` |
| `image` | `video` |
| `landing_page` | `content` |
| `research` | (no GM — swarm internal) |
| `strategy` | (no GM — swarm internal) |

### Mission Scheduling

Completed missions can be saved as reusable templates. The user sets:
- **Frequency:** daily, weekly, biweekly, monthly, or custom interval
- **Optional end date** or run indefinitely
- Auto-runs via cron without user intervention. Results appear in Mission Control for optional review.

### What Was Built (Phase 1 — April 1, 2026)

| Item | Status | Notes |
|------|--------|-------|
| `AgentDomain` types: `orchestrator`, `sales_chat` | DONE | `src/types/training.ts` |
| Zod schema drift fixed (added `video`, `orchestrator`, `sales_chat`) | DONE | `agent-training-validation.ts` |
| Deploy scoping bug fixed (was deactivating ALL GMs) | DONE | `golden-master-updater.ts`, `golden-master-builder.ts` |
| Training configs for orchestrator + sales_chat | DONE | `agent-type-configs.ts` |
| Jasper GM loader with 60s cache | DONE | `jasper-golden-master.ts` |
| Chat route loads Jasper GM | DONE | `orchestrator/chat/route.ts` |
| Mission grading types + service + API | DONE | `mission-grades.ts`, `mission-grade-service.ts` |
| StarRating / MissionGradeCard / StepGradeWidget | DONE | `mission-control/_components/` |
| Grading wired into Mission Control page | DONE | `page.tsx` — center panel + right panel + sidebar badge |
| Mission scheduling types + service + API + cron | DONE | `mission-schedule.ts`, `mission-schedule-service.ts` |
| ScheduleMissionDialog wired into Mission Control | DONE | `page.tsx` — button on completed missions |
| GM seed script | DONE | `scripts/seed-golden-masters.js` — both GMs live in Firestore |
| Deliverable rejection routes to producing agent | DONE | `deliverables/[deliverableId]/route.ts` — auto-flags |
| Training Center UI updated with new agent types | DONE | Orchestrator + Sales Chat tabs |
| Seed API endpoints (owner-only, idempotent) | DONE | `seed-orchestrator-gm`, `seed-sales-chat-gm` |

### What Needs To Be Built (Phase 2 — Prompt Engineer + Learning Loop)

**IMPORTANT: The `buildLearnedCorrectionsBlock` approach (appending corrections to the prompt) must be REMOVED. It was an interim shortcut. The correct architecture is direct prompt editing via the Prompt Engineer Agent with owner approval.**

| Item | Priority | Description |
|------|----------|-------------|
| Prompt Engineer Agent | P0 | New specialist on Claude Opus — reads current prompt + correction, proposes section-targeted rewrite, can ask clarifying questions |
| Prompt Revision Popup UI | P0 | 3-panel component (current / proposed / chat) with Approve/Reject/Edit buttons |
| Grade → Popup trigger | P0 | When grade explanation is submitted in Mission Control, trigger popup instead of auto-flagging |
| Deliverable reject → Popup trigger | P0 | When deliverable is rejected with feedback, trigger popup for producing agent's GM |
| Training Center → Popup trigger | P1 | When chat training produces a correction, trigger popup |
| GM Version Control UI | P1 | Version list + diff view + rollback in Training Center |
| Fix deliverable routing map | P1 | `blog` → `content` (not `seo`), verify all mappings |
| Remove `buildLearnedCorrectionsBlock` | P1 | Remove the layering approach from chat route — replaced by direct prompt editing |
| Jasper GM systemPrompt | P0 | GM currently has empty systemPrompt — needs the full compiled prompt so Jasper actually spawns from it |
| Content agent GM | P1 | Seed GM for content/copywriter agent |
| Ensure all reviewable agents have GMs | P2 | video, social, email agents need seeded GMs |

### Pick Up Here

**OUT OF DATE — see Current Priority section at the top of this file.** The Phase 2 GM learning loop is now a successor workstream that does not start until every specialist in every department has been rebuilt as a real AI agent. Reason: the learning loop edits prompts, but until the specialist rebuild ships, there are no real prompts to edit — the "specialists" are hand-coded template engines. Build the prompts first, build the editor second. Full context in the Current Priority section.

---

## Phase 1: Jasper Orchestrator & Mission Control (18 tests)

**Goal:** Jasper responds, calls tools, creates missions, and Mission Control displays them correctly.
**STATUS:** Orchestration testing in progress. Campaign pipeline works (8 steps green). Fixing tool coverage and execution reliability.

### Orchestration Fixes Applied (March 30, 2026)

**Commits:** 5155f074, 104d3211, 368bf01e

1. **Config awareness hedging FIXED** — Removed "RULES FOR CONFIGURATION AWARENESS" that told Jasper to warn before calling tools. Config status is now informational only. (route.ts)
2. **Zero narration rule ADDED** — Jasper must call tools in first response, never repeat user's request, never describe plan before acting. (jasper-thought-partner.ts)
3. **Multi-part request handling ADDED** — Each numbered item in user's message = separate tool call. `orchestrate_campaign` only handles content (blog/video/social/email/landing). Scraping, leads, enrichment, outreach are separate tools. (jasper-thought-partner.ts)
4. **maxIterations increased to 30** — Was 3, causing complex requests to exhaust iterations before generating text → "I encountered an issue" fallback. (route.ts)
5. **Fallback message FIXED** — Instead of fake error, now shows which tools ran + Mission Control link. (route.ts)
6. **Video/Social review links FIXED** — Mission steps now include `toolResult` with `reviewLink`. Added fallback entries to `TOOL_ROUTE_MAP`. (jasper-tools.ts, dashboard-links.ts)
7. **Email review link FIXED** — Email step `toolResult` now includes `reviewLink`. (jasper-tools.ts)
8. **Blog editor black screen FIXED** — Widget type changed from `'text'` to `'html'`. Uses `SafeHtml` component for proper rendering. (jasper-tools.ts)

### Orchestration Fixes Applied (March 31, 2026)

9. **Zero narration ENFORCED** — Rewrote VOICE examples, DELEGATION WORKFLOW, DELEGATION EXAMPLES, and EXAMPLE INTERACTIONS to all show post-result narration only. Removed all pre-tool "I've put the team on it" patterns. Made ZERO NARRATION the "HIGHEST PRIORITY RULE" with explicit prohibition on ANY text before tool calls. (jasper-thought-partner.ts)
10. **Campaign vs standalone tools CLARIFIED** — Added explicit block: "orchestrate_campaign ONLY handles CONTENT CREATION." Listed 7 tools that must be called separately (scrape_website, scan_leads, enrich_lead, score_leads, draft_outreach_email, get_seo_config, research_competitors). Added "TWO CAMPAIGN MODES" section distinguishing orchestrate_campaign (automated) from create_campaign + individual tools (manual). (jasper-thought-partner.ts)
11. **scan_leads now saves to CRM** — Added `saveToCrm` parameter (default: "true"). When enabled, writes each company as a lead to `organizations/{PLATFORM_ID}/leads` via AdminFirestoreService. Sets `acquisitionMethod: 'intelligence_discovery'`, `source: 'apollo'`, stores full org data in `enrichmentData`. Returns `savedToCrm: true, savedCount: N` in response. (jasper-tools.ts)

### Outstanding Orchestration Issues (Pick Up Here)

All three previous blockers (narration, tool routing, lead persistence) have been fixed. Need to validate with the test prompt below.
4. **Test prompt for validation:**

```
I want you to run a complete end-to-end campaign. Here's what I need:

1. Research: Scrape gohighlevel.com, vendasta.com, and hubspot.com — analyze their positioning, pricing, and weaknesses. Research trending topics in AI-powered sales tools for 2026.

2. Leads: Scan for 10 high-value leads — SaaS operations directors and VP Sales at mid-market companies who are currently using one of those competitors. Enrich and score them.

3. Full Campaign: Launch a complete multi-channel campaign on "AI Sales Acceleration for Q3" targeting B2B SaaS founders struggling with summer sales slumps. I need EVERYTHING — blog post, 3-email drip sequence, social posts for Twitter and LinkedIn, a landing page, and a video storyboard. Professional tone.

4. Outreach: Draft a personalized cold outreach email to the top-scored lead from the scan.

5. SEO: Pull our current SEO config so I can see if it aligns with the campaign keywords.

Go all out — use every tool you have.
```

**Expected tool calls (15+):** scrape_website x3, research_trending_topics, scan_leads, enrich_lead, score_leads, orchestrate_campaign (→ research, strategy, blog, video, social, email, landing page), draft_outreach_email, get_seo_config

**Success criteria:** All tools fire in one prompt, no hedging, no narration before execution, all steps green in Mission Control with review links.

### Full Orchestration Test Suite

**File:** [`docs/orchestration-test-suite.md`](docs/orchestration-test-suite.md)

The test prompt above (A.1) is just the first of **60+ test prompts** across 9 categories. The full suite must pass before Phase 1 orchestration can be marked COMPLETE:

| Category | What It Tests | Prompts | Target |
|----------|--------------|---------|--------|
| A — Power User | Numbered, explicit multi-tool requests | 3 | 100% |
| B — Casual User | Natural language, no structure | 8 | 90%+ |
| C — Busy Executive | Terse one-liners | 10 | 90%+ |
| D — Compound | Multiple tasks without numbering | 8 | 85%+ |
| E — Ambiguous | Vague/minimal input | 5 | 75%+ |
| F — Industry Jargon | ABM, nurture, drip, TOFU, MQL, pipeline | 8 | 85%+ |
| G — Error Paths | Missing keys, bad URLs, cancel | 7 | 90%+ |
| H — Follow-Up | Contextual requests referencing prior results | 5 | 80%+ |
| I — Conversational | No tools expected (greetings, thanks) | 5 | 100% |

**Workflow:** Test A.1 first (the power-user prompt). If it fails, fix before proceeding. Then work through B→I categories. Log results in the test suite file's "Test Run Log" table.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 1.1 | Jasper opens | Click Jasper chat icon | Chat panel opens, welcome message shows | PASS | |
| 1.2 | Simple conversation | Type "Hello, what can you do?" | Jasper responds with capabilities, no tool calls | PASS | Clean capabilities overview, no tool calls. |
| 1.3 | Tool invocation | "Show me my recent leads" | Jasper calls CRM tool, returns real data | PASS | Tools called: score_leads, get_system_state, enrich_lead. Empty results (fresh env). Response should say "no leads found" more explicitly — prompt tuning item. |
| 1.4 | Delegation | "Create a blog post about AI in sales" | Jasper delegates to content team, mission created | PARTIAL | Blog saved via `save_blog_draft` (works). **Bugs fixed:** (1) Blog editor crash — `section.columns` guard. (2) Review link → Mission Control. (3) `delegate_to_content` label → "Content" not "Video Studio". (4) Review page rendered raw JSON → now shows readable specialist report. **Known issue:** `delegate_to_content` agent broken — copywriter expects `method` but manager sends `action`, 6/7 specialists fail. Jasper prompt updated to use `save_blog_draft` directly for blog posts. Content agent contract mismatch needs dedicated fix. |
| 1.5 | Mission appears | After 1.4, navigate to `/mission-control` | One mission visible with correct title | PASS | Shows in History tab. Live tab filters out completed missions >10min — fixed deep-link to always include targeted mission. |
| 1.6 | No duplicate missions | Check mission list after 1.4 | Exactly ONE mission, not two or more | PASS | 3 missions in history, no duplicates. |
| 1.7 | Mission steps | Click on the mission from 1.4 | Steps visible (RUNNING → COMPLETED), correct tool names | PASS | 2 steps shown: Content + Save Blog Draft, both COMPLETED with progress bar. |
| 1.8 | Mission SSE streaming | Watch mission while Jasper works | Status updates in real-time without refresh | | |
| 1.9 | Review link | After delegation completes, check Jasper's response | Contains clickable review link to the output page | | |
| 1.10 | Mission cancel | Create a mission, then click Cancel | Mission status changes to FAILED, "Cancelled by user" | | |
| 1.11 | Mission delete | Click delete on a completed mission | Mission removed from list | | |
| 1.12 | Clear all | Click "Clear All" on completed/failed missions | All terminal missions removed | | |
| 1.13 | Mission history | Navigate to `/mission-control/history` | Past missions listed with filters | | |
| 1.14 | Campaign creation | "Build a campaign: blog + video + social post about X" | Campaign created with multiple deliverables | | |
| 1.15 | Campaign review | Navigate to mission-control with campaign filter | All deliverables shown as cards with approve/reject | | |
| 1.16 | Error display | Trigger an error (e.g., ask about unconfigured service) | Jasper shows the real error message, not a generic one | | |
| 1.17 | Model selection | Change model in Jasper settings | Subsequent responses use selected model | | |
| 1.18 | Retry on failure | If OpenRouter fails, check behavior | Jasper retries (up to 2x) before showing error | | |

---

## Phase 2: CRM & Sales Pipeline (22 tests)

**Goal:** Full CRUD on contacts, leads, deals. Scoring, enrichment, and pipeline stages work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 2.1 | Leads list | Navigate to `/leads` | List loads with existing leads (or empty state) | | |
| 2.2 | Create lead | Click "New Lead" → fill form → save | Lead created, appears in list | | |
| 2.3 | Lead detail | Click on a lead | Detail page shows all fields, activity timeline | | |
| 2.4 | Edit lead | Edit lead fields → save | Changes persist on reload | | |
| 2.5 | Delete lead | Delete a lead | Removed from list, gone on reload | | |
| 2.6 | Lead scoring | Check lead score on detail page | Score (0-100) displayed, BANT factors shown | | |
| 2.7 | Lead enrichment | Click "Enrich" on a lead | Enrichment data populates (company, social, etc.) | | |
| 2.8 | Lead research | Navigate to `/leads/research` | Research tool loads, search works | | |
| 2.9 | Lead discovery | Navigate to `/leads/discovery` | Discovery page loads, can search for prospects | | |
| 2.10 | ICP page | Navigate to `/leads/icp` | Ideal Customer Profile page renders | | |
| 2.11 | Contacts list | Navigate to `/contacts` | List loads correctly | | |
| 2.12 | Create contact | Create new contact with full details | Contact saved, all fields persist | | |
| 2.13 | Contact detail | Click into contact → check all tabs | Tabs load: overview, activity, deals, emails | | |
| 2.14 | Deals list | Navigate to `/deals` | Pipeline view or list view loads | | |
| 2.15 | Create deal | Create new deal, assign to contact/lead | Deal created with stage, value, contact link | | |
| 2.16 | Deal stages | Drag deal to different pipeline stage | Stage updates, persists on reload | | |
| 2.17 | Deal detail | Click into deal | Full detail: value, stage, contacts, timeline | | |
| 2.18 | Search | Use search on leads/contacts/deals | Results relevant, fast response | | |
| 2.19 | Filters | Apply filters (status, score, date) | List filters correctly | | |
| 2.20 | Bulk actions | Select multiple leads → bulk action | Action applies to all selected | | |
| 2.21 | Lead scoring config | Navigate to `/lead-scoring` | Scoring rules page loads, editable | | |
| 2.22 | Conversations | Navigate to `/conversations` | Conversation list loads | | |

---

## Phase 3: Email & Communications (16 tests)

**Goal:** Email campaigns send, track opens/clicks, templates work, unsubscribe functions.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 3.1 | Campaign list | Navigate to `/email/campaigns` | List loads with campaigns (or empty state) | | |
| 3.2 | Create campaign | Click "New Campaign" → build email → save | Campaign created as draft | | |
| 3.3 | Email builder | Navigate to `/marketing/email-builder` | Builder loads with template options | | |
| 3.4 | Send campaign | Send a campaign to a test list | Email delivered (check inbox or logs) | | |
| 3.5 | Campaign detail | Click into a campaign | Stats: sent, opened, clicked, bounced | | |
| 3.6 | Open tracking | Open a sent email | Open count increments in campaign stats | | |
| 3.7 | Click tracking | Click a link in a sent email | Click count increments, redirect works | | |
| 3.8 | Unsubscribe | Click unsubscribe link in email | `/unsubscribe` page loads, confirms opt-out | | |
| 3.9 | Email writer | Navigate to `/email-writer` | AI email composition tool loads | | |
| 3.10 | Email templates | Navigate to `/settings/email-templates` | Templates list, can create/edit | | |
| 3.11 | Nurture sequences | Navigate to `/nurture` | Sequences list loads | | |
| 3.12 | Create nurture | Create new nurture sequence with steps | Sequence saved with timing rules | | |
| 3.13 | Nurture stats | Navigate to `/nurture/[id]/stats` | Stats page renders with data | | |
| 3.14 | Outbound hub | Navigate to `/outbound` | Outbound management loads | | |
| 3.15 | Sequences | Navigate to `/outbound/sequences` | Sequences list loads | | |
| 3.16 | SMS settings | Navigate to `/settings/sms-messages` | SMS configuration page loads | | |

---

## Phase 4: Social Media (14 tests)

**Goal:** Social posting works for all wired platforms, scheduling, approvals, analytics.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 4.1 | Social activity | Navigate to `/social/activity` | Activity feed loads | | |
| 4.2 | Post to Twitter/X | Create and publish a post to Twitter | Post published, appears in activity | | |
| 4.3 | Post to LinkedIn | Create and publish to LinkedIn | Post published (if OAuth connected) | | |
| 4.4 | Post to Bluesky | Create and publish to Bluesky | Post published (if API key set) | | |
| 4.5 | Post scheduling | Schedule a post for future time | Post saved as scheduled, appears in calendar | | |
| 4.6 | Social calendar | Navigate to `/social/calendar` | Calendar view with scheduled posts | | |
| 4.7 | Social analytics | Navigate to `/social/analytics` | Analytics dashboard with engagement data | | |
| 4.8 | Content approvals | Navigate to `/social/approvals` | Approval queue loads | | |
| 4.9 | Command center | Navigate to `/social/command-center` | Command center renders | | |
| 4.10 | Agent rules | Navigate to `/social/agent-rules` | Agent configuration page loads | | |
| 4.11 | Social listening | Navigate to `/social/listening` | Listening dashboard loads | | |
| 4.12 | Multi-platform post | Create one post, select multiple platforms | Post sent to all selected platforms | | |
| 4.13 | Social campaigns | Navigate to `/social/campaigns` | Campaigns list loads | | |
| 4.14 | Social playbook | Navigate to `/social/playbook` | Playbook page loads | | |

---

## Phase 5: Website Builder & Blog (18 tests)

**Goal:** Pages create/edit, widgets render, blog works, SEO controls function.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 5.1 | Pages list | Navigate to `/website/pages` | Pages list loads | | |
| 5.2 | Create page | Create a new page with title and slug | Page created, visible in list | | |
| 5.3 | Page editor | Open page in `/website/editor` | Drag-drop editor loads with widget palette | | |
| 5.4 | Add widgets | Add 3-4 different widget types to a page | Widgets render correctly in editor | | |
| 5.5 | Save and preview | Save page → preview | Public page renders with all widgets | | |
| 5.6 | AI page generation | Use AI to generate a page | Page created with content and layout | | |
| 5.7 | Domain management | Navigate to `/website/domains` | Domain config page loads | | |
| 5.8 | Navigation editor | Navigate to `/website/navigation` | Nav editor loads, can add/reorder items | | |
| 5.9 | Templates | Navigate to `/website/templates` | Template gallery loads | | |
| 5.10 | Website settings | Navigate to `/website/settings` | Settings page loads with config options | | |
| 5.11 | SEO controls | Navigate to `/website/seo` | SEO management page loads | | |
| 5.12 | Blog list | Navigate to `/website/blog` | Blog posts list loads | | |
| 5.13 | Blog editor | Navigate to `/website/blog/editor` | Blog editor loads with formatting tools | | |
| 5.14 | Create blog post | Write and publish a blog post | Post published, visible on public blog | | |
| 5.15 | Blog categories | Navigate to `/website/blog/categories` | Categories management loads | | |
| 5.16 | Public blog | Visit public blog URL | Blog renders with published posts | | |
| 5.17 | Storefront | Navigate to `/website/store` | Store page loads with products | | |
| 5.18 | Audit log | Navigate to `/website/audit-log` | Audit log loads with activity | | |

---

## Phase 6: Video & Creative Studio (20 tests)

**Goal:** Video pipeline works end-to-end — storyboard → generation → assembly. Studio generates images.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 6.1 | Video hub | Navigate to `/content/video` | Video management page loads | | |
| 6.2 | Video library | Navigate to `/content/video/library` | Library loads with existing videos (or empty) | | |
| 6.3 | Create video project | Ask Jasper to "make a video about X" | Jasper calls list_avatars → produce_video | | |
| 6.4 | Storyboard review | After 6.3, review the storyboard in Mission Control | Storyboard visible with scenes, scripts, thumbnails | | |
| 6.5 | Scene preview images | Check storyboard scenes | Preview images render (base64 from Firestore) | | |
| 6.6 | Approve storyboard | Click approve on storyboard | Status updates, ready for generation | | |
| 6.7 | Generate video | Ask Jasper to generate (after approval) | Video generation starts via Hedra API | | |
| 6.8 | Generation progress | Watch generation status | Progress updates (polling or SSE) | | |
| 6.9 | Assembly | After scenes generated, ask Jasper to assemble | FFmpeg stitching runs, final video produced | | |
| 6.10 | Video editor | Navigate to `/content/video/editor` | CapCut-style editor loads | | |
| 6.11 | Editor timeline | Add clips to timeline, reorder | Drag-and-drop works, order persists | | |
| 6.12 | Text overlays | Add text overlay to video | Overlay renders in preview | | |
| 6.13 | Image generator | Navigate to `/content/image-generator` | Image generation UI loads | | |
| 6.14 | Generate image | Enter prompt → generate | Image generated via configured provider | | |
| 6.15 | Character Studio | Navigate to video characters page | Character list loads with avatars | | |
| 6.16 | Clone Wizard | Start "Clone Yourself" flow | 5-step wizard: face upload → voice record → create | | |
| 6.17 | Voice Lab | Navigate to `/content/voice-lab` | Voice lab loads with recording/playback | | |
| 6.18 | Video calendar | Navigate to `/content/video/calendar` | Calendar view loads | | |
| 6.19 | Music library | Check background music in video editor | Music tracks available and playable | | |
| 6.20 | Simple/Advanced mode | Toggle between simple and advanced style pickers | Both modes render, preference persists | | |

---

## Phase 7: Voice AI & Calls (10 tests)

**Goal:** Voice infrastructure loads, call interface works, TTS functions.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 7.1 | Calls list | Navigate to `/calls` | Call history loads | | |
| 7.2 | Make a call | Navigate to `/calls/make` | Call interface loads with dialer | | |
| 7.3 | Voice training | Navigate to `/voice/training` | Training center loads | | |
| 7.4 | Jasper voice mode | Enable voice in Jasper chat | TTS reads Jasper's responses | | |
| 7.5 | Voice settings | Navigate to `/settings/ai-agents/voice` | Voice configuration loads | | |
| 7.6 | TTS preview | Play a TTS preview in voice lab | Audio plays in browser | | |
| 7.7 | Voice live mode | Toggle live conversation mode in Jasper | VAD detects speech, Jasper responds | | |
| 7.8 | ElevenLabs status | Check if ElevenLabs key is configured | Key present → voice features enabled | | |
| 7.9 | Twilio status | Check if Twilio credentials configured | Status shown in settings | | |
| 7.10 | Call agent config | Check voice agent BANT qualification setup | Configuration page loads | | |

---

## Phase 8: Payments & E-Commerce (18 tests)

**Goal:** Products, checkout, Stripe integration, orders, invoices, coupons all work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 8.1 | Products list | Navigate to `/products` | Products list loads | | |
| 8.2 | Create product | Create new product with price | Product saved, visible in list | | |
| 8.3 | Edit product | Edit product details | Changes persist | | |
| 8.4 | Services | Navigate to `/products/services` | Services list loads | | |
| 8.5 | Storefront settings | Navigate to `/settings/storefront` | Storefront config loads | | |
| 8.6 | Orders list | Navigate to `/orders` | Orders list loads | | |
| 8.7 | Checkout flow | Trigger a checkout (Stripe test mode) | Checkout session created, redirects to Stripe | | |
| 8.8 | Order completion | Complete a test payment | Order created in Firestore with status | | |
| 8.9 | Invoice generation | After order, check for invoice | Invoice PDF generated and accessible | | |
| 8.10 | Subscription create | Create a subscription product → subscribe | Subscription active in Stripe + Firestore | | |
| 8.11 | Subscription cancel | Cancel an active subscription | Subscription cancelled, status updated | | |
| 8.12 | Coupon system | Navigate to `/settings/promotions` | Coupon management loads | | |
| 8.13 | Create coupon | Create a discount code | Coupon saved, usable at checkout | | |
| 8.14 | Apply coupon | Apply coupon during checkout | Discount applied correctly | | |
| 8.15 | Billing settings | Navigate to `/settings/billing` | Billing/subscription management UI loads | | |
| 8.16 | Subscription settings | Navigate to `/settings/subscription` | Subscription tier management loads | | |
| 8.17 | Webhook handling | Simulate Stripe webhook (CLI or event) | Firestore updated correctly | | |
| 8.18 | Proposals builder | Navigate to `/proposals/builder` | Proposal builder loads | | |

---

## Phase 9: Workflows & Automation (12 tests)

**Goal:** Workflows create, trigger, execute actions, and log results.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 9.1 | Workflows list | Navigate to `/workflows` | Workflow list loads | | |
| 9.2 | Create workflow | Click "New Workflow" → configure | Workflow created with trigger + actions | | |
| 9.3 | Workflow detail | Click into a workflow | Config visible: trigger, conditions, actions | | |
| 9.4 | Workflow builder | Navigate to `/workflows/builder` | Visual builder loads | | |
| 9.5 | Trigger test | Manually trigger a workflow | Workflow executes, actions fire | | |
| 9.6 | Run history | Navigate to `/workflows/[id]/runs` | Execution history with status per run | | |
| 9.7 | Conditions | Add conditional logic to workflow | Conditions evaluate correctly during run | | |
| 9.8 | Email action | Workflow with "send email" action | Email sent when triggered | | |
| 9.9 | CRM action | Workflow with "update lead" action | Lead updated when triggered | | |
| 9.10 | Scheduled trigger | Create workflow with cron trigger | Workflow runs on schedule | | |
| 9.11 | Webhook trigger | Create workflow with webhook trigger | POST to webhook URL triggers workflow | | |
| 9.12 | Workflow settings | Navigate to `/settings/workflows` | Workflow settings page loads | | |

---

## Phase 10: Forms & Data Capture (10 tests)

**Goal:** Forms create, publish, submit, and feed into CRM.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 10.1 | Forms list | Navigate to `/forms` | Forms list loads | | |
| 10.2 | Create form | Create new form with fields | Form saved, visible in list | | |
| 10.3 | Edit form | Navigate to `/forms/[formId]/edit` | Form editor loads with existing fields | | |
| 10.4 | Publish form | Publish form → get embed URL | Public form URL generated | | |
| 10.5 | Submit form | Visit public form URL → fill → submit | Submission recorded | | |
| 10.6 | Submissions list | View form submissions in dashboard | All submissions visible with data | | |
| 10.7 | CRM auto-create | Submit form with email field | Lead auto-created in CRM from submission | | |
| 10.8 | reCAPTCHA | Check spam protection on public form | CAPTCHA present and functional | | |
| 10.9 | Embedded form | Visit `/f/[formId]` | Embeddable form renders | | |
| 10.10 | Templates | Navigate to `/templates` | Form templates available | | |

---

## Phase 11: SEO & Growth (14 tests)

**Goal:** SEO tools work, keyword research returns data, rank tracking charts render, growth dashboard functional.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 11.1 | Keywords page | Navigate to `/growth/keywords` | 3 tabs: Tracker, Research, Rank History | | |
| 11.2 | Keyword research | Enter seed keyword → search | Suggestions returned with volume data | | |
| 11.3 | Track keyword | Click "Track" on a suggestion | Keyword added to tracker tab | | |
| 11.4 | Rank history | Switch to Rank History tab → select keywords | Line chart renders with position data | | |
| 11.5 | Growth strategy | Navigate to `/growth/strategy` | Strategy page loads | | |
| 11.6 | Competitor tracking | Navigate to `/growth/competitors` | Competitor profiles load | | |
| 11.7 | Growth activity | Navigate to `/growth/activity` | Activity feed loads | | |
| 11.8 | Growth command center | Navigate to `/growth/command-center` | Command center renders | | |
| 11.9 | AI visibility | Navigate to `/growth/ai-visibility` | AI visibility dashboard loads | | |
| 11.10 | Website SEO | Navigate to `/website/seo` | SEO controls load | | |
| 11.11 | Competitor SEO | Navigate to `/website/seo/competitors` | Competitor analysis page loads | | |
| 11.12 | AI search insights | Navigate to `/website/seo/ai-search` | AI search optimization page loads | | |
| 11.13 | SEO training | Navigate to `/seo/training` | Training page loads | | |
| 11.14 | Intelligence discovery | Navigate to `/intelligence/discovery` | Discovery hub loads | | |

---

## Phase 12: Analytics & Reporting (12 tests)

**Goal:** All analytics dashboards render with real data, charts load, filters work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 12.1 | Analytics hub | Navigate to `/analytics` | Main analytics page loads | | |
| 12.2 | Sales analytics | Navigate to `/analytics/sales` | Sales charts and metrics render | | |
| 12.3 | Pipeline analytics | Navigate to `/analytics/pipeline` | Pipeline visualization loads | | |
| 12.4 | Revenue analytics | Navigate to `/analytics/revenue` | Revenue metrics and charts render | | |
| 12.5 | Attribution | Navigate to `/analytics/attribution` | Attribution model loads | | |
| 12.6 | E-commerce analytics | Navigate to `/analytics/ecommerce` | E-commerce metrics render | | |
| 12.7 | Workflow analytics | Navigate to `/analytics/workflows` | Workflow stats load | | |
| 12.8 | Sequence analytics | Navigate to `/sequences/analytics` | Sequence performance data loads | | |
| 12.9 | Performance | Navigate to `/performance` | Performance dashboard loads | | |
| 12.10 | Executive briefing | Navigate to `/executive-briefing` | Briefing page renders with data | | |
| 12.11 | Compliance reports | Navigate to `/compliance-reports` | Reports page loads | | |
| 12.12 | Living ledger | Navigate to `/living-ledger` | Financial ledger loads | | |

---

## Phase 13: Settings & Configuration (16 tests)

**Goal:** All settings pages load, configurations save, API keys manage correctly.

**Note:** Verify the Schema Editor (`/schemas`) is correctly wired and adapts to user profile field changes (phone, title, timezone added during profile page rebuild). Ensure custom entities and fields persist and render correctly across the system.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 13.1 | Settings home | Navigate to `/settings` | Settings hub loads with all categories | | |
| 13.2 | Account settings | Navigate to `/settings/account` | Profile, name, email editable | | |
| 13.3 | API keys | Navigate to `/settings/api-keys` | All provider keys shown, add/edit works | | |
| 13.4 | Add API key | Add a new API key (e.g., test key) | Key saved, shows in list | | |
| 13.5 | Brand DNA | Navigate to `/settings/brand-dna` | Brand identity config loads | | |
| 13.6 | Brand kit | Navigate to `/settings/brand-kit` | Brand assets page loads | | |
| 13.7 | Theme settings | Navigate to `/settings/theme` | Theme customization loads | | |
| 13.8 | Feature toggles | Navigate to `/settings/features` | Module toggle switches work | | |
| 13.9 | Integrations | Navigate to `/settings/integrations` | Integrations page loads, OAuth connect buttons | | |
| 13.10 | Security settings | Navigate to `/settings/security` | Security config loads | | |
| 13.11 | User management | Navigate to `/settings/users` | User list with role management | | |
| 13.12 | Invite team member | Send invite from user management | Invite email sent, accept flow works | | |
| 13.13 | Webhooks config | Navigate to `/settings/webhooks` | Webhook management loads | | |
| 13.14 | Music library admin | Navigate to `/settings/music-library` | Upload status, per-track upload buttons | | |
| 13.15 | Lead routing | Navigate to `/settings/lead-routing` | Routing rules page loads | | |
| 13.16 | Meeting scheduler | Navigate to `/settings/meeting-scheduler` | Calendar integration config loads | | |

---

## Phase 14: Team, Coaching & Performance (10 tests)

**Goal:** Team features, coaching AI, leaderboards, and task management work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 14.1 | Coaching hub | Navigate to `/coaching` | Coaching dashboard loads with AI insights | | |
| 14.2 | Team coaching | Navigate to `/coaching/team` | Team coaching page loads | | |
| 14.3 | Leaderboard | Navigate to `/team/leaderboard` | Leaderboard renders with rankings | | |
| 14.4 | Team tasks | Navigate to `/team/tasks` | Task list loads | | |
| 14.5 | Workforce | Navigate to `/workforce` | Workforce management loads | | |
| 14.6 | Workforce performance | Navigate to `/workforce/performance` | Performance metrics load | | |
| 14.7 | Battlecards | Navigate to `/battlecards` | Sales battlecards load | | |
| 14.8 | Playbook | Navigate to `/playbook` | Business playbook loads | | |
| 14.9 | Academy | Navigate to `/academy` | Academy hub loads | | |
| 14.10 | Certifications | Navigate to `/academy/certifications` | Certifications page loads | | |

---

## Phase 15: Public Pages & Onboarding (14 tests)

**Goal:** All public pages render, onboarding flow completes, legal pages exist.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 15.1 | Home page | Visit `/` (logged out) | Landing page renders professionally | | |
| 15.2 | Features page | Visit `/features` | Features showcase loads | | |
| 15.3 | Pricing page | Visit `/pricing` | Pricing tiers displayed | | |
| 15.4 | About page | Visit `/about` | About page renders | | |
| 15.5 | Contact page | Visit `/contact` | Contact form loads and submits | | |
| 15.6 | Demo page | Visit `/demo` | Demo booking page loads | | |
| 15.7 | Blog (public) | Visit `/blog` | Blog listing renders | | |
| 15.8 | FAQ | Visit `/faq` | FAQ page renders | | |
| 15.9 | Terms of service | Visit `/terms` | Legal text renders | | |
| 15.10 | Privacy policy | Visit `/privacy` | Legal text renders | | |
| 15.11 | Security page | Visit `/security` | Security info renders | | |
| 15.12 | Docs | Visit `/docs` | Documentation renders | | |
| 15.13 | Onboarding flow | Login as new user → complete onboarding | All steps complete, auto-save works mid-flight | | |
| 15.14 | Onboarding resume | Start onboarding → close browser → reopen | Resumes from last saved step | | |

---

## Phase 16: Cross-System Integration Tests (10 tests)

**Goal:** Systems work together — end-to-end workflows that cross feature boundaries.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 16.1 | Lead → Deal pipeline | Create lead → score → convert to deal | Deal created with lead data carried over | | |
| 16.2 | Form → CRM → Email | Submit form → lead created → nurture sequence starts | Automated email sent to new lead | | |
| 16.3 | Jasper → Video → Campaign | Ask Jasper for campaign → video + blog + social | All deliverables in campaign review, can approve | | |
| 16.4 | Workflow → Email | Trigger workflow → sends email action | Email received with correct content | | |
| 16.5 | Social → Analytics | Post to social → check analytics | Post appears in social analytics | | |
| 16.6 | Checkout → Order → Invoice | Complete checkout → order created → invoice generated | Full commerce flow end-to-end | | |
| 16.7 | Blog → SEO | Publish blog post → check SEO sitemap | Post appears in sitemap.xml | | |
| 16.8 | Voice → CRM | Make a call → check CRM activity | Call logged on contact's activity timeline | | |
| 16.9 | Team invite → RBAC | Invite member → they sign up → verify restricted access | New user has member role, limited sidebar | | |
| 16.10 | Feature toggle cascade | Disable a module → check sidebar + routes + Jasper | Module hidden everywhere, Jasper knows it's off | | |

---

## Phase S: Security & Infrastructure (8 tests)

**Goal:** Verify endpoints are protected, signatures validated, data cleanup works, headers correct. These are invisible to browser QA — must be tested via DevTools or curl.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| S.1 | Unprotected `/api/version` | `curl localhost:3000/api/version` (no auth header) | Returns 401, not deployment info | | Currently WIDE OPEN — leaks git commit, branch, Vercel URL |
| S.2 | Unprotected `/api/recovery/track` | `curl localhost:3000/api/recovery/track/anything` (no auth) | Returns 401 | | Currently WIDE OPEN — no auth, no validation, no rate limit |
| S.3 | Identity role escalation | As `member` role, POST to `/api/identity` | Returns 403 (requires owner/admin) | | Currently any authenticated user can overwrite workforce identity |
| S.4 | Webhook signature forgery | Send POST to `/api/webhooks/stripe` with invalid signature | Returns 400, not processed | | Stripe is verified — check PayPal, Razorpay, Gmail too |
| S.5 | CSP header check | Open DevTools → Network → check response headers | `script-src` uses nonce, not `unsafe-inline` | | Currently has `unsafe-inline` — XSS risk |
| S.6 | Cascading delete — forms | Delete a form → check Firestore for orphaned `fields/`, `submissions/` subcollections | Subcollections deleted with parent | | Currently orphans subcollections |
| S.7 | Cascading delete — schemas | Delete a schema → check Firestore for orphaned `fields/` subcollection | Subcollection deleted with parent | | Currently orphans subcollections |
| S.8 | Cron auth timing safety | Inspect cron endpoint auth code | Uses `crypto.timingSafeEqual()`, not string `!==` | | Currently uses simple string comparison |

---

## Post-QA: Multi-Tenant Readiness (Before Conversion)

Before re-enabling multi-tenancy, these must be completed:

| # | Task | Status |
|---|------|--------|
| MT.1 | Audit all hardcoded `PLATFORM_ID` / `organizations/${PLATFORM_ID}` paths (50+ found in code review) | NOT STARTED |
| MT.2 | Migrate all hardcoded paths to use `collections.ts` helpers (`getSubCollection()`, `getPlatformSubCollection()`) | NOT STARTED |
| MT.3 | Update Firestore security rules for tenant isolation | NOT STARTED |
| MT.4 | Re-add org-switching / tenant context to auth layer | NOT STARTED |
| MT.5 | Test tenant data isolation end-to-end | NOT STARTED |

---

## Bug Tracker

| Bug # | Phase | Test # | Description | Severity | Status | Fix Commit |
|-------|-------|--------|-------------|----------|--------|------------|
| — | — | — | — | — | — | — |

---

## Design Observations

| # | Phase | Area | Observation | Priority | Status |
|---|-------|------|-------------|----------|--------|
| — | — | — | — | — | — |

---

## Post-QA Milestones

| Milestone | Status | Date |
|-----------|--------|------|
| All 244 tests pass (including Phase S security) | NOT STARTED | — |
| All critical/high bugs fixed (see Known Bugs) | NOT STARTED | — |
| Security hardening complete (Phase S green) | NOT STARTED | — |
| Design improvements implemented | NOT STARTED | — |
| Multi-tenant readiness checklist (MT.1-MT.5) | NOT STARTED | — |
| Multi-tenant implementation | NOT STARTED | — |
| Production deployment to salesvelocity.ai | NOT STARTED | — |
| Launch | NOT STARTED | — |

---

## Already Fixed This Session

| Item | Details |
|------|---------|
| Jasper mission deduplication | Added `requestId` idempotency key from client — retries reuse same missionId |
| OpenRouter retry on network failure | Added 2x retry with 2s delay on `fetch failed` / timeout / DNS errors |

---

## Completed Work (All Sessions Archived)

- **Pre-Launch Items** (March 27) — SEO keyword research + rank tracking + invite accept + music upload admin
- **Post-Audit Sprint** (March 26) — 13 items resolved across 4 commits
- **Stub Eradication** (March 25) — 8 issues, voice providers, catalog sync, workflows, forms
- **Jasper Intelligence Layer** (March 25) — Config awareness, inline setup guidance
- **Campaign Dashboard** (March 25) — `/campaigns` page, 8 templates, analytics
- **Payment System** (March 25) — 12 providers, webhook handlers, provider-agnostic dispatcher
- **AI Creative Studio** (March 16) — 250+ cinematic presets, multi-provider
- **Campaign Orchestration** (March 15) — Layers 1-4, auto-publish, feedback loop
- **Video System** (March 10) — Hedra sole engine, Clone Wizard, auto-captions, editor
