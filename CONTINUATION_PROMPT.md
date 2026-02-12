# SalesVelocity.ai — Feature Completion Sprint

**Repository:** https://github.com/StamperDavid/Rapid-Compliance
**Branch:** dev
**Last Updated:** February 12, 2026
**Status:** Demo data seeded (158 docs). 5 dashboard features have incomplete UI — must be built out before launch.

---

## Session Protocol

**Every new Claude Code session MUST:**
1. Read `CLAUDE.md` first — it contains binding project governance, constraints, and worktree rules
2. Read this file (`CONTINUATION_PROMPT.md`) for current status and next steps
3. Pick up where the last session left off
4. Update this file at end of session with what was accomplished and what's next
5. Do NOT create new planning/status documents — this is the single tracking file

---

## Platform Summary

- **Architecture:** Single-tenant penthouse model
- **Org ID:** `rapid-compliance-root` | **Firebase:** `rapid-compliance-65f87`
- **Scale:** 163 pages, 227 API endpoints, 52 AI agents, 330K+ LOC
- **Code Health:** TypeScript 0 errors, ESLint 0 warnings, Build passes clean

---

## What Was Just Completed (Feb 12, 2026)

### Demo Data Seeded — 158 Documents Total

Two seed scripts were created and successfully executed:

1. **`scripts/seed-demo-account.ts`** (Part 1 — CRM, 96 docs)
   - 10 Contacts (4 VIP, full address/social/customFields)
   - 12 Leads (full enrichmentData with 26 fields each)
   - 8 Deals ($478K pipeline, all stages, customFields)
   - 25 Activities (calls, emails, meetings, notes, tasks)
   - 6 Products (variants, SEO, inventory tracking)
   - 3 Email Campaigns + 2 Nurture Sequences
   - 30 days of Analytics data

2. **`scripts/seed-demo-account-part2.ts`** (Part 2 — Full Platform, 62 docs)
   - Onboarding Data (complete 25-step business setup)
   - AI Agent Persona (full configuration with training insights)
   - 3 Workflows (entity trigger, schedule, form trigger)
   - 2 Forms with 11 fields + 3 submissions
   - 3 Website Pages + 3 Blog Posts + Site Config/Theme/Navigation
   - 8 Social Media Posts (twitter + linkedin, various statuses)
   - 4 Orders (pending through delivered)
   - 5 Templates (3 email + 2 SMS)
   - Lead Scoring Rules, 2 Webhooks, 5 Team Tasks
   - 2 AI Conversations with full message history
   - 3 Integrations (Google Calendar, Slack, Stripe)
   - 2 Custom Tools

All data is tagged "(Demo)" with `demo-` prefixed IDs. Firestore paths use `test_` prefix for dev environment.

### Dashboard Audit Completed

A full audit of all dashboard features was performed. Results below.

---

## CURRENT TASK: Build Missing UI for 5 Incomplete Features

The user explicitly stated: **"We are not removing features in order to launch. If you have incomplete work like missing UI it needs to be completed."**

### Features That Are COMPLETE (no work needed):
- ✅ Workflows — full CRUD, builder, pagination, filtering
- ✅ Forms — full CRUD, template selection, bulk delete, CSV export
- ✅ Website Pages — list, create, delete, editor, duplicate
- ✅ Blog — full CRUD, featured toggle, category management
- ✅ Conversations — real-time monitoring, history, training flags
- ✅ Integrations — browse, connect OAuth/API key, disconnect
- ✅ Custom Tools — full CRUD, enable/disable, emoji icons
- ✅ AI Persona — 6-section editor, auto-generation, save
- ✅ Business Setup — 7-section tabbed form, save
- ✅ CRM (Contacts, Leads, Deals) — full CRUD
- ✅ Products — full CRUD
- ✅ Email Campaigns — full CRUD
- ✅ Analytics — dashboard with daily metrics

### 5 Features That Need UI Built:

#### 1. ORDERS PAGE — ❌ COMPLETELY MISSING
**Priority:** High — we seeded 4 orders but there's NO page to view them
**What to build:**
- New page at `src/app/(dashboard)/orders/page.tsx`
- List view showing all orders with status, customer, total, date
- Order detail view (click to expand or separate page)
- Status management (pending → processing → shipped → delivered)
- Filter by status, search by customer/order number
- **Data path:** `test_organizations/rapid-compliance-root/test_workspaces/default/entities/orders/records`
- **Pattern to follow:** Look at how `/deals/page.tsx` or `/contacts/page.tsx` implements list + detail views

#### 2. SOCIAL MEDIA — ⚠️ STUB WITH MOCK DATA
**Priority:** High — page exists but uses hardcoded mock data instead of Firestore
**File:** `src/app/(dashboard)/social/` or `src/app/dashboard/marketing/social/`
**What to fix:**
- Replace hardcoded campaign/post data with real Firestore reads
- Wire up create post functionality
- Wire up edit/delete post functionality
- Implement post scheduling UI
- Connect analytics tab to real data
- Connect settings tab
- **Data path:** `test_organizations/rapid-compliance-root/test_workspaces/default/test_socialPosts`
- **May need API routes** at `src/app/api/social/posts/` for CRUD

#### 3. LEAD SCORING RULES — ⚠️ "MANAGE RULES" BUTTON BROKEN
**Priority:** Medium — dashboard displays scores fine, but rules management is missing
**File:** `src/app/(dashboard)/lead-scoring/page.tsx`
**What to fix:**
- "Manage Rules" button currently has NO onclick handler
- Build rules management UI (create, edit, delete scoring rules)
- Allow configuring: company fit rules, person fit rules, intent weights, engagement rules
- **Type definitions:** `src/types/lead-scoring.ts` — `ScoringRules` interface is fully defined with `CompanyFitRules`, `PersonFitRules`, `EngagementRules`
- **Default template exists:** `DEFAULT_SCORING_RULES` constant in lead-scoring.ts
- **Data path:** `test_organizations/rapid-compliance-root/test_workspaces/default/test_scoringRules`

#### 4. WEBHOOKS — ⚠️ HARDCODED MOCK DATA
**Priority:** Medium — page renders but shows hardcoded examples, not real data
**File:** `src/app/(dashboard)/settings/webhooks/page.tsx`
**What to fix:**
- Replace hardcoded webhook data with Firestore reads
- Wire up create webhook modal to actually save
- Wire up edit button
- Wire up delete button
- Wire up test webhook button
- **Data path:** `test_organizations/rapid-compliance-root/test_workspaces/default/test_webhooks`
- **May need API routes** for CRUD

#### 5. TEAM TASKS — ⚠️ MINIMAL IMPLEMENTATION
**Priority:** Medium — has Kanban layout and filtering, but missing CRUD
**File:** `src/app/(dashboard)/team/tasks/page.tsx`
**What to fix:**
- Add create task UI (button exists but `setShowNewTask` is unused)
- Add edit task UI
- Add delete task UI
- Possibly add drag-and-drop between Kanban columns
- **Data path:** `test_organizations/rapid-compliance-root/test_workspaces/default/test_teamTasks`

---

## Implementation Approach

**Best practice order:** Fix quick wins first (Lead Scoring, Webhooks, Team Tasks) since those pages already exist and just need wiring up, then build the new Orders page, then fix Social Media (largest scope).

**Patterns to follow:**
- All dashboard pages are client components (`'use client'`)
- Data fetching: Most pages use API routes (preferred) or direct Firestore reads
- Delete pattern: Confirmation modal before delete (see Blog page for reference)
- Collections registry: `src/lib/firebase/collections.ts` — use `COLLECTIONS` constants
- Firestore service: `src/lib/db/firestore-service.ts` — generic CRUD layer
- Auth: All API routes use `requireAuth` middleware from `src/lib/auth/api-auth`
- Toast notifications: Used across the app for success/error feedback
- Styling: Inline CSS or Tailwind — follow existing page patterns

**Key reference files:**
- `src/app/(dashboard)/website/blog/page.tsx` — Good example of list + delete with confirmation modal
- `src/app/(dashboard)/workflows/page.tsx` — Good example of full CRUD list page
- `src/app/(dashboard)/settings/custom-tools/page.tsx` — Good example of settings CRUD
- `src/lib/firebase/collections.ts` — Collection names and path helpers
- `src/lib/db/firestore-service.ts` — Firestore CRUD operations

---

## Firestore Path Reference

All dev paths use `test_` prefix. The pattern is:
```
test_organizations/rapid-compliance-root/test_workspaces/default/...
```

| Collection | Path under workspace root |
|------------|--------------------------|
| Contacts | `entities/contacts/records` |
| Leads | `entities/leads/records` |
| Deals | `entities/deals/records` |
| Products | `entities/products/records` |
| Orders | `entities/orders/records` |
| Activities | `activities` |
| Workflows | `test_workflows` |
| Forms | `test_forms` |
| Social Posts | `test_socialPosts` |
| Templates | `test_globalTemplates` |
| Scoring Rules | `test_scoringRules` |
| Webhooks | `test_webhooks` |
| Team Tasks | `test_teamTasks` |
| Conversations | `test_conversations` |
| Integrations | `test_integrations` |
| Custom Tools | `test_customTools` |
| Email Campaigns | `test_emailCampaigns` |
| Nurture Sequences | `test_nurtureSequences` |
| Analytics | `analytics` |
| Pages | `test_pages` |
| Blog Posts | `test_blogPosts` |

Org-level (not workspace-scoped):
```
test_organizations/rapid-compliance-root/test_onboarding/current
test_organizations/rapid-compliance-root/agent/persona
test_organizations/rapid-compliance-root/test_siteConfig/demo-site-config
test_organizations/rapid-compliance-root/test_themes/demo-theme
test_organizations/rapid-compliance-root/test_navigation/demo-navigation
```

---

## Issues Tracker

| Issue | Status | Resolution |
|-------|--------|------------|
| Orders page missing entirely | TODO | Build new page |
| Social media page uses mock data | TODO | Wire to real Firestore data |
| Lead scoring "Manage Rules" button broken | TODO | Build rules management UI |
| Webhooks page uses hardcoded data | TODO | Wire to real Firestore data |
| Team tasks missing create/edit/delete | TODO | Complete CRUD UI |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance — READ FIRST every session |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |
| `src/lib/firebase/collections.ts` | Collection names and path helpers |
| `src/lib/db/firestore-service.ts` | Generic Firestore CRUD layer |
| `src/types/lead-scoring.ts` | Lead scoring interfaces + DEFAULT_SCORING_RULES |
| `src/types/social.ts` | Social media post interfaces |
| `src/types/ecommerce.ts` | Order/cart interfaces |
| `src/types/workflow.ts` | Workflow interfaces |
| `scripts/seed-demo-account.ts` | Part 1 seed script (CRM data) |
| `scripts/seed-demo-account-part2.ts` | Part 2 seed script (platform data) |
