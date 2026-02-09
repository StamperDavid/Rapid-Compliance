# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: b1c50e8f — "feat: implement ConversationMemory service — agents recall customer history"

## Current State (February 8, 2026)

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **158 physical routes**, **219 API endpoints**, **430K+ lines of TypeScript**
- **NOT yet deployed to production** — everything is dev branch only

### Code Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors)**
- `npm run build` — **PASSES (production build succeeds)**
- **510 `tests/lib/` tests** — ALL PASS (19/19 suites)
- **126 safe unit tests** — ALL PASS (event-router 49, jasper-command-authority 21, mutation-engine 9, analytics-helpers 47)
- **92 root-level tests** — ALL PASS
- **27 MemoryVault tests** — ALL PASS (hydration, serialization, TTL cleanup)
- **3 service tests failing** — infrastructure issue only (missing Firestore composite indexes, not code bugs)

### What's Complete
- **organizationId purge — FULLY COMPLETE** (zero references in src/ and tests/, all cascade type errors fixed, 564 files changed)
- Single-tenant conversion (-80K+ lines total across all purge phases)
- SalesVelocity.ai rebrand + CSS variable theme system
- Agent hierarchy with full manager orchestration
- 4-role RBAC with API gating and sidebar filtering
- Stabilization Roadmap (all 15 tasks across 3 tiers)
- Social Media Growth Engine (Phases 1-6)
- **Autonomous Business Operations (ALL 8 PHASES)** — Event Router, Operations Cycle Cron, Event Emitters, Manager Authority, Revenue Pipeline Automation, Outreach Autonomy, Content Production Hub, Intelligence Always-On, Builder/Commerce Reactive Loops, Contextual Artifact Generation, Jasper Command Authority
- Post-Phase 8 Stabilization — integration tests, production cron scheduling, executive briefing dashboard
- Pre-existing type errors fixed (brand-dna-service duplicate properties, claims-validator shorthand, director-service missing field, orchestrator LogContext type)
- **Unused import cleanup — COMPLETE** (135 lint errors removed: 126 PLATFORM_ID imports, 3 empty interfaces, 6 unused vars)
- Restored onboarding page.tsx (was accidentally emptied during orgId purge)
- **MemoryVault Firestore persistence — COMPLETE** (commit e388c151). Agents survive Vercel cold starts. `read()` and `query()` now await Firestore hydration before returning results. TTL cleanup wired to operations-cycle cron (every 4 hours). 35+ callers across 9 agent/orchestrator files updated to async.
- **ConversationMemory service — COMPLETE** (commit b1c50e8f). All 5 sub-tasks done:
  - 3a: Voice transcript persistence — `handleEndCall()` persists to Firestore before clearing memory. Also persists on transfer/close.
  - 3b: Auto-analysis trigger — voice calls auto-trigger `analyzeTranscript()` after completion. Chat sessions trigger analysis via API on `completeSession()`.
  - 3c: ConversationMemory service — `src/lib/conversation/conversation-memory.ts`. Unified retrieval across voice, chat, SMS by phone/email/customerId/leadId.
  - 3d: Lead Briefing generator — `conversationMemory.brief()` synthesizes interactions into structured briefing (sentiment trends, objections, buying signals, recommendations).
  - 3e: Agent integration — Outreach Manager enriches lead profiles, Revenue Director includes brief context in delegations, Voice AI loads caller history.

### Immediate Next Task
**Code Integrity Hardening** — Eliminate "false green" state. Lint passes with zero errors but only because 113 `eslint-disable` inline comments suppress violations. Security vulnerabilities exist (unsanitized HTML, weak CSP). See the full action plan below.

### Known Issues
| Issue | Details |
|-------|---------|
| **113 eslint-disable bypasses** | Lint passes "clean" but 113 inline suppressions mask real violations. 47 are `no-alert`, 12 are `no-console`, 7 are `react-hooks/exhaustive-deps`, 7 are `@next/next/no-img-element`. See audit below. |
| **4 XSS-vulnerable files** | `dangerouslySetInnerHTML` without DOMPurify sanitization in WidgetRenderer.tsx, proposals/builder/page.tsx, email-templates/page.tsx, email-builder/page.tsx |
| **CSP weakened** | `unsafe-inline` and `unsafe-eval` in CSP headers (`src/lib/middleware/security-headers.ts`, `src/lib/security/security-middleware.ts`) |
| **CORS open** | `/api/chat/public/route.ts` reflects ANY origin instead of whitelisting |
| **CSRF not enforced** | Functions `generateCSRFToken()` / `validateCSRFToken()` exist in security-middleware.ts but are never called |
| **132+ type laundering casts** | `as unknown as` used heavily. ~70% legitimate (Firebase type bridge), ~30% workarounds (especially e-commerce services — 8 repeated casts in checkout-service.ts) |
| **20+ files use `Function` type** | Should use specific function signatures instead of the broad `Function` type |
| 3 service tests failing | Missing Firestore composite indexes (status+createdAt, stage+createdAt on `records` and `workflows`). Fix: `firebase login --reauth` then `firebase deploy --only firestore:indexes` |
| Firebase CLI credentials expired | Run `firebase login --reauth` to re-authenticate before deploying indexes |
| Outbound webhooks are scaffolding | Settings UI exists with event list but backend dispatch system is not implemented |

---

## Code Integrity Hardening Plan (February 2026 Audit)

### Audit Summary (February 8, 2026)

A full read-only audit was performed covering ESLint config, TypeScript config, Husky hooks, inline suppressions, type workarounds, and security posture.

**Configuration integrity: A (Excellent)** — ESLint rules, TypeScript strict mode, pre-commit hooks, and lint-staged are all properly configured and have NOT been tampered with. No `.eslintrc` overrides, no `.eslintignore` bypass files.

**Inline bypass abuse: C** — 113 `eslint-disable` comments act as escape hatches. Zero `@ts-ignore`, zero `@ts-nocheck`, only 2 `@ts-expect-error` (in jest.setup.js — acceptable).

**Type safety: B+** — Zero `any` types, zero `as any`, zero `Record<string, any>`. But 132+ `as unknown as` casts and 20+ files using broad `Function` type.

**Security: C+** — 4 unsanitized `dangerouslySetInnerHTML` (XSS risk), weak CSP, open CORS on one endpoint, CSRF functions defined but never enforced.

### Worst Offender Files

| File | Bypass Count | Issues |
|------|-------------|--------|
| `src/app/(dashboard)/settings/ai-agents/training/page.tsx` | 19 | `no-alert` (16), `react-hooks/exhaustive-deps` (1), others |
| `src/app/(dashboard)/settings/api-keys/page.tsx` | 7 | `no-alert` |
| `src/components/orchestrator/AdminOrchestrator.tsx` | 5 | `no-console` (debug logs in production) |
| `src/components/website-builder/WidgetRenderer.tsx` | 3 | `@next/next/no-img-element` + unsanitized HTML |
| `src/lib/vercel-domains.ts` | 3 | `no-console` |
| `src/lib/ecommerce/checkout-service.ts` | 8 casts | `as unknown as EcommerceConfig` repeated 8 times |

### Phase 1: Security Fixes (P0)

**1A. Create `<SafeHtml>` component with DOMPurify**
- Install `dompurify` and `@types/dompurify`
- Create `src/components/SafeHtml.tsx` — thin wrapper with configurable presets (`strict`, `email`, `rich-text`)
- Fix these 4 files:
  - `src/components/website-builder/WidgetRenderer.tsx` (line 414)
  - `src/app/(dashboard)/proposals/builder/page.tsx` (line 249)
  - `src/app/(dashboard)/settings/email-templates/page.tsx` (line 1042)
  - `src/app/(dashboard)/marketing/email-builder/page.tsx` (line 397)

**1B. Fix CSP headers — implement nonce-based CSP**
- Remove `unsafe-inline` and `unsafe-eval` from CSP directives
- Use Next.js 13+ native nonce support via middleware
- Files to modify:
  - `src/lib/middleware/security-headers.ts` (line 35)
  - `src/lib/security/security-middleware.ts` (line 275)

**1C. Fix CORS on public chat endpoint**
- `src/app/api/chat/public/route.ts` (lines 268-279)
- Stop reflecting arbitrary origins — use the existing `addCORSHeaders()` function from `security-headers.ts` which properly whitelists origins

### Phase 2: UI Best Practices (P1)

**2A. Create `useConfirm()` hook + `ConfirmDialog` component**
- Build a promise-based confirmation dialog: `const confirmed = await confirm("Delete this?")`
- Use shadcn/ui Dialog or build a minimal accessible modal
- This replaces all 47 `window.alert()` / `window.confirm()` calls
- Start with the worst offender: `settings/ai-agents/training/page.tsx` (16 alert suppressions)
- Then migrate remaining admin pages incrementally

**2B. Remove production console.log statements**
- Replace ~10 production `console.log` calls with the existing logger service at `src/lib/logger/logger.ts`
- Priority files: `AdminOrchestrator.tsx` (lines 129, 209, 211, 251), `risk/page.tsx` (lines 108, 111)
- `src/lib/utils/orphaned-files-report.ts` is a CLI tool — file-level disable is acceptable there

### Phase 3: Type Safety (P1)

**3A. Fix e-commerce type laundering**
- The 8 repeated `as unknown as EcommerceConfig` casts in `checkout-service.ts` and `cart-service.ts` indicate a type mismatch at the Firestore read boundary
- Solution: Create Zod schemas for `EcommerceConfig` and parse at the Firestore read layer — return typed data so downstream code never needs to cast
- This eliminates ~10 casts in one fix

**3B. Replace `Function` type with specific signatures**
- 20+ files use the broad `Function` type
- Replace with proper function signatures like `(...args: unknown[]) => unknown` or specific callback types
- Key files: `plugin-manager.ts`, `workflow-engine.ts`, `function-calling.ts`, `types/workflow.ts`, `types/ai-models.ts`

**3C. Do NOT eliminate all `as unknown as` casts**
- ~70% are legitimate Firebase admin-to-client type bridging (`db as unknown as Firestore`, `Timestamp` conversions)
- These are unfixable without rewriting Firebase's type system
- Focus only on the ~40 that represent actual data boundary crossings

### Phase 4: Hook & Image Cleanup (P2)

**4A. Fix `react-hooks/exhaustive-deps` suppressions (7 instances)**
- Add missing dependencies or stabilize functions with `useCallback`/`useMemo`
- Files: `VersionHistory.tsx`, `leads/[id]/page.tsx`, `voice/training/page.tsx`, `templates/page.tsx`, `leaderboard/page.tsx`, `performance/page.tsx`

**4B. Migrate `<img>` to Next.js `<Image>` (7 instances)**
- For dynamic CMS content: use `<Image>` with `unoptimized` prop if needed
- For blob URLs (email templates): use custom image loader
- Files: `WidgetRenderer.tsx`, `ResponsiveRenderer.tsx`, `OptimizedImage.tsx`, `MobileNavigation.tsx`, `PageRenderer.tsx`, `PublicLayout.tsx`

### Phase 5: Lock It Down (after fixes are done)

**5A. Add bypass ratchet to pre-commit hook**
- Create `.eslint-bypass-budget.json` tracking current eslint-disable count per rule
- Pre-commit hook checks that count only goes DOWN, never UP
- This prevents new bypasses from being introduced while allowing incremental cleanup

**5B. Implement CSRF protection**
- Wire up the existing `generateCSRFToken()` / `validateCSRFToken()` functions in `security-middleware.ts`
- Apply to all state-changing API routes (POST, PUT, DELETE)

### Rules for This Work

1. **Do NOT weaken any ESLint rules, TypeScript config, or pre-commit hooks** — fix the code, not the rules
2. **Do NOT add new `eslint-disable` comments** — every fix must REMOVE suppressions, never add them
3. **Do NOT over-engineer** — each fix should be the minimum viable solution (e.g., `SafeHtml` is a thin wrapper, not a framework)
4. **Do NOT rewrite entire files** — surgical fixes only, targeting specific bypasses
5. **Test after each phase** — `npm run lint`, `npx tsc --noEmit`, `npm run build` must all pass
6. **Commit after each phase** — don't batch all fixes into one giant commit

---

## Launch Sequence (Priority Order)

| Step | Task | Time Est. | Why |
|------|------|-----------|-----|
| ~~**0**~~ | ~~Remove unused imports~~ | ~~30 min~~ | **DONE** — 135 errors removed, lint passes clean. |
| ~~**2**~~ | ~~MemoryVault Firestore persistence~~ | ~~3-4 hrs~~ | **DONE** — commit e388c151. |
| ~~**3**~~ | ~~ConversationMemory service~~ | ~~6-8 hrs~~ | **DONE** — commit b1c50e8f. |
| **1** | **Code Integrity Hardening Phase 1** | 3-4 hrs | Security fixes: `SafeHtml` + DOMPurify (4 XSS files), CSP nonces, CORS whitelist. See plan above. |
| **2** | **Code Integrity Hardening Phase 2** | 4-6 hrs | UI best practices: `useConfirm()` hook replaces 47 `alert()` calls. Console.log cleanup. |
| **3** | **Code Integrity Hardening Phase 3** | 3-4 hrs | Type safety: Zod schemas for e-commerce boundary, `Function` type replacements. |
| **4** | **Code Integrity Hardening Phase 4** | 2-3 hrs | Hook deps fixes, `<img>` → `<Image>` migration. |
| **5** | **Code Integrity Hardening Phase 5** | 1-2 hrs | Pre-commit ratchet + CSRF enforcement. Lock down so bypasses can never increase. |
| **6** | Deploy Firestore indexes | 15 min | `firebase deploy --only firestore:indexes`. Fixes 3 failing service tests. |
| **7** | **Production deploy to Vercel** | 2-3 hrs | 7 cron jobs already defined in `vercel.json`. OAuth flows, webhooks, Stripe — none work until deployed with real env vars. |
| **8** | Smoke test the OODA loop | 2-3 hrs | Feed a real lead through the system. Verify event router fires, Revenue Director picks it up, sequence engine enrolls. |
| **9** | Fix what breaks | Variable | Something will break in production. Budget time for env var issues, cold start timing, external API rate limits. |
| **10** | Wire up outbound webhook dispatch | 3-4 hrs | Settings page exists, event list is there, UI is built — backend just doesn't send webhooks. |

### Step 3 — ConversationMemory Service (Detailed Spec)

**Problem:** Agents have amnesia about customer interactions. Chat sessions, SMS messages, and orchestrator conversations are stored in Firestore but no agent can query them. Voice call transcripts (the richest data) are lost entirely when calls end — stored in-memory only. When an agent prepares to contact a lead, it has zero context about prior conversations across any channel.

**Solution:** A dedicated ConversationMemory service (Option B architecture) — one service owns all conversation data, agents query it when they need customer context. MemoryVault stays focused on agent-to-agent coordination.

**Architecture Decision:** Option B was chosen over a hybrid approach (Option C) because:
- No data duplication — conversation data lives in one place, not mirrored in MemoryVault
- No sync issues — no risk of MemoryVault copies going stale
- Clean separation — MemoryVault = agent coordination, ConversationMemory = customer interaction history
- Agents simply query ConversationMemory as part of their lead preparation workflow

**Data Flow:**
```
Call/Chat/SMS ends
       │
       ▼
┌─────────────────────┐
│  Persist full record │  ← Transcript + metadata → Firestore
│  to Firestore        │     (voice is the gap — chat/SMS/orchestrator already stored)
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Conversation Analysis runs  │  ← Engine already exists at src/lib/conversation/
│  automatically after each    │     Sentiment, objections, buying signals, coaching
│  interaction completes       │     Currently manual-only via POST /api/conversation/analyze
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Analysis stored alongside   │  ← Summary, key moments, objections, next steps
│  conversation record         │     Persisted for agent retrieval
└─────────────────────────────┘

Agent preparing to contact Lead X:
       │
       ▼
┌──────────────────────────────┐
│  ConversationMemory.brief()  │  ← Query all interactions by leadId
│                              │     across chat, voice, SMS, email
│  Returns structured Lead     │     Last N interactions summarized
│  Briefing (not raw           │     Sentiment trend, open objections,
│  transcripts)                │     recommended approach
└──────────────────────────────┘
```

**Lead Briefing Output (what agents receive):**
```
Lead: John Smith, Acme Corp
Last contact: 2 days ago (voice call, 12 min)
Total interactions: 4 (2 calls, 1 chat, 1 email reply)
Sentiment trend: neutral → positive (improving)

Key context:
- Budget review in March, decision after that
- Pain point: manual compliance reporting 20hrs/week
- Compared us to CompetitorX, said pricing was lower
- Asked about Salesforce API integration

Open objections:
- Price concern (medium severity, unresolved)
- Integration timeline worry

Recommended approach:
- Lead with ROI calculation (20hrs/week saved)
- Address Salesforce integration early
- Don't push for close before March budget review
```

**5 Implementation Sub-Tasks:**

| # | Task | Details |
|---|------|---------|
| 3a | **Voice transcript persistence** | Save call data (transcript, turns, sentiment, qualification score, buying signals) to Firestore `conversations` collection when voice calls end. Currently in-memory only in `src/lib/voice/ai-conversation-service.ts`. |
| 3b | **Auto-analysis trigger** | Hook the conversation analysis engine (`src/lib/conversation/conversation-engine.ts`) to fire automatically after every call/chat completion. Currently only runs on manual API call to `POST /api/conversation/analyze`. |
| 3c | **ConversationMemory service** | New service at `src/lib/conversation/conversation-memory.ts`. Unified retrieval layer that queries across `chatSessions`, `conversations`, `smsMessages`, `orchestratorConversations` by leadId/customerId. Returns structured data, not raw transcripts. |
| 3d | **Lead Briefing generator** | Method on ConversationMemory that synthesizes all recent interactions into a concise context block. Uses the analysis data (sentiment, objections, buying signals, next steps) to build the briefing. May use LLM for final synthesis. |
| 3e | **Agent integration** | Update agent work cycles (Revenue Manager, Outreach Manager, Voice AI) to call `ConversationMemory.brief(leadId)` before acting on a lead. Add to the standard lead preparation workflow. |

**Retention Policy:**
| Data | Retention | Rationale |
|------|-----------|-----------|
| Full transcripts | 90 days | Compliance and dispute resolution |
| Conversation summaries | 1 year | Agents need history without storage cost |
| Lead briefings | Generated on demand | Always fresh, built from summaries |
| Analysis results | 1 year (alongside summaries) | Sentiment trends, objection history |

**Existing Infrastructure to Leverage:**
- `src/lib/conversation/conversation-engine.ts` — Full analysis engine (sentiment, talk ratio, objections, coaching, competitor mentions). Already built, just needs auto-triggering.
- `src/lib/conversation/types.ts` — Comprehensive types for Conversation, ConversationAnalysis, SentimentAnalysis, ObjectionAnalysis, etc.
- `src/lib/agent/chat-session-service.ts` — Chat message storage and retrieval already working.
- `src/lib/firebase/collections.ts` — All Firestore collection paths already defined.
- `src/app/api/conversation/analyze/route.ts` — Analysis API with rate limiting and caching.

**What This Does NOT Include:**
- Semantic/vector search (embedding-based retrieval) — future enhancement, not needed for v1
- Email body archival (only metadata stored today) — separate effort
- Video conversation transcripts — not yet implemented
- Long-term learning/agent improvement from conversations — future episodic memory layer

---

### What We Are NOT Building Right Now
- **No plugin/hook registry** — the internal infrastructure (EventRouter, SignalBus, MemoryVault, PluginManager) is powerful but intentionally closed. No external API surface for third-party tools.
- **No external agent registration API** — the 52-agent swarm is a closed system
- **No public REST API / OpenAPI spec** — all 219 endpoints are internal dashboard routes
- **No "WordPress extensibility"** — deferred until post-launch

### External Integration Capabilities (What Works Today)

**Outbound (SalesVelocity calls external APIs) — WORKS:**
- OAuth integrations: Gmail, Outlook, Slack, Teams, QuickBooks, Xero, Stripe, PayPal
- API key storage for: SendGrid, Twilio, Clearbit, HubSpot, OpenRouter
- Workflow HTTP action: full HTTP requests (GET/POST/PUT/PATCH/DELETE) with auth, headers, response parsing

**Inbound (External systems call SalesVelocity) — LIMITED:**
- `POST /api/workflows/webhooks/{workflowId}` — generic webhook trigger with optional HMAC verification (the ONE viable two-way integration path)
- `GET/POST /api/public/forms/{formId}` — public form fetch + submission (no auth required)
- 6 service-specific webhooks: Stripe, SendGrid, SendGrid Inbound, Twilio SMS, Twilio Voice, Gmail

**Not Exposed Externally:**
- EventRouter (no HTTP endpoint for emit/subscribe)
- SignalBus (purely in-memory, no HTTP wrapper)
- MemoryVault (no REST API)
- PluginManager (code exists at `src/lib/plugins/plugin-manager.ts` with full registration, tool schemas, rate limiting, OpenAI function format — but zero API routes wrap it)
- Agent swarm (closed, no external agent registration)
- Outbound webhook dispatch (UI scaffolding only, no backend)

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |
| `src/lib/orchestration/event-router.ts` | Declarative rules engine — 25+ event rules → Manager actions via SignalBus |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication (BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN) |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge store (Firestore-backed, cold-start safe) |
| `src/lib/conversation/conversation-engine.ts` | Conversation analysis engine (sentiment, objections, coaching) |
| `src/lib/conversation/types.ts` | Comprehensive conversation/analysis type definitions |
| `src/lib/agent/chat-session-service.ts` | Chat session + message storage/retrieval |
| `src/lib/conversation/conversation-memory.ts` | ConversationMemory service — unified retrieval + Lead Briefing generator |
| `src/lib/voice/ai-conversation-service.ts` | Voice AI conversation handling (transcripts now persisted to Firestore) |
| `src/lib/plugins/plugin-manager.ts` | Plugin registration system (built but not exposed via API) |
| `src/lib/orchestrator/jasper-command-authority.ts` | Executive briefings, approval gateway, command issuance |
| `src/lib/agents/base-manager.ts` | BaseManager with reviewOutput(), applyPendingMutations(), requestFromManager() |
| `src/lib/workflows/actions/http-action.ts` | Workflow HTTP action — calls external APIs with full auth support |
| `vercel.json` | 7 cron entries for autonomous operations |
| `firestore.indexes.json` | Composite indexes (defined but NOT deployed) |

### Autonomous Operations — Key Files

| File | Phase | What It Does |
|------|-------|-------------|
| `src/lib/orchestrator/event-router.ts` | 1a | Rules engine — 25+ event rules mapping business events → Manager actions |
| `src/app/api/cron/operations-cycle/route.ts` | 1b | 3-tier cron: 4h operational, 24h strategic, weekly executive |
| `src/lib/agents/revenue/manager.ts` | 3 | Auto-progression, intelligence-to-outreach bridge, win/loss feedback |
| `src/lib/agents/outreach/manager.ts` | 4 | Reply → action chains, adaptive timing, ghosting recovery |
| `src/lib/outbound/sequence-engine.ts` | 4b | Engagement-based adaptive timing |
| `src/lib/agents/content/manager.ts` | 5a, 7 | Production hub with priority queue + contextual artifact generation |
| `src/lib/agents/intelligence/manager.ts` | 5b | Daily parallel sweeps |
| `src/lib/agents/builder/manager.ts` | 6a | Analytics-driven page optimization |
| `src/lib/agents/commerce/manager.ts` | 6b | Cart abandonment recovery, loyalty tiers |
| `src/lib/orchestrator/jasper-command-authority.ts` | 8 | Jasper command authority |

### Post-Phase 8 — Key Files

| File | What It Does |
|------|-------------|
| `vercel.json` | 7 cron entries for all autonomous crons |
| `src/app/api/orchestrator/executive-briefing/route.ts` | GET — generates executive briefing |
| `src/app/api/orchestrator/approvals/route.ts` | GET/POST — pending approvals + decisions |
| `src/app/api/orchestrator/command/route.ts` | GET/POST — issue commands, overrides, objectives |
| `src/app/(dashboard)/executive-briefing/page.tsx` | Executive briefing dashboard |

---

## Test Infrastructure

| File | Purpose |
|------|---------|
| `jest.setup.js` | Connects to REAL Firebase DEV database via Admin SDK (by design) |
| `jest.globalTeardown.js` | Post-test cleanup — calls db-manager.js, throws on failure |
| `scripts/db-manager.js` | Test data cleanup — hybrid detection (flags + patterns + known IDs) |
| `tests/helpers/test-cleanup.ts` | TestCleanupTracker class for integration tests |
| `tests/helpers/e2e-cleanup-utility.ts` | E2ECleanupTracker for E2E tests (E2E_TEMP_ prefix) |

## Documentation Inventory

**Root docs** (5 files): CLAUDE.md, README.md, ENGINEERING_STANDARDS.md, COMPETITIVE_ANALYSIS_BRIEFING.md, SOCIAL-MEDIA-AI-SPEC.md
**docs/** (3 files): single_source_of_truth.md, playwright-audit-2026-01-30.md, test-results-summary.md
**docs/master_library/** (16 files): Per-feature audit summaries from Feb 5, 2026
**docs/archive/** (16 files): Historical records — do not reference for architectural decisions
**.claude/agents/** (6 files): QA and architecture agent prompts
