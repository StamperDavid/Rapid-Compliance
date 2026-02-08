# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: e388c151 — "feat: wire MemoryVault Firestore persistence — agents survive cold starts"

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

### Immediate Next Task
**Deploy Firestore indexes** — `firebase deploy --only firestore:indexes`. Fixes 3 failing service tests. Then proceed to ConversationMemory service.

### Known Issues
| Issue | Details |
|-------|---------|
| 3 service tests failing | Missing Firestore composite indexes (status+createdAt, stage+createdAt on `records` and `workflows`). Fix: `firebase deploy --only firestore:indexes` |
| Agents have no conversation recall | Chat sessions, SMS, and orchestrator conversations are stored in Firestore but agents cannot query them. Voice call transcripts are lost when calls end (in-memory only). No unified retrieval layer exists for agents to get context on past customer interactions. See Step 3 below. |
| Outbound webhooks are scaffolding | Settings UI exists with event list but backend dispatch system is not implemented |

---

## Launch Sequence (Priority Order)

| Step | Task | Time Est. | Why |
|------|------|-----------|-----|
| ~~**0**~~ | ~~Remove unused imports~~ | ~~30 min~~ | **DONE** — 135 errors removed, lint passes clean. |
| **1** | Deploy Firestore indexes | 15 min | `firebase deploy --only firestore:indexes`. Fixes 3 failing service tests. |
| ~~**2**~~ | ~~MemoryVault Firestore persistence~~ | ~~3-4 hrs~~ | **DONE** — commit e388c151. Agents survive cold starts. read()/query() await hydration. TTL cleanup on 4h cron. |
| **3** | **ConversationMemory service** | 6-8 hrs | Agents cannot recall past customer interactions. See detailed spec below. |
| **4** | Production deploy to Vercel | 2-3 hrs | 7 cron jobs already defined in `vercel.json`. OAuth flows, webhooks, Stripe — none work until deployed with real env vars. |
| **5** | Smoke test the OODA loop | 2-3 hrs | Feed a real lead through the system. Verify event router fires, Revenue Director picks it up, sequence engine enrolls. |
| **6** | Fix what breaks | Variable | Something will break in production. Budget time for env var issues, cold start timing, external API rate limits. |
| **7** | Wire up outbound webhook dispatch | 3-4 hrs | Settings page exists, event list is there, UI is built — backend just doesn't send webhooks. |

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
| `src/lib/voice/ai-conversation-service.ts` | Voice AI conversation handling (transcripts NOT persisted — Step 3a) |
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
