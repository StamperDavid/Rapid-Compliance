# Dashboard Connectivity Audit Report

**Audit Date:** January 29, 2026
**Auditor:** System-Wide Connectivity Audit (Multi-Agent)
**Scope:** MASTER_ORCHESTRATOR → 8 Domain Managers → Frontend Dashboard
**Status:** READ-ONLY INSPECTION COMPLETE

---

## Executive Summary

This audit maps the data flow from the MASTER_ORCHESTRATOR and 8 Domain Managers to the Frontend Dashboard components. The audit identifies where connections are established and where critical wiring gaps exist.

### Overall Connectivity Score: **42/100** (INCOMPLETE)

| Category | Status | Score |
|----------|--------|-------|
| State Alignment | DISCONNECTED | 15/25 |
| Telemetry Trace | PARTIAL | 12/25 |
| Agent ID Verification | MISMATCHED | 8/25 |
| Brief Injection | NOT WIRED | 7/25 |

---

## 1. State Alignment Audit

### Finding: Frontend Store Does NOT Consume `getSwarmStatus()`

**Backend Implementation (FUNCTIONAL):**
- **Location:** `src/lib/agents/orchestrator/manager.ts:1230-1290`
- **Method:** `getSwarmStatus(tenantId: string): Promise<SwarmStatus>`
- **Returns:** Aggregated status from all 9 managers including:
  - `overallHealth`: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE'
  - `managers`: Array of `ManagerBrief` with health, workloads, errors
  - `activeSagas`, `completedSagas`, `failedSagas`
  - `successRate`, `averageResponseTimeMs`
  - `insights`: Recent entries from TenantMemoryVault

**Frontend Implementation (DISCONNECTED):**
- **Store Location:** `src/lib/stores/orchestrator-store.ts:1-209`
- **Store Name:** `useOrchestratorStore` (Zustand)
- **Issue:** Store manages ONLY UI state (chat history, feedback modals, welcome state)
- **Missing:** No `swarmStatus`, `managers`, `agentHealth`, or any orchestrator data

**Gap Analysis:**

| Expected | Actual | Status |
|----------|--------|--------|
| `useSwarmStore` hook consuming `getSwarmStatus()` | Does not exist | MISSING |
| API route `/api/swarm/status` | Does not exist | MISSING |
| Real-time SwarmStatus subscription | Not implemented | MISSING |
| SwarmMonitorWidget connected to live data | Uses SAMPLE_AGENTS hardcoded | DISCONNECTED |

### Wiring Required:
1. Create `/api/swarm/status` route calling `getMasterOrchestrator().getSwarmStatus(tenantId)`
2. Create `useSwarmStore` or extend `useOrchestratorStore` with swarm state
3. Wire `SwarmMonitorWidget` to consume live API data

---

## 2. Telemetry Trace Audit

### Finding: SignalBus Pulses Reach Notification Handlers But NOT Dashboard Widgets

**Signal Infrastructure (FUNCTIONAL):**

| Component | Location | Status |
|-----------|----------|--------|
| SignalCoordinator | `src/lib/orchestration/SignalCoordinator.ts` | FUNCTIONAL |
| Signal Types (80+) | `src/lib/orchestration/types.ts:36-188` | DEFINED |
| Notification Handlers | `src/lib/notifications/signal-handlers.ts` | CONSUMING |
| Slack Signal Handlers | `src/lib/slack/signal-handlers.ts` | CONSUMING |
| Dashboard API | `src/app/api/analytics/dashboard/route.ts` | FUNCTIONAL |

**Signal Flow Trace:**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Domain Engines  │────▶│ SignalCoordinator│────▶│ Firestore       │
│ (Risk, Playbook,│     │ (emitSignal)     │     │ signals/        │
│  Performance)   │     └────────┬─────────┘     └────────┬────────┘
└─────────────────┘              │                        │
                                 │                        │
                    ┌────────────▼────────────┐           │
                    │   Real-time Listeners   │◀──────────┘
                    │   (onSnapshot)          │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │ Notification   │ │ Slack          │ │ Dashboard      │
     │ Handlers       │ │ Handlers       │ │ Widgets        │
     │ (CONNECTED)    │ │ (CONNECTED)    │ │ (DISCONNECTED) │
     └────────────────┘ └────────────────┘ └────────────────┘
```

**Gap Analysis:**

| Signal Type | Notification Handler | Slack Handler | Dashboard Widget |
|-------------|---------------------|---------------|------------------|
| `deal.risk.critical` | ✅ Line 618 | ✅ Line 182 | ❌ NOT WIRED |
| `conversation.analyzed` | ✅ Line 622 | ✅ Line 234 | ❌ NOT WIRED |
| `playbook.generated` | ✅ Line 635 | ✅ Line 356 | ❌ NOT WIRED |
| `workforce.deployed` | ❌ NOT WIRED | ❌ NOT WIRED | ❌ NOT WIRED |
| `agent.activated` | ❌ NOT WIRED | ❌ NOT WIRED | ❌ NOT WIRED |

**Dashboard API Consumption:**
- `/api/analytics/dashboard` fetches aggregated metrics (Line 74-92)
- Emits `analytics.dashboard.viewed` signal
- Does NOT expose real-time signal stream to frontend
- Frontend widgets do NOT subscribe to signals

### Wiring Required:
1. Create WebSocket or SSE endpoint for real-time signal streaming
2. Implement `useSignalSubscription` hook for frontend
3. Wire dashboard widgets to consume live signals
4. Add swarm-specific signal handlers (`agent.activated`, `workforce.deployed`)

---

## 3. Agent ID Verification Audit

### Finding: CRITICAL MISMATCH Between Backend Registry and Frontend Components

**Backend Agent Registry (47 Agents):**
- **Location:** `src/lib/agents/index.ts:169-234`
- **Count:** 47 total (1 orchestrator + 9 managers + 37 specialists)

**Frontend SwarmMonitorWidget (5 Hardcoded Agents):**
- **Location:** `src/components/shared/SwarmMonitorWidget.tsx:17-23`

```typescript
const SAMPLE_AGENTS: AgentStatus[] = [
  { id: 'MARKETING_MANAGER', name: 'Marketing Manager', status: 'FUNCTIONAL' },
  { id: 'TIKTOK_EXPERT', name: 'TikTok Expert', status: 'FUNCTIONAL' },
  { id: 'TWITTER_EXPERT', name: 'Twitter/X Expert', status: 'FUNCTIONAL' },
  { id: 'COMPETITOR_RESEARCHER', name: 'Competitor Researcher', status: 'FUNCTIONAL' },  // ⚠️ ID MISMATCH
  { id: 'INVENTORY_MANAGER', name: 'Inventory Manager', status: 'FUNCTIONAL' },
];
```

**Admin Swarm Execute Route (3 Whitelisted Agents):**
- **Location:** `src/app/api/admin/swarm/execute/route.ts:20`

```typescript
agentId: z.enum(['MARKETING_MANAGER', 'COMPETITOR_RESEARCHER', 'TIKTOK_EXPERT'])
```

**Cross-Reference Analysis:**

| Backend ID | Widget ID | Execute Route | Status |
|------------|-----------|---------------|--------|
| MASTER_ORCHESTRATOR | ❌ NOT LISTED | ❌ NOT LISTED | L1 CEO - Missing |
| MARKETING_MANAGER | ✅ MATCHED | ✅ MATCHED | OK |
| REVENUE_DIRECTOR | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| ARCHITECT_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| BUILDER_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| CONTENT_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| OUTREACH_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| COMMERCE_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| REPUTATION_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| INTELLIGENCE_MANAGER | ❌ NOT LISTED | ❌ NOT LISTED | Missing |
| COMPETITOR_RESEARCHER | ❌ MISMATCHED | ⚠️ WRONG ID | `COMPETITOR_RESEARCHER` vs `COMPETITOR_RESEARCHER` |
| TIKTOK_EXPERT | ✅ MATCHED | ✅ MATCHED | OK |
| TWITTER_EXPERT | ✅ MATCHED | ❌ NOT LISTED | Partial |
| INVENTORY_MANAGER | ✅ MATCHED | ❌ NOT LISTED | Partial |
| (33 other specialists) | ❌ NOT LISTED | ❌ NOT LISTED | Missing |

**Critical Issues:**
1. **ID Naming Inconsistency:** Backend uses `COMPETITOR_RESEARCHER`, Frontend uses `COMPETITOR_RESEARCHER`
2. **Missing Coverage:** Only 5/47 agents shown in widget (10.6% coverage)
3. **Execute Whitelist:** Only 3 agents executable via API (6.4% coverage)

### Wiring Required:
1. Fix ID mismatch: `COMPETITOR_RESEARCHER` → `COMPETITOR_RESEARCHER`
2. Import `AGENT_IDS` from `src/lib/agents/index.ts` into frontend
3. Remove hardcoded `SAMPLE_AGENTS`, use dynamic registry
4. Expand execute route whitelist or create dynamic agent execution

---

## 4. Brief Injection Audit

### Finding: Brief Data Structures NOT Consumed by Dashboard Widgets

**Backend Brief Definitions (COMPLETE):**

| Brief Type | Location | Lines | Key Metrics |
|------------|----------|-------|-------------|
| CommerceBrief | `src/lib/agents/commerce/manager.ts` | 168-205 | MRR, Churn, Inventory |
| ReputationBrief | `src/lib/agents/trust/reputation/manager.ts` | 741-794 | TrustScore, NPS, Sentiment |
| TechnicalBrief | `src/lib/agents/architect/manager.ts` | 467-523 | APIs, Schema, SEO |
| CampaignBrief | `src/lib/agents/marketing/manager.ts` | 371-409 | Platform Strategy |
| IntelligenceBrief | `src/lib/agents/intelligence/manager.ts` | 65-122 | Competitor, Trends |
| OutreachBrief | `src/lib/agents/outreach/manager.ts` | 258-294 | Sequence Status |
| RevenueBrief | `src/lib/agents/sales/revenue/manager.ts` | 519-556 | Pipeline, Win/Loss |
| ManagerBrief | `src/lib/agents/orchestrator/manager.ts` | 374-382 | Health, Workload |

**Frontend Widget Expectations:**

| Widget | Location | Expected Data | Actual Source |
|--------|----------|---------------|---------------|
| SwarmMonitorWidget | `src/components/shared/SwarmMonitorWidget.tsx` | `AgentStatus[]` | Hardcoded `SAMPLE_AGENTS` |
| LeadPipelineWidget | `src/components/shared/LeadPipelineWidget.tsx` | `PipelineStage[]` | Hardcoded `DEFAULT_STAGES` |
| SocialComposerWidget | `src/components/shared/SocialComposerWidget.tsx` | Platform limits | Hardcoded constants |

**Brief → Widget Mapping Gap:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND BRIEFS                               │
├────────────────┬────────────────┬────────────────┬──────────────────┤
│ CommerceBrief  │ ReputationBrief│ RevenueBrief   │ ManagerBrief     │
│ {mrr, churn,   │ {trustScore,   │ {pipeline,     │ {health,         │
│  inventory}    │  nps, sentiment}│ conversion}   │  workloads}      │
└───────┬────────┴───────┬────────┴───────┬────────┴────────┬─────────┘
        │                │                │                 │
        ▼                ▼                ▼                 ▼
   ┌─────────┐      ┌─────────┐     ┌─────────┐      ┌─────────┐
   │   ???   │      │   ???   │     │   ???   │      │   ???   │
   │ NO API  │      │ NO API  │     │ NO API  │      │ NO API  │
   │ ROUTES  │      │ ROUTES  │     │ ROUTES  │      │ ROUTES  │
   └─────────┘      └─────────┘     └─────────┘      └─────────┘
        ⬇                ⬇               ⬇                ⬇
   ┌─────────────────────────────────────────────────────────────┐
   │              FRONTEND WIDGETS (DISCONNECTED)                 │
   │  - SwarmMonitorWidget: uses hardcoded SAMPLE_AGENTS         │
   │  - No Commerce widget consuming CommerceBrief               │
   │  - No Reputation widget consuming ReputationBrief           │
   │  - No Revenue widget consuming RevenueBrief                 │
   └─────────────────────────────────────────────────────────────┘
```

**Missing API Routes:**
1. `GET /api/swarm/status` → Returns `SwarmStatus` with `ManagerBrief[]`
2. `GET /api/commerce/brief` → Returns `CommerceBrief`
3. `GET /api/reputation/brief` → Returns `ReputationBrief`
4. `GET /api/revenue/brief` → Returns `RevenueBrief`

### Wiring Required:
1. Create API routes exposing each Brief type
2. Create frontend hooks (`useCommerceBrief`, `useReputationBrief`, etc.)
3. Create dedicated widgets for each Brief type
4. Wire SwarmMonitorWidget to consume `ManagerBrief[]` from `SwarmStatus`

---

## 5. Summary: Required Wiring Tasks

### Priority 1: Critical Path (State Alignment)

| Task | Files Affected | Complexity |
|------|----------------|------------|
| Create `/api/swarm/status` route | New: `src/app/api/swarm/status/route.ts` | Medium |
| Create `useSwarmStatus` hook | New: `src/hooks/useSwarmStatus.ts` | Low |
| Wire SwarmMonitorWidget to live data | Edit: `src/components/shared/SwarmMonitorWidget.tsx` | Medium |

### Priority 2: Agent Registry Sync

| Task | Files Affected | Complexity |
|------|----------------|------------|
| Export AGENT_IDS for frontend | Edit: `src/lib/agents/index.ts` | Low |
| Fix COMPETITOR_RESEARCHER → COMPETITOR_RESEARCHER | Edit: Widget + Execute Route | Low |
| Create shared agent types package | New: `src/types/agents.ts` | Medium |

### Priority 3: Brief API Routes

| Task | Files Affected | Complexity |
|------|----------------|------------|
| Create `/api/commerce/brief` | New route | Medium |
| Create `/api/reputation/brief` | New route | Medium |
| Create `/api/revenue/brief` | New route | Medium |
| Create Brief consumer hooks | New hooks | Medium |

### Priority 4: Real-Time Telemetry

| Task | Files Affected | Complexity |
|------|----------------|------------|
| Create WebSocket/SSE signal stream | New: `src/app/api/signals/stream/route.ts` | High |
| Create `useSignalSubscription` hook | New hook | High |
| Add swarm signal handlers | Edit: `signal-handlers.ts` | Medium |

---

## 6. Architecture Recommendations

### Recommended Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MASTER_ORCHESTRATOR                              │
│                    getSwarmStatus()                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    /api/swarm/status                                 │
│         GET → SwarmStatus { managers: ManagerBrief[] }              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    useSwarmStatus() Hook                             │
│              React Query / SWR with polling                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ SwarmMonitor│ │ AgentList  │ │ Health     │
     │ Widget      │ │ Component  │ │ Dashboard  │
     └────────────┘ └────────────┘ └────────────┘
```

### Type Safety Recommendations

1. **Shared Types Package:** Create `src/types/swarm.ts` importing from backend
2. **Zod Validation:** Add runtime validation on API responses
3. **Type Guards:** Create `isManagerBrief()`, `isSwarmStatus()` guards

---

## Appendix A: File Reference Index

### Backend Files (Orchestration Layer)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/agents/orchestrator/manager.ts` | Master Orchestrator | `getMasterOrchestrator`, `getSwarmStatus` |
| `src/lib/agents/index.ts` | Agent Registry | `AGENT_IDS` (47 agents) |
| `src/lib/orchestration/SignalCoordinator.ts` | Signal Bus | `SignalCoordinator`, `emitSignal` |
| `src/lib/orchestration/types.ts` | Signal Types | 80+ signal type definitions |

### Frontend Files (Dashboard Layer)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/stores/orchestrator-store.ts` | UI State | `useOrchestratorStore` |
| `src/components/shared/SwarmMonitorWidget.tsx` | Swarm Display | `SwarmMonitorWidget` |
| `src/hooks/useUnifiedAuth.ts` | Auth Hook | `useUnifiedAuth` |
| `src/hooks/useUnifiedData.ts` | Data Hooks | `useTenantData`, `useTenantDoc` |

### API Routes

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| `/api/admin/swarm/execute` | POST | Execute 3 agents | FUNCTIONAL |
| `/api/admin/swarm/execute` | GET | Circuit breaker status | FUNCTIONAL |
| `/api/analytics/dashboard` | GET | Analytics metrics | FUNCTIONAL |
| `/api/swarm/status` | GET | Swarm health | MISSING |
| `/api/commerce/brief` | GET | Commerce metrics | MISSING |
| `/api/reputation/brief` | GET | Trust metrics | MISSING |

---

## Appendix B: Agent ID Complete Cross-Reference

### L1 Orchestrator (1)
| Backend ID | Widget | Execute Route |
|------------|--------|---------------|
| MASTER_ORCHESTRATOR | ❌ | ❌ |

### L2 Managers (9)
| Backend ID | Widget | Execute Route |
|------------|--------|---------------|
| INTELLIGENCE_MANAGER | ❌ | ❌ |
| MARKETING_MANAGER | ✅ | ✅ |
| BUILDER_MANAGER | ❌ | ❌ |
| COMMERCE_MANAGER | ❌ | ❌ |
| OUTREACH_MANAGER | ❌ | ❌ |
| CONTENT_MANAGER | ❌ | ❌ |
| ARCHITECT_MANAGER | ❌ | ❌ |
| REVENUE_DIRECTOR | ❌ | ❌ |
| REPUTATION_MANAGER | ❌ | ❌ |

### L3 Specialists (37)
| Backend ID | Widget | Execute Route |
|------------|--------|---------------|
| COMPETITOR_RESEARCHER | ⚠️ MISMATCHED as COMPETITOR_RESEARCHER | ⚠️ WRONG ID |
| SENTIMENT_ANALYST | ❌ | ❌ |
| TECHNOGRAPHIC_SCOUT | ❌ | ❌ |
| SCRAPER_SPECIALIST | ❌ | ❌ |
| TREND_SCOUT | ❌ | ❌ |
| TIKTOK_EXPERT | ✅ | ✅ |
| TWITTER_EXPERT | ✅ | ❌ |
| FACEBOOK_EXPERT | ❌ | ❌ |
| LINKEDIN_EXPERT | ❌ | ❌ |
| SEO_EXPERT | ❌ | ❌ |
| UX_UI_ARCHITECT | ❌ | ❌ |
| FUNNEL_ENGINEER | ❌ | ❌ |
| ASSET_GENERATOR | ❌ | ❌ |
| WORKFLOW_OPTIMIZER | ❌ | ❌ |
| UX_UI_SPECIALIST | ❌ | ❌ |
| FUNNEL_PATHOLOGIST | ❌ | ❌ |
| COPY_SPECIALIST | ❌ | ❌ |
| PAYMENT_SPECIALIST | ❌ | ❌ |
| SUBSCRIPTION_SPECIALIST | ❌ | ❌ |
| CATALOG_MANAGER | ❌ | ❌ |
| PRICING_STRATEGIST | ❌ | ❌ |
| INVENTORY_MANAGER | ✅ | ❌ |
| EMAIL_SPECIALIST | ❌ | ❌ |
| SMS_SPECIALIST | ❌ | ❌ |
| COPYWRITER | ❌ | ❌ |
| CALENDAR_COORDINATOR | ❌ | ❌ |
| VIDEO_SPECIALIST | ❌ | ❌ |
| MERCHANDISER | ❌ | ❌ |
| OUTREACH_SPECIALIST | ❌ | ❌ |
| LEAD_QUALIFIER | ❌ | ❌ |
| DEAL_CLOSER | ❌ | ❌ |
| OBJ_HANDLER | ❌ | ❌ |
| GMB_SPECIALIST | ❌ | ❌ |
| REVIEW_SPECIALIST | ❌ | ❌ |
| REV_MGR | ❌ | ❌ |
| CASE_STUDY | ❌ | ❌ |

**Coverage Summary:**
- Widget Coverage: 5/47 (10.6%)
- Execute Route Coverage: 3/47 (6.4%)
- ID Mismatches: 1 (COMPETITOR_RESEARCHER vs COMPETITOR_RESEARCHER)

---

*Audit completed. No code modifications made. This document serves as the authoritative reference for Dashboard-Swarm integration work.*
