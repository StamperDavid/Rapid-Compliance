# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 28, 2026 (CRM Entity Configurability — full implementation)

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

## What Just Changed (Session 46)

### CRM Entity Configurability — Full Implementation
Implemented a 3-tier entity configurability system (11 phases, 13 files, +1,116 lines):

**Architecture:**
- **Always-On (5):** leads, contacts, companies, deals, tasks — cannot be toggled off
- **CRM Extended (5):** products, quotes, invoices, payments, orders — toggleable, default ON
- **Industry-Specific (13):** drivers, vehicles, compliance_documents, projects, time_entries, customers, inventory, properties, showings, cases, billing_entries, patients, appointments — toggled by industry defaults

**6-Layer Pattern (mirroring feature modules):**
1. `src/types/entity-config.ts` — EntityTier, EntityMetadata, EntityConfig types
2. `src/lib/validation/entity-config-schemas.ts` — Zod schemas
3. `src/lib/constants/entity-config.ts` — metadata, defaults, category mappings, helpers
4. `src/lib/services/entity-config-service.ts` — Firestore CRUD
5. `src/lib/stores/entity-config-store.ts` — Zustand store with isEntityEnabled()
6. `src/hooks/useEntityConfig.ts` — React hook with auto-load

**API & UI:**
- `GET/PUT /api/entity-config` — auth-protected, Zod-validated (endpoint #299)
- Entity page gating — disabled entities show banner with Enable button (admin) or "Contact admin" (user)
- Schema Editor — disabled entities dimmed at 50% opacity, "Enable in Settings" link
- Settings > Features > CRM Entities tab — toggle cards grouped by tier
- Onboarding — 15 categories have `defaultEntities` mapping; `buildEntityConfigForCategory()` helper ready

**Firestore:** `organizations/rapid-compliance-root/settings/entity_config`

---

## Next Up

### 1. Technical Debt — Placeholder Tests
- **115 `expect(true).toBe(true)` placeholder tests** across 11 files (HIGH severity)
- **52 `it.skip` tests** — 31 need Firestore emulator, 16 obsolete (MEDIUM)
- **~49% Zod validation coverage** on API routes (MEDIUM)

### 2. E2E Test Infrastructure
- Provision `e2e-member@salesvelocity.ai` and `e2e-admin@salesvelocity.ai` in Firebase Auth
- Authenticated Playwright tests currently skip because accounts don't exist

### 3. Merge dev → main
- 1,116+ lines of entity config changes on dev, not yet on main
- Once stable, PR or merge to main deploys to Vercel

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/components/admin/AdminSidebar.tsx` | 9-section sidebar with feature module gating |
| `src/lib/schema/standard-schemas.ts` | CRM entity type definitions |
| `src/lib/constants/entity-config.ts` | Entity config constants, metadata, category defaults |
| `src/lib/services/entity-config-service.ts` | Entity config Firestore CRUD |
| `src/lib/stores/entity-config-store.ts` | Entity config Zustand store |
| `src/hooks/useEntityConfig.ts` | Entity config React hook |
| `src/app/api/entity-config/route.ts` | Entity config API (GET/PUT) |
| `src/lib/onboarding/` | Industry template + onboarding flow |

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
