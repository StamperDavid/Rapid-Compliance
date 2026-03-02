# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: March 2, 2026 (Unified Agent Training & Performance Intelligence — Phase 1)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **169 physical routes**, **299 API endpoints**, **~330K LOC**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Zero `@ts-ignore`, zero `any` violations, 16 justified `eslint-disable` comments

---

## Active Project: Unified Agent Training & Performance Intelligence System

### What This Is
A unified system connecting Golden Masters (all 5 agent types), production performance monitoring, coaching-to-training pipelines, and swarm specialist improvement loops. The platform has 52 AI agents but only 2 Golden Masters (Jasper + Alex). This project gives every customer-facing agent type its own Golden Master, adds automated production monitoring that flags poor performance, and creates improvement pipelines for internal swarm specialists.

### Phase Status

| Phase | Description | Status | Key Deliverables |
|-------|-------------|--------|-----------------|
| **1** | Foundation — Data Models & Infrastructure | **IN PROGRESS** | Types, Zod schemas, performance tracker, agent-type configs |
| **2** | Unified Golden Master System | PLANNED | GM factory, playbook bridge, training lab UI, migration |
| **3** | Production Performance Monitoring Pipeline | PLANNED | Agent rep profiles, auto-flag service, coaching-training bridge |
| **4** | Swarm Agent Performance Tracking | PLANNED | Specialist metrics, improvement generator/applier, dashboard |
| **5** | Integration, Wiring & Polish | PLANNED | Signal bus, unified coaching page, review queue, migration |

### Phase 1 Progress (Current Session)
- [x] **1.1** Extended core types — `agentType` on `GoldenMaster` + `BaseModel` in `agent-memory.ts`; expanded `AgentDomain` to include `'seo'`; added `AgentPerformanceEntry`, `AgentPerformanceAggregation`, `SpecialistImprovementRequest`, `ProposedSpecialistChange`, `AgentTypeTrainingConfig` and sub-types in `training.ts`
- [x] **1.2** Extended swarm review infrastructure — `qualityScore` on `ReviewResult` in `base-manager.ts`; `qualityScore` on `AgentReport` in `types.ts`
- [ ] **1.3** Performance tracker service — `src/lib/agents/shared/performance-tracker.ts`
- [ ] **1.4** Agent-type training config registry — `src/lib/training/agent-type-configs.ts`
- [ ] **1.5** Zod validation schemas — `src/lib/training/agent-training-validation.ts`
- [ ] **Verification** — `tsc --noEmit`, `npm run lint`, `npm run build`

---

## Full Plan Reference

The complete 5-phase plan is documented in the conversation transcript at:
`C:\Users\David\.claude\projects\D--Future-Rapid-Compliance\35f563ae-ef64-4319-9e92-4dc3a00b41e8.jsonl`

### Files Summary

**New Files (Phase 1-5):**
- `src/lib/training/agent-type-configs.ts` — Per-agent-type scoring criteria
- `src/lib/training/agent-training-validation.ts` — Zod schemas for new types
- `src/lib/agents/shared/performance-tracker.ts` — Write/query agent performance entries
- `src/lib/training/golden-master-factory.ts` — Create initial GMs per agent type (Phase 2)
- `src/lib/training/playbook-bridge.ts` — Bridge GoldenPlaybook → GM pipeline (Phase 2)
- `src/app/api/training/agent-types/route.ts` — GET agent type configs (Phase 2)
- `src/app/api/training/golden-masters/route.ts` — GET/POST GMs by agent type (Phase 2)
- `scripts/migrate-agent-training-configs.ts` — One-time data migration (Phase 2)
- `src/lib/agents/agent-rep-profiles.ts` — Synthetic rep profiles for AI agents (Phase 3)
- `src/lib/training/production-monitor.ts` — Generalized production analysis trigger (Phase 3)
- `src/lib/training/auto-flag-service.ts` — Auto-flag sessions below threshold (Phase 3)
- `src/lib/training/coaching-training-bridge.ts` — Map coaching insights → training signals (Phase 3)
- `src/app/api/agent-performance/analyze/route.ts` — Trigger agent performance analysis (Phase 3)
- `src/app/api/agent-performance/[agentId]/route.ts` — Get agent performance data (Phase 3)
- `src/app/api/agent-performance/flagged-sessions/route.ts` — List flagged sessions (Phase 3)
- `src/lib/agents/shared/specialist-metrics.ts` — Query/aggregate specialist metrics (Phase 4)
- `src/lib/agents/shared/specialist-improvement-generator.ts` — Generate improvement requests (Phase 4)
- `src/lib/agents/shared/specialist-improvement-applier.ts` — Review/apply improvements (Phase 4)
- `src/app/api/swarm/performance/route.ts` — Swarm performance dashboard API (Phase 4)
- `src/app/api/swarm/performance/[specialistId]/route.ts` — Single specialist API (Phase 4)
- `src/app/api/swarm/improvement-requests/route.ts` — List/create improvement requests (Phase 4)
- `src/app/api/swarm/improvement-requests/[requestId]/route.ts` — Review/apply requests (Phase 4)
- `src/app/(dashboard)/workforce/performance/page.tsx` — Swarm performance dashboard UI (Phase 4)
- `scripts/migrate-unified-training.ts` — Full migration script (Phase 5)

**Modified Files:**
- `src/types/agent-memory.ts` — `agentType` on `GoldenMaster` and `BaseModel`
- `src/types/training.ts` — Expanded `AgentDomain`, new interfaces
- `src/lib/agents/base-manager.ts` — `qualityScore` on `ReviewResult`, instrument `delegateWithReview`
- `src/lib/agents/types.ts` — `qualityScore` on `AgentReport`
- `src/lib/agent/golden-master-builder.ts` — Accept/propagate `agentType` (Phase 2)
- `src/lib/agent/instance-manager.ts` — Remove inline cast (Phase 2)
- `src/lib/training/golden-master-updater.ts` — Propagate `agentType` (Phase 2)
- `src/lib/training/feedback-processor.ts` — Add SEO domain (Phase 2)
- `src/app/(dashboard)/settings/ai-agents/training/page.tsx` — Agent type selector (Phase 2, 5)
- `src/lib/agent/chat-session-service.ts` — Replace `triggerChatAnalysis` (Phase 3)
- `src/lib/coaching/coaching-analytics-engine.ts` — `analyzeAgentPerformance` (Phase 3)
- `src/lib/coaching/coaching-generator.ts` — Agent-aware insights (Phase 3)
- `src/lib/coaching/types.ts` — `isAI` on `RepPerformanceMetrics` (Phase 3)
- `src/lib/coaching/events.ts` — Wire to SignalCoordinator (Phase 3)
- `src/app/(dashboard)/coaching/page.tsx` — Human/AI toggle (Phase 5)

---

## Key Design Decisions
1. **Agent IDs prefixed `agent_`** — avoids collision with human user IDs
2. **Synthetic user docs** — created alongside `AgentRepProfile` so coaching engine works
3. **Human review gate preserved everywhere** — GM updates and specialist improvements always `pending_review`
4. **GoldenPlaybook not deleted** — bridged into GM pipeline
5. **MemoryVault + Firestore dual-write** — MemoryVault for fast agent state, Firestore for durable querying
6. **90-day TTL on performance entries** — prevents unbounded growth
7. **Signal bus for cross-module communication** — coaching → training via events

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/types/training.ts` | Training system types (expanded with performance tracking) |
| `src/types/agent-memory.ts` | Agent memory + Golden Master types |
| `src/lib/agents/base-manager.ts` | Base manager class with quality gate |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent memory infrastructure |
| `src/lib/coaching/coaching-analytics-engine.ts` | Coaching analytics engine |
| `src/lib/training/feedback-processor.ts` | Training feedback processor |

---

## Known Issues & Technical Debt

| Issue | Severity | Details |
|-------|----------|---------|
| **Placeholder tests** | HIGH | 115 `expect(true).toBe(true)` across 11 files |
| **Skipped tests** | MEDIUM | 52 `it.skip` (31 need Firestore emulator, 16 obsolete) |
| **Zod validation gaps** | MEDIUM | ~49% of API routes have Zod schemas |
| **Facebook/Instagram** | BLOCKED | Requires Meta Developer Portal approval |
| **LinkedIn** | BLOCKED | Unofficial RapidAPI wrapper — needs Marketing Developer Platform approval |
| **Stripe live keys** | BLOCKED | Test mode only — bank account setup required |
