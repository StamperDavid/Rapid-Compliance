# SalesVelocity.ai - Single Source of Truth

**Generated:** January 26, 2026
**Last Updated:** February 13, 2026 (AI social media command center, content studio dual-mode, approval queue upgrade, activity feed, analytics dashboard, agent rules UI — 4 new pages, 2 new API routes)
**Branches:** `dev` (latest)
**Status:** AUTHORITATIVE - All architectural decisions MUST reference this document
**Architecture:** Single-Tenant (Penthouse Model) - NOT a SaaS platform
**Audit Method:** Multi-agent parallel scan with verification + Deep-dive forensic analysis + Playwright Visual Trace Audit

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Ironclad Architecture Rules](#ironclad-architecture-rules) **[BINDING - February 3, 2026]**
3. [Single-Tenant Conversion Plan](#single-tenant-conversion-plan)
4. [Verified Live Route Map](#verified-live-route-map)
5. [Agent Registry](#agent-registry)
6. [Unified RBAC Matrix](#unified-rbac-matrix)
7. [Security Audit Findings](#security-audit-findings)
8. [Tooling Inventory](#tooling-inventory)
9. [Infrastructure Systems](#infrastructure-systems)
10. [Integration Status](#integration-status)
11. [Firestore Collections](#firestore-collections)
12. [Architecture Notes](#architecture-notes)
13. [Data Contracts Reference](#data-contracts-reference)
14. [Autonomous Verification](#autonomous-verification)
15. [Document Maintenance](#document-maintenance)

---

## Executive Summary

### Platform Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Physical Routes (page.tsx) | 167 | Verified February 13, 2026 (added /social/command-center, /social/activity, /social/analytics, /social/agent-rules) |
| API Endpoints (route.ts) | 242 | Verified February 13, 2026 (added /api/social/agent-status, /api/social/activity) |
| AI Agents | 52 | **52 FUNCTIONAL (48 swarm + 4 standalone)** |
| RBAC Roles | 4 | `owner` (level 3), `admin` (level 2), `manager` (level 1), `member` (level 0) — 4-role RBAC |
| Firestore Collections | 65+ | Active (expanded social media collections) |

**Architecture:** Single-company deployment for SalesVelocity.ai. Clients purchase services/products - they do NOT get SaaS tenants.

### Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (Status: **Pending Import** from GitHub)
- **Database:** Firebase Firestore (single-tenant: `rapid-compliance-65f87`)
- **Authentication:** Firebase Auth with custom claims
- **AI Gateway:** OpenRouter (100+ models)
- **Voice:** VoiceEngineFactory (ElevenLabs, Unreal Speech)
- **Payments:** Stripe

### Codebase Scale (February 6, 2026)

**Total Lines of Code Analysis (via `cloc src/`):**

| Metric | Count | Change vs. Pre-Purge |
|--------|-------|--------|
| **Total Files** | 1,134 | -157 files |
| **Total Lines** | 430,060 | -84,011 lines |
| **Code Lines** | **329,557** | -73,537 lines |
| **Comment Lines** | 50,397 | -3,182 lines |
| **Blank Lines** | 50,106 | -7,192 lines |

**Breakdown by Language:**

| Language | Files | Code | Comments | Blank |
|----------|-------|------|----------|-------|
| TypeScript | 1,129 | 328,704 | 50,372 | 49,951 |
| Markdown | 2 | 551 | 0 | 139 |
| JSON | 2 | 191 | 0 | 0 |
| CSS | 1 | 111 | 25 | 16 |

**Breakdown by Directory (TypeScript LOC):**

| Directory | Files | Code Lines | Purpose |
|-----------|-------|------------|---------|
| `src/lib/` | ~480 | ~190,000 | Core business logic, services, agents |
| `src/components/` | ~185 | ~40,000 | UI components (incl. new DataTable system) |
| `src/app/api/` | 215 | ~28,000 | API routes (flat structure) |
| `src/app/(dashboard)/` | 114 | ~18,000 | Dashboard pages (flattened, incl. former admin) |
| `src/types/` | 39 | ~9,500 | TypeScript definitions |
| `src/hooks/` | 14 | ~2,200 | React hooks |

### AI Governance Layer

**File:** `CLAUDE.md` (Project Root)
**Status:** ✅ AUTHORITATIVE
**Scope:** All Claude Code sessions in this project

The Claude Code Governance Layer defines binding operational constraints for AI-assisted development:

| Constraint | Description |
|------------|-------------|
| **Linting Lock** | NO modification of ESLint, TypeScript config, pre-commit hooks, or lint-staged |
| **Zero-Any Policy** | No `any` types in TypeScript; no new `eslint-disable` or `@ts-ignore` comments |
| **Best Practices** | Adherence to ENGINEERING_STANDARDS.md, Zod validation, service layer architecture |
| **Sub-Agent Protocol** | Mandatory use of specialized agents (Explore, Plan, Architect, CodeScout, fixer, Reviewer, steward) |
| **Session Sync** | End-of-session commits to `dev` branch with SSOT update when applicable |

**Key Governance Files:**

| File | Purpose | Modification Status |
|------|---------|---------------------|
| `CLAUDE.md` | AI instruction set | **BINDING** |
| `ENGINEERING_STANDARDS.md` | Code quality requirements | Reference |
| `eslint.config.mjs` | Linting rules | 🔒 **LOCKED** |
| `tsconfig.json` | TypeScript config | 🔒 **LOCKED** |
| `.husky/*` | Pre-commit hooks | 🔒 **LOCKED** |

**Pre-Commit Gate Requirements:**
- `npm run lint` must pass
- `npx tsc --noEmit` must pass (W2 Build Gate)
- `npm run build` must succeed
- No new `any` types introduced
- No new eslint-disable comments added

### Recent Major Milestones (February 2026)

#### AI Social Media Command Center & Full Page Buildout
**Status:** ✅ **COMPLETE** (February 13, 2026)

All 7 target social media pages from the "Tesla Autopilot" supervised autonomy plan are now built:
- **Command Center** (`/social/command-center`) — Kill switch, velocity gauges (SVG circular meters), agent status, platform connections, activity feed, auto-refresh every 30s
- **Content Studio** (`/social/campaigns`) — Dual-mode (Autopilot/Manual toggle), AI queue visibility, scheduled posts, recently published
- **Approval Queue** (`/social/approvals`) — Batch selection, bulk approve/reject, "Why" badge with flagged phrase highlighting, correction capture for AI training
- **Activity Feed** (`/social/activity`) — Chronological AI activity with filter tabs (All/Published/Scheduled/Flagged/Failed)
- **Analytics Dashboard** (`/social/analytics`) — Summary stats, 7-day SVG bar chart, platform breakdown, post performance table
- **Agent Rules** (`/social/agent-rules`) — Visual guardrails editor: velocity limits, sentiment keywords, escalation triggers, per-platform toggles
- **Brand Voice/Training** (`/social/training`) — Already complete from prior session

New API endpoints: `/api/social/agent-status` (GET/POST), `/api/social/activity` (GET). Kill switch (`agentEnabled` boolean) added to `AutonomousAgentSettings` type, agent config defaults, settings API Zod schema, and `executeAction()` guard.

#### Feature Completion Sprint — All Dashboard UIs Functional
**Status:** ✅ **COMPLETE** (February 12, 2026)

All 5 remaining incomplete dashboard features have been built out with full CRUD operations and Firestore integration:
- **Orders Page** — New page at `/orders` with table view, status/search filters, detail drawer, status management
- **Social Media** — Replaced hardcoded mock data with Firestore-backed posts CRUD (new API: `/api/social/posts`)
- **Lead Scoring Rules** — Wired "Manage Rules" button to existing API with rules modal (create/toggle/delete)
- **Webhooks** — Replaced hardcoded data with Firestore CRUD (new API: `/api/settings/webhooks`)
- **Team Tasks** — Added full CRUD with create/edit modals, status transitions (new API: `/api/team/tasks/[taskId]`)

Bug fixes included: orders API Firestore path mismatch corrected, sidebar link updated, broken team tasks "Complete" button fixed.

#### Demo Data Seeding Complete
**Status:** ✅ **COMPLETE** (February 12, 2026)

158 demo documents seeded across all platform features via two seed scripts (`scripts/seed-demo-account.ts` and `scripts/seed-demo-account-part2.ts`). Covers CRM (contacts, leads, deals, activities, products), marketing (campaigns, sequences), platform (workflows, forms, pages, blog, social posts, orders, templates, scoring rules, webhooks, team tasks, conversations, integrations, custom tools), and 30 days of analytics data.

#### SalesVelocity.ai Rebrand Complete
**Status:** ✅ **COMPLETE** (February 3, 2026)

All user-facing brand references have been migrated from RapidCompliance.US to **SalesVelocity.ai**:
- Platform name updated throughout UI components
- `COMPANY_CONFIG.name = 'SalesVelocity.ai'` in `src/lib/constants/platform.ts`
- Marketing materials, documentation, and public-facing content updated
- Internal identifiers remain unchanged: `rapid-compliance-root` (org ID), `rapid-compliance-65f87` (Firebase project)

#### CSS Variable Theme System Deployed
**Status:** ✅ **COMPLETE** (February 3, 2026)

Hard-coded hex colors converted to CSS variables across 100+ components (Rule 3 enforcement):
- All components now use `var(--color-*)` pattern for theming
- Admin dashboard isolated with `.admin-theme-scope` class
- Client workspace uses document-level CSS variables via `useOrgTheme()`
- Theme changes reflect instantly without page reloads
- Known exception: `AdminSidebar.tsx` navigation config uses static hex for icon colors

#### Agent Coordination Layer Refactor
**Status:** ✅ **FULLY IMPLEMENTED** (February 3, 2026)

TenantMemoryVault refactored to enforce single-tenant model (Rule 1 compliance):
- `tenantId` parameter removed from all API methods (replaced with DEFAULT_ORG_ID)
- All internal operations route to `DEFAULT_ORG_ID` exclusively
- No dynamic organization ID resolution - hard-coded to `rapid-compliance-root`
- Maintains backward compatibility for swarm agent coordination

---

## Current Status Assessment (February 6, 2026)

> **Honest audit of what's real vs what's stubbed. This section replaces all previous launch readiness scorecards.**

### What's Solid

| Area | Status | Evidence |
|------|--------|----------|
| Single-tenant architecture | **COMPLETE** | Firebase kill-switch, PLATFORM_ID constant, zero `organizationId` references in src/ or tests/, -80K+ lines purged across all phases |
| 4-role RBAC | **ENFORCED** | `requireRole()` on API routes, sidebar permission filtering, 47 permissions |
| Agent hierarchy | **STRUCTURALLY COMPLETE** | 52 agents defined with full config, manager orchestration logic implemented |
| Type safety | **CLEAN** | `tsc --noEmit` passes, zero `any` policy enforced |
| Build pipeline | **CLEAN** | `npm run build` passes with pre-commit hooks |

### What Needs Work

| Area | Issue | Severity |
|------|-------|----------|
| **~40 TODO comments** | Auth context TODOs reduced; 27 alert/confirm/prompt calls replaced with proper UI components | MEDIUM (down from HIGH) |
| ~~**No error boundaries**~~ | ✅ RESOLVED — Tier 1.2 added 30 error.tsx + 30 loading.tsx files across all route groups (dashboard, auth, store, onboarding) | ✅ RESOLVED |
| ~~**Mock data isolation**~~ | ✅ RESOLVED — OpenAI embeddings replace mock provider; workflow triggers write to Firestore; demo data properly gated | ✅ RESOLVED |
| ~~**Dashboard mock data pages**~~ | ✅ RESOLVED (Feb 12) — Social Media, Webhooks pages replaced with Firestore-backed CRUD; Orders page built from scratch; Lead Scoring rules wired; Team Tasks CRUD added | ✅ RESOLVED |
| ~~**Accessibility**~~ | ~~1 `aria-label` across 115+ pages, no semantic HTML, no keyboard navigation~~ | ✅ RESOLVED — Tier 2.3 skip-to-main, dialog focus trapping, ARIA on loading/error/nav/DataTable, semantic headings, reduced motion |
| ~~**Data tables**~~ | ~~No column sorting, no bulk actions, no CSV export on any table~~ | ✅ RESOLVED — Tier 2.1 DataTable system with sorting, bulk select/delete, CSV export |
| **Agent end-to-end testing** | No test validates full chain: user → orchestrator → manager → specialist → UI | MEDIUM |
| ~~**Mixed styling**~~ | ✅ RESOLVED — Top 6 inline style offenders (236+ styles) migrated to Tailwind; Tailwind config maps CSS variables to utility classes | ✅ RESOLVED |

### What's Stubbed (Not Yet Functional)

| Endpoint/Feature | Issue |
|------------------|-------|
| ~~Voice AI audio generation~~ | ✅ RESOLVED — TTS wired to agent handler via VoiceEngineFactory; 2 providers (ElevenLabs, Unreal Speech). Native stub removed Feb 12, 2026. |
| ~~Video content generation~~ | ✅ RESOLVED — RenderPipeline class orchestrates storyboard→provider→stitcher→storage; wired to /api/video/generate |
| ~~Email reply processing~~ | ✅ RESOLVED — SendGrid Inbound Parse webhook at /api/webhooks/email-inbound; AI classification with auto-response |
| ~~PDF proposal generation~~ | ✅ RESOLVED — Playwright PDF conversion with Firebase Storage upload; GET /api/proposals/[id]/pdf endpoint |
| ~~ML predictive lead scoring~~ | ✅ RESOLVED — Firestore-configurable weights with `trainFromHistoricalData()` using logistic regression approximation |
| ~~`/api/coaching/team`~~ | ✅ RESOLVED — Queries Firestore for team membership with fallback to org-wide sales reps |
| `/api/crm/deals/[dealId]/recommendations` | Auth implementation incomplete |

---

## Stabilization Roadmap

> **Status:** ✅ COMPLETE — All tiers (1, 2, 3) verified complete. Stabilization work has concluded.
>
> Tier 1 (Foundation): 5/5 tasks DONE. Tier 2 (UX Parity): 5/5 tasks DONE. Tier 3 (Feature Completion): 5/5 tasks DONE.

### Tier 1 — Foundation (Stop the Bleeding)

These tasks fix broken or missing fundamentals. No new features until these are done.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1.1 | **Audit every TODO in critical paths** | Catalog every TODO/FIXME in `src/app/api/` and `src/lib/services/`. Classify each as: (a) stub that blocks functionality, (b) enhancement, (c) dead code. Produce a machine-readable inventory. | ✅ DONE — `docs/todo-audit-inventory.json` (10 items: 4 stubs, 6 enhancements, 0 dead code) |
| 1.2 | **Add error.tsx boundaries** | Add `error.tsx` and `loading.tsx` to every route group: `(dashboard)`, `dashboard/*`, `admin/*`, `(public)/*`. Follow Next.js 15 patterns. | ✅ DONE — 30 error.tsx + 30 loading.tsx added across all route groups, dashboard sub-routes, store/checkout, onboarding |
| 1.3 | **Replace mock data with real queries or empty states** | Grep for hardcoded arrays, sample data, and `mock` variables in page components. Replace with Firestore queries or proper empty-state UI with CTAs. | ✅ DONE — CRM page (10 entities), Living Ledger (deals), Templates (deal scores) now query Firestore with empty-state UI |
| 1.4 | **Verify agent service backends** | For each of the 50 agents, trace from the agent's `execute()` method through to the underlying service. Document which services are real vs TODO stubs. | ✅ DONE — `docs/agent-backend-audit.json`. 50/50 REAL (SUBSCRIPTION_SPECIALIST removed — multi-tenant debt) |
| 1.5 | **Fix auth context TODOs** | Replace all 15 instances of `"TODO: Get from auth context"` with actual authenticated user resolution. | ✅ DONE — All 15 instances replaced with `useAuth()` hook (pages/components) or `userId` parameter (services) |

### Critical Gap from Tier 1 Audit

> **SUBSCRIPTION_SPECIALIST** — ✅ RESOLVED (REMOVED). This agent was multi-tenant debt from the SaaS era — subscription lifecycle management (trials, billing cycles, dunning, state machine) is not applicable to the single-tenant Penthouse Model where clients purchase services and products. The agent file, Commerce Manager subscription methods, delegation rules, intent types, and all registry references have been fully removed. Agent count updated from 51 to 50.

### Tier 2 — UX Parity (Industry Competitiveness)

These tasks bring the UI to the level expected by users coming from HubSpot, Salesforce, Apollo, etc.


| # | Task | Description | Status |
|---|------|-------------|--------|
| 2.1 | **Data table upgrades** | Add column sorting, filtering, bulk select/delete, and CSV export to: Leads, Deals, Contacts, Forms tables. Custom DataTable component at `src/components/ui/data-table/`. Orders page now exists at `/orders`. | ✅ DONE — Reusable DataTable with sorting, selection, CSV export. Checkbox + ConfirmDialog primitives. DELETE endpoints for leads/deals/contacts/forms. View toggles on Contacts + Forms. |
| 2.2 | **Form validation standardization** | Standardize all dashboard forms on react-hook-form + zod (already used on API side). Add field-level error messages, loading states on submit buttons. | ✅ DONE — Created `src/components/ui/form.tsx` (Form/FormField/FormItem/FormLabel/FormControl/FormMessage). 9 Zod form schemas in `src/lib/validation/`. All 9 creation forms converted: leads, contacts, deals, products, workflows, campaigns, ab-tests, nurture, fine-tuning. Field-level errors via `<FormMessage />`. Loading states via `formState.isSubmitting`. useFieldArray for dynamic arrays (workflows, nurture). watch() for leads duplicate detection + data quality. |
| 2.3 | **Accessibility pass** | Add semantic HTML (`nav`, `main`, `section`), aria labels, keyboard navigation, focus management for modals. Target WCAG 2.1 AA. | ✅ DONE — Skip-to-main link, MotionConfig reduced motion, dialog/confirm-dialog focus trapping + ARIA roles, 30 loading.tsx with role="status" + aria-busy + sr-only, 30 error.tsx with role="alert", AdminSidebar aria-label/aria-expanded/aria-current, DataTable scope/aria-sort/tableLabel/button labels, dashboard heading hierarchy h1→h2 with sections, view toggle aria-pressed. 73 files changed. |
| 2.4 | **Page transition polish** | Add loading states between page navigations, skeleton screens for data-heavy pages, optimistic UI for mutations. | ✅ DONE — Content-aware skeleton screens for 7 loading.tsx files (dashboard, leads, deals, contacts, forms, analytics, parent group). NavigationProgress bar via framer-motion in ClientProviders. Optimistic delete with rollback via `useOptimisticDelete` hook on leads/deals/contacts/forms. `usePagination` exposes `setData` for optimistic mutations. `<Toaster>` mounted in ClientProviders for toast feedback. |
| 2.5 | **Scraper distillation preview** | Add inline preview of distillation results on the scraper page so users don't need to download to verify AI output. | COMPLETE |

### Tier 3 — Feature Completion

Only after Tiers 1 and 2 are verified complete.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 3.1 | **Owner impersonation tool** | Built `/system/impersonate` — owner can view the platform as any member. API at `/api/admin/impersonate` (POST/DELETE/GET). Full audit logging, session management, ImpersonationBanner component. | COMPLETE |
| 3.2 | **LinkedIn selector update** | Update CSS selectors in scraper intelligence for recent LinkedIn UI changes. | COMPLETE |
| 3.3 | **End-to-end agent testing** | Write integration tests that validate the full chain: user action → API → orchestrator → manager → specialist → result. | COMPLETE |
| 3.4 | **Webhook signature verification** | Add HMAC validation to email, SMS, and voice webhook endpoints. | COMPLETE |
| 3.5 | **Stub implementations** | Implement the stubbed features from the "What's Stubbed" table above, prioritized by user impact. | COMPLETE |

---

## Social Media Growth Engine (COMPLETE)

> **Status:** COMPLETE — All 6 phases implemented (February 7, 2026).

Metrics collector, Growth Analyst agent, LISTEN/ENGAGE capabilities, GROWTH_LOOP orchestration, content recycling with 30-day cooldown. All infrastructure is production-ready and feeds into the Autonomous Business Operations upgrade below.

### Marketing Manager Orchestration Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| `CAMPAIGN_SPRINT` | Default / human command | Standard single campaign execution |
| `GROWTH_LOOP` | Growth objective set | Continuous: LISTEN → ANALYZE → MUTATE → CREATE → PUBLISH → ENGAGE → repeat |
| `OPPORTUNISTIC` | TREND_SCOUT HIGH/CRITICAL signal | Interrupt flow, fast-track trending content |
| `CRISIS_RESPONSE` | SENTIMENT_ANALYST negative spike | Pause publishing, deploy damage control |
| `AMPLIFICATION` | SENTIMENT_ANALYST positive spike | Boost content frequency, share positive mentions |

---

## Autonomous Business Operations Upgrade

> **Status:** COMPLETE — All 8 phases implemented February 7, 2026. Full spec in `CONTINUATION_PROMPT.md`.

**Goal:** Transition the entire 48-agent swarm from task executors to autonomous managers that operate the business as a team. The human sets objectives; the system runs the business. Jasper (AI assistant) is the human interface.

**Assessment:** Infrastructure and autonomous behavior fully wired. Agents now trigger each other's actions via Event Router, operate on scheduled cycles, and Jasper has command authority over all 9 managers.

### Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **1** | Event Router + Company Operations Cycle (foundation for all autonomy) | COMPLETE |
| **2** | Manager Authority Upgrade (quality gates, mutation application, cross-department signals) | COMPLETE |
| **3** | Revenue Pipeline Automation (auto-progression, intelligence-to-outreach bridge, win/loss feedback) | COMPLETE |
| **4** | Outreach Autonomy (reply → action chains, adaptive timing, ghosting recovery) | COMPLETE |
| **5** | Content Production Line + Intelligence Always-On (cross-department briefs, daily market sweeps) | COMPLETE |
| **6** | Builder/Commerce Reactive Loops (analytics-driven page optimization, cart recovery, pricing) | COMPLETE |
| **7** | Contextual Artifact Generation (reply → personalized video + PDF → auto-send) | COMPLETE |
| **8** | Jasper Command Authority (briefing system, approval gateway, command authority) | COMPLETE |

### Key Infrastructure (Built)

| Component | Path | Purpose |
|-----------|------|---------|
| Event Router | `src/lib/orchestration/event-router.ts` | Rules engine — 20+ rules mapping business events to Manager actions via SignalBus |
| Operations Cycle Cron | `src/app/api/cron/operations-cycle/route.ts` | Company-wide management cycle (4-hour operational, 24-hour strategic, weekly executive) |
| Intelligence Sweep Cron | `src/app/api/cron/intelligence-sweep/route.ts` | Daily market monitoring — competitor activity, funding, hiring signals |
| BaseManager Authority | `src/lib/agents/base-manager.ts` | reviewOutput(), readAndApplyMutations(), requestFromManager(), readIncomingRequests() |
| Jasper Command Authority | `src/lib/orchestrator/jasper-command-authority.ts` | Executive briefings, approval gateway, command issuance to any Manager |

### Cross-Department Event Routing (Phase 1 — LIVE)

| Event | Condition | Action |
|-------|-----------|--------|
| `email.reply.received` (interested) | intent classification | Revenue Director: advance stage |
| `email.reply.received` (needs_more_info) | intent classification | Content Manager: generate assets → Outreach Manager: reply |
| `lead.bant_score.updated` | score >= 70 | Revenue Director: auto-transition to OUTREACH |
| `post.metrics.updated` (viral) | engagement > 5x average | Content Manager: produce follow-up |
| `review.received` (5-star) | rating = 5 | Marketing Manager: repurpose as social proof |
| `cart.abandoned` | no checkout within 1 hour | Outreach Manager: recovery sequence |
| `deal.closed.won` | — | Reputation Manager: review solicitation |

---

## Ironclad Architecture Rules

> **Status:** BINDING — These rules are non-negotiable architectural constraints. Any code that violates them is a **bug** and must be corrected immediately. No exception, no discussion.

---

### Rule 1: The "One Company" Rule

**`rapid-compliance-root` is the ONLY valid organization ID in this system. Period.**

| Aspect | Detail |
|--------|--------|
| **Constant** | `DEFAULT_ORG_ID = 'rapid-compliance-root'` in `src/lib/constants/platform.ts` |
| **Company Config** | `COMPANY_CONFIG = { id: 'rapid-compliance-root', name: 'SalesVelocity.ai' }` |
| **Firebase Project** | `rapid-compliance-65f87` (enforced by `CriticalConfigurationError` kill-switch) |
| **Validation Helpers** | `isDefaultOrg(orgId)` confirms identity; `getDefaultOrgId()` returns the constant |

**Enforcement:**
- All Firestore paths, API routes, and service classes use `DEFAULT_ORG_ID` exclusively
- `CriticalConfigurationError` in `src/lib/firebase/config.ts` halts the application if any other Firebase project is detected at runtime
- Service classes accept deprecated `orgId` parameters for backward compatibility but **ignore them** — all methods route to `DEFAULT_ORG_ID` internally

**Bug Definition:** Any code that introduces dynamic organization IDs, org-switching logic, tenant selection, multi-org routing, or parameterized org resolution is a **bug**. There is no org picker. There is no tenant dropdown. Clients purchase services — they do NOT get tenants.

---

### Rule 2: Unified AI Workforce Registry

**The 52 AI Agents are managed through a single global registry in Firestore, not per-user and not per-tenant.**

| Aspect | Detail |
|--------|--------|
| **Registry File** | `AGENT_REGISTRY.json` (project root — authoritative manifest) |
| **Runtime Registry** | `src/lib/agents/index.ts` (factory functions, swarm wiring) |
| **Firestore: Agent Config** | `organizations/rapid-compliance-root/agentConfig/{agentId}` |
| **Firestore: Golden Masters** | `organizations/rapid-compliance-root/goldenMasters/{masterId}` |
| **Firestore: Training Data** | `organizations/rapid-compliance-root/trainingData/{dataId}` |

**Hierarchy:**

```
MASTER_ORCHESTRATOR (L1 - Swarm CEO)
├── INTELLIGENCE_MANAGER (L2) → 5 Specialists
├── MARKETING_MANAGER (L2) → 6 Specialists
├── BUILDER_MANAGER (L2) → 4 Specialists
├── ARCHITECT_MANAGER (L2) → 3 Specialists
├── COMMERCE_MANAGER (L2) → 4 Specialists
├── OUTREACH_MANAGER (L2) → 2 Specialists
├── CONTENT_MANAGER (L2) → 3 Specialists
├── REVENUE_DIRECTOR (L2) → 5 Specialists
└── REPUTATION_MANAGER (L2) → 4 Specialists

Standalone: JASPER, VOICE_AGENT_HANDLER,
           AUTONOMOUS_POSTING_AGENT, CHAT_SESSION_SERVICE
```

**Total: 48 Swarm (1 + 9 + 38) + 4 Standalone = 52 Agents**

**Governance:** Agents are deployed, trained, and configured at the **platform level**. The `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) creates ephemeral session instances from Golden Masters — these are temporary runtime objects, not persistent per-user registries.

**Bug Definition:** Any code that creates user-scoped agent registries, per-tenant agent configurations, or duplicate agent manifests outside the global registry is a **bug**.

---

### Rule 3: Theme Governance — CSS Variables Only

**All UI components MUST use CSS variables for colors. Hard-coded hex values are FORBIDDEN in component code.**

| Aspect | Detail |
|--------|--------|
| **Variable Source** | `src/app/globals.css` (`:root` block) |
| **Admin Scope** | `.admin-theme-scope` class — overrides `--color-*` with `--admin-color-*` |
| **Client Scope** | `:root` (document-level) via `useOrgTheme()` hook |
| **Admin Hook** | `useAdminTheme()` — loads from `platform_settings/adminTheme` |
| **Client Hook** | `useOrgTheme()` — loads from `organizations/rapid-compliance-root/themes/default` |

**Required Pattern (CORRECT):**
```css
color: var(--color-primary);
background: var(--color-bg-main);
background: rgba(var(--color-primary-rgb), 0.5);
border-color: var(--color-border-main);
```

**Forbidden Pattern (BUG):**
```css
color: #6366f1;
background: #000000;
background: rgb(99, 102, 241);
border-color: #1a1a1a;
```

**Core CSS Variable Families:**

| Family | Variables | Purpose |
|--------|-----------|---------|
| Primary | `--color-primary`, `--color-primary-light`, `--color-primary-dark`, `--color-primary-rgb` | Brand primary color |
| Secondary | `--color-secondary`, `--color-secondary-light`, `--color-secondary-dark` | Brand secondary color |
| Accent | `--color-accent`, `--color-accent-light`, `--color-accent-dark` | Accent highlights |
| Semantic | `--color-success`, `--color-warning`, `--color-error`, `--color-info` | Status indicators |
| Background | `--color-bg-main`, `--color-bg-paper`, `--color-bg-elevated` | Surface backgrounds |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled` | Typography colors |
| Border | `--color-border-main`, `--color-border-light`, `--color-border-strong` | Border colors |
| Neutral | `--color-neutral-100` through `--color-neutral-900` | Gray scale |

**Theme Isolation Guarantee:**
- Changing a client theme at `/settings/theme` does NOT affect the Admin Dashboard
- Admin UI is wrapped in `.admin-theme-scope` which overrides all `--color-*` with `--admin-color-*`
- CSS cascading ensures admin variables always win within the admin container

**Known Exception:** `AdminSidebar.tsx` uses `iconColor` hex strings in its navigation config for Lucide icon coloring. These are static navigation constants in the config array — not dynamic component styling. Future work should migrate these to CSS variable references.

**Bug Definition:** Any component that uses literal hex codes, `rgb()` values, or hard-coded color strings for theming instead of CSS variables is a **bug**.

---

### Rule 4: Navigation Hierarchy — Consolidated Sidebar

**All navigation lives in a single `AdminSidebar` component. The legacy "God Mode" sidebar is dead. Do not resurrect it.**

| Aspect | Detail |
|--------|--------|
| **Source** | `src/components/admin/AdminSidebar.tsx` |
| **Sections** | 12 navigation sections, 70+ menu items |
| **Width** | 280px expanded / 64px collapsed |
| **Theming** | 100% CSS variable-driven via `var(--color-*)` |
| **Routing** | All static routes — no `[orgId]` parameters in sidebar links |

**Consolidated Navigation Structure:**

| # | Section | Items |
|---|---------|-------|
| 1 | **Command Center** | Dashboard, Workforce HQ |
| 2 | **CRM** | Leads, Deals/Pipeline, Contacts, Conversations, Living Ledger |
| 3 | **Lead Gen** | Forms, Lead Research, Lead Scoring |
| 4 | **Outbound** | Outbound, Sequences, Campaigns, Email Writer, Nurture, Calls |
| 5 | **Content Factory** | Video Studio, Social Media (9 pages: Command Center, Content Studio, Approvals, Calendar, Listening, Training, Activity Feed, Analytics, Agent Rules), Proposals, Battlecards |
| 6 | **AI Workforce** | Agent Registry, Training Center, Agent Persona, Voice & Speech, Voice AI Lab, Social AI Lab, SEO AI Lab, Datasets, Fine-Tuning |
| 7 | **Automation** | Workflows, A/B Testing, Lead Routing |
| 8 | **E-Commerce** | Products, Orders, Storefront |
| 9 | **Compliance** | Compliance Reports, Audit Log |
| 10 | **Analytics** | Overview, Revenue, Pipeline, Sales Performance, Sequences |
| 11 | **Website** | Site Editor, Pages, Blog, SEO, Domains, Site Settings |
| 12 | **Settings** | General, Users & Team, Integrations, API Keys, Theme & Branding, Security |

**Deleted Components (Forensic Record):**
- `CommandCenterSidebar.tsx` — Deleted January 26, 2026 (commit `f2d2497b`)
- God Mode sidebar logic — Absorbed into unified `AdminSidebar.tsx`
- `UnifiedSidebar.tsx` in admin context — Superseded by `AdminSidebar.tsx` for admin routes

**Dashboard vs. Admin Navigation:**
- **Dashboard routes** (`/(dashboard)/*`) use `buildNavigationStructure()` from `feature-toggle-service.ts` — 11 client sections, no System tools
- **Admin routes** (`/admin/*`) use `AdminSidebar.tsx` — 12 sections including all operational tools

**Bug Definition:** Any code that creates parallel navigation structures, reintroduces God Mode sidebars, builds shadow navigation components, or splits sidebar logic into disconnected files is a **bug**.

---

### Rule 5: Firebase Flat Pathing

**Firestore uses a flat pathing model. `users` and `platform_settings` are root-level collections. Organization data nests under the single `rapid-compliance-root` document.**

**Root-Level Collections (Flat — NOT nested under any org):**

| Collection | Path Pattern | Purpose |
|------------|-------------|---------|
| `users` | `users/{userId}` | User profiles and auth data |
| `platform_settings` | `platform_settings/{settingId}` | Global platform configuration (admin theme, feature flags) |
| `platform_metrics` | `platform_metrics/{metricId}` | Platform-wide analytics metrics |
| `health` | `health/{healthId}` | System health check records |
| `discoveryQueue` | `discoveryQueue/{itemId}` | Lead discovery queue items |
| `admin` | `admin/{configId}` | Admin-level configurations |
| `slack_workspaces` | `slack_workspaces/{workspaceId}` | Slack OAuth workspace configs |

**Organization-Scoped Collections (under single org root):**

| Collection | Path Pattern | Purpose |
|------------|-------------|---------|
| Agent Config | `organizations/rapid-compliance-root/agentConfig/{agentId}` | AI agent settings |
| Golden Masters | `organizations/rapid-compliance-root/goldenMasters/{masterId}` | Trained AI model snapshots |
| Themes | `organizations/rapid-compliance-root/themes/default` | Client theme configuration |
| Workspaces | `organizations/rapid-compliance-root/workspaces/{wsId}` | Workspace containers |
| CRM Records | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/{entity}/records/{id}` | Entity records |
| Schemas | `organizations/rapid-compliance-root/workspaces/{wsId}/schemas/{schemaId}` | Data schemas |
| Email Campaigns | `organizations/rapid-compliance-root/emailCampaigns/{campaignId}` | Email campaign data |
| Nurture Sequences | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}` | Nurture sequence data |
| Signals | `organizations/rapid-compliance-root/signals/{signalId}` | Agent signal bus events |

**Path Builders (in `src/lib/db/firestore-service.ts`):**

```typescript
orgPath(subPath)           → organizations/rapid-compliance-root/{subPath}
workspacePath(wsId, sub)   → organizations/rapid-compliance-root/workspaces/{wsId}/{sub}
entityRecordsPath(wsId, e) → organizations/rapid-compliance-root/workspaces/{wsId}/entities/{e}/records
```

All three functions are hardcoded to `DEFAULT_ORG_ID`. There is no dynamic org parameter.

**Bug Definition:** Any code that constructs Firestore paths with dynamic organization IDs, nests `users` or `platform_settings` under an organization document, or creates per-user root-level collections for data that belongs at org scope is a **bug**.

---

## Single-Tenant Architecture (COMPLETE)

**Status:** ✅ FULLY COMPLETE - February 2, 2026
**Repository:** https://github.com/StamperDavid/Rapid-Compliance
**Branch:** `dev` at commit `e8a707c0`
**Model:** Penthouse Single-Tenant (hardened)
**Hosting:** Vercel (Pending Import) | **Backend:** Firebase `rapid-compliance-65f87`

### Overview

SalesVelocity.ai is a **single-company sales and marketing super tool**. This is NOT a SaaS platform. Clients purchase professional services and products - they do NOT get their own tenant/workspace.

### Multi-Tenant Purge Summary (February 2, 2026)

| Category | Items Removed |
|----------|--------------|
| Workspace Pages | `src/app/workspace/[orgId]/` (~100 pages) - **DELETED** |
| Workspace API Routes | `src/app/api/workspace/[orgId]/` (12 routes) - **MIGRATED to /api/** |
| Subscription API | `src/app/api/subscription/` (5 routes) - **DELETED** |
| Billing API | `src/app/api/billing/` (3 routes) - **DELETED** |
| Billing Services | `src/lib/billing/`, `src/lib/subscription/` - **DELETED** |
| Types | `src/types/subscription.ts`, `src/types/organization.ts` - **DELETED** |
| Route Builders | `src/lib/routes/workspace-routes.ts` - **DELETED** |

**Net Result:** -185 files, -71,369 lines of code

### Penthouse Security Model

The Penthouse model implements a **hardened single-tenant deployment** with the following security measures:

#### Firebase Kill-Switch

**File:** `src/lib/firebase/config.ts`

```typescript
const ALLOWED_PROJECT_ID = 'rapid-compliance-65f87';

function validateProjectId(): void {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (!isBuildPhase && firebaseConfig.projectId !== ALLOWED_PROJECT_ID) {
    throw new CriticalConfigurationError(
      `CRITICAL: Invalid Firebase project "${firebaseConfig.projectId}". ` +
      `This deployment ONLY allows "${ALLOWED_PROJECT_ID}". Halting all operations.`
    );
  }
}
```

**Behavior:**
- Only `rapid-compliance-65f87` Firebase project is allowed
- Any other project ID throws `CriticalConfigurationError` at runtime
- Build phase bypassed to allow CI/CD (validation occurs at runtime)
- Prevents accidental deployment to wrong project

#### Backend Migration Status

**Status:** ✅ COMPLETE (February 2, 2026)

| Component | Old Value | New Value | Status |
|-----------|-----------|-----------|--------|
| Project ID | `ai-sales-platform-dev` | `rapid-compliance-65f87` | ✅ Migrated |
| Auth Domain | `ai-sales-platform-dev.firebaseapp.com` | `rapid-compliance-65f87.firebaseapp.com` | ✅ Migrated |
| Storage Bucket | `ai-sales-platform-dev.firebasestorage.app` | `rapid-compliance-65f87.firebasestorage.app` | ✅ Migrated |
| Firestore Rules | Legacy project | `rapid-compliance-65f87` | ⚠️ Deploy after `firebase login --reauth` |
| Admin SDK | Old credentials | Configured in `.env.local` | ✅ Ready |
| Measurement ID | N/A | `G-YELVC6MTYF` | ✅ Added |

**Verification Script:** `scripts/verify-firebase-connection.ts`
- Confirms CriticalConfigurationError kill-switch is NOT triggered
- Validates Firestore handshake with production project
- Run: `node scripts/verify-firebase-connection.mjs`

#### Flattened Route Architecture

**Change:** Routes moved from `/workspace/[orgId]/*` to `/(dashboard)/*`

| Before | After |
|--------|-------|
| `/workspace/abc123/dashboard` | `/dashboard` |
| `/workspace/abc123/entities/leads` | `/entities/leads` |
| `/workspace/abc123/settings/users` | `/settings/users` |

**Implementation:**
- Created `src/app/(dashboard)/` route group with 114 pages (flattened single-tenant, includes former admin routes)
- All pages use `DEFAULT_ORG_ID = 'rapid-compliance-root'` instead of `useParams()`
- Legacy URLs redirect via middleware (`/workspace/*` → `/(dashboard)/*`)

#### Middleware Redirects

**File:** `src/middleware.ts`

Legacy workspace URLs are automatically redirected:
- `/workspace/any-org-id/path` → `/path`
- Preserves query strings and hash fragments

### Single-Tenant Conversion Summary

**Status:** ✅ FULLY COMPLETE — February 2, 2026 (8 phases, 25 tasks, 100%)
**Net Result:** -185 files, -71,369 lines of code
**Details:** Workspace routes migrated to `/(dashboard)/*`, subscription/billing APIs deleted, TenantMemoryVault refactored, RBAC converted from 5-level to 4-role.

> Historical conversion phase details have been archived. See `docs/archive/` for forensic records.

---

## Verified Live Route Map

### Route Distribution (February 12, 2026)

| Area | Routes | Dynamic Params | Status |
|------|--------|----------------|--------|
| Dashboard (`/(dashboard)/*`) | 117 | 8 | **Flattened** single-tenant (incl. former admin routes) |
| Public (`/(public)/*`) | 16 | 0 | All pages exist |
| Dashboard sub-routes (`/dashboard/*`) | 16 | 0 | Analytics, coaching, marketing, performance |
| Store (`/store/*`) | 5 | 1 (`[productId]`) | E-commerce storefront |
| Onboarding (`/onboarding/*`) | 2 | 0 | Account + industry setup |
| Auth (`/(auth)/*`) | 1 | 0 | Admin login |
| Other (`/preview`, `/profile`, `/sites`) | 3 | 2 | Preview tokens, user profile, site builder |
| **TOTAL** | **160** | **11** | **Verified** |

**DELETED:** `src/app/workspace/[orgId]/*` (95 pages) and `src/app/admin/*` (92 pages) - multi-tenant and standalone admin routes removed/consolidated into `(dashboard)`

### Admin Routes (ARCHIVED — Consolidated into Dashboard)

> **Note:** The standalone `/admin/*` page routes (92 pages) were removed during the single-tenant consolidation. All administrative functionality now lives within the `/(dashboard)/*` route group, accessible via RBAC role-gating (`owner`/`admin` roles). Admin API routes (`/api/admin/*`) still exist for backend operations.
>
> **Admin Login:** `/(auth)/admin-login` — Firebase admin auth
### Dashboard Routes (114 in /(dashboard)/* - Flattened Single-Tenant)

> **Note:** These routes were migrated from `/workspace/[orgId]/*` to `/(dashboard)/*` as part of the single-tenant conversion. All routes now use `DEFAULT_ORG_ID = 'rapid-compliance-root'` internally.

**Core Navigation:**
- `/dashboard`, `/settings`, `/analytics`, `/integrations`, `/templates`
- `/battlecards`, `/email-writer`, `/lead-scoring`, `/living-ledger`
- `/conversations`, `/workforce`

**CRM Entities:**
- `/leads`, `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`, `/leads/research`
- `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit`
- `/contacts`, `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit`
- `/products`, `/products/new`, `/products/[id]/edit`
- `/orders` (NEW Feb 12 — full order management with table, filters, detail drawer)
- `/entities/[entityName]`

**Marketing & Outbound:**
- `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[campaignId]`
- `/nurture`, `/nurture/new`, `/nurture/[id]`, `/nurture/[id]/stats`
- `/ab-tests`, `/ab-tests/new`, `/ab-tests/[id]`
- `/outbound`, `/outbound/email-writer`, `/outbound/sequences`
- `/social/campaigns` (Content Studio — dual-mode autopilot/manual), `/social/training`, `/social/approvals` (batch review, correction capture, "Why" badge), `/social/calendar`, `/social/listening`
- `/social/command-center` (kill switch, velocity gauges, agent status), `/social/activity` (activity feed), `/social/analytics` (dashboard), `/social/agent-rules` (guardrails editor)

**Settings (19 sub-routes):**
- `api-keys`, `accounting`, `storefront`, `promotions`
- `email-templates`, `sms-messages`, `theme`, `users`
- `security`, `integrations`, `webhooks`, `custom-tools`, `workflows`
- `lead-routing`, `meeting-scheduler`
- `ai-agents/*` (6 routes: hub, business-setup, configuration, persona, training, voice)

> **Removed:** `/settings/billing`, `/settings/subscription`, `/settings/organization` (subscription system deleted)

**Website Builder:**
- `/website/editor`, `/website/pages`, `/website/domains`, `/website/seo`
- `/website/settings`, `/website/templates`, `/website/navigation`, `/website/audit-log`
- `/website/blog`, `/website/blog/categories`, `/website/blog/editor`

### Dashboard Sub-Routes (16 in /dashboard/*)

```
/dashboard/analytics                # Workspace analytics [FULL - 278 lines]
/dashboard/coaching                 # Coaching hub
/dashboard/coaching/team            # Team coaching
/dashboard/conversation             # Conversation intelligence
/dashboard/marketing/email          # Email marketing
/dashboard/marketing/social         # Social marketing
/dashboard/performance              # Performance metrics
/dashboard/playbook                 # Sales playbook
/dashboard/risk                     # Risk management
/dashboard/routing                  # Lead routing
/dashboard/sales/deals              # Deals pipeline
/dashboard/sales/leads              # Leads management
/dashboard/sequence                 # Sequence management
/dashboard/settings                 # Settings
/dashboard/swarm                    # AI swarm control
/dashboard/system                   # Admin hub [FULL - 203 lines]
```

### Public Routes (16)

```
/(public)/                          # Landing page
/(public)/about                     # About page
/(public)/blog                      # Blog
/(public)/contact                   # Contact form
/(public)/demo                      # Demo request
/(public)/docs                      # Documentation
/(public)/f/[formId]                # Public form submission
/(public)/faq                       # FAQ
/(public)/features                  # Features
/(public)/forgot-password           # Password reset
/(public)/login                     # User login
/(public)/pricing                   # Pricing page
/(public)/privacy                   # Privacy policy
/(public)/security                  # Security page
/(public)/signup                    # User signup
/(public)/terms                     # Terms of service
```

### Route Issues

| Issue | Location | Severity | Status |
|-------|----------|----------|--------|
| ~~Stub Page~~ | `/admin/command-center` | ~~LOW~~ | ✅ RESOLVED — Admin routes consolidated into dashboard |
| ~~Duplicate Destination~~ | `settingsEcommerce` + `settingsProducts` | ~~INFO~~ | ✅ RESOLVED — Admin routes removed |

---

## Agent Registry

### Agent Swarm Overview

**Total Agents:** 52 (48 swarm + 4 standalone)
- **Swarm Agents:** 48 (1 orchestrator + 9 managers + 38 specialists)
- **Standalone Agents:** 4 (outside swarm hierarchy)

| Status | Count | Description |
|--------|-------|-------------|
| FUNCTIONAL (Swarm) | 48 | **100% SWARM COMPLETION** - All agents fully operational |
| FUNCTIONAL (Standalone) | 4 | Jasper (AI Assistant), Voice Agent, Autonomous Posting Agent, Chat Session Service |
| GHOST | 0 | All specialists have been implemented |

### Master Orchestrator (1) - L1 Swarm CEO

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| MASTER_ORCHESTRATOR | MasterOrchestrator | Swarm Coordination | FUNCTIONAL | **Swarm CEO** - 2000+ LOC implementing Command Pattern for task dispatching, Saga Pattern for multi-manager workflows with compensation, processGoal() hierarchical task decomposition, intent-based domain routing engine with 9 intent categories, cross-domain synchronization with dependency graph resolution, getSwarmStatus() global state aggregation from all 9 managers, TenantMemoryVault integration for goal insights |

### Managers (9) - L2 Orchestrators

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| INTELLIGENCE_MANAGER | IntelligenceManager | Research & Analysis | FUNCTIONAL | Dynamic orchestration engine with parallel execution, graceful degradation |
| MARKETING_MANAGER | MarketingManager | Social & Ads | FUNCTIONAL | **Industry-agnostic Cross-Channel Commander** - 1200+ LOC with dynamic specialist resolution (6 specialists: TIKTOK_EXPERT, TWITTER_X_EXPERT, FACEBOOK_ADS_EXPERT, LINKEDIN_EXPERT, SEO_EXPERT, GROWTH_ANALYST), Brand DNA integration, SEO-social feedback loop, intelligence signal wiring (TREND_SCOUT, SENTIMENT_ANALYST), GROWTH_LOOP orchestration cycle, OPPORTUNISTIC/CRISIS_RESPONSE/AMPLIFICATION modes, parallel execution |
| BUILDER_MANAGER | BuilderManager | Site Building | FUNCTIONAL | **Autonomous Construction Commander** - 1650+ LOC with dynamic specialist resolution (3 specialists: UX_UI_ARCHITECT, FUNNEL_ENGINEER, ASSET_GENERATOR), Blueprint-to-Deployment workflow, pixel injection (GA4, GTM, Meta Pixel, Hotjar), build state machine (PENDING_BLUEPRINT → ASSEMBLING → INJECTING_SCRIPTS → DEPLOYING → LIVE), Vercel deployment manifest generation, SignalBus `website.build_complete` broadcast, parallel execution, graceful degradation |
| COMMERCE_MANAGER | CommerceManager | E-commerce | FUNCTIONAL | **Transactional Commerce Commander** - 1400+ LOC with dynamic specialist resolution (4 specialists: PAYMENT_SPECIALIST, CATALOG_MANAGER, PRICING_STRATEGIST, INVENTORY_MANAGER), Product-to-Payment checkout orchestration, CommerceBrief revenue synthesis (Transaction Volume), TenantMemoryVault tax/currency settings, parallel execution, graceful degradation |
| OUTREACH_MANAGER | OutreachManager | Email & SMS | FUNCTIONAL | **Omni-Channel Communication Commander** - 1900+ LOC with dynamic specialist resolution (EMAIL_SPECIALIST, SMS_SPECIALIST), Multi-Step Sequence execution, channel escalation (EMAIL → SMS → VOICE), sentiment-aware routing via INTELLIGENCE_MANAGER, DNC compliance via TenantMemoryVault, frequency throttling, quiet hours enforcement, SignalBus integration |
| CONTENT_MANAGER | ContentManager | Content Creation | FUNCTIONAL | **Multi-Modal Production Commander** - 1600+ LOC with dynamic specialist resolution (4 specialists: COPYWRITER, CALENDAR_COORDINATOR, VIDEO_SPECIALIST, ASSET_GENERATOR), TechnicalBrief consumption from ARCHITECT_MANAGER, Brand DNA integration (avoidPhrases, toneOfVoice, keyPhrases), SEO-to-Copy keyword injection, ContentPackage synthesis, validateContent() quality gate, SignalBus `content.package_ready` broadcast, parallel execution, graceful degradation |
| ARCHITECT_MANAGER | ArchitectManager | Site Architecture | FUNCTIONAL | **Strategic Infrastructure Commander** - 2100+ LOC with dynamic specialist resolution (3 specialists), Brand DNA integration, TenantMemoryVault Intelligence Brief consumption, SiteArchitecture + TechnicalBrief synthesis, SignalBus `site.blueprint_ready` broadcast, parallel execution, graceful degradation |
| REVENUE_DIRECTOR | RevenueDirector | Sales Ops | FUNCTIONAL | **Sales Ops Commander** - 1800+ LOC with dynamic specialist resolution (5 specialists), Golden Master persona tuning, RevenueBrief synthesis, objection library battlecards, cross-agent signal sharing |
| REPUTATION_MANAGER | ReputationManager | Trust & Reviews | FUNCTIONAL | **Brand Defense Commander** - 2000+ LOC with dynamic specialist resolution (4 specialists: REVIEW_SPECIALIST, GMB_SPECIALIST, REV_MGR, CASE_STUDY), automated review solicitation from sale.completed signals, AI-powered response engine with star-rating strategies, GMB profile optimization coordination, ReputationBrief trust score synthesis, webhook.review.received signal handling, Review-to-Revenue feedback loop |

> **Note:** All 9 managers and the MASTER_ORCHESTRATOR are now FUNCTIONAL with complete specialist orchestration, cross-agent signal communication, and saga-based workflow coordination. **100% Swarm Completion achieved.**

### Specialists (38) - L3 Workers

#### Intelligence Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COMPETITOR_RESEARCHER | CompetitorResearcher | Competitor analysis, SWOT | FUNCTIONAL |
| SENTIMENT_ANALYST | SentimentAnalyst | Sentiment scoring, trend detection | FUNCTIONAL |
| TECHNOGRAPHIC_SCOUT | TechnographicScout | Tech stack analysis | FUNCTIONAL |
| SCRAPER_SPECIALIST | ScraperSpecialist | Web scraping, data extraction | FUNCTIONAL |
| TREND_SCOUT | TrendScout | Market trends, emerging patterns | FUNCTIONAL |

#### Marketing Domain (6)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| TIKTOK_EXPERT | TikTokExpert | Viral content, trends, LISTEN/ENGAGE | FUNCTIONAL |
| TWITTER_EXPERT | TwitterExpert | Threads, engagement, LISTEN/ENGAGE | FUNCTIONAL |
| FACEBOOK_EXPERT | FacebookAdsExpert | Ad copy, targeting, LISTEN/ENGAGE | FUNCTIONAL |
| LINKEDIN_EXPERT | LinkedInExpert | B2B posts, outreach, LISTEN/ENGAGE | FUNCTIONAL |
| SEO_EXPERT | SEOExpert | Keywords, optimization | FUNCTIONAL |
| GROWTH_ANALYST | GrowthAnalyst | Performance analytics, KPIs, mutation directives, content library, weekly reports | FUNCTIONAL |

#### Builder Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_ARCHITECT | UxUiArchitect | Interface design | FUNCTIONAL |
| FUNNEL_ENGINEER | FunnelEngineer | Conversion funnels | FUNCTIONAL |
| ASSET_GENERATOR | AssetGenerator | Graphics, assets | FUNCTIONAL |
| WORKFLOW_OPTIMIZER | WorkflowOptimizer | Process automation | FUNCTIONAL |

#### Architect Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_SPECIALIST | UXUISpecialist | Site UX/UI | FUNCTIONAL |
| FUNNEL_PATHOLOGIST | FunnelPathologist | Funnel analysis | FUNCTIONAL |
| COPY_SPECIALIST | CopySpecialist | Website copy | FUNCTIONAL |

##### ARCHITECT_MANAGER Site Blueprint Orchestration Logic

The ARCHITECT_MANAGER implements dynamic site architecture generation from Brand DNA:

**Architecture Derivation Pipeline:**
1. Load Brand DNA from tenant context (industry, tone, audience, unique value)
2. Query TenantMemoryVault for existing Intelligence Briefs (market context)
3. Derive site requirements: industry type, funnel type, target audience, integrations
4. Generate site map from 7 industry templates (SaaS, Agency, E-commerce, Coach, Local Business, Media, Nonprofit)
5. Design funnel flow from 4 funnel templates (Lead Gen, E-commerce, Course, Service)
6. Execute specialists in parallel with graceful degradation
7. Synthesize SiteArchitecture + TechnicalBrief output

**Output Types:**
- `SiteArchitecture`: Complete site blueprint with siteMap, funnelFlow, navigation, designDirection, contentStructure
- `TechnicalBrief`: API integrations, schema requirements, SEO mandates, performance targets, accessibility checklist

**Industry Templates:**
- SaaS: Features, Pricing, Integrations, Docs, Case Studies (9 pages)
- Agency: Portfolio, Services, Case Studies, Process (8 pages)
- E-commerce: Shop, Product, Cart, Checkout, Account (9 pages)
- Coach: Services, Programs, Resources, Book a Call (9 pages)
- Local Business: Services, Gallery, Reviews (6 pages)
- Media: Articles, Categories, Subscribe (6 pages)
- Nonprofit: Programs, Impact, Donate, Get Involved (8 pages)

**Signal Broadcasting:**
- Broadcasts `site.blueprint_ready` signal to BUILDER_MANAGER, CONTENT_MANAGER, MARKETING_MANAGER
- Stores blueprint as insight in TenantMemoryVault for cross-agent consumption

**Specialist Orchestration:**
- UX_UI_SPECIALIST: Wireframes, component library, color psychology, accessibility
- FUNNEL_PATHOLOGIST: Conversion optimization, urgency tactics, pricing strategy
- COPY_SPECIALIST: Messaging framework, headlines, CTAs, voice alignment

##### BUILDER_MANAGER Blueprint-to-Deployment Orchestration Logic

The BUILDER_MANAGER implements autonomous site construction from architectural blueprints:

**Blueprint-to-Deployment Pipeline:**
1. Receive `site.blueprint_ready` signal from ARCHITECT_MANAGER
2. Load SiteArchitecture from TenantMemoryVault
3. Execute specialists in parallel: UX_UI_ARCHITECT, FUNNEL_ENGINEER, ASSET_GENERATOR
4. Assemble page components by mapping sections to templates
5. Inject tracking pixels (GA4, GTM, Meta Pixel, Hotjar) into page headers
6. Inject custom "Golden Master" conversion scripts as specified by blueprint
7. Generate Vercel-compatible deployment manifest
8. Broadcast `website.build_complete` signal to downstream managers

**Build State Machine:**
- `PENDING_BLUEPRINT` → Awaiting architecture from ARCHITECT_MANAGER
- `ASSEMBLING` → Coordinating specialists, generating components
- `INJECTING_SCRIPTS` → Adding tracking pixels and conversion scripts
- `DEPLOYING` → Generating deployment manifest
- `LIVE` → Build complete, ready for deployment

**Output Types:**
- `AssembledPage[]`: Page components with sections, metadata, scripts, styles
- `AssetPackage`: Logo variants, favicons, social graphics, banners
- `InjectedScripts`: Head scripts, body scripts, dataLayer configuration
- `DeploymentManifest`: Pages, assets, redirects, headers, environment, build config

**Pixel Injection Capabilities:**
- Google Analytics (GA4): gtag.js with measurement ID
- Google Tag Manager: Container script with dataLayer initialization
- Meta Pixel: Facebook conversion tracking with PageView events
- Hotjar: Heatmap and session recording integration
- Custom Scripts: Priority-sorted injection by placement (head/body_start/body_end)

**Signal Broadcasting:**
- Broadcasts `website.build_complete` signal to CONTENT_MANAGER, MARKETING_MANAGER
- Stores build result as insight in TenantMemoryVault for cross-agent consumption

**Specialist Orchestration:**
- UX_UI_ARCHITECT: Design system tokens, color palettes, typography, accessibility
- FUNNEL_ENGINEER: Conversion funnel design, landing page optimization, A/B test setup
- ASSET_GENERATOR: Logo generation, favicon sets, social graphics, banners

##### CONTENT_MANAGER Multi-Modal Content Orchestration Logic

The CONTENT_MANAGER implements multi-modal content production from architectural briefs:

**SEO-to-Copy Injection Workflow:**
1. Receive `site.blueprint_ready` signal from ARCHITECT_MANAGER
2. Load Brand DNA from TenantMemoryVault (toneOfVoice, avoidPhrases, keyPhrases, colorPalette)
3. Extract SEO mandates from TechnicalBrief (perPage keywords, meta templates)
4. Inject SEO keywords into COPYWRITER briefs for each page
5. Execute specialists in parallel with brand + SEO context
6. Synthesize outputs into ContentPackage JSON
7. Validate all copy against avoidPhrases (quality gate)
8. Broadcast `content.package_ready` signal to BUILDER_MANAGER, MARKETING_MANAGER

**Output Types:**
- `ContentPackage`: Complete content package with pageContent, socialSnippets, videoContent, calendar
- `PageContent[]`: H1-H6 headlines, body copy, CTAs, metadata, visuals per page
- `SocialSnippets`: Platform-specific promotional copy (Twitter, LinkedIn, Instagram, TikTok, Facebook)
- `VideoContent`: Storyboards, scripts, thumbnails, video SEO tags
- `ContentCalendar`: Recommended publishing schedule with optimal timing

**Content Validation (Quality Gate):**
- Check ALL copy against Brand DNA avoidPhrases list
- Verify toneOfVoice consistency across all content
- Validate meta description character limits (120-160)
- Ensure alt-text is descriptive for accessibility
- Calculate toneConsistency, seoScore, accessibilityScore

**Signal Broadcasting:**
- Broadcasts `content.package_ready` signal to BUILDER_MANAGER, MARKETING_MANAGER
- Stores content insights in TenantMemoryVault for cross-agent consumption

**Specialist Orchestration:**
- COPYWRITER: Headlines (H1-H6), product descriptions, email copy, ad copy, landing pages
- CALENDAR_COORDINATOR: Content scheduling, optimal posting times, cross-platform coordination
- VIDEO_SPECIALIST: Script-to-storyboard, audio cues, video SEO, thumbnail strategy
- ASSET_GENERATOR: Brand visuals, social graphics, hero images with hex-code palette

#### Commerce Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| PAYMENT_SPECIALIST | PaymentSpecialist | Checkout sessions, payment intents, refunds | FUNCTIONAL |
| CATALOG_MANAGER | CatalogManagerSpecialist | Product CRUD, variants, search | FUNCTIONAL |
| PRICING_STRATEGIST | PricingStrategist | Dynamic pricing, discounts, totals | FUNCTIONAL |
| INVENTORY_MANAGER | InventoryManagerAgent | Stock management, demand forecasting | FUNCTIONAL |

##### COMMERCE_MANAGER Transactional Orchestration Logic

The COMMERCE_MANAGER implements Product-to-Payment commerce orchestration:

**Checkout Orchestration Pipeline:**
1. Fetch tenant commerce settings from TenantMemoryVault (currency, tax config)
2. Validate products via CATALOG_MANAGER
3. Calculate totals via PRICING_STRATEGIST (subtotal, tax, shipping, discounts)
4. Initialize checkout session via PAYMENT_SPECIALIST
5. Handle webhook completion and update inventory
6. Broadcast `commerce.checkout_complete` signal to BUILDER_MANAGER

**Revenue Reporting (CommerceBrief):**
- Transaction Volume and Count
- Inventory health metrics

**Signal Broadcasting:**
- `commerce.checkout_complete` → BUILDER_MANAGER, OUTREACH_MANAGER

**Specialist Orchestration:**
- PAYMENT_SPECIALIST: Stripe checkout sessions, payment intents, webhooks, refunds
- CATALOG_MANAGER: Product fetching, catalog CRUD, variant management, search
- PRICING_STRATEGIST: Price validation, discount application, totals calculation
- INVENTORY_MANAGER: Stock analysis, demand forecasting, reorder alerts

#### Outreach Domain (2)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| EMAIL_SPECIALIST | EmailSpecialist | Email campaigns | FUNCTIONAL |
| SMS_SPECIALIST | SmsSpecialist | SMS outreach | FUNCTIONAL |

##### OUTREACH_MANAGER Multi-Step Sequence Orchestration Logic

The OUTREACH_MANAGER implements omni-channel communication with intelligent sequencing and compliance:

**Multi-Step Sequence Execution Pipeline:**
1. Receive outreach brief with lead profile, sequence steps, and communication settings
2. Query TenantMemoryVault for DNC lists and contact history
3. Query INTELLIGENCE_MANAGER insights for lead sentiment (block HOSTILE)
4. Validate compliance: DNC check, frequency limits, quiet hours
5. Execute sequence steps with channel escalation (EMAIL → SMS → VOICE)
6. Track delivery status and engagement metrics
7. Broadcast signals for completed outreach and unsubscribes

**Channel Escalation Logic:**
- **Step 1-3:** EMAIL channel (cost-effective, async)
- **Step 4-5:** SMS channel (higher urgency, better open rates)
- **Step 6+:** VOICE channel (human escalation for high-value leads)
- Escalation triggers: no response after N attempts, high lead score, time-sensitive offers

**Compliance Enforcement:**
- **DNC Lists:** Check TenantMemoryVault before ANY outreach, block if on list
- **Frequency Throttling:** Max 1 email/day, 1 SMS/week per lead (configurable)
- **Quiet Hours:** No outreach between 9PM-8AM local time (respects lead timezone)
- **Opt-Out Handling:** Immediate DNC list addition on unsubscribe signal

**Sentiment-Aware Routing:**
- Query cached insights from INTELLIGENCE_MANAGER before outreach
- HOSTILE sentiment → Flag for human review, skip automated outreach
- NEGATIVE sentiment → Softer messaging, longer delays between touches
- NEUTRAL/POSITIVE → Standard sequence execution
- Fallback: If no sentiment data, proceed with caution (reduced frequency)

**Output Types:**
- `OutreachResult`: Success/failure, messageIds, delivery status, next step recommendation
- `ComplianceReport`: DNC check result, frequency status, quiet hours validation
- `SequenceProgress`: Current step, completed steps, remaining steps, engagement metrics

**Signal Broadcasting:**
- `outreach.sequence_started` → Sequence initiated for lead
- `outreach.step_completed` → Individual step delivered
- `outreach.sequence_completed` → All steps executed
- `lead.unsubscribed` → Opt-out received, DNC list updated
- `outreach.flagged_for_review` → Human intervention required

**Specialist Orchestration:**
- EMAIL_SPECIALIST: Template rendering, bulk sending, delivery tracking
- SMS_SPECIALIST: E.164 validation, Twilio/Vonage integration, compliance
- VOICE_AI_SPECIALIST: (Future) Warm transfer, voicemail drops

#### Content Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COPYWRITER | Copywriter | Marketing copy | FUNCTIONAL |
| CALENDAR_COORDINATOR | CalendarCoordinator | Content scheduling | FUNCTIONAL |
| VIDEO_SPECIALIST | VideoSpecialist | Video scripts | FUNCTIONAL |

#### Sales Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| MERCHANDISER | MerchandiserSpecialist | Product merchandising | FUNCTIONAL |
| OUTREACH_SPECIALIST | OutreachSpecialist | Sales outreach | FUNCTIONAL |
| LEAD_QUALIFIER | LeadQualifierSpecialist | Lead scoring | FUNCTIONAL |
| DEAL_CLOSER | DealCloserSpecialist | Closing strategies | FUNCTIONAL |
| OBJ_HANDLER | ObjectionHandlerSpecialist | Objection handling | FUNCTIONAL |

##### REVENUE_DIRECTOR Golden Master Tuning Logic

The REVENUE_DIRECTOR implements dynamic persona adjustment based on win/loss signals from the CRM:

**Persona Weight Adjustments:**
- `urgencyEmphasis` (0-1): Increases when avg days-to-close < 25, decreases when > 45
- `valueStackDepth` (0-1): Increases when competitor losses exceed 30% of total losses
- `objectionPreemption` (0-1): Increases when price/timing objections exceed 40%
- `followUpPersistence` (0-1): Increases when win rate < 30%, decreases when > 60%
- `discountWillingness` (0-1): Increases when price objections exceed 30% of losses
- `closingAggression` (0-1): Increases when win rate > 50% AND avg close < 30 days

**Signal Sources:**
- `deal.won` - Positive outcome signals from DEAL_CLOSER
- `deal.lost` - Loss signals with reason analysis
- TenantMemoryVault cross-agent communication

**Feedback Loop:**
DEAL_CLOSER closed-won signals are broadcast to LEAD_QUALIFIER for continuous BANT threshold optimization.

#### Trust Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| GMB_SPECIALIST | GMBSpecialist | Google My Business, local SEO | FUNCTIONAL |
| REVIEW_SPECIALIST | ReviewSpecialist | Review management | FUNCTIONAL |
| REV_MGR | ReviewManagerSpecialist | Review response | FUNCTIONAL |
| CASE_STUDY | CaseStudyBuilderSpecialist | Case study creation | FUNCTIONAL |

##### REPUTATION_MANAGER Brand Guardian Orchestration Logic

The REPUTATION_MANAGER implements brand defense through coordinated review management and trust score synthesis:

**Review-to-Revenue Feedback Loop:**
1. Receive `sale.completed` signal from REVENUE_DIRECTOR
2. Extract customer profile and purchase details
3. Calculate optimal review solicitation timing (3-7 days post-purchase)
4. Broadcast `reputation.review_solicitation_requested` signal to OUTREACH_MANAGER
5. Store solicitation record in TenantMemoryVault for tracking

**AI-Powered Response Engine:**
1. Receive `webhook.review.received` signal
2. Delegate to REVIEW_SPECIALIST for sentiment-aware response generation
3. Apply star-rating specific strategies (1-star Crisis → 5-star Amplification)
4. Load Brand DNA for tone alignment
5. For negative reviews (1-3 stars): Flag HIGH PRIORITY, queue for human approval
6. For positive reviews (4-5 stars): Auto-approve with review option
7. Cache successful response templates in TenantMemoryVault

**Trust Score Synthesis (ReputationBrief):**
- Overall Trust Score: 0-100 composite metric
- Components: Average Rating, Review Velocity, Sentiment Score, Response Rate, NPS
- Trend Analysis: IMPROVING | DECLINING | STABLE
- Platform-specific metrics: Google, Yelp, Facebook, Other
- GMB Health: Profile completeness, posting frequency, map pack position
- Actionable recommendations based on trust metrics

**Signal Integration:**
- Receives: `sale.completed`, `deal.won`, `webhook.review.received`, `review.received`
- Broadcasts: `reputation.review_solicitation_requested`, `reputation.gmb_updated`
- Shares: PERFORMANCE insights for trust metrics, AUDIENCE insights for solicitations

**Specialist Orchestration:**
- REVIEW_SPECIALIST: Sentiment-aware response generation, star-rating strategies
- GMB_SPECIALIST: Local SEO optimization, profile updates, map pack positioning
- SENTIMENT_ANALYST: Deep sentiment analysis, crisis detection, trend monitoring

### Standalone Agents (4) - Outside Swarm Hierarchy

These agents operate independently of the L1/L2/L3 swarm hierarchy:

| Agent | Type | Path | Status | Description |
|-------|------|------|--------|-------------|
| Jasper | Platform AI Assistant | Firestore `goldenMasters/` + `src/lib/orchestrator/jasper-tools.ts` | FUNCTIONAL | Jasper — the platform AI assistant and primary human interface to the agent swarm. Delegates to all 9 domain managers via tool functions. Provides strategic guidance across the platform. |
| Voice Agent Handler | Voice AI Agent | `src/lib/voice/voice-agent-handler.ts` | FUNCTIONAL | Hybrid AI/human voice agent with two modes: **Prospector** (lead qualification) and **Closer** (deal closing with warm transfer). API routes: `src/app/api/voice/ai-agent/` |
| Autonomous Posting Agent | Social Media Automation | `src/lib/social/autonomous-posting-agent.ts` | FUNCTIONAL | Manages autonomous content posting across LinkedIn and Twitter/X with scheduling, queueing, and analytics tracking. |
| Chat Session Service | Agent Infrastructure | `src/lib/agent/chat-session-service.ts` | FUNCTIONAL | Manages real-time AI chat sessions and agent instance lifecycle. `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) handles ephemeral agent instances spawned from Golden Masters. |

### Agent File Locations

```
src/lib/agents/
├── index.ts                    # Swarm registry & exports
├── types.ts                    # Agent type definitions
├── base-specialist.ts          # Base specialist class
├── base-manager.ts             # Base manager class
├── orchestrator/
│   └── manager.ts              # MASTER_ORCHESTRATOR (Swarm CEO) - L1 Orchestrator
├── shared/
│   ├── index.ts
│   └── tenant-memory-vault.ts  # Cross-agent memory
├── intelligence/
│   ├── manager.ts
│   ├── competitor/specialist.ts
│   ├── sentiment/specialist.ts
│   ├── technographic/specialist.ts
│   ├── scraper/specialist.ts
│   └── trend/specialist.ts
├── marketing/
│   ├── manager.ts
│   ├── tiktok/specialist.ts
│   ├── twitter/specialist.ts
│   ├── facebook/specialist.ts
│   ├── linkedin/specialist.ts
│   └── seo/specialist.ts
├── builder/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   ├── assets/specialist.ts
│   └── workflow/specialist.ts
├── architect/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   └── copy/specialist.ts
├── commerce/
│   ├── manager.ts
│   ├── payment/specialist.ts
│   ├── subscription/specialist.ts
│   ├── catalog/specialist.ts
│   ├── pricing/specialist.ts
│   └── inventory/specialist.ts
├── outreach/
│   ├── manager.ts
│   ├── email/specialist.ts
│   └── sms/specialist.ts
├── content/
│   ├── manager.ts
│   ├── copywriter/specialist.ts
│   ├── calendar/specialist.ts
│   └── video/specialist.ts
├── sales/
│   ├── revenue/manager.ts
│   ├── merchandiser/specialist.ts
│   ├── outreach/specialist.ts
│   ├── qualifier/specialist.ts
│   ├── deal-closer/specialist.ts
│   └── objection-handler/specialist.ts
└── trust/
    ├── reputation/manager.ts
    ├── gmb/
    │   ├── index.ts
    │   ├── specialist.ts
    │   └── README.md
    ├── review/specialist.ts
    ├── review-manager/specialist.ts
    └── case-study/specialist.ts

# Standalone Agent Files (outside swarm)
src/lib/orchestrator/jasper-tools.ts    # Jasper AI assistant tools
src/lib/voice/voice-agent-handler.ts    # Voice AI Agent (Prospector/Closer)
src/lib/social/autonomous-posting-agent.ts  # Autonomous Social Posting
src/lib/agent/chat-session-service.ts   # Chat Session Service
src/lib/agent/instance-manager.ts       # Agent Instance Manager
```

---

## Unified RBAC Matrix

### Role Hierarchy (4-Role RBAC — Phase 11)

| Role | Level | Description |
|------|-------|-------------|
| `owner` | 3 | Master key — full system access, can delete org, impersonate users |
| `admin` | 2 | Full access minus org deletion and user impersonation |
| `manager` | 1 | Team lead — CRM, marketing, sales, limited user/data management |
| `member` | 0 | Individual contributor — own records, limited read access |

**Source of Truth:** `src/types/unified-rbac.ts` — `UNIFIED_ROLE_PERMISSIONS` constant
**Legacy Compatibility:** `src/types/permissions.ts` re-exports from unified-rbac.ts (31-field subset)

### Permission Categories (4-Role RBAC)

#### Platform Administration (8 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canAccessPlatformAdmin | YES | YES | - | - |
| canManageAllOrganizations | YES | YES | - | - |
| canViewSystemHealth | YES | YES | - | - |
| canManageFeatureFlags | YES | YES | - | - |
| canViewAuditLogs | YES | YES | - | - |
| canManageSystemSettings | YES | YES | - | - |
| canImpersonateUsers | YES | - | - | - |
| canAccessSupportTools | YES | YES | - | - |

#### Organization Management (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageOrganization | YES | YES | - | - |
| canManageBilling | YES | YES | - | - |
| canManageAPIKeys | YES | YES | - | - |
| canManageTheme | YES | YES | YES | - |
| canDeleteOrganization | YES | - | - | - |

#### User Management (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canInviteUsers | YES | YES | YES | - |
| canRemoveUsers | YES | YES | - | - |
| canChangeUserRoles | YES | YES | - | - |
| canViewAllUsers | YES | YES | YES | - |

#### Data Management (7 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateSchemas | YES | YES | - | - |
| canEditSchemas | YES | YES | YES | - |
| canDeleteSchemas | YES | YES | - | - |
| canExportData | YES | YES | YES | YES |
| canImportData | YES | YES | YES | - |
| canDeleteData | YES | YES | - | - |
| canViewAllRecords | YES | YES | YES | - |

#### CRM Operations (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateRecords | YES | YES | YES | YES |
| canEditRecords | YES | YES | YES | YES |
| canDeleteRecords | YES | YES | YES | - |
| canViewOwnRecordsOnly | - | - | - | YES |
| canAssignRecords | YES | YES | YES | - |

#### Workflows & Automation (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateWorkflows | YES | YES | YES | - |
| canEditWorkflows | YES | YES | YES | - |
| canDeleteWorkflows | YES | YES | - | - |

#### AI Agents & Swarm (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canTrainAIAgents | YES | YES | YES | - |
| canDeployAIAgents | YES | YES | YES | - |
| canManageAIAgents | YES | YES | - | - |
| canAccessSwarmPanel | YES | YES | YES | - |

#### Marketing (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageSocialMedia | YES | YES | YES | - |
| canManageEmailCampaigns | YES | YES | YES | - |
| canManageWebsite | YES | YES | YES | - |

#### Sales (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canViewLeads | YES | YES | YES | YES |
| canManageLeads | YES | YES | YES | - |
| canViewDeals | YES | YES | YES | YES |
| canManageDeals | YES | YES | YES | - |
| canAccessVoiceAgents | YES | YES | YES | - |

#### Reports & Analytics (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canViewReports | YES | YES | YES | YES |
| canCreateReports | YES | YES | YES | - |
| canExportReports | YES | YES | YES | - |
| canViewPlatformAnalytics | YES | YES | YES | - |

#### Settings (2 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canAccessSettings | YES | YES | YES | - |
| canManageIntegrations | YES | YES | - | - |

#### E-Commerce (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageEcommerce | YES | YES | YES | - |
| canProcessOrders | YES | YES | YES | YES |
| canManageProducts | YES | YES | YES | - |

### Navigation Section Visibility (12 Sections — 4-Role RBAC)

**12 Unified Sections** in `AdminSidebar.tsx` (permission-gated per role via `filterNavigationByRole()`):

| Section | owner | admin | manager | member | Key Permission |
|---------|-------|-------|---------|--------|----------------|
| 1. Command Center | YES | YES | YES | YES | - |
| 2. CRM | YES | YES | YES | YES* | canViewLeads, canViewDeals |
| 3. Lead Gen | YES | YES | YES | - | canManageLeads |
| 4. Outbound | YES | YES | YES | - | canManageLeads, canManageEmailCampaigns |
| 5. Content Factory | YES | YES | YES | - | canManageSocialMedia |
| 6. AI Workforce | YES | YES | YES | - | canDeployAIAgents, canTrainAIAgents |
| 7. Automation | YES | YES | YES | - | canCreateWorkflows |
| 8. E-Commerce | YES | YES | YES | YES* | canProcessOrders |
| 9. Compliance | YES | YES | - | - | canViewAuditLogs |
| 10. Analytics | YES | YES | YES | YES* | canViewReports |
| 11. Website | YES | YES | YES | - | canManageWebsite |
| 12. Settings | YES | YES | YES | - | canAccessSettings |

*Member sees limited items based on specific permissions

### RBAC Source Files

- **Definitions:** `src/types/unified-rbac.ts` (single source of truth)
- **Legacy re-export:** `src/types/permissions.ts` (thin compatibility layer)
- **Sidebar filtering:** `src/components/admin/AdminSidebar.tsx` → `filterNavigationByRole()`
- **API middleware:** `src/lib/auth/api-auth.ts` → `requireRole()`
- **Claims mapping:** `src/lib/auth/claims-validator.ts` → `validateRole()`
- **Client hooks:** `src/hooks/useUnifiedAuth.ts`, `src/hooks/useAuth.ts`

---

## Security Audit Findings

### Authentication Flow

#### Client-Side (`useUnifiedAuth` hook)

```
1. Firebase user signs in
   ↓
2. Get Firebase ID token
   ↓
3. Check Firestore USERS collection
   ├─ If document exists → Load user profile
   │  └─ Extract role (owner|admin|manager|member)
   └─ If document missing → User is unauthenticated
   ↓
4. Set permissions via getUnifiedPermissions(role)
   ↓
5. Return UnifiedUser + UnifiedPermissions
```

#### Server-Side (`src/lib/auth/api-auth.ts`)

```
1. Extract Bearer token from Authorization header
   ↓
2. Verify token using Firebase Admin SDK
   ↓
3. Extract custom claims from decoded token
   ├─ role, admin flag
   ↓
4. If no role in claims → Try Firestore lookup
   ├─ Check USERS collection for user document
   ↓
5. Return AuthenticatedUser with uid, email, role
   ↓
6. Route-level checks (requireRole) enforce access
```

### API Protection Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireAuth(request)` | Basic authentication | 401 if invalid token |
| `requireRole(request, allowedRoles[])` | Role-based access (4-role RBAC) | 403 if role not in whitelist |
| `optionalAuth(request)` | Non-blocking authentication | User or null |

### Security Strengths

| Strength | Implementation | Files |
|----------|----------------|-------|
| Single-Tenant Security | All requests operate under DEFAULT_ORG_ID | `claims-validator.ts`, `api-auth.ts` |
| 4-Role RBAC | owner/admin/manager/member with differentiated permission matrices | `unified-rbac.ts` |
| Token Verification | Firebase Admin SDK validates ID tokens server-side | `api-auth.ts` |
| Layout-Level Auth | Admin routes protected at layout level before render | `admin/layout.tsx` |
| Permission Matrix | Comprehensive 47-permission definitions per role | `unified-rbac.ts` |

### Security Concerns

| Severity | Issue | Location | Status |
|----------|-------|----------|--------|
| ~~CRITICAL~~ | ~~82 API routes missing authentication~~ | `src/app/api/**` | ✅ **RESOLVED 2026-02-11** — Day 4 security hardening sprint added `requireAuth` to all 82 unprotected dashboard routes. See [API Route Protection Summary](#api-route-protection-summary) below. |
| ~~MEDIUM~~ | ~~Demo mode fallback in useAuth.ts~~ | `src/hooks/useAuth.ts` | ✅ RESOLVED - Wrapped in `NODE_ENV === 'development'` check |
| ~~LOW~~ | ~~Inconsistent role naming~~ | Multiple files | ✅ RESOLVED - 4-role RBAC (owner|admin|manager|member) deployed. claims-validator maps legacy strings. |
| LOW | Token claim extraction lacks strict validation | `api-auth.ts` | Add runtime type guards |
| LOW | Manual organization check in agent routes | `/api/agent/chat` | Create decorator pattern for auto org validation |
| ~~CRITICAL~~ | ~~Auth Handshake Failure: `useSystemStatus` hook missing Authorization header~~ | `src/hooks/useSystemStatus.ts` | ✅ **RESOLVED 2026-01-29** - Implemented reactive auth handshake with fresh Firebase ID Token per request. Features: (1) `onAuthStateChanged` listener for reactive auth state, (2) `getIdToken()` called inside fetch for token freshness, (3) Auth-ready polling kill-switch, (4) Graceful 401/403 error handling via `connectionError` state, (5) Proper cleanup on unmount. `/api/system/status` is now **AUTHENTICATED-LIVE**. |

### API Route Protection Summary

**Audit Date:** February 11, 2026
**Total Routes:** 228

| Protection Type | Count | Details |
|----------------|-------|---------|
| `requireAuth` middleware | ~167 | Standard dashboard route protection (82 added Feb 11) |
| `verifyAdminRequest` | ~15 | Admin routes via `@/lib/api/admin-auth` |
| `requireUserRole` | 2 | Admin template routes via `@/lib/auth/server-auth` |
| Manual `verifyIdToken` | ~8 | Workflows, lead-scoring (Firebase Admin SDK direct) |
| `CRON_SECRET` verification | 5 | Cron jobs: intelligence-sweep, operations-cycle, social-metrics, process-sequences, scheduled-publisher |
| Legitimately public | 31 | Webhooks (6), OAuth callbacks (7), tracking pixels (3), TwiML/voice (5), public website (5), health/chat/forms (3), workflow webhooks (1), RSS/robots/sitemap (1) |

**Auth systems in use:**
- `requireAuth` from `@/lib/auth/api-auth` — primary dashboard auth (verifies Firebase token, returns `{ user }` or 401)
- `requireRole` from `@/lib/auth/api-auth` — role-gated access (extends requireAuth with role check)
- `verifyAdminRequest` from `@/lib/api/admin-auth` — admin routes (token + admin role verification)
- `requireUserRole` from `@/lib/auth/server-auth` — server-side role enforcement
- Manual `getAuth(adminApp).verifyIdToken(token)` — used in workflows and lead-scoring routes

**Utility:** `scripts/find-unprotected.ps1` — PowerShell script to scan for routes missing auth patterns

### Admin Account Bootstrap

To properly configure an admin account, Firebase custom claims must be set:

```bash
# Run the bootstrap script (one-time setup)
node scripts/bootstrap-platform-admin.js
```

This script:
- Sets Firebase custom claims: `{ role: "admin", admin: true }`
- Updates Firestore user document with standardized role
- Verifies claims were successfully applied

**Note:** Custom claims provide the primary authentication mechanism. The 4-role RBAC system uses owner (level 3), admin (level 2), manager (level 1), and member (level 0).

### Protected Route Patterns

#### Middleware Routing (`src/middleware.ts`)

| Route Pattern | Authentication | Enforcement |
|---------------|----------------|-------------|
| `/admin/*` | Any user (layout enforces role) | Admin Layout |
| `/workspace/platform-admin/*` | N/A | 308 redirect to `/admin/*` |
| `/sites/{orgId}/*` | Not required | Middleware rewrite |
| `/api/*` | Skipped at middleware | Per-route enforcement |

#### Admin Layout Enforcement (`src/app/admin/layout.tsx`)

- Unauthenticated → `/admin-login`
- Non-admin role → `/(dashboard)/dashboard`
- Only admin-level users (owner or admin role) allowed through

### Public Routes (No Auth Required)

```
/                    # Landing page
/login               # User login
/admin-login         # Admin login
/signup              # User signup
/security            # Security page
/privacy             # Privacy policy
/terms               # Terms of service
```

### Files Containing RBAC Logic

**Authentication & Authorization:**
- `src/lib/auth/api-auth.ts` - API endpoint auth middleware
- `src/lib/auth/auth-service.ts` - Firebase auth operations
- `src/lib/auth/claims-validator.ts` - Claims-based authorization
- `src/lib/auth/server-auth.ts` - Server-side auth utilities

**Type Definitions:**
- `src/types/unified-rbac.ts` - Unified role/permission definitions
- `src/types/admin.ts` - Admin-specific types
- `src/types/permissions.ts` - Legacy permission types

**Client Hooks:**
- `src/hooks/useUnifiedAuth.ts` - Primary client-side auth hook
- `src/hooks/useAuth.ts` - Legacy auth hook (has demo mode)
- `src/hooks/useAdminAuth.ts` - Admin-specific auth hook

---

## Tooling Inventory

### API Routes (240 Total)

| Category | Count | Path Pattern | Status |
|----------|-------|--------------|--------|
| Admin | 21 | `/api/admin/*` | Mostly functional |
| Analytics | 8 | `/api/analytics/*` | Functional |
| Agent | 4 | `/api/agent/*` | Partial |
| Battlecard | 4 | `/api/battlecard/*` | Functional |
| Billing | 3 | `/api/billing/*` | Functional |
| Coaching | 2 | `/api/coaching/*` | Functional |
| CRM | 9 | `/api/crm/*` | Functional |
| Cron | 1 | `/api/cron/social-listening-collector` | Functional (NEW Feb 12) |
| Discovery | 1 | `/api/discovery/*` | Functional |
| E-commerce | 5 | `/api/ecommerce/*` | Functional (orders path fixed Feb 12) |
| Email | 4 | `/api/email-writer/*`, `/api/email/*` | Functional |
| Health | 2 | `/api/health/*` | Functional |
| Integrations | 18 | `/api/integrations/*` | Functional |
| Lead Scoring | 3 | `/api/lead-scoring/*` | Functional |
| Leads | 3 | `/api/leads/*` | Functional |
| Learning | 2 | `/api/learning/*` | Partial |
| Meetings | 1 | `/api/meetings/*` | Functional |
| Onboarding | 1 | `/api/onboarding/*` | Functional |
| Orchestrator | 3 | `/api/orchestrator/*` | Functional |
| Outbound | 3 | `/api/outbound/*` | Functional |
| Performance | 1 | `/api/performance/*` | Functional |
| Playbook | 1 | `/api/playbook/*` | Functional |
| Proposals | 1 | `/api/proposals/*` | Functional |
| Recovery | 1 | `/api/recovery/*` | Functional |
| Reports | 1 | `/api/reports/*` | Partial |
| Risk | 1 | `/api/risk/*` | Functional |
| Schemas | 6 | `/api/schema*/*` | Functional |
| Settings | 1 | `/api/settings/webhooks` | Functional (NEW Feb 12) |
| Social | 12 | `/api/social/*` | Functional (EXPANDED Feb 13 — added agent-status, activity) |
| Team | 1 | `/api/team/tasks/[taskId]` | Functional (NEW Feb 12) |
| Other | ~125 | Various | Mixed |

### Key API Endpoints

#### Orchestrator (Jasper AI)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/orchestrator/chat` | POST | Jasper conversation | FUNCTIONAL |
| `/api/orchestrator/system-health` | GET | System health | FUNCTIONAL |
| `/api/orchestrator/feature-toggle` | POST | Feature flags | FUNCTIONAL |

#### Admin Operations

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/admin/organizations` | GET/POST | Organization CRUD | FUNCTIONAL |
| `/api/admin/users` | GET | User listing | FUNCTIONAL |
| `/api/admin/provision` | POST | Provision new org | FUNCTIONAL |
| `/api/admin/platform-pricing` | GET/PUT | Pricing config | FUNCTIONAL |
| `/api/admin/platform-coupons` | GET/POST | Coupon management | FUNCTIONAL |

#### Voice & AI

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/voice/*` | Various | Voice agent operations | FUNCTIONAL |
| `/api/agent/config` | GET/PUT | Agent configuration | FUNCTIONAL |
| `/api/agent/knowledge/upload` | POST | Knowledge base upload | FUNCTIONAL |

#### Social Media Platform (NEW Feb 12)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/social/accounts` | GET/POST/PUT/DELETE | Multi-account management | FUNCTIONAL |
| `/api/social/settings` | GET/PUT | Agent config tuning | FUNCTIONAL |
| `/api/social/media/upload` | POST | Media upload to Firebase Storage | FUNCTIONAL |
| `/api/social/media/[mediaId]` | GET/DELETE | Media retrieval and deletion | FUNCTIONAL |
| `/api/social/approvals` | GET/POST/PUT | Approval workflow management | FUNCTIONAL |
| `/api/social/calendar` | GET | Content calendar aggregation | FUNCTIONAL |
| `/api/social/listening` | GET/PUT | Social listening mentions | FUNCTIONAL |
| `/api/social/listening/config` | GET/PUT | Listening configuration | FUNCTIONAL |
| `/api/cron/social-listening-collector` | GET | Social listening cron job | FUNCTIONAL |
| `/api/social/agent-status` | GET/POST | Agent status dashboard + kill switch toggle | FUNCTIONAL (NEW Feb 13) |
| `/api/social/activity` | GET | Chronological activity feed from posts/approvals/queue | FUNCTIONAL (NEW Feb 13) |
| `/api/social/posts` | GET/POST/PUT/DELETE | Social post CRUD | FUNCTIONAL (existing) |

### API Implementation Notes

The following endpoints have working infrastructure (rate limiting, caching, auth) but use **mock data** for core business logic:

| Endpoint | Issue | Priority |
|----------|-------|----------|
| `/api/coaching/team` | Team member query returns hardcoded IDs | HIGH |
| `/api/crm/deals/[dealId]/recommendations` | Auth implementation incomplete | MEDIUM |
| `/api/crm/deals/monitor/start` | Monitor lifecycle not fully implemented | LOW |
| `/api/webhooks/gmail` | Auto-meeting booking has TODO | LOW |
| `/api/voice/twiml` | Audio fallback uses placeholder URL | LOW |

**RESOLVED (January 30, 2026):**
- `/api/admin/social/post` - Now persists scheduled posts to Firestore via `SocialPostService`
- `/api/admin/video/render` - New endpoint with real `jobId` persistence via `VideoJobService`
- `/api/admin/promotions` - ✅ **NEW** Full CRUD for promotional campaigns via `PromotionService`
  - POST: Create promotion with Zod validation, Firestore persistence
  - GET: Fetch all promotions with analytics aggregation
  - DELETE: Remove promotion by ID
  - Service: `src/lib/promotions/promotion-service.ts`

**RESOLVED (February 12, 2026) - Social Media Platform Enhancement:**
- `/api/social/*` - 6-phase expansion with enterprise-grade features
  - Multi-account management (`src/lib/social/social-account-service.ts`)
  - Dynamic agent configuration (`src/lib/social/agent-config-service.ts`)
  - Media uploads via Firebase Storage (`src/lib/social/media-service.ts`)
  - Approval workflow with status tracking (`src/lib/social/approval-service.ts`)
  - Social listening with AI sentiment analysis (`src/lib/social/listening-service.ts`, `src/lib/social/sentiment-analyzer.ts`)
  - Content calendar aggregation across all platforms

**RESOLVED (February 13, 2026) - AI Social Media Command Center & Page Buildout:**
- `/api/social/agent-status` (GET/POST) — Agent status dashboard with kill switch toggle, velocity usage, queue depth, platform connections
- `/api/social/activity` (GET) — Chronological activity feed from posts/approvals/queue with event type mapping
- Kill switch (`agentEnabled` boolean) added to `AutonomousAgentSettings` type, config defaults, Zod schema, and `executeAction()` guard
- 4 new frontend pages: Command Center, Activity Feed, Analytics Dashboard, Agent Rules
- 2 upgraded pages: Content Studio (dual-mode autopilot/manual), Approval Queue (batch, correction capture, Why badge)

### Testing Infrastructure (Audit: January 30, 2026)

#### Test Frameworks Installed

| Framework | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Jest | ^30.2.0 | Unit tests, Jest E2E | FUNCTIONAL |
| Playwright | ^1.57.0 | Browser E2E testing | ✅ OPERATIONAL |
| @playwright/test | ^1.57.0 | Playwright test runner | ✅ OPERATIONAL |

#### Playwright Configuration

**File:** `playwright.config.ts`

| Setting | Value | Status |
|---------|-------|--------|
| testDir | `./tests/e2e` | ✅ Configured |
| testMatch | `**/*.spec.ts` | ✅ CONFIGURED |
| baseURL | `http://localhost:3000` | ✅ Configured |
| reporter | `html` | ✅ Configured |
| projects | 5 (chromium, firefox, webkit, mobile) | ✅ Configured |

**RESOLVED (January 30, 2026):** Added `testMatch: '**/*.spec.ts'` to isolate Playwright specs from Jest E2E tests. Test discovery now functional.

#### Test File Naming Conventions

| Pattern | Framework | Directory | Count |
|---------|-----------|-----------|-------|
| `*.spec.ts` | Playwright | `tests/e2e/` | 4 |
| `*.e2e.test.ts` | Jest | `tests/e2e/` | 3 |
| `*.test.ts` | Jest | `tests/` | Various |

**Playwright E2E Tests (Valid):**
- `website-builder.spec.ts` (16 tests)
- `voice-engine.spec.ts` (22 tests)
- `admin-gateway.spec.ts` (Admin login/theme audit)
- `admin-content-factory.spec.ts` (Content & AI management audit)
- `admin-routes-audit.spec.ts` ✅ **NEW** (46-route visual audit with trace)

**Jest E2E Tests (Separate Runner):**
- `email-sequences.e2e.test.ts`
- `ecommerce-checkout.e2e.test.ts`
- `ui-pages.e2e.test.ts`

#### Test Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `jest` | Unit tests |
| `test:e2e` | `jest --testPathPattern=e2e --runInBand` | Jest E2E |
| `test:playwright` | `playwright test` | ✅ Playwright E2E |
| `test:playwright:ui` | `playwright test --ui` | ✅ Playwright UI mode |

#### Readiness Status

| Criterion | Status |
|-----------|--------|
| Playwright installed | ✅ PASS |
| Config file exists | ✅ PASS |
| Test discovery | ✅ PASS (200 tests across 5 projects) |
| Autonomous testing | ✅ OPERATIONAL |

**Full Audit Report:** `docs/playwright-audit-2026-01-30.md`

---

### TESTING INFRASTRUCTURE: PLAYWRIGHT ACTIVATION

**Status:** ✅ OPERATIONAL

**Fix Applied:** January 30, 2026

**Configuration Change:**
```typescript
// playwright.config.ts
testMatch: '**/*.spec.ts',
```

**Test Discovery Results:**
- **Total Tests:** 200
- **Spec Files:** 2 (`voice-engine.spec.ts`, `website-builder.spec.ts`)
- **Browser Projects:** 5 (chromium, firefox, webkit, Mobile Chrome, Mobile Safari)
- **Jest Conflict:** RESOLVED (`.e2e.test.ts` files are now correctly ignored)

**Naming Convention Standard:**
| Pattern | Framework | Purpose |
|---------|-----------|---------|
| `*.spec.ts` | Playwright | Browser-based E2E tests |
| `*.e2e.test.ts` | Jest | API/integration E2E tests |
| `*.test.ts` | Jest | Unit tests |

**Autonomous Test-Fix-Verify Cycles:** Enabled

---

### INFRASTRUCTURE: AUTOMATED CLEANUP PROTOCOL

**Status:** ✅ ACTIVE

**Implemented:** January 30, 2026

**Location:** `tests/helpers/e2e-cleanup-utility.ts`

**Purpose:** Zero-residual E2E testing with guaranteed Firestore cleanup

#### Core Components

| Component | Description |
|-----------|-------------|
| `E2ECleanupTracker` | Class for tracking and cleaning E2E test artifacts |
| `E2E_PREFIX` | `E2E_TEMP_` - mandatory prefix for all test data |
| `deleteSubcollectionsRecursively()` | Recursive sub-collection deletion using Firebase Admin SDK |
| `verifyDeleted()` | 404 verification to confirm complete deletion |
| `cleanupAllWithVerification()` | Orchestrated cleanup with verification |

#### Protected Organizations

The following organization IDs are **hardcoded as protected** and will NEVER be deleted:
- `platform`
- `platform-internal-org`
- `org_demo_auraflow`
- `org_demo_greenthumb`
- `org_demo_adventuregear`
- `org_demo_summitwm`
- `org_demo_pixelperfect`

> **Safety:** Any attempt to track a protected org is blocked with console error.

#### Cleanup Protocol

```typescript
// 1. Generate prefixed org ID
const orgId = tracker.generateOrgId('content_audit');
// Result: E2E_TEMP_org_content_audit_1738276800000

// 2. Track for cleanup
tracker.trackOrganization(orgId);

// 3. Run tests...

// 4. Cleanup with verification
const report = await tracker.cleanupAllWithVerification();
// Returns: { success: boolean, organizationsDeleted: number, ... }
```

#### Recursive Deletion Strategy

The cleanup utility uses **dynamic sub-collection discovery** via Firebase Admin SDK's `listCollections()` method, ensuring ALL nested data is deleted regardless of schema evolution.

**Known Organization Sub-Collections (24):**
```
workspaces          workflows           workflowExecutions
deals               leads               contacts
users               members             records
signals             sequences           sequenceEnrollments
campaigns           trainingSessions    goldenMasters
goldenMasterUpdates baseModels          scheduledPosts
socialPosts         videoJobs           storyboards
analytics_events    merchant_coupons    schemas
apiKeys             integrations        auditLogs
```

**Deletion Tree Example:**
```
Organization Document (E2E_TEMP_org_content_audit_1738276800000)
├── [Dynamic Discovery via listCollections()]
├── members/
│   └── E2E_TEMP_user_abc123 (deleted)
├── leads/
│   └── E2E_TEMP_lead_xyz789 (deleted)
│       └── activities/ (nested sub-collection deleted)
├── campaigns/
│   └── E2E_TEMP_campaign_001 (deleted)
└── [All discovered sub-collections recursively deleted]
```

**Batch Size:** 400 operations per batch (Firestore limit: 500)

**Depth-First Traversal:** Nested sub-collections are deleted BEFORE their parent documents to ensure complete cleanup.

#### Integration with E2E Tests

```typescript
// admin-content-factory.spec.ts
import { E2ECleanupTracker, E2E_PREFIX } from '../helpers/e2e-cleanup-utility';

test.afterAll(async () => {
  const report = await tracker.cleanupAllWithVerification();
  expect(report.success).toBe(true);
  console.info('[E2E Cleanup] Report:', report);
});
```

#### Stale Data Detection

Utility function to find and clean orphaned E2E data:
```typescript
import { cleanupAllE2ETempData } from '../helpers/e2e-cleanup-utility';

// Scans organizations collection for E2E_TEMP_ prefixed IDs
// Uses Firestore range query: __name__ >= 'E2E_TEMP_' AND < 'E2E_TEMP_\uf8ff'
const totalCleaned = await cleanupAllE2ETempData();
console.info(`Cleaned ${totalCleaned} stale E2E documents`);
```

**Safety Features:**
- Prefix enforcement: Only deletes IDs starting with `E2E_TEMP_`
- Protected org check: Skips all 7 protected organization IDs
- Verification query: 404 check confirms complete deletion
- Detailed logging: Console output for audit trail

---

## Infrastructure Systems

> **Audit Note (January 27, 2026):** These systems are fully implemented but were previously undocumented.

### Rate Limiting

**Implementation:** In-memory rate limiting with configurable windows per endpoint.

| Endpoint Category | Limit | Window | File |
|-------------------|-------|--------|------|
| Health endpoints | 10 req | 60s | `src/lib/rate-limit/rate-limiter.ts` |
| Billing webhooks | 100 req | 60s | `/api/billing/webhook/route.ts` |
| Coaching/team | 20 req | 60s | `/api/coaching/team/route.ts` |
| Lead routing | 10 req | 60s | `/api/routing/route-lead/route.ts` |
| Notifications | 50 req | 60s | `/api/notifications/send/route.ts` |

**Response:** HTTP 429 with `Retry-After` header when limit exceeded.

### Notification System

**Location:** `src/lib/notifications/notification-service.ts`

| Feature | Description |
|---------|-------------|
| **Multi-Channel** | Slack, Email, Webhook, In-App |
| **Templates** | Template-based notification content |
| **Preferences** | User preference respect (quiet hours, channels, categories) |
| **Retry Logic** | Exponential backoff with configurable retries |
| **Smart Batching** | Batches notifications for efficiency |
| **Delivery Tracking** | Analytics for sent/delivered/failed |

**API Endpoints:**
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/list` - List notifications
- `GET/PUT /api/notifications/preferences` - Manage preferences

### Background Processing

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/cron/scheduled-publisher` | CRON_SECRET env var | Scheduled content publishing |

**Note:** Vercel cron jobs can trigger this endpoint on a schedule.

### Response Caching

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| `/api/coaching/team` | 1 hour | `team-insights-{teamId}-{period}` |

**Implementation:** In-memory cache with automatic TTL expiration.

### Lead Routing System (FUNCTIONAL)

**Location:** `src/app/api/routing/route-lead/route.ts`, `src/lib/crm/lead-routing.ts`

**Status:** PRODUCTION - Fully implemented with Firestore-backed routing rules

**Algorithm:** Priority-based rule evaluation with configurable strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Round Robin** | Cycles through assigned users sequentially | Fair distribution |
| **Territory** | Routes by state/country/industry match | Geographic assignment |
| **Skill-based** | Matches lead language to rep skills | Specialized handling |
| **Load Balance** | Assigns to rep with lowest workload | Capacity optimization |
| **Default** | Round-robin across active org members | Fallback when no rules match |

**Process Flow:**
1. Authenticate via `requireOrganization` (Bearer token)
2. Verify `canAssignRecords` permission (RBAC)
3. Fetch lead from Firestore (`organizations/{orgId}/workspaces/{workspaceId}/entities/leads/records`)
4. Evaluate routing rules by priority (`organizations/{orgId}/leadRoutingRules`)
5. Apply matching strategy (round-robin → territory → skill → load-balance)
6. Update `lead.ownerId` with assigned rep
7. Create audit log entry via `logStatusChange()`
8. Emit `lead.routed` signal to Signal Bus

**Rate Limiting:** 10 requests/minute per organization+lead combination

**Required Permission:** `canAssignRecords` (available to: admin only)

**Routing Rules Collection Schema:**
```typescript
{
  id: string;
  organizationId: string;
  name: string;
  enabled: boolean;
  priority: number;  // Higher = evaluated first
  routingType: 'round-robin' | 'territory' | 'skill-based' | 'load-balance' | 'custom';
  assignedUsers: string[];  // User IDs eligible for assignment
  conditions?: RoutingCondition[];
  metadata?: {
    territories?: { userId, states?, countries?, industries? }[];
    skills?: { userId, skills[] }[];
    maxLeadsPerUser?: number;
    balancingPeriod?: 'day' | 'week' | 'month';
  };
}
```

### Error Tracking & Logging

**Location:** `src/lib/logger/logger.ts`, `src/lib/logging/api-logger.ts`

- Structured logging with context (file, function, metadata)
- Error tracking with stack traces
- Logger instance passed to every API endpoint
- Activity logging for CRM operations (`src/lib/crm/activity-logger.ts`)

---

## Integration Status

### Native Integrations (FUNCTIONAL)

| Integration | Type | Features |
|-------------|------|----------|
| **Stripe** | Payments | Subscriptions, invoices, webhooks |
| **Firebase** | Auth + DB | Authentication, Firestore (`rapid-compliance-65f87`) |
| **OpenRouter** | AI Gateway | 100+ model access |
| **Calendly** | Scheduling | Meeting booking |
| **Shopify** | E-commerce | Product sync |

### OAuth Integrations (FUNCTIONAL)

| Provider | Scope | Features |
|----------|-------|----------|
| **Google** | Calendar, Gmail | Read/send emails, calendar events |
| **Microsoft** | Outlook, Teams | Email, channel messaging |
| **Slack** | Messaging | Channel notifications |
| **QuickBooks** | Accounting | Invoice sync |
| **Twitter/X** | Social | Post/schedule |

### Voice Engines (FUNCTIONAL)

| Engine | Provider | Status |
|--------|----------|--------|
| ElevenLabs | ElevenLabs API | Default (Ultra quality) |
| Unreal Speech | Unreal Speech API | Alternative (Cost-effective) |

> **Removed:** Native Voice provider (placeholder stub with no real backend) — deleted February 12, 2026. Settings page: `/settings/ai-agents/voice`.

### Planned Integrations (INCOMPLETE)

- Salesforce CRM
- HubSpot
- Xero Accounting
- PayPal Payments

### Dashboard-Swarm Connectivity (LIVE: January 29, 2026)

**Audit Reference:** `docs/audit_dashboard_connectivity.md`

**Overall Connectivity Score: 85/100 (LIVE)**

| Category | Status | Implementation |
|----------|--------|----------------|
| State Alignment | **LIVE** | `getSwarmStatus()` exposed via `/api/system/status`, consumed by `useSystemStatus` hook |
| Telemetry Trace | **LIVE** | SwarmMonitorWidget polls live metrics from MASTER_ORCHESTRATOR |
| Agent ID Verification | **ALIGNED** | `COMPETITOR_RESEARCHER` unified across frontend and backend (47 agents) |
| Brief Injection | PARTIAL | Manager briefs live; Commerce/Reputation briefs need dedicated routes |

**Implemented API Routes:**

| Route | Purpose | Status |
|-------|---------|--------|
| `GET /api/system/status` | Expose `SwarmStatus` with `ManagerBrief[]` | **LIVE** |
| `GET /api/admin/swarm/execute` | Execute agents with circuit breaker | **LIVE** |
| `GET /api/commerce/brief` | Expose `CommerceBrief` metrics | PLANNED |
| `GET /api/reputation/brief` | Expose `ReputationBrief` trust scores | PLANNED |

**Frontend Integration:**

| Component | Status | Notes |
|-----------|--------|-------|
| `useSystemStatus` | **LIVE** | New hook polling `/api/system/status` with 30s interval |
| `SwarmMonitorWidget` | **LIVE** | Consumes live data, displays 9 managers with real metrics |
| `useOrchestratorStore` | UNCHANGED | Manages chat/UI state (separate concern) |

**Agent ID Alignment (COMPLETED):**
- Backend Registry: 47 agents (`src/lib/agents/index.ts:169-234`)
- Frontend Widget: Displays all 9 managers from live API
- Execute Route Whitelist: 3 agents (`MARKETING_MANAGER`, `COMPETITOR_RESEARCHER`, `TIKTOK_EXPERT`)
- ID Mismatch **FIXED**: `COMPETITOR_RESEARCHER` → `COMPETITOR_RESEARCHER` unified

**Key Files:**
- API Route: `src/app/api/system/status/route.ts` (NEW - calls `getSwarmStatus`)
- Frontend Hook: `src/hooks/useSystemStatus.ts` (NEW - polling hook)
- Swarm Widget: `src/components/shared/SwarmMonitorWidget.tsx` (UPDATED - live data)
- Backend Orchestrator: `src/lib/agents/orchestrator/manager.ts:1230` (unchanged)

---

## Firestore Collections

### Root Collections (11)

| Collection | Purpose |
|------------|---------|
| `organizations` | Tenant definitions |
| `users` | User profiles |
| `health` | System health records |
| `admin` | Admin configurations |
| `platform_metrics` | Platform-wide metrics |
| `platform_settings` | Global settings |
| `discoveryQueue` | Lead discovery queue |
| `slack_workspaces` | Slack workspace configs |
| `slack_oauth_states` | OAuth state tokens |
| `slack_channels` | Slack channel mappings |
| `slack_messages` | Message history |

### Organization Sub-Collections (35)

```
organizations/{orgId}/
├── records/                  # CRM records
├── workspaces/               # Workspace definitions
├── sequences/                # Email sequences
├── campaigns/                # Marketing campaigns
├── workflows/                # Automation workflows
├── products/                 # E-commerce products
├── orders/                   # Order history
├── conversations/            # Chat history
├── trainingData/             # AI training data
├── baseModels/               # AI model configs
├── schemas/                  # Custom schemas
├── apiKeys/                  # API keys
├── integrations/             # Integration configs
├── merchant_coupons/         # Merchant coupons
├── members/                  # Organization members
├── settings/                 # Org settings
├── agentConfig/              # Agent configurations
├── goldenMasters/            # Golden master agents
├── signals/                  # Agent signals
├── socialAccounts/           # Social media accounts (NEW Feb 12)
├── socialMedia/              # Social media uploads (NEW Feb 12)
├── socialApprovals/          # Social approval workflow (NEW Feb 12)
├── socialListening/          # Social listening mentions (NEW Feb 12)
├── socialSettings/           # Social agent config (NEW Feb 12)
├── forms/                    # Form builder forms
│   ├── fields/               # Form fields
│   ├── submissions/          # Form submissions
│   ├── analytics/            # Form analytics
│   └── views/                # View events
├── formTemplates/            # Form templates
├── websites/                 # Website configs
├── pages/                    # Website pages
├── domains/                  # Custom domains
├── blogPosts/                # Blog content
├── brandDNA/                 # Brand configuration
├── memoryVault/              # Agent shared memory (Firestore-backed, cold-start safe)
└── provisionerLogs/          # Provisioning logs
```

### Total: 65+ Collections

---

## Architecture Notes

### Build System (W2 Security Gate)

**Status:** RESOLVED (January 29, 2026)

The build pipeline now enforces **mandatory TypeScript type-checking** as a non-bypassable prerequisite:

```json
"build": "tsc --noEmit && next build"
```

| Gate | Command | Behavior |
|------|---------|----------|
| Type Check | `tsc --noEmit` | Fails build on ANY type error |
| Next.js Build | `next build` | Only runs if type-check passes |

**Security Implications:**
- Prevents deployment of code with type inconsistencies
- Eliminates W2 risk (type errors bypassing CI)
- Ensures compile-time safety before production artifacts are generated

**No Bypass Policy:** The `--noEmit` flag ensures type-checking runs without generating output files. There are no suppression flags. All type errors must be resolved before `next build` executes.

### Single-Tenant Model (Penthouse)

> **See also:** [Ironclad Architecture Rules](#ironclad-architecture-rules) — Rules 1 and 5

- **One organization:** `rapid-compliance-root` is the only org in the system (Rule 1)
- All Firestore data scoped to `organizations/rapid-compliance-root/` or flat root collections (Rule 5)
- Feature visibility configurable at the platform level, not per-tenant
- All 51 AI agents operate under the single org identity (Rule 2)
- `DEFAULT_ORG_ID` constant used by all service classes — no dynamic org resolution
- Legacy `organizationId` parameters in service classes are deprecated and ignored

### Middleware Routing Strategy

The middleware (`src/middleware.ts`) uses **Role-Based Segment Routing**:

1. All `/admin/*` paths allowed through middleware
2. Authentication & authorization handled by `/admin/layout.tsx`
3. Non-admin users redirected to workspace by layout, not middleware
4. Prevents 404s from middleware redirecting to non-existent paths

### Sidebar Architecture

**Forensic Investigation Completed:** January 26, 2026
**Legacy Client UI Restored:** January 27, 2026 (1/25/2026 Baseline)
**Dynamic Theming Enabled:** January 27, 2026 - Hardcoded hex colors replaced with CSS variables

> **IMPORTANT:** The "Unified Dashboard" logic has been SCRAPPED for the client view.
> The legacy client navigation with 11 operational sections has been restored.
> System tools are now HARD-GATED and isolated from the standard client navigation array.

#### Current Implementation (SINGLE-TENANT ARCHITECTURE)

| Component | Location | Used By | Status |
|-----------|----------|---------|--------|
| **Dashboard Layout** | `src/app/(dashboard)/layout.tsx` | Dashboard Routes | ACTIVE - Flattened single-tenant |
| **useFeatureVisibility** | `src/hooks/useFeatureVisibility.ts` | Dashboard Layout | ACTIVE - Feature navigation |
| **buildNavigationStructure** | `src/lib/orchestrator/feature-toggle-service.ts` | useFeatureVisibility | ACTIVE - 11 sections |
| **UnifiedSidebar** | `src/components/dashboard/UnifiedSidebar.tsx` | Admin Layout | ACTIVE - Uses `getNavigationForRole()` |
| **Navigation Config** | `src/components/dashboard/navigation-config.ts` | UnifiedSidebar | ACTIVE - Hard-gated System section |

> **Note:** The workspace layout at `src/app/workspace/[orgId]/layout.tsx` has been **DELETED** as part of the multi-tenant purge. All dashboard routes now use the flattened `/(dashboard)/` layout with `DEFAULT_ORG_ID`.

#### Navigation Architecture

**Dashboard Routes (`/(dashboard)/*`):**
- Uses flattened layout with DEFAULT_ORG_ID
- Navigation from `buildNavigationStructure()` in feature-toggle-service.ts
- 11 sections, NO System tools
- Dark theme with emoji icons

**Admin Routes (`/admin/*`):**
- Uses UnifiedSidebar component
- Navigation from `getNavigationForRole()` in navigation-config.ts
- Hard-gated System section for superadmin only

#### Client Navigation Structure (11 Sections)

Clients see ONLY these 11 sections (NO System tools):

1. **Command Center** - Workforce HQ, Dashboard, Conversations
2. **CRM** - Leads, Deals, Contacts, Living Ledger
3. **Lead Gen** - Forms, Lead Research, Lead Scoring
4. **Outbound** - Sequences, Campaigns, Email Writer, Nurture, Calls
5. **Automation** - Workflows, A/B Tests
6. **Content Factory** - Video Studio, Social Media, Proposals, Battlecards
7. **AI Workforce** - Agent Training, Voice & Speech, Voice AI Lab, Social AI Lab, SEO AI Lab, Datasets, Fine-Tuning
8. **E-Commerce** - Products, Orders, Storefront
9. **Analytics** - Overview, Revenue, Pipeline, Sequences
10. **Website** - Pages, Blog, Domains, SEO, Site Settings
11. **Settings** - Organization, Team, Integrations, API Keys, Billing

#### Platform Admin Tools (HARD-GATED)

Admin users see all 11 client sections PLUS the System section (12 total):

12. **System** (admin ONLY) - System Overview, Organizations, All Users, Feature Flags, Audit Logs, System Settings

**CRITICAL:** The System section is NOT part of `CLIENT_SECTIONS`. It is a separate `SYSTEM_SECTION` export
that is conditionally appended ONLY when `user.role === 'admin'` via `getNavigationForRole()`.

#### Route Pattern (Single-Tenant)

- **Dashboard Routes:** `/(dashboard)/*` (11 operational sections, flattened)
- **Admin Routes:** `/admin/*` (System section)
- **Sites Routes:** `/sites/[orgId]/*` (uses DEFAULT_ORG_ID internally)
- **Store Routes:** `/store/[orgId]/*` (uses DEFAULT_ORG_ID internally)

> **DELETED:** `/workspace/[orgId]/*` routes - migrated to `/(dashboard)/*`

#### Admin Navigation Context (January 30, 2026)

**Purpose:** Prevent Admin users from being routed OUT of the admin context when viewing organization details.

**Problem Solved:** The UnifiedSidebar was showing CLIENT_SECTIONS (11 sections) to Admin users in the admin context. Clicking any of these links would cause navigation issues:
1. Exits the `/admin` route tree
2. Unmounts Jasper (AdminOrchestrator)
3. Loses the Admin theme
4. Routes to dashboard context unnecessarily

**Solution:** Admin Navigation Context system that dynamically switches navigation based on current route:

| Context | Route Pattern | Navigation Shown |
|---------|---------------|------------------|
| `admin-global` | `/admin/*` (except org detail) | Support Tools + System |
| `admin-org-view` | `/admin/organizations/[id]/*` | Organization + Support Tools + System |

**Admin Support Flow** (Stay in Admin Context):
```
Admin User → /admin/organizations → /admin/organizations/[id] → /admin/organizations/[id]/edit
                                                              ↓
                                   Sidebar shows: Organization, Support Tools, System sections
                                       Jasper remains mounted, Admin theme active
```

**Owner Impersonation Flow** (Tier 3.1 — Implemented):
```
Owner → /system/impersonate → Search & select user → Enter reason → POST /api/admin/impersonate
                                                                      ↓
                              ImpersonationBanner displays at top of viewport (all pages)
                              Owner sees platform as the target user
                              Session tracked in Firestore (impersonationSessions collection)
                              Audit log entry created in auditLogs collection
                                                                      ↓
                              Owner clicks "End Session" → DELETE /api/admin/impersonate
                              Banner removed, session marked as ended
```

**Implementation Files:**
- `src/app/admin/layout.tsx` - Detects admin navigation context from pathname
- `src/components/dashboard/UnifiedSidebar.tsx` - Accepts `adminNavigationContext` and `adminViewingOrgId` props
- `src/components/dashboard/navigation-config.ts` - Exports `getNavigationForRole(role, adminContext)` with context-aware sections
- `src/types/unified-rbac.ts` - Defines `admin_org_view` and `admin_support` navigation categories

**Gap Report (0 Missing Routes - COMPLETE):**
The `/admin/organizations/[id]/*` route tree now has **45 functional pages** (January 30, 2026 - Full Implementation):

| Route | Status | Description |
|-------|--------|-------------|
| `/admin/organizations/[id]` | ✅ | Organization detail view |
| `/admin/organizations/[id]/edit` | ✅ | Edit organization |
| `/admin/organizations/[id]/dashboard` | ✅ | Admin org dashboard |
| `/admin/organizations/[id]/leads` | ✅ | Lead management view |
| `/admin/organizations/[id]/deals` | ✅ | Deal pipeline view |
| `/admin/organizations/[id]/contacts` | ✅ | Contact management view |
| `/admin/organizations/[id]/analytics` | ✅ | Analytics dashboard |
| `/admin/organizations/[id]/analytics-pipeline` | ✅ | Pipeline analytics |
| `/admin/organizations/[id]/analytics-revenue` | ✅ | Revenue analytics |
| `/admin/organizations/[id]/calls` | ✅ | Call management view |
| `/admin/organizations/[id]/conversations` | ✅ | Conversation tracking |
| `/admin/organizations/[id]/email-campaigns` | ✅ | Email campaign management |
| `/admin/organizations/[id]/social-campaigns` | ✅ | Social campaign management |
| `/admin/organizations/[id]/sequences` | ✅ | Sequence management |
| `/admin/organizations/[id]/nurture` | ✅ | Nurture sequence view |
| `/admin/organizations/[id]/forms` | ✅ | Form management |
| `/admin/organizations/[id]/templates` | ✅ | Template management |
| `/admin/organizations/[id]/products` | ✅ | Product catalog view |
| `/admin/organizations/[id]/orders` | ✅ | Order management view |
| `/admin/organizations/[id]/storefront` | ✅ | Storefront management |
| `/admin/organizations/[id]/proposals` | ✅ | Proposal management |
| `/admin/organizations/[id]/battlecards` | ✅ | Sales battlecards |
| `/admin/organizations/[id]/lead-scoring` | ✅ | Lead scoring config |
| `/admin/organizations/[id]/workflows` | ✅ | Workflow automation |
| `/admin/organizations/[id]/workforce` | ✅ | AI workforce view |
| `/admin/organizations/[id]/datasets` | ✅ | Dataset management |
| `/admin/organizations/[id]/fine-tuning` | ✅ | Model fine-tuning |
| `/admin/organizations/[id]/agent-training` | ✅ | Agent training |
| `/admin/organizations/[id]/custom-tools` | ✅ | Custom tools config |
| `/admin/organizations/[id]/ab-tests` | ✅ | A/B test management |
| `/admin/organizations/[id]/living-ledger` | ✅ | Living ledger view |
| `/admin/organizations/[id]/website-pages` | ✅ | Website pages |
| `/admin/organizations/[id]/website-blog` | ✅ | Blog management |
| `/admin/organizations/[id]/website-seo` | ✅ | SEO management |
| `/admin/organizations/[id]/website-domains` | ✅ | Domain management |
| `/admin/organizations/[id]/video-studio` | ✅ | Video studio |
| `/admin/organizations/[id]/voice-ai-lab` | ✅ | Voice AI lab |
| `/admin/organizations/[id]/seo-ai-lab` | ✅ | SEO AI lab |
| `/admin/organizations/[id]/social-ai-lab` | ✅ | Social AI lab |
| `/admin/organizations/[id]/integrations` | ✅ | Integration management |
| `/admin/organizations/[id]/settings` | ✅ | Organization settings |
| `/admin/organizations/[id]/api-keys` | ✅ | API key management |
| `/admin/organizations/[id]/webhooks` | ✅ | Webhook management |
| `/admin/organizations/[id]/billing` | ✅ | Billing management |
| `/admin/organizations/[id]/security` | ✅ | Security settings |

**All Admin Support Views implemented with:**
- `useAdminAuth()` permission checks (admin role required)
- Organization data loading via FirestoreService
- Consistent Admin Banner with Shield icon
- Dark theme styling matching platform design
- Backend integration via existing APIs

#### Bug Fix (January 27, 2026)

**Issue:** UnifiedSidebar href resolution was checking for `[orgId]` placeholder but navigation-config.ts uses `:orgId`.
**Fix:** Updated UnifiedSidebar.tsx to correctly replace `:orgId` placeholder in all 3 locations:
- `NavItemComponent` href builder (line 72-77)
- `NavSectionComponent` active item check (line 119-126)
- Section items active state check (line 166-170)

**All 109 workspace routes and 46 admin routes verified as valid.**

#### Key Finding: Dual-Layout Navigation System

**Investigation Result (January 27, 2026 Restoration):** The codebase uses **separate navigation systems** for client vs admin:

1. **Client Routes** (`/workspace/[orgId]/*`) use a **built-in sidebar** in the workspace layout
   - Navigation from `buildNavigationStructure()` with 11 sections
   - `useFeatureVisibility` hook for adaptive per-org feature toggling
   - **Dynamic theming via CSS variables** (replaces hardcoded hex colors as of 1/27/2026):
     - `var(--color-bg-main)` - Main background (was #000000)
     - `var(--color-bg-paper)` - Sidebar/header background (was #0a0a0a)
     - `var(--color-bg-elevated)` - Elevated surfaces like active nav items (was #1a1a1a)
     - `var(--color-border-main)` - Border colors (was #1a1a1a)
   - Emoji icons, section dividers
   - NO System tools (Audit Logs, Feature Flags, etc.) - completely absent

2. **Admin Routes** (`/admin/*`) use `UnifiedSidebar` component
   - Navigation from `getNavigationForRole()` with hard-gated System section
   - Admin users see all 12 sections including System tools

#### Navigation Item Locations (Key Routes)

| Feature | Section | Permission Required | Route Pattern |
|---------|---------|---------------------|---------------|
| Leads | CRM | `canViewLeads` | `/workspace/:orgId/leads` |
| Deals | CRM | `canViewDeals` | `/workspace/:orgId/deals` |
| Forms | Lead Gen | `canManageLeads` | `/workspace/:orgId/forms` |
| Sequences | Outbound | `canManageEmailCampaigns` | `/workspace/:orgId/outbound/sequences` |
| Workflows | Automation | `canCreateWorkflows` | `/workspace/:orgId/workflows` |
| Video Studio | Content Factory | `canManageSocialMedia` | `/workspace/:orgId/content/video` |
| Agent Training | AI Workforce | `canTrainAIAgents` | `/workspace/:orgId/settings/ai-agents/training` |
| Products | E-Commerce | `canManageProducts` | `/workspace/:orgId/products` |
| Analytics | Analytics | `canViewReports` | `/workspace/:orgId/analytics` |
| Pages | Website | `canManageWebsite` | `/workspace/:orgId/website/pages` |
| Organization | Settings | `canManageOrganization` | `/workspace/:orgId/settings` |
| System Overview | System | `canViewSystemHealth` | `/admin/system/health` |

#### Deleted Components (Forensic Record)

| File | Commit | Date | Reason |
|------|--------|------|--------|
| `CommandCenterSidebar.tsx` | `f2d2497b` | Jan 26, 2026 | UI consolidation - migrated to UnifiedSidebar |

**CommandCenterSidebar Contents (437 lines):** 10 navigation categories (Dashboard, Clients, Leads & Sales, Social Media, Email Marketing, AI Voice, Analytics, System, Jasper Lab), collapsible sections, badge support, role display. All functionality migrated to unified system.

#### Section Visibility by Role (12 Sections — 4-Role RBAC)

| # | Section | owner | admin | manager | member |
|---|---------|-------|-------|---------|--------|
| 1 | Command Center | ✅ | ✅ | ✅ | ✅ |
| 2 | CRM | ✅ | ✅ | ✅ | ✅* |
| 3 | Lead Gen | ✅ | ✅ | ✅ | - |
| 4 | Outbound | ✅ | ✅ | ✅ | - |
| 5 | Content Factory | ✅ | ✅ | ✅ | - |
| 6 | AI Workforce | ✅ | ✅ | ✅ | - |
| 7 | Automation | ✅ | ✅ | ✅ | - |
| 8 | E-Commerce | ✅ | ✅ | ✅ | ✅* |
| 9 | Compliance | ✅ | ✅ | - | - |
| 10 | Analytics | ✅ | ✅ | ✅ | ✅* |
| 11 | Website | ✅ | ✅ | ✅ | - |
| 12 | Settings | ✅ | ✅ | ✅ | - |

*Member sees limited items based on specific permissions

#### Files for Navigation Debugging

```
src/components/dashboard/
├── UnifiedSidebar.tsx          # Sidebar component (use for ALL layouts)
├── navigation-config.ts        # UNIFIED_NAVIGATION constant
├── README.md                   # Migration documentation
├── MIGRATION.md                # Migration guide
└── IMPLEMENTATION_SUMMARY.md   # Implementation details

src/types/
└── unified-rbac.ts             # filterNavigationByRole() + UNIFIED_ROLE_PERMISSIONS
```

#### Orphaned Code Status: ✅ CLEAN

No disconnected navigation references, unused arrays, or orphaned code found during forensic audit.

### Theme Architecture (INDEPENDENT PIPELINES)

**Isolation Implemented:** January 27, 2026

The Admin UI and Client UI now have **completely independent theme-variable pipelines**. This ensures that organization-specific theme customizations in the Client Workspace do NOT affect the Admin Dashboard, and vice versa.

#### Theme Pipeline Comparison

| Aspect | Admin Dashboard | Client Workspace |
|--------|-----------------|------------------|
| **Hook** | `useAdminTheme()` | `useOrgTheme()` |
| **Source** | Platform-level Firestore (`platform_settings/adminTheme`) | Org-level Firestore (`organizations/{orgId}/themes/default`) |
| **Scope** | `.admin-theme-scope` container class | `document.documentElement` |
| **Variable Prefix** | `--admin-color-*` (with standard override) | `--color-*` |
| **Isolation** | CSS cascading via scoped container | Global application |

#### How Isolation Works

1. **Client Workspace** (`/workspace/[orgId]/*`):
   - `useOrgTheme()` loads organization-specific theme from Firestore
   - Applies CSS variables to `document.documentElement` (root level)
   - Each organization can have different colors, fonts, branding

2. **Admin Dashboard** (`/admin/*`):
   - `useAdminTheme()` loads platform-level theme settings
   - Applies CSS variables to a **scoped container** with class `.admin-theme-scope`
   - Admin layout wraps all content in this scoped container
   - Standard CSS variables (`--color-*`) are **overridden within the scope**
   - This means even if `useOrgTheme` modifies root variables, Admin is unaffected

#### CSS Variable Hierarchy

```css
/* Root level (globals.css) - Base defaults */
:root {
  --color-primary: #6366f1;
  --admin-color-primary: #6366f1;  /* Admin-specific fallbacks */
  ...
}

/* Client themes modify :root via useOrgTheme() */
document.documentElement.style.setProperty('--color-primary', orgTheme.primary);

/* Admin scope overrides (cascading) */
.admin-theme-scope {
  --color-primary: var(--admin-color-primary);  /* Ignores root changes */
  ...
}
```

#### Theme Files

| File | Purpose |
|------|---------|
| `src/hooks/useAdminTheme.ts` | Admin theme hook - scoped application |
| `src/hooks/useOrgTheme.ts` | Client theme hook - root application |
| `src/app/globals.css` | Base variables + Admin scope class |
| `src/app/admin/layout.tsx` | Applies `.admin-theme-scope` container |
| `src/app/workspace/[orgId]/settings/theme/page.tsx` | **Org Theme Editor** (UI exists) |

> **Note:** The **Admin Theme Editor UI does NOT exist** yet. Admin themes can only be modified via direct Firestore writes to `platform_settings/adminTheme`. The Org Theme Editor at `/workspace/[orgId]/settings/theme` is fully functional.

#### Admin Sidebar Dynamic Styling (January 27, 2026)

The `UnifiedSidebar.tsx` component now features **100% reactive theming** via CSS variables:

**Active State Highlights:**
- 3px solid left border using `var(--color-primary)` on active navigation items
- Background uses `var(--color-bg-elevated)` for active items
- Smooth transitions on all theme-reactive elements

**Lucide SVG Iconography:**
- Active items: Icons colored with `text-[var(--color-primary)]`
- Inactive items: Icons colored with `text-[var(--color-text-secondary)]`
- Section icons: Dynamically colored based on whether section contains active item
- Hover states: Icons transition to primary color on hover

**Implementation Pattern:**
```tsx
// Dynamic icon color tied to theme variables
const iconColorClass = isActive
  ? "text-[var(--color-primary)]"
  : "text-[var(--color-text-secondary)]";

<Icon className={`w-5 h-5 transition-colors ${iconColorClass}`} />
```

**Reactivity:** Changes made in the Admin Theme Editor (`platform_settings/adminTheme` in Firestore) reflect immediately in the sidebar without requiring a page reload, as CSS variables are applied via `useAdminTheme()` hook to the `.admin-theme-scope` container.

#### Verification Test

To verify isolation:
1. Navigate to `/(dashboard)/settings/theme`
2. Change the organization's primary color to red (`#ff0000`)
3. Navigate to `/admin/*`
4. Confirm Admin sidebar remains purple/indigo (`#6366f1`)

The Admin UI will NOT be affected by organization theme changes.

### State Management Architecture

The platform uses a **layered state management** approach:

| Layer | Technology | Scope | Persistence |
|-------|------------|-------|-------------|
| Component UI | `useState`, `useMemo` | Component | None |
| App-wide Auth | `useUnifiedAuth()` hook | App | Firebase |
| App-wide Theme | `useAdminTheme()`, `useOrgTheme()` | App | Firestore |
| Global UI | Zustand stores | Global | localStorage |
| Route Context | Layout files | Route tree | None |

#### Zustand Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `useOnboardingStore` | `src/lib/stores/onboarding-store.ts` | Multi-step onboarding flow |
| `useOrchestratorStore` | `src/lib/stores/orchestrator-store.ts` | AI assistant UI state |
| `usePendingMerchantStore` | `src/lib/stores/pending-merchants-store.ts` | Lead capture & abandonment tracking |

#### Sidebar Reactivity Pattern

UnifiedSidebar achieves reactivity through:
1. **Memoized navigation filtering:** `useMemo(() => getNavigationForRole(user.role), [user.role])`
2. **Path-based active state:** `usePathname()` from Next.js
3. **CSS variable injection:** Theme changes via `container.style.setProperty()` update instantly
4. **React.memo sub-components:** Prevents unnecessary re-renders

### Agent Communication

Agents communicate via **TenantMemoryVault** (Firestore-backed since Feb 8, 2026):
- Cross-agent memory sharing
- Signal broadcasting
- Insight sharing
- Cold-start safe: `read()` and `query()` await Firestore hydration before returning
- TTL cleanup runs every 4 hours via operations-cycle cron
- Location: `src/lib/agents/shared/memory-vault.ts`

### Agent Memory Hierarchy

| Layer | Status | Details |
|-------|--------|---------|
| **Working memory** | Have it | In-process variables during a single task execution |
| **Shared operational state (MemoryVault)** | **Complete** | Cross-agent signals, insights, context. Firestore-backed, survives cold starts (commit e388c151) |
| **Customer/entity memory** | Have it | CRM data in Firestore collections (records, deals, contacts) |
| **Conversation memory** | **COMPLETE (commit b1c50e8f)** | ConversationMemory service — unified retrieval of past customer interactions across all channels. Location: `src/lib/conversation/conversation-memory.ts` |
| **Episodic memory** | Not built | Agents recalling specific past interactions and learning from outcomes |
| **Semantic/vector memory** | Not built | Embedding-based retrieval for similarity search across knowledge |

### Conversation Storage (Current State)

| Channel | Firestore Collection | Persisted? | Agent-Queryable? |
|---------|---------------------|------------|-----------------|
| Chat widget | `chatSessions/{id}/messages` | Yes | No — agents don't query it |
| Jasper (orchestrator) | `orchestratorConversations/{id}/messages` | Yes | No — UI-only |
| SMS | `smsMessages` | Yes (individual records) | No — not threaded, not agent-accessible |
| Voice AI | In-memory only | **No — lost when call ends** | No |
| Email | Campaign metadata only | Partial (no body) | No |

**Gap Resolved (commit b1c50e8f):** ConversationMemory service now provides unified retrieval across all channels. Agents can query conversation history with auto-analysis and Lead Briefing generation. Voice transcripts persist to Firestore, and all channels are agent-queryable.

### Intelligence Manager - Dynamic Orchestration Engine

**Status:** FUNCTIONAL (January 29, 2026)
**Location:** `src/lib/agents/intelligence/manager.ts`

The Intelligence Manager is the orchestration engine for market intelligence gathering. It coordinates 5 specialist agents with dynamic resolution, parallel execution, and graceful degradation.

#### Orchestration Patterns

| Intent | Specialists Activated | Use Case |
|--------|----------------------|----------|
| `FULL_MARKET_RESEARCH` | All 5 specialists | Complete market analysis |
| `COMPETITOR_ANALYSIS` | COMPETITOR_RESEARCHER, TECHNOGRAPHIC_SCOUT | Competitive landscape |
| `BRAND_MONITORING` | SENTIMENT_ANALYST, TREND_SCOUT | Brand health tracking |
| `TECH_DISCOVERY` | TECHNOGRAPHIC_SCOUT, SCRAPER_SPECIALIST | Technology stack analysis |
| `TREND_ANALYSIS` | TREND_SCOUT, SENTIMENT_ANALYST | Market signal detection |
| `COMPANY_PROFILE` | SCRAPER_SPECIALIST, COMPETITOR_RESEARCHER | Company profiling |
| `SINGLE_SPECIALIST` | (Delegation rules) | Targeted single-specialist query |

#### Execution Flow

```
1. Parse Request → Detect Intent from payload keywords
   ↓
2. Resolve Specialists → Dynamic lookup from SwarmRegistry
   ↓
3. Parallel Execution → Promise.allSettled() for isolation
   ↓
4. Graceful Degradation → Partial results on specialist failure
   ↓
5. Synthesize Brief → Aggregate into IntelligenceBrief
   ↓
6. Store in Vault → Share insights via TenantMemoryVault
```

#### IntelligenceBrief Output Structure

```typescript
{
  briefId: string;
  request: IntelligenceRequest;
  competitorAnalysis: { competitors, marketInsights, confidence } | null;
  sentimentAnalysis: { overallSentiment, brandHealth, alerts, confidence } | null;
  technographicAnalysis: { techStack, platforms, summary, confidence } | null;
  trendAnalysis: { signals, forecasts, pivotRecommendations, confidence } | null;
  companyProfile: { keyFindings, contactInfo, businessSignals, confidence } | null;
  synthesis: {
    executiveSummary: string;
    keyFindings: string[];
    opportunities: string[];
    threats: string[];
    recommendedActions: string[];
    overallConfidence: number;
  };
  execution: {
    totalSpecialists: number;
    successfulSpecialists: number;
    failedSpecialists: number;
    skippedSpecialists: number;
    totalExecutionTimeMs: number;
  };
  errors: string[];
}
```

#### Key Features

| Feature | Implementation |
|---------|----------------|
| **Dynamic Resolution** | Specialists resolved from SwarmRegistry at runtime, not hard-coded |
| **Parallel Execution** | All specialists execute via `Promise.allSettled()` |
| **Graceful Degradation** | Returns partial results if some specialists fail |
| **Intent Detection** | Keyword-based intent mapping + explicit intent parameter |
| **Contextual Synthesis** | Weighted confidence scoring, contradiction detection |
| **Vault Integration** | Stores insights and broadcasts signals to TenantMemoryVault |

### Marketing Manager - Industry-Agnostic Cross-Channel Commander

**Status:** FUNCTIONAL (January 29, 2026)
**Location:** `src/lib/agents/marketing/manager.ts`

The Marketing Manager is an **industry-agnostic** orchestration engine for cross-channel marketing campaigns. It dynamically adapts to ANY business context via the TenantMemoryVault Brand DNA, eliminating all hardcoded industry assumptions.

#### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Industry Bias** | All industry context derived from Brand DNA at runtime |
| **Dynamic Specialist Resolution** | 5 specialists resolved from SwarmRegistry via factory functions |
| **SEO-Social Feedback Loop** | SEO keywords flow into social content briefs |
| **Brand Voice Consistency** | All content adapts to tenant's tone, key phrases, and avoid-phrases |
| **Parallel Execution** | Social specialists execute concurrently for performance |

#### Campaign Intent Detection

| Intent | Specialists Activated | Use Case |
|--------|----------------------|----------|
| `FULL_FUNNEL` | All 5 specialists | Comprehensive omnichannel campaign |
| `AWARENESS` | TIKTOK, TWITTER, LINKEDIN | Brand visibility and reach |
| `LEAD_GENERATION` | SEO, FACEBOOK, LINKEDIN | B2B/B2C lead capture |
| `THOUGHT_LEADERSHIP` | SEO, TWITTER, LINKEDIN | Authority building |
| `VIRAL_CONTENT` | TIKTOK, TWITTER | Maximum organic reach |
| `PAID_ADVERTISING` | FACEBOOK, LINKEDIN | Targeted paid campaigns |
| `ORGANIC_GROWTH` | SEO + All social | Long-term organic strategy |
| `SINGLE_PLATFORM` | (Detected dynamically) | Platform-specific request |

#### Orchestration Flow

```
1. Load Brand DNA → Industry, tone, key phrases from TenantMemoryVault
   ↓
2. Detect Campaign Intent → Keyword-based + objective mapping
   ↓
3. SEO Keyword Research → SEO_EXPERT provides target keywords FIRST
   ↓
4. Inject Keywords → SEO terms flow into all social briefs
   ↓
5. Parallel Execution → Social specialists run via Promise.allSettled()
   ↓
6. Aggregate Results → Unified CampaignBrief with cross-platform recommendations
   ↓
7. Store Insights → Share campaign strategy via TenantMemoryVault
```

#### CampaignBrief Output Structure

```typescript
{
  briefId: string;
  campaignGoal: CampaignGoal;
  brandContext: BrandContext;      // Industry context from Brand DNA
  detectedIntent: CampaignIntent;
  seoGuidance: SEOKeywordGuidance | null;  // Keywords for social content
  campaignAnalysis: CampaignAnalysis;
  platformStrategy: PlatformStrategy;
  delegations: DelegationResult[];
  specialistOutputs: {
    tiktok: unknown | null;
    twitter: unknown | null;
    facebook: unknown | null;
    linkedin: unknown | null;
    seo: unknown | null;
  };
  aggregatedPlan: AggregatedPlan;
  crossPlatformRecommendations: string[];
  confidence: number;
  execution: {
    totalSpecialists: number;
    successfulSpecialists: number;
    totalExecutionTimeMs: number;
  };
}
```

#### Specialists Orchestrated

| Specialist | Factory Function | Domain |
|------------|-----------------|--------|
| `TIKTOK_EXPERT` | `getTikTokExpert()` | Short-form viral video |
| `TWITTER_X_EXPERT` | `getTwitterExpert()` | Threads, thought leadership |
| `FACEBOOK_ADS_EXPERT` | `getFacebookAdsExpert()` | Paid ads, lead generation |
| `LINKEDIN_EXPERT` | `getLinkedInExpert()` | B2B content, professional networking |
| `SEO_EXPERT` | `getSEOExpert()` | Keyword research, content optimization |

#### Brand DNA Integration

The manager loads tenant-specific context at runtime:

```typescript
BrandContext {
  organizationId: string;      // Always DEFAULT_ORG_ID in single-tenant
  companyDescription: string;  // What the business does
  uniqueValue: string;         // USP - derived dynamically
  targetAudience: string;      // Who to target
  industry: string;            // Industry context (never hardcoded!)
  toneOfVoice: string;         // warm | professional | direct | etc.
  keyPhrases: string[];        // Phrases to use in content
  avoidPhrases: string[];      // Phrases to never use
  competitors: string[];       // For differentiation
}
```

This architecture ensures the Marketing Manager works for **any industry**: SaaS, real estate, e-commerce, healthcare, finance, or any custom vertical defined in the tenant's Brand DNA.

### Master Orchestrator - Swarm CEO (L1 Orchestrator)

**Status:** FUNCTIONAL (January 29, 2026)
**Location:** `src/lib/agents/orchestrator/manager.ts`

The Master Orchestrator is the **Swarm CEO** - the primary entry point for the entire AI platform. It interprets complex user goals and coordinates all 8 Domain Managers through sophisticated workflow orchestration.

#### Core Patterns Implemented

| Pattern | Description |
|---------|-------------|
| **Command Pattern** | Every task wrapped in a Command with target manager, payload, priority, dependencies, and compensating action |
| **Saga Pattern** | Multi-manager workflows with sequential/parallel execution, progress tracking, and compensation on failure |
| **Domain Routing** | Intent-based routing table mapping user goals to appropriate managers |
| **Dependency Graph** | Cross-domain synchronization ensuring correct execution order |

#### Goal Processing Pipeline

```
1. User Goal → Intent Classification (9 categories)
   ↓
2. Route to Primary Manager + Supporting Managers
   ↓
3. Decompose into DecomposedTasks (atomic manager actions)
   ↓
4. Create Saga from Template (if multi-manager workflow)
   ↓
5. Execute Saga with Dependency Resolution
   ↓
6. Handle Failures with Compensating Transactions
   ↓
7. Aggregate Results → SwarmStatus Report
```

#### Intent Categories

| Intent | Primary Manager | Supporting Managers |
|--------|-----------------|---------------------|
| FULL_BUSINESS_SETUP | ARCHITECT_MANAGER | All 8 managers |
| WEBSITE_BUILD | ARCHITECT_MANAGER | BUILDER, CONTENT |
| MARKETING_CAMPAIGN | MARKETING_MANAGER | CONTENT, INTELLIGENCE |
| SALES_PIPELINE | REVENUE_DIRECTOR | OUTREACH, INTELLIGENCE |
| CONTENT_CREATION | CONTENT_MANAGER | MARKETING |
| CUSTOMER_OUTREACH | OUTREACH_MANAGER | CONTENT, INTELLIGENCE |
| ECOMMERCE_SETUP | COMMERCE_MANAGER | BUILDER, CONTENT |
| REPUTATION_MANAGEMENT | REPUTATION_MANAGER | OUTREACH, CONTENT |
| MARKET_RESEARCH | INTELLIGENCE_MANAGER | (standalone) |

#### Saga Templates

Pre-defined workflows for common business operations:

1. **FULL_BUSINESS_LAUNCH**: Research → Architect → Content → Build → Commerce → Marketing → Outreach → Reputation
2. **WEBSITE_BUILD**: Architect → Content → Build
3. **MARKETING_CAMPAIGN**: Research → Content → Launch
4. **SALES_ACCELERATION**: Research → Qualify → Outreach
5. **CONTENT_PRODUCTION**: Produce → Distribute
6. **OUTREACH_SEQUENCE**: Sentiment → Content → Execute
7. **ECOMMERCE_LAUNCH**: Catalog → Content → Checkout → Build
8. **REPUTATION_BUILD**: Monitor → GMB → Solicit

#### SwarmStatus Aggregation

The `getSwarmStatus()` method provides real-time health and metrics:

```typescript
SwarmStatus {
  orchestratorId: string;
  timestamp: Date;
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE';
  managers: ManagerBrief[];  // Status from all 9 managers
  activeSagas: number;
  completedSagas: number;
  failedSagas: number;
  totalCommands: number;
  successRate: number;
  averageResponseTimeMs: number;
  insights: InsightEntry[];
}
```

#### Cross-Manager Dependencies

The orchestrator enforces execution order through dependency tracking:

- ARCHITECT must complete before BUILDER starts
- CONTENT depends on ARCHITECT blueprints
- MARKETING depends on CONTENT assets
- OUTREACH depends on CONTENT copy
- BUILDER depends on ARCHITECT + CONTENT
- REPUTATION may trigger OUTREACH for review solicitation
- COMMERCE triggers REPUTATION on sale.completed

---

## Data Contracts Reference

### Core Type Definitions

| Type | Location | Purpose |
|------|----------|---------|
| `UnifiedUser` | `src/types/unified-rbac.ts` | Authenticated user with role, permissions |
| `UnifiedPermissions` | `src/types/unified-rbac.ts` | 47 permission flags per role |
| `AccountRole` | `src/types/unified-rbac.ts` | `'owner' \| 'admin' \| 'manager' \| 'member'` (4-role RBAC) |
| `Organization` | `src/types/organization.ts` | Tenant definition with plan, branding, settings |
| `Lead` | `src/types/crm-entities.ts` | CRM lead with scoring, enrichment |
| `Deal` | `src/types/crm-entities.ts` | CRM deal with stage history, value |
| `Contact` | `src/types/crm-entities.ts` | CRM contact with address, social |
| `Schema` | `src/types/schema.ts` | Custom entity schema definition |
| `AdminThemeConfig` | `src/hooks/useAdminTheme.ts` | Admin theme colors, branding |
| `ThemeConfig` | `src/types/theme.ts` | Full theme with typography, layout |

### Zod Validation Schemas

| Schema | Location | Purpose |
|--------|----------|---------|
| `emailSendSchema` | `src/lib/validation/schemas.ts` | Email delivery request validation |
| `leadScoringSchema` | `src/lib/validation/schemas.ts` | Lead scoring API input |
| `CreateWorkflowSchema` | `src/lib/workflow/validation.ts` | Workflow creation validation |
| `AnalyticsRequestSchema` | `src/lib/analytics/dashboard/validation.ts` | Analytics query parameters |
| `sequenceStepSchema` | `src/lib/sequence/validation.ts` | Email sequence step definition |
| `TriggerConditionSchema` | `src/lib/workflow/validation.ts` | Workflow trigger conditions |

### Key Interfaces

```typescript
// Core user type
interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;  // 'admin' | 'user'
  organizationId: string;  // Always DEFAULT_ORG_ID in single-tenant
  status: 'active' | 'suspended' | 'pending';
  mfaEnabled: boolean;
}

// Theme configuration
interface AdminThemeConfig {
  colors: {
    primary: { main: string; light: string; dark: string; contrast: string };
    secondary: { main: string; light: string; dark: string; contrast: string };
    background: { main: string; paper: string; elevated: string };
    text: { primary: string; secondary: string; disabled: string };
    border: { main: string; light: string; strong: string };
  };
  branding: { platformName: string; logoUrl: string; primaryColor: string };
}
```

---

## Autonomous Verification

### Admin Gateway E2E Audit

**Audit Date:** January 30, 2026
**Test File:** `tests/e2e/admin-gateway.spec.ts`
**Audit Method:** Playwright-driven E2E test + MCP browser manual verification

#### Test Results Summary

| Assertion | Description | Status | Evidence |
|-----------|-------------|--------|----------|
| 1 | Smart Redirect: admin → /admin | **PASS** | URL verified as `/admin`, not `/(dashboard)/...` |
| 2 | UnifiedSidebar System Section | **PASS** | System section visible with 6 hard-gated items |
| 3 | Admin Theme CSS Isolation | **PASS** | All CSS variables correctly scoped |

#### Detailed Results

##### Assertion 1: Smart Role-Based Redirect
- **Commit Reference:** `950e5f08` (Smart role-based login redirection)
- **Behavior:** Admin users (role='admin') are redirected to `/admin` after login
- **Verification:** URL matches `/admin` pattern, does NOT contain `/(dashboard)/`
- **FOUC Prevention:** Redirecting state shows clean loading indicator

##### Assertion 2: UnifiedSidebar System Section (Hard-Gated)
- **Commit Reference:** `1a3c89f5` (Sidebar default collapsed state)
- **System Section Items Verified:**
  - System Overview (`/admin/system/health`)
  - Organizations (`/admin/organizations`)
  - All Users (`/admin/users`)
  - Feature Flags (`/admin/system/flags`)
  - Audit Logs (`/admin/system/logs`)
  - System Settings (`/admin/system/settings`)
- **Hard-Gate:** System section ONLY appears for `admin` role

##### Assertion 3: Admin Theme CSS Variable Isolation
- **Scope Class:** `.admin-theme-scope` present on admin container
- **CSS Variables Verified:**

| Variable | Expected | Actual | Status |
|----------|----------|--------|--------|
| `--admin-color-primary` | `#6366f1` | `#6366f1` | PASS |
| `--admin-color-bg-main` | `#000000` | `#000000` | PASS |
| `--admin-color-bg-paper` | `#0a0a0a` | `#0a0a0a` | PASS |
| `--admin-color-text-primary` | `#ffffff` | `#ffffff` | PASS |
| `--color-primary` (scoped) | `#6366f1` | `#6366f1` | PASS |
| `--color-bg-main` (scoped) | `#000000` | `#000000` | PASS |
| `--color-bg-paper` (scoped) | `#0a0a0a` | `#0a0a0a` | PASS |

- **Sidebar Background:** `rgb(10, 10, 10)` = `#0a0a0a` (matches expected)
- **Theme Bleeding:** NONE detected - Admin theme is properly isolated from tenant themes

#### Playwright Test Suite Status

| Browser | Tests Passed | Tests Skipped | Tests Failed |
|---------|--------------|---------------|--------------|
| Chromium | 5 | 4 | 0 |
| Mobile Chrome | 5 | 4 | 0 |

*Note: Auth-dependent tests skipped due to E2E_ADMIN_EMAIL not configured in CI environment*

#### Infrastructure Notes

- **Test Isolation:** Playwright config uses `testMatch: '**/*.spec.ts'` to isolate from Jest E2E tests
- **Admin Layout:** Uses `useAdminTheme` hook with scoped CSS variable application
- **Fixed Positioning:** Sidebar applies theme variables directly via inline styles for proper inheritance
- **Navigation Config:** `getNavigationForRole()` hard-gates System section to `admin` only

---

## Document Maintenance

### Update Protocol

This document MUST be updated when:

1. **Route Changes:** New pages added, routes removed, or paths changed
2. **Agent Changes:** New agents added, agents deprecated, or status changed
3. **RBAC Changes:** New permissions, role modifications, or access changes
4. **Integration Changes:** New integrations added or existing ones modified
5. **Collection Changes:** Firestore schema modifications

### Mandatory Cleanup Rule

**All temporary audit logs, discovery documents, or draft architecture files MUST be deleted or archived within 24 hours of creation.**

This prevents documentation drift and ensures single_source_of_truth.md remains the sole authoritative reference.

### Update Procedure

```bash
# After any codebase change affecting this document:
1. Verify change against this document
2. Update relevant section(s)
3. Update "Generated" date at top
4. Commit with message: "docs: update single_source_of_truth.md - [change description]"

# For temporary audit/discovery documents:
1. Create in project root during session
2. Extract relevant findings into this document
3. Move original to docs/archive/legacy/ within 24 hours
4. Update archive README.md
```

### Archived Documents

Legacy documentation moved to: `docs/archive/legacy/`

**Forensic Audits:**
- `GROUND_TRUTH_DISCOVERY.md` - Jan 20, 2026 forensic audit
- `FEATURE_PARITY_AUDIT.md` - Admin vs workspace parity audit
- `FORENSIC_AUDIT_V3.md` - God Mode removal record
- `FORENSIC_AUDIT_BRIEFING.md` - Initial forensic briefing

**Architecture:**
- `SYSTEM_MAP_JAN_2026.md` - Previous route audit
- `SYSTEM_BLUEPRINT.md` - Previous architecture guide
- `ARCHITECTURE_GRAPH.md` - Previous dependency map
- `orchestrator-system-blueprint.md` - Jasper AI blueprint

**Operational:**
- `REDIRECT_*.md` - Redirect implementation docs
- `VERIFIED.md` - Progress log
- `workflow_state.md` - Temporary state

See `docs/archive/legacy/README.md` for full archive index.

---

**END OF SINGLE SOURCE OF TRUTH**

*Document generated by Claude Code multi-agent audit - January 26, 2026*
*Last updated: February 6, 2026 - Tier 2.1 Data Table Upgrades complete (commit 1ef5dbb0)*

> Historical changelogs (January 27 - January 30, 2026) have been removed to reduce document size. Key changes from those sessions are reflected in the current document state.

---

## Previous Launch Gap Analysis (Archived)

> The January 29, 2026 launch gap analysis has been superseded by the **Stabilization Roadmap** above. Key findings have been incorporated into the "Current Status Assessment" section. Historical audit details are available in `docs/archive/`.

---

## Login Architecture

**Status:** ✅ OPERATIONAL — Smart role redirection implemented in `src/app/(public)/login/page.tsx`. All roles redirect to `/dashboard` where sidebar filtering handles feature visibility per role. Admin users redirect to `/admin`. FOUC prevented with loading state.

---

## Session Changelog Archive

Historical session logs have been moved to keep this document lean and focused on current architecture.

**Archive Location:** [`docs/archive/session_changelog.md`](archive/session_changelog.md)
