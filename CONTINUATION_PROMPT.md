# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: `155a1032` — "fix: resolve all tests/lib/ failures with full lint compliance"

## Current State (February 7, 2026)

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **158 physical routes**, **219 API endpoints**, **433K+ lines of TypeScript**
- **NOT yet deployed to production** — everything is dev branch only

### Code Health
- `tsc --noEmit` — PASSES (zero errors)
- `npm run lint` — PASSES (zero warnings)
- `npm run build` — PASSES (production build succeeds)
- **510 `tests/lib/` tests** — ALL PASS (19/19 suites)
- **126 safe unit tests** — ALL PASS (event-router 49, jasper-command-authority 21, mutation-engine 9, analytics-helpers 47)
- **92 root-level tests** — ALL PASS
- **3 service tests failing** — infrastructure issue only (missing Firestore composite indexes, not code bugs)

### What's Complete
- Single-tenant conversion (-71K lines, -185 files)
- SalesVelocity.ai rebrand + CSS variable theme system
- Agent hierarchy with full manager orchestration
- 4-role RBAC with API gating and sidebar filtering
- Stabilization Roadmap (all 15 tasks across 3 tiers)
- Social Media Growth Engine (Phases 1-6)
- **Autonomous Business Operations (ALL 8 PHASES)** — Event Router, Operations Cycle Cron, Event Emitters, Manager Authority, Revenue Pipeline Automation, Outreach Autonomy, Content Production Hub, Intelligence Always-On, Builder/Commerce Reactive Loops, Contextual Artifact Generation, Jasper Command Authority
- Post-Phase 8 Stabilization — integration tests, production cron scheduling, executive briefing dashboard
- Database Hygiene Verification — 72 test files audited, production DB protected
- Test Cleanup Hardening — all tests/lib/ suites fixed, jest teardown hardened

### Known Issues
| Issue | Details |
|-------|---------|
| 3 service tests failing | Missing Firestore composite indexes (status+createdAt, stage+createdAt on `records` and `workflows`). Indexes defined in `firestore.indexes.json` but not deployed. Fix: `firebase deploy --only firestore:indexes` |
| MemoryVault is in-memory only | Agents lose all knowledge on server restart / Vercel cold start. Async method stubs already exist for Firestore persistence — needs wiring |
| Outbound webhooks are scaffolding | Settings UI exists with event list but backend dispatch system is not implemented |

---

## Launch Sequence (Priority Order)

| Step | Task | Time Est. | Why |
|------|------|-----------|-----|
| **1** | Deploy Firestore indexes | 15 min | `firebase deploy --only firestore:indexes`. Fixes 3 failing service tests. Unlocks composite queries that managers need. |
| **2** | MemoryVault Firestore persistence | 3-4 hrs | Without this, every Vercel cold start wipes agent memory. Async stubs already in `memory-vault.ts`. Straight Firestore read/write — no hooks, no plugin system. |
| **3** | Production deploy to Vercel | 2-3 hrs | 7 cron jobs already defined in `vercel.json`. OAuth flows, webhooks, Stripe — none work until deployed with real env vars. |
| **4** | Smoke test the OODA loop | 2-3 hrs | Feed a real lead through the system. Verify event router fires, Revenue Director picks it up, sequence engine enrolls. First real end-to-end validation. |
| **5** | Fix what breaks | Variable | Something will break in production. Budget time for env var issues, cold start timing, external API rate limits. |
| **6** | Wire up outbound webhook dispatch | 3-4 hrs | Settings page exists, event list is there, UI is built — backend just doesn't send webhooks. Makes platform useful for basic automation. |

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
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge store (in-memory, needs Firestore persistence) |
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
