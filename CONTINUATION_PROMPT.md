# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context

Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 27, 2026 (CRM hub removal + sidebar entity links)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **169 physical routes**, **298 API endpoints**, **~330K LOC**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**
- Zero `@ts-ignore`, zero `any` violations, 16 justified `eslint-disable` comments

---

## What Just Changed (Session 45)

### CRM Hub Removed — Direct Sidebar Navigation
- **Deleted** `/crm` hub page (1,280-line legacy page with internal sidebar + useState tab switching)
- **Added** Leads, Contacts, Companies, Deals as direct sidebar items under CRM section
- `/leads` → redirects to `/entities/leads`, `/contacts` → redirects to `/entities/contacts`
- `/entities/companies` and `/deals` are direct links
- All `/crm` references across the codebase updated (dashboard, profile, settings, living-ledger, manifest.json, e2e tests)
- Conversations, Living Ledger, Lead Intelligence, Coaching, Playbook, Risk remain unchanged in sidebar

---

## Next Up: CRM Entity Configurability

### Problem
The CRM ships with 10 hardcoded entity types from `STANDARD_SCHEMAS`: leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks. Several don't fit SalesVelocity.ai's own business model (SaaS priced per CRM record — not selling physical products or issuing invoices).

### Goal
Make CRM entity visibility **industry-configurable** so that:
1. **SalesVelocity.ai's own CRM** shows only relevant objects (Leads, Contacts, Companies, Deals, Tasks)
2. **Future multi-tenant clients** get industry-appropriate defaults from the onboarding template system
3. The schema definitions stay intact — visibility is a toggle, not a deletion

### Approach
1. **Add `enabledEntities` to org/industry config** — the onboarding industry templates already exist in `src/lib/onboarding/`; extend them to specify which CRM entities are active
2. **Filter entity visibility** — the `/entities/[entityName]` dynamic route and Schema Editor's "View Data" buttons should respect the enabled list
3. **Admin override** — owner/admin can toggle entities on/off from Settings regardless of industry template
4. **Sidebar stays static** — the 4 core items (Leads, Contacts, Companies, Deals) are always in the sidebar; other entities are accessible via Schema Editor if enabled

### Key Files
- `src/lib/schema/standard-schemas.ts` — the 10 entity type definitions
- `src/lib/onboarding/` — industry template system (already has industry selection)
- `src/app/(dashboard)/entities/[entityName]/page.tsx` — generic entity page
- `src/components/admin/AdminSidebar.tsx` — sidebar (already updated)
- `src/app/(dashboard)/schemas/` — Schema Editor

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
