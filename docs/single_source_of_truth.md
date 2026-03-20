# SalesVelocity.ai - Single Source of Truth

**Generated:** January 26, 2026
**Last Updated:** March 19, 2026 (Scene grading & review system, shot continuity, Deepgram transcription integration, storyboard illustration style)
**Branches:** `dev` (latest)
**Status:** AUTHORITATIVE - All architectural decisions MUST reference this document
**Architecture:** Single-Tenant Penthouse Model (development strategy — multi-tenant SaaS product)
**Audit Method:** Multi-agent parallel scan with verification + Deep-dive forensic analysis + Playwright Visual Trace Audit

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Status](#current-status-february-28-2026)
3. [Ironclad Architecture Rules](#ironclad-architecture-rules) **[BINDING]**
4. [Single-Tenant Architecture](#single-tenant-architecture-complete)
5. [Verified Live Route Map](#verified-live-route-map)
6. [Agent Registry](#agent-registry)
7. [Unified RBAC Matrix](#unified-rbac-matrix)
8. [Security Audit Findings](#security-audit-findings)
9. [Tooling Inventory](#tooling-inventory)
10. [Infrastructure Systems](#infrastructure-systems)
11. [Integration Status](#integration-status)
12. [Firestore Collections](#firestore-collections)
13. [Architecture Notes](#architecture-notes)
14. [Data Contracts Reference](#data-contracts-reference)
15. [Autonomous Verification](#autonomous-verification)
16. [Document Maintenance](#document-maintenance)

---

## Executive Summary

### Platform Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Physical Routes (page.tsx) | 182 | Updated March 17, 2026 (+1 mission-control/review) |
| API Endpoints (route.ts) | 382 | Updated March 19, 2026 (+2 scene grading/review routes) |
| AI Agents | 52 | **52 FUNCTIONAL (46 swarm + 6 standalone)** |
| RBAC Roles | 4 | owner / admin / manager / member |
| TypeScript Files | 1,582 | Verified March 15, 2026 |
| Firestore Collections | 80+ | Active |

**Architecture:** Single-tenant Penthouse Model (development strategy). SalesVelocity.ai is a multi-tenant SaaS product — clients will purchase their own deployment. Penthouse simplifies development; multi-tenancy will be re-enabled.

### Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (Status: **DEPLOYED** — dev → main → Vercel auto-deploy)
- **Database:** Firebase Firestore (single-tenant: `rapid-compliance-65f87`)
- **Authentication:** Firebase Auth with custom claims
- **AI Gateway:** OpenRouter (100+ models)
- **Voice:** VoiceEngineFactory (ElevenLabs, Unreal Speech)
- **Payments:** Stripe

### Codebase Scale (March 6, 2026)

| Metric | Count |
|--------|-------|
| **TypeScript Files** | 1,582 |
| **Estimated Code Lines** | ~340,000 |
| **Test Files (Jest + Playwright)** | 22 |

**Breakdown by Directory (TypeScript):**

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/lib/` | ~490 | Core business logic, services, agents |
| `src/components/` | ~200 | UI components (+13 lead-research) |
| `src/app/api/` | ~357 | API routes |
| `src/app/(dashboard)/` | ~116 | Dashboard pages |
| `src/types/` | ~42 | TypeScript definitions |
| `src/hooks/` | ~22 | React hooks |

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
| `tsconfig.eslint.json` | ESLint-scoped tsconfig (src/ only, excludes .next) | Operational |
| `.husky/*` | Pre-commit hooks | 🔒 **LOCKED** |

**Pre-Commit Gate Requirements:**
- `npm run lint` must pass (uses `cross-env NODE_OPTIONS=--max-old-space-size=8192`)
- `npx tsc --noEmit` must pass (W2 Build Gate)
- `npm run build` must succeed
- No new `any` types introduced
- No new eslint-disable comments added

**ESLint Memory Configuration:**
- ESLint uses `tsconfig.eslint.json` (scoped to `src/` only) to avoid loading `.next` build cache (~5.3GB)
- All lint scripts in `package.json` use `cross-env NODE_OPTIONS=--max-old-space-size=8192`
- Pre-commit hook (`.husky/pre-commit`) exports `NODE_OPTIONS` with 8GB heap
- Full lint completes in ~1m42s with zero OOM

### Recent Major Milestones

> All milestone details (Sessions 1-31) have been archived. Key achievements:
> - **Hedra Video Fix** — Replaced 3-step TTS dance with inline `audio_generation`. Confirmed Kling O3 T2V produces speaking characters. hedra-node SDK rejected as outdated. Full system review completed. (March 15)
> - **Campaign Orchestration Pipeline Layer 1+2 DONE** — Campaign + CampaignDeliverable models, 4 API routes, `create_campaign` Jasper tool, deliverable auto-tracking on produce_video/save_blog_draft/social_post, Campaign Review UI at `/mission-control?campaign={id}`. (March 15)
> - **System-wide audit** — 1,582 files, 376 API routes, 0 `any` types, 0 TODOs, 0 security issues. Code quality rated excellent. (March 15)
> - **Voice Lab & Custom Avatars** — Recording studio, voice library, avatar photo upload to Firestore `custom_avatars`, voice assignment, CUSTOM badges (March 6)
> - **Lead Research AI upgrade** — Apollo free-tier org search, 8-tool AI chat with comprehensive system prompt, 5 tool rounds (March 6)
> - Growth Command Center — 6 pages, 11 API routes, 3 crons (March 2)
> - Production deployment to Vercel via main branch (Session 30)
> - Nav consolidation: 13 sections → 9 (Sessions 25-27)
> - All 36 features across 8 sprints built to production-ready (Sessions 20-24)

### Video System Architecture (Updated March 15, 2026)

- **Hedra is the sole video engine.** Two generation modes:
  - **Prompt-only:** Kling O3 Standard T2V — generates speaking characters with native audio from text prompt. No portrait needed.
  - **Avatar mode:** Character 3 — portrait + inline `audio_generation` for controlled lip-sync with exact script and voice.
- **Inline TTS** replaces separate 3-step TTS dance. Single API call to Hedra.
- **87 models available** (58 video, 29 image). Key lip-sync models: Character 3 (auto duration), Omnia (8s), Avatar (10min), VEED Fabric (5min).
- **69 voices** including ElevenLabs, MiniMax, and custom clones via `type: "voice_clone"`.
- **Character Studio** stores client characters in Firestore (portraits, voices, metadata). Hedra's element API is read-only via API key — custom characters must live in our system.
- **Prompt pipeline:** `hedra-prompt-agent.ts` and `hedra-prompt-translator.ts` updated March 15 — correct inline TTS field structure enforced, cinema-quality prompt generation for both avatar and T2V modes.
- **Core business value:** Clients clone themselves (face + voice) to automate daily video content. Cinema-quality enterprise ads at a fraction of traditional cost.

### AI Creative Studio (Planned — March 16, 2026)

**Inspiration:** RenderZero AI Studio — professional-grade cinematic AI image/video generation with deep creative controls.
**Goal:** Build a web-native equivalent directly into SalesVelocity.ai at `/content/studio`, surpassing RenderZero's desktop app with SaaS convenience + campaign integration.

**Core Architecture (8 Phases):**

| Phase | Name | What It Delivers |
|-------|------|-----------------|
| 1 | Cinematic Preset Engine | 200+ presets: 49 camera bodies, 43 lighting setups, 30 film stocks, 100+ movie looks, 20+ art styles (photorealistic, Pixar/3D, anime, comic, watercolor, oil painting, cyberpunk, fantasy, noir, retro, etc.), 15+ compositions. Data layer + prompt injection system. |
| 2 | Multi-Provider Backend | Fal.ai (Flux/SDXL), Google AI Studio (Gemini), Kling 3.0, Hedra (avatar), DALL-E 3. Provider router with BYOK key management. |
| 3 | Studio UI — Image Generation | Full creative workspace: prompt + cinematic controls panel, live preview, generation history/gallery, batch generation. Manual mode with direct parameter editing. |
| 4 | Character System (Upgraded) | Full character profiles: face refs, clothing, personality, voice. Face-lock consistency across generations. Wardrobe system. Import from photo. Character library with search/organize. |
| 5 | Image → Video Bridge | Generate still → click "animate" → routes to Kling/Hedra. Multi-angle generation (same scene, 3-4 camera positions). Seamless hybrid workflow. |
| 6 | Studio UI — Video Controls | Cinematic controls applied to video generation. Scene-level camera/lighting/style. Storyboard integration with visual presets. |
| 7 | Cost Tracking Dashboard | Per-generation cost logging by provider/model/resolution. Daily/weekly/monthly spend. Per-project rollup. Budget alerts. |
| 8 | Manual Fallback Mode | Full offline-capable preset browsing. Prompt builder from dropdowns (no AI call needed). Queue-and-retry when providers are down. Pro mode vs Easy mode toggle. |

**Key Design Decisions:**
- Web-native (not desktop) — runs inside SalesVelocity dashboard, no separate app
- BYOK model — clients use their own API keys (already in Firestore via `/settings/api-keys`)
- Campaign-integrated — studio generations can feed directly into campaign deliverables
- Jasper-aware — `create_image`, `create_cinematic_video` tools will use studio presets
- Manual fallback — all controls work without AI; prompt builder constructs from dropdowns

**New Files (Planned):**
- `src/app/(dashboard)/content/studio/page.tsx` — Main creative studio UI
- `src/lib/ai/creative-studio-service.ts` — Multi-provider orchestration
- `src/lib/ai/cinematic-presets.ts` — 200+ preset library with prompt mappings
- `src/lib/ai/provider-router.ts` — BYOK provider selection and routing
- `src/lib/ai/cost-tracker.ts` — Per-generation cost logging
- `src/types/creative-studio.ts` — CinematicPreset, StudioGeneration, CharacterProfile, ProviderConfig types
- API routes: `/api/studio/generate`, `/api/studio/providers`, `/api/studio/presets`, `/api/studio/characters`, `/api/studio/cost`

**Firestore (Planned):**
- `organizations/{PLATFORM_ID}/studio/presets` — Custom presets (user-created)
- `organizations/{PLATFORM_ID}/studio/characters` — Enhanced character profiles
- `organizations/{PLATFORM_ID}/studio/generations` — Generation history with cost tracking
- `organizations/{PLATFORM_ID}/studio/cost-log` — Per-generation cost records

**Provider Matrix:**

| Provider | Capability | Models | Cost Range |
|----------|-----------|--------|------------|
| Fal.ai | Image gen (fast) | Flux, SDXL, Stable Diffusion | $0.01–$0.05/image |
| Google AI Studio | Image gen | Gemini image models | $0.01–$0.04/image |
| DALL-E 3 | Image gen (quality) | DALL-E 3 | $0.04–$0.12/image |
| Hedra | Avatar video | Character 3, Kling O3 | $0.05–$0.15/video |
| Kling 3.0 | Video gen | Kling 3.0 | $0.03–$0.10/video |

### Campaign Orchestration Pipeline (Layers 1–4 DONE — March 15, 2026)

Jasper orchestrates full marketing campaigns: research → strategy → produce all content → unified review.

**Built (Layers 1+2):**
- `Campaign` + `CampaignDeliverable` types with Zod schemas (`src/types/campaign.ts`)
- Full Firestore CRUD service with auto-status promotion (`src/lib/campaign/campaign-service.ts`)
- 4 API routes: `POST/GET /api/campaigns`, `GET/PATCH /api/campaigns/[campaignId]`, `POST/GET .../deliverables`, `PATCH .../deliverables/[deliverableId]`
- `create_campaign` Jasper tool + `campaignId` param on `produce_video`, `save_blog_draft`, `social_post`
- Campaign Review UI at `/mission-control?campaign={id}` — deliverable cards, approve/reject/feedback, "Approve All", progress bar
- Firestore: `organizations/{PLATFORM_ID}/campaigns/{campaignId}` + `.../deliverables/{deliverableId}`

**Built (Layers 3+4):**
- **Layer 3 — Auto-Publish Pipeline:** Approved deliverables auto-publish: blog drafts → published post, social → posted via social agent, video/image → saved to media library. Zero manual steps after approval.
- **Layer 4 — Feedback Loop:** Rejected deliverables with reviewer feedback auto-create revision missions via `mission-persistence.ts`. Each rejection spawns a new tracked mission so Jasper iterates until approval.

---

## Current Status (March 6, 2026)

### Production Readiness: ~97%

| Area | Status |
|------|--------|
| Single-tenant architecture | **COMPLETE** — Firebase kill-switch, PLATFORM_ID constant, workspace paths eradicated (53 files migrated) |
| 4-role RBAC | **ENFORCED** — `requireRole()` on ~347/355 API routes (8 intentionally public), sidebar filtering, 47 permissions |
| Agent hierarchy | **100% COMPLETE** — 52 agents (46 swarm + 6 standalone), all managers orchestrate all specialists |
| Jasper delegation | **COMPLETE** — 51 tools (13 delegate_to_*, 38 utility incl. create_campaign, assemble_video, edit_video, manage_media_library). Mission Control SSE streaming + Campaign Review live |
| Lead Research | **COMPLETE** — Unified 3-column page with AI chat, results panel, URL sources. 5 API routes, 8-tool AI subset |
| Type safety | **CLEAN** — `tsc --noEmit` passes, zero `any` types, zero `@ts-ignore`, zero `@ts-expect-error` |
| Build pipeline | **CLEAN** — `npm run build` passes, `npm run lint` zero warnings, 17 eslint-disable (ratcheted) |
| Dashboard UI | **180 pages** with 12-module feature toggle system |
| Integrations | **28 real integrations** verified with actual API calls (added Apollo, Clay) |

### Open Items — Launch Punch List

#### Tier 1: CRITICAL (Code fixes — actively harmful or demo-breaking)

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | **Facebook agent fake data** | Removed Math.random() metrics + shareInsight calls | ✅ FIXED Mar 9 |
| 2 | **Twitter agent fake data** | Wired real TwitterService; shareInsight only with real API data | ✅ FIXED Mar 9 |
| 3 | **CRM event triggers disabled** | Replaced client SDK with admin SDK; triggers now query Firestore correctly | ✅ FIXED Mar 9 |
| 4 | **Email tracking not recorded** | Replaced client SDK with admin SDK; opens/clicks now persist | ✅ FIXED Mar 9 |
| 5 | **Signal persistence now durable** | Signal persistence now durable — writeSignal awaits Firestore confirmation. Workflow execution was already tracked. | ✅ FIXED Mar 10 |
| 6 | **Cross-manager routing fake** | Returns honest "not yet wired" instead of fake success | ✅ FIXED Mar 9 |
| 7 | **Social posting DEV MODE** | Returns 503 error when credentials missing (was fake 200) | ✅ FIXED Mar 9 |
| 8 | **Commerce payment fake** | Returns error when Stripe unconfigured (was fake checkout session) | ✅ FIXED Mar 9 |
| 9 | **Voice outreach blocked** | Already returns honest BLOCKED status — not a lie | ⚠️ KNOWN |

#### Tier 2: Functional Gaps (Silent failures, empty responses)

| # | Area | Issue | Status |
|---|------|-------|--------|
| 10 | **Lead nurturing** | scheduleStep implemented with admin SDK; cron pickup works | ✅ FIXED Mar 9 |
| 11 | **Deal pipeline chart** | Time series now uses real deal data | ✅ FIXED Mar 9 |
| 12 | **GMB agent** | Returns empty array with warning (Google Places API needed) | ✅ FIXED Mar 9 |
| 13 | **Review manager** | Queries real Firestore reviews collection | ✅ FIXED Mar 9 |
| 14 | **Catalog sync** | Returns honest error instead of success:true with zero synced | ✅ FIXED Mar 9 |
| 15 | **Video system** | Phase 1 complete — Hedra-only engine, TTS fixed, all engines stripped | ✅ FIXED Mar 9 |
| 16 | **Vertex AI tuning** | Throws honest error about missing credentials | ✅ FIXED Mar 9 |
| 17 | **Workflow triggers** | Warning logs added; config-only until Cloud Functions deployed | ✅ FIXED Mar 9 |
| 18 | **score_leads tool** | Real scoring implemented — queries leads, scores, writes back | ✅ FIXED Mar 9 |

#### Tier 3: External Blockers (Need credentials or third-party action)

| # | Area | What's Needed |
|---|------|---------------|
| 18 | **Stripe** | Production API keys (bank account setup) |
| 19 | **Facebook/Instagram** | Meta Developer Portal approval |
| 20 | **LinkedIn** | Marketing Developer Platform approval |
| 21 | **Twilio** | Account verification for voice calls |
| 22 | **Email DNS** | SPF/DKIM/DMARC for salesvelocity.ai |
| 23 | **Domain** | CNAME/A records to Vercel, SSL |
| 24 | **OAuth apps** | Production redirect URIs |

#### Tier 4: Technical Debt (Post-launch OK)

| # | Issue | Status |
|---|-------|--------|
| 25 | Placeholder tests | ✅ FIXED Mar 9 — only 6 existed (not 115), removed |
| 26 | Zod validation coverage | ✅ FIXED Mar 9 — 100% of mutation routes validated (was ~74%, not 49%) |
| 27 | 37 skipped tests (need external services) | 34 skipped tests — 16 E2E timing (Firebase auth slow), 13 need API keys (external), 1 Jest limitation. All have proper conditional skip logic. \| DOCUMENTED |
| 28 | Search uses Firestore full-scan (no Algolia) | ✅ FIXED Mar 10 — admin SDK, parallel queries, per-schema caps (200), relevance scoring, early termination |
| 29 | Admin DAL `verifyAccess()` is a no-op | ✅ FIXED Mar 10 — dead code removed |
| 30 | SMTP was a stub — now real via nodemailer | ✅ FIXED Mar 10 — only SMTP was a stub; now real via nodemailer. Square, Vonage, Resend, and Calendly were already real implementations. |

### Active Roadmap

| Priority | Focus | Status |
|----------|-------|--------|
| **Tier 1 punch list** | 8/9 fixed, 1 known (voice blocked on Twilio) | ✅ DONE |
| **Tier 2 gaps** | All 9 items resolved | ✅ DONE |
| **Tier 4 debt** | Search, SMTP, dead code, Zod, tests — all resolved or documented | ✅ DONE |
| **Video Phase 2** | Character Studio — source badges, role/style, dual TTS, Hedra browser | ✅ DONE |
| **Video Phase 3** | AI Video Director — produce_video, assemble_video, brand memory, review UI | ✅ DONE |
| **Video Phase 4** | Video Editor (CapCut-style timeline), Media Library, edit_video + manage_media_library Jasper tools | ✅ DONE |
| **Facebook/Instagram** | Implement when Meta Developer Portal approval obtained | BLOCKED |
| **LinkedIn official** | Replace RapidAPI wrapper when Marketing Developer Platform approved | BLOCKED |
| **Stripe go-live** | Switch from test to live keys when bank account setup complete | BLOCKED |

### Completed Sprints (All)

> Sprints 1-17 archived. Sprints 18+ listed below.

| Sprint | Summary | Date |
|--------|---------|------|
| **18-23** | Mission Control (live SSE, cancel, delegation), AI Search Optimization, Website Migration, Security Hardening | Feb 24 |
| **24** | Admin SDK Migration — 64 API routes migrated | Feb 25 |
| **25-28** | Workspace eradication, nav cleanup, feature toggles, onboarding overhaul | Feb 27 |
| **—** | Demo seed Part 4, Growth Command Center, Golden Masters, Coaching | Mar 2 |
| **—** | Lead Research consolidation — 4 tools → 1 page, leads tab nav fixed | Mar 5 |

### Completed Roadmaps (Archived)

All roadmaps fully complete. Details in git history and `docs/archive/`.

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
| **Validation Helpers** | `PLATFORM_ID` constant; `getSubCollection()` builds platform-scoped Firestore paths |

**Enforcement:**
- All Firestore paths, API routes, and service classes use `DEFAULT_ORG_ID` exclusively
- `CriticalConfigurationError` in `src/lib/firebase/config.ts` halts the application if any other Firebase project is detected at runtime
- All Firestore path helpers (`getSubCollection`, `getPlatformCollection`) use `PLATFORM_ID` internally — no dynamic org routing

**Bug Definition:** Any code that introduces dynamic organization IDs, org-switching logic, tenant selection, multi-org routing, or parameterized org resolution is a **bug**. There is no org picker. There is no tenant dropdown. All paths use `PLATFORM_ID` constant.

---

### Rule 2: Unified AI Workforce Registry

**The 52 AI Agents are managed through a single global registry (src/lib/agents/agent-registry.ts), not per-user.**

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

**Total: 46 Swarm (1 + 9 + 36) + 6 Standalone = 52 Agents**

**Governance:** Agents are deployed, trained, and configured at the **platform level**. The `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) creates ephemeral session instances from Golden Masters — these are temporary runtime objects, not persistent per-user registries.

**Bug Definition:** Any code that creates user-scoped agent registries or duplicate agent manifests outside the global registry is a **bug**.

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

**Known Exception:** `AdminSidebar.tsx` uses `iconColor` CSS variable strings (e.g., `var(--color-primary)`, `var(--color-success)`) in its navigation config for Lucide icon coloring. These are static navigation constants in the config array — migrated from hex strings to CSS variables as of Session 25.

**Bug Definition:** Any component that uses literal hex codes, `rgb()` values, or hard-coded color strings for theming instead of CSS variables is a **bug**.

---

### Rule 4: Navigation Hierarchy — Consolidated Sidebar

**All navigation lives in a single `AdminSidebar` component. The legacy "God Mode" sidebar is dead. Do not resurrect it.**

| Aspect | Detail |
|--------|--------|
| **Source** | `src/components/admin/AdminSidebar.tsx` |
| **Sections** | 9 navigation sections, ~40 sidebar items |
| **Width** | 280px expanded / 64px collapsed |
| **Theming** | 100% CSS variable-driven via `var(--color-*)` |
| **Routing** | All static routes — no dynamic org parameters in sidebar links |
| **Footer** | Integrations (plug icon → `/settings/integrations`), Settings (gear icon → `/settings`), and Help/Academy (help icon → `/academy`) |
| **Tab Navigation** | `SubpageNav` component provides route-based tabs on hub/parent pages |

**Consolidated Navigation Structure (February 27, 2026 — Redundancy Cleanup):**

| # | Section | Sidebar Items | Sub-pages (via SubpageNav tabs) |
|---|---------|---------------|----------------------------------|
| 1 | **Home** | Dashboard, Team | Dashboard tabs: Dashboard, Executive Briefing, Workforce HQ; Team tabs: Leaderboard, Tasks, Performance |
| 2 | **CRM** | Leads, Contacts, Companies, Deals, Conversations | Leads tabs (layout): All Leads (`/entities/leads`), Lead Research (`/leads/research`), Scoring (`/lead-scoring`) |
| 3 | **Outreach** | Sequences, Campaigns, Email Studio, Calls | Email Studio tabs: Email Writer, Nurture, Email Builder, Templates |
| 4 | **Marketing** | Social Hub, Video, Proposals, Forms, Workflows | Social Hub tabs (layout): Command Center, Campaigns, Calendar, Approvals, Listening, Agent Rules, Playbook; Proposals tabs: Proposals, Builder |
| 5 | **Commerce** | Products, Orders, Storefront | — |
| 6 | **Website** | Website | Website tabs (layout): Editor, Pages, Templates, Blog, SEO, Navigation, Settings, Audit Log; Blog sub-tabs: Posts, Editor, Categories; SEO sub-tabs: SEO, Competitors, Domains |
| 7 | **AI Workforce** | AI Workforce | Mission Control tabs (layout): Live, History; Training Hub tabs: AI Training, Voice, Social, SEO; Models tabs: Datasets, Fine-Tuning |
| 8 | **Analytics & Growth** | Overview, Growth, A/B Testing | Analytics tabs (layout): Overview, Revenue, CRM Analytics, E-Commerce, Attribution, Workflows, Sequences, Compliance, Competitor Research |
| 9 | **System** (owner-only) | System | System tabs: System Health, Impersonate |

**Footer:** Integrations → `/settings/integrations`, Settings → `/settings`, Academy → `/academy`

**SubpageNav Architecture:**
- **Component:** `src/components/ui/SubpageNav.tsx` — Route-based tab bar using `usePathname()`
- **Centralized Config:** `src/lib/constants/subpage-nav.ts` — 21 tab arrays
- **11 layout.tsx files** render SubpageNav automatically: social, analytics, website, website/blog, website/seo, mission-control, ai, coaching, team, growth, leads
- **Cross-route pages** import from centralized constants and render inline SubpageNav (e.g., entities/leads page shows LEADS_TABS)

**Lead Research Consolidation (March 5, 2026):**
- `/leads/icp`, `/leads/discovery`, `/scraper` → all redirect to `/leads/research`
- `/leads` → redirects to `/entities/leads` (All Leads entity page)
- `entities/[entityName]/page.tsx` renders LEADS_TABS when `entityName === 'leads'`
- `leads/layout.tsx` renders LEADS_TABS for all `/leads/*` sub-routes

**History:** 13 sections → 9 sections (Sessions 25-27). 11 layout.tsx files render SubpageNav. 21 tab arrays in centralized config. 12 pages redirect to canonical routes.

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
| CRM Records | `organizations/rapid-compliance-root/{entity}/{id}` | Entity records (flat, no workspace nesting) |
| Schemas | `organizations/rapid-compliance-root/schemas/{schemaId}` | Data schemas (flat, no workspace nesting) |
| Email Campaigns | `organizations/rapid-compliance-root/emailCampaigns/{campaignId}` | Email campaign data |
| Nurture Sequences | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}` | Nurture sequence data |
| Signals | `organizations/rapid-compliance-root/signals/{signalId}` | Agent signal bus events |

**Collection Helpers (in `src/lib/firebase/collections.ts`):**

```typescript
orgCol(collection)         → organizations/rapid-compliance-root/{collection}
orgDoc(collection, id)     → organizations/rapid-compliance-root/{collection}/{id}
```

All helpers are hardcoded to `DEFAULT_ORG_ID`. There is no dynamic org parameter. Workspace-scoped path builders (`workspacePath`, `entityRecordsPath`) have been fully eradicated — 53 files migrated to flat org-scoped paths as of February 27, 2026.

**Bug Definition:** Any code that constructs Firestore paths with dynamic organization IDs, nests `users` or `platform_settings` under an organization document, or creates per-user root-level collections for data that belongs at org scope is a **bug**.

---

## Single-Tenant Architecture (COMPLETE)

**Status:** FULLY COMPLETE — February 2, 2026 | **Net Result:** -185 files, -71,369 lines of code

SalesVelocity.ai is a **multi-tenant SaaS product** currently running on the Penthouse Model (single-tenant development strategy). Multi-tenancy will be re-enabled after core features are stable. All data paths use `PLATFORM_ID` constant.

**Security:** Firebase kill-switch in `src/lib/firebase/config.ts` — only `rapid-compliance-65f87` project allowed, `CriticalConfigurationError` halts on mismatch. Routes use `/(dashboard)/*` layout. Legacy URLs redirect via middleware.

> Migration details, backend status tables, and conversion phase records archived in `docs/archive/`.

---

## Verified Live Route Map

### Route Distribution (March 6, 2026)

| Area | Routes | Dynamic Params | Status |
|------|--------|----------------|--------|
| Dashboard (`/(dashboard)/*`) | ~116 | 8 | **Flattened** single-tenant (incl. social, mission-control, video, settings; 12 redirects included) |
| Public (`/(public)/*`) | ~20 | 1 (`[formId]`) | Marketing + auth pages |
| Dashboard sub-routes (`/dashboard/*`) | 16 | 0 | Analytics, coaching, marketing, performance |
| Store (`/store/*`) | ~5 | 1 (`[productId]`) | E-commerce storefront |
| Onboarding (`/onboarding/*`) | 4 | 0 | 4-step onboarding: industry category, niche drill-down, account creation, API key setup |
| Auth (`/(auth)/*`) | 1 | 0 | Admin login |
| Other (`/preview`, `/profile`, `/sites`) | 3 | 2 | Preview tokens, user profile, site builder |
| **TOTAL** | **181** | **~11** | **Updated March 10, 2026 (+1 Video Editor)** |

**DELETED:** `src/app/workspace/` (95 pages) and `src/app/admin/*` (92 pages) - legacy routes removed/consolidated into `(dashboard)`

### Admin Routes (ARCHIVED — Consolidated into Dashboard)

> **Note:** The standalone `/admin/*` page routes (92 pages) were removed during consolidation. All administrative functionality now lives within the `/(dashboard)/*` route group, accessible via RBAC role-gating (`owner`/`admin` roles). Admin API routes (`/api/admin/*`) still exist for backend operations.
>
> **Admin Login:** `/(auth)/admin-login` — Firebase admin auth
### Dashboard Routes (127 in /(dashboard)/* - Flattened Single-Tenant)

> **Note:** All dashboard routes use `PLATFORM_ID = 'rapid-compliance-root'` internally via `getSubCollection()`.

**Core Navigation:**
- `/dashboard`, `/settings`, `/analytics`, `/templates`
- `/battlecards`, `/email-writer`, `/lead-scoring`, `/living-ledger`
- `/conversations`, `/workforce`, `/crm` (unified CRM with entity tabs)

**CRM Entities:**
- `/crm` (unified: leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks via `?view=` param)
- `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`
- `/leads/research` (3-column Lead Research page — AI chat, results, URL sources)
- `/leads/icp` → redirects to `/leads/research`
- `/leads/discovery` → redirects to `/leads/research`
- `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit`
- `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit`
- `/products`, `/products/new`, `/products/[id]/edit`
- `/orders` (NEW Feb 12 — full order management with table, filters, detail drawer)
- `/entities/[entityName]` (entity config gating — disabled entities show "not enabled" banner with Enable button for admin, "contact admin" for users)

**Entity Config System (NEW Feb 28):**
- 5 Always-On: `leads`, `contacts`, `companies`, `deals`, `tasks` — cannot be toggled off
- 5 CRM Extended: `products`, `quotes`, `invoices`, `payments`, `orders` — toggleable, default ON
- 13 Industry-Specific: `drivers`, `vehicles`, `compliance_documents`, `projects`, `time_entries`, `customers`, `inventory`, `properties`, `showings`, `cases`, `billing_entries`, `patients`, `appointments` — toggled by category defaults
- Schema Editor dims disabled entities (50% opacity), hides "View Data", shows "Enable in Settings" link
- Settings > Features page has 5 tabs: Your Business → Features → **CRM Entities** → API Keys → Summary
- Stored in Firestore: `organizations/{PLATFORM_ID}/settings/entity_config`

**Marketing & Outbound:**
- `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[campaignId]`
- `/nurture`, `/nurture/new`, `/nurture/[id]`, `/nurture/[id]/stats`
- `/ab-tests`, `/ab-tests/new`, `/ab-tests/[id]`
- `/outbound/sequences`
- `/social/campaigns` (Content Studio — dual-mode autopilot/manual), `/social/training`, `/social/approvals` (batch review, correction capture, "Why" badge), `/social/calendar`, `/social/listening`
- `/social/command-center` (kill switch, velocity gauges, agent status, activity feed), `/social/analytics` (dashboard), `/social/agent-rules` (guardrails editor)

**Deleted Duplicates (February 26, 2026):**
- `/marketing/ab-tests` — duplicate of `/ab-tests`
- `/outbound/email-writer` — duplicate of `/email-writer`
- `/identity/refine` — duplicate of `/settings/ai-agents/persona`

**Redirected Pages:**
- `/integrations` → `/settings/integrations`
- `/ai-agents` → `/workforce`
- `/settings/workflows` → `/workflows`
- `/outbound` → `/email-writer`
- `/leads` → `/entities/leads` (All Leads entity page with LEADS_TABS)
- `/contacts` → `/crm?view=contacts`
- `/social/activity` → `/social/command-center`
- `/analytics/pipeline` → `/analytics/sales`
- `/website/seo/ai-search` → `/website/seo`
- `/leads/icp` → `/leads/research` (March 5 — consolidated into Lead Research)
- `/leads/discovery` → `/leads/research` (March 5 — consolidated into Lead Research)
- `/scraper` → `/leads/research` (March 5 — consolidated into Lead Research)

**Video & Voice Lab:**
- `/content/video` (Video Studio — Hedra-only engine + Character Studio + AI Video Director)
- `/content/video/library` (Video Library gallery with grid view, filter tabs, detail expansion, edit/download/delete actions)
- `/content/video/editor` (Standalone Video Editor — CapCut-style timeline, clip stitching, audio mixing, text overlays; accepts project clips or direct URL list)
- `/content/voice-lab` (Voice Lab — recording studio, voice library with ElevenLabs voices, AI music generation)
- **Character Studio** — reusable character library: custom + Hedra stock characters, reference images, green screen clips, voice assignment, role/style tags. Auto-syncs all Hedra characters into avatar picker on mount.
- **AI Video Director** — `produce_video`, `assemble_video`, `edit_video`, and `manage_media_library` Jasper tools, per-scene character assignment, Hedra prompt translator, scene review workflow (approve/reject/feedback/regenerate), brand preference memory.
- **Current Status: FUNCTIONAL** — Hedra sole engine. Phases 1-4 complete (March 10). Video Editor, Media Library, and 2 new Jasper tools operational.

**Growth Command Center (NEW March 2):**
- `/growth/command-center` — Overview dashboard: stat cards (competitors, keywords, AI visibility), competitive landscape, keyword movers, strategy status, activity feed
- `/growth/competitors` — Competitor cards, discover by niche, add/analyze/remove, domain authority trends
- `/growth/keywords` — Keyword ranking table with position/change/volume/CPC/difficulty, bulk add, check ranking
- `/growth/strategy` — 3-tier strategy comparison (Aggressive/Competitive/Scrappy), approve/reject, budget config, cheaper alternatives
- `/growth/ai-visibility` — AI search visibility score, query results, competitor presence, run check
- `/growth/activity` — Timeline activity feed with type filtering and icon/color coding

**AI Workforce:**
- `/mission-control` (NEW Sprint 18 — 3-panel live delegation tracker: sidebar, timeline, step detail)
- `/mission-control/history` (NEW Sprint 18 — paginated completed mission table)

**Settings (19 sub-routes):**
- `api-keys`, `accounting`, `storefront`, `promotions`
- `email-templates`, `sms-messages`, `theme`, `users`
- `security`, `integrations`, `webhooks`, `custom-tools`, `workflows`
- `lead-routing`, `meeting-scheduler`
- `features` (5 tabs: Your Business → Features → CRM Entities → API Keys → Summary)
- `ai-agents/*` (6 routes: hub, business-setup, configuration, persona, training, voice)

> **Removed:** `/settings/billing`, `/settings/subscription`, `/settings/organization` (subscription system deleted)

**Website Builder:**
- `/website/editor`, `/website/pages`, `/website/domains`, `/website/seo`, `/website/seo/competitors`
- `/website/settings`, `/website/templates`, `/website/navigation`, `/website/audit-log`
- `/website/blog`, `/website/blog/categories`, `/website/blog/editor`

**Website Migration Pipeline (Sprint 21):**
- Deep scraper with section-level extraction (`src/lib/website/deep-scraper.ts`)
- AI-powered Site Blueprint Extractor (`src/lib/website/site-blueprint-extractor.ts`)
- Full migration orchestration service with mission events (`src/lib/website/site-migration-service.ts`)
- Jasper tool: `migrate_website` — natural-language "clone this site" delegation

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

No open route issues. All previously identified stub pages and duplicate destinations have been resolved.

---

## Agent Registry

### Agent Swarm Overview

**Total Agents:** 52 (46 swarm + 6 standalone)
- **Swarm Agents:** 46 (1 orchestrator + 9 managers + 36 specialists)
- **Standalone Agents:** 6 (outside swarm hierarchy)
- **Variants:** 2 (Growth Analyst sub-specializations)

| Status | Count | Description |
|--------|-------|-------------|
| FUNCTIONAL (Swarm) | 46 | **100% SWARM COMPLETION** - All agents fully operational |
| FUNCTIONAL (Standalone) | 6 | Jasper (Internal Assistant), Voice Agent, Autonomous Posting Agent, Chat Session Service, AI Chat Sales Agent, Growth Strategist |
| GHOST | 0 | All specialists have been implemented |

### Master Orchestrator (1) - L1 Swarm CEO

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| MASTER_ORCHESTRATOR | MasterOrchestrator | Swarm Coordination | FUNCTIONAL | **Swarm CEO** - 2000+ LOC implementing Command Pattern for task dispatching, Saga Pattern for multi-manager workflows with compensation, processGoal() hierarchical task decomposition, intent-based domain routing engine with 9 intent categories, cross-domain synchronization with dependency graph resolution, getSwarmStatus() global state aggregation from all 9 managers, MemoryVault integration for goal insights |

### Managers (9) - L2 Orchestrators

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| INTELLIGENCE_MANAGER | IntelligenceManager | Research & Analysis | FUNCTIONAL | Dynamic orchestration engine with parallel execution, graceful degradation |
| MARKETING_MANAGER | MarketingManager | Social & Ads | FUNCTIONAL | **Industry-agnostic Cross-Channel Commander** - 1200+ LOC with dynamic specialist resolution (6 specialists: TIKTOK_EXPERT, TWITTER_X_EXPERT, FACEBOOK_ADS_EXPERT, LINKEDIN_EXPERT, SEO_EXPERT, GROWTH_ANALYST), Brand DNA integration, SEO-social feedback loop, intelligence signal wiring (TREND_SCOUT, SENTIMENT_ANALYST), GROWTH_LOOP orchestration cycle, OPPORTUNISTIC/CRISIS_RESPONSE/AMPLIFICATION modes, parallel execution |
| BUILDER_MANAGER | BuilderManager | Site Building | FUNCTIONAL | **Autonomous Construction Commander** - 1650+ LOC with dynamic specialist resolution (3 specialists: UX_UI_ARCHITECT, FUNNEL_ENGINEER, ASSET_GENERATOR), Blueprint-to-Deployment workflow, pixel injection (GA4, GTM, Meta Pixel, Hotjar), build state machine (PENDING_BLUEPRINT → ASSEMBLING → INJECTING_SCRIPTS → DEPLOYING → LIVE), Vercel deployment manifest generation, SignalBus `website.build_complete` broadcast, parallel execution, graceful degradation |
| COMMERCE_MANAGER | CommerceManager | E-commerce | FUNCTIONAL | **Transactional Commerce Commander** - 1400+ LOC with dynamic specialist resolution (4 specialists: PAYMENT_SPECIALIST, CATALOG_MANAGER, PRICING_STRATEGIST, INVENTORY_MANAGER), Product-to-Payment checkout orchestration, CommerceBrief revenue synthesis (Transaction Volume), MemoryVault tax/currency settings, parallel execution, graceful degradation |
| OUTREACH_MANAGER | OutreachManager | Email & SMS | FUNCTIONAL | **Omni-Channel Communication Commander** - 1900+ LOC with dynamic specialist resolution (EMAIL_SPECIALIST, SMS_SPECIALIST), Multi-Step Sequence execution, channel escalation (EMAIL → SMS → VOICE), sentiment-aware routing via INTELLIGENCE_MANAGER, DNC compliance via MemoryVault, frequency throttling, quiet hours enforcement, SignalBus integration |
| CONTENT_MANAGER | ContentManager | Content Creation | FUNCTIONAL | **Multi-Modal Production Commander** - 1600+ LOC with dynamic specialist resolution (4 specialists: COPYWRITER, CALENDAR_COORDINATOR, VIDEO_SPECIALIST, ASSET_GENERATOR), TechnicalBrief consumption from ARCHITECT_MANAGER, Brand DNA integration (avoidPhrases, toneOfVoice, keyPhrases), SEO-to-Copy keyword injection, ContentPackage synthesis, validateContent() quality gate, SignalBus `content.package_ready` broadcast, parallel execution, graceful degradation |
| ARCHITECT_MANAGER | ArchitectManager | Site Architecture | FUNCTIONAL | **Strategic Infrastructure Commander** - 2100+ LOC with dynamic specialist resolution (3 specialists), Brand DNA integration, MemoryVault Intelligence Brief consumption, SiteArchitecture + TechnicalBrief synthesis, SignalBus `site.blueprint_ready` broadcast, parallel execution, graceful degradation |
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
| SEO_EXPERT | SEOExpert | Keywords, optimization, **domain analysis** (traffic, backlinks, referring domains, competitors), crawl analysis, keyword gap, 30-day strategy | FUNCTIONAL |
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

> **Implementation Details:** Manager orchestration logic (pipelines, signal broadcasting, specialist coordination) is documented in the source code. See each manager's `manager.ts` file for details.

#### Commerce Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| PAYMENT_SPECIALIST | PaymentSpecialist | Checkout sessions, payment intents, refunds | FUNCTIONAL |
| CATALOG_MANAGER | CatalogManagerSpecialist | Product CRUD, variants, search | FUNCTIONAL |
| PRICING_STRATEGIST | PricingStrategist | Dynamic pricing, discounts, totals | FUNCTIONAL |
| INVENTORY_MANAGER | InventoryManagerAgent | Stock management, demand forecasting | FUNCTIONAL |

> Commerce orchestration details in `src/lib/agents/commerce/manager.ts`.

#### Outreach Domain (2)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| EMAIL_SPECIALIST | EmailSpecialist | Email campaigns | FUNCTIONAL |
| SMS_SPECIALIST | SmsSpecialist | SMS outreach | FUNCTIONAL |

> Outreach orchestration details in `src/lib/agents/outreach/manager.ts`.

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

> Revenue Director tuning logic details in `src/lib/agents/sales/revenue/manager.ts`.

#### Trust Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| GMB_SPECIALIST | GMBSpecialist | Google My Business, local SEO | FUNCTIONAL |
| REVIEW_SPECIALIST | ReviewSpecialist | Review management | FUNCTIONAL |
| REV_MGR | ReviewManagerSpecialist | Review response | FUNCTIONAL |
| CASE_STUDY | CaseStudyBuilderSpecialist | Case study creation | FUNCTIONAL |

> Reputation Manager orchestration details in `src/lib/agents/trust/reputation/manager.ts`.

### Standalone Agents (6) - Outside Swarm Hierarchy

These agents operate independently of the L1/L2/L3 swarm hierarchy:

| Agent | Type | Path | Status | Description |
|-------|------|------|--------|-------------|
| Jasper | Internal AI Assistant & Swarm Commander | Firestore `goldenMasters/` + `src/lib/orchestrator/jasper-tools.ts` | FUNCTIONAL | Jasper — the founder's internal AI assistant and swarm commander. **50 tools** across delegation, intelligence, content, video, and platform categories. Delegates to all 9 domain managers via `delegate_to_*` tools. Video: `produce_video`, `assemble_video`, `edit_video` (opens Standalone Video Editor, pre-loads clips), `manage_media_library` (list/search/add media assets with type/category filters). Does NOT handle customer-facing sales (that's the AI Chat Sales Agent). Relays Growth Strategist briefings. |
| AI Chat Sales Agent | Customer-Facing Sales Agent | `src/lib/agents/sales-chat/specialist.ts` | FUNCTIONAL | Customer-facing AI sales agent for website chat widget and Facebook Messenger. Sells SalesVelocity.ai as a **multi-tenant SaaS subscription**. Uses its own Golden Master separate from Jasper. Setup: `scripts/setup-sales-agent-golden-master.js`. Routes: `/api/chat/public`, `/api/chat/facebook`. |
| Growth Strategist | Chief Growth Officer | `src/lib/agents/growth-strategist/specialist.ts` | FUNCTIONAL | Cross-domain business intelligence agent. Aggregates data from all analytics sources (revenue, SEO, social, email, pipeline). Produces strategic directives for domain managers. Briefings accessible through Jasper. Data aggregator: `src/lib/agents/growth-strategist/data-aggregator.ts`. |
| Voice Agent Handler | Voice AI Agent | `src/lib/voice/voice-agent-handler.ts` | FUNCTIONAL | Hybrid AI/human voice agent with two modes: **Prospector** (lead qualification) and **Closer** (deal closing with warm transfer). API routes: `src/app/api/voice/ai-agent/` |
| Autonomous Posting Agent | Social Media Automation | `src/lib/social/autonomous-posting-agent.ts` | FUNCTIONAL | Manages autonomous content posting across LinkedIn and Twitter/X with scheduling, queueing, and analytics tracking. |
| Chat Session Service | Agent Infrastructure | `src/lib/agent/chat-session-service.ts` | FUNCTIONAL | Manages real-time AI chat sessions and agent instance lifecycle. `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) handles ephemeral agent instances spawned from Golden Masters. Supports `agentType` parameter for Golden Master selection. |

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
│   └── memory-vault.ts  # Cross-agent memory
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
src/lib/orchestrator/jasper-tools.ts          # Jasper internal AI assistant tools
src/lib/agents/sales-chat/specialist.ts       # AI Chat Sales Agent (customer-facing)
src/lib/agents/growth-strategist/specialist.ts # Growth Strategist (Chief Growth Officer)
src/lib/agents/growth-strategist/data-aggregator.ts # Cross-domain data aggregation
src/lib/voice/voice-agent-handler.ts          # Voice AI Agent (Prospector/Closer)
src/lib/social/autonomous-posting-agent.ts    # Autonomous Social Posting
src/lib/agent/chat-session-service.ts         # Chat Session Service
src/lib/agent/instance-manager.ts             # Agent Instance Manager
src/app/api/chat/facebook/route.ts            # Facebook Messenger webhook
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

### Navigation Section Visibility (9 Sections — 4-Role RBAC)

**9 Consolidated Sections** in `AdminSidebar.tsx` (permission-gated per role via `filterNavigationByRole()`):

| Section | owner | admin | manager | member | Key Permission |
|---------|-------|-------|---------|--------|----------------|
| 1. Home | YES | YES | YES | YES | - |
| 2. CRM | YES | YES | YES | YES* | canViewLeads, canViewDeals |
| 3. Outreach | YES | YES | YES | - | canManageLeads, canManageEmailCampaigns |
| 4. Content | YES | YES | YES | - | canManageSocialMedia |
| 5. AI Workforce | YES | YES | YES | - | canDeployAIAgents, canTrainAIAgents |
| 6. Commerce | YES | YES | YES | YES* | canProcessOrders |
| 7. Website | YES | YES | YES | - | canManageWebsite |
| 8. Analytics | YES | YES | YES | YES* | canViewReports |
| 9. System | YES | - | - | - | owner-only |

**Footer items** (Settings, Academy) visible to all roles. Settings hub page internally gates Compliance & Admin items to owner/admin via `canManageOrganization`.

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

### Client-Side Auth Pattern (`useAuthFetch` hook)

**File:** `src/hooks/useAuthFetch.ts`

All client-side API calls MUST use `authFetch()` instead of bare `fetch()`. The hook automatically attaches the Firebase Bearer token via the `useUnifiedAuth` hook's `getIdToken()`.

```typescript
const authFetch = useAuthFetch();
const res = await authFetch('/api/some-endpoint');
```

**Coverage (as of Session 33):** All 65 dashboard pages and components use `authFetch`. The intentionally unauthenticated client calls are `PublicLayout.tsx → /api/chat/public` (public chatbot widget, now powered by AI Chat Sales Agent Golden Master) and `/api/chat/facebook` (Facebook Messenger webhook).

### Security Strengths

| Strength | Implementation | Files |
|----------|----------------|-------|
| Single-Tenant Security | All requests operate under DEFAULT_ORG_ID | `claims-validator.ts`, `api-auth.ts` |
| 4-Role RBAC | owner/admin/manager/member with differentiated permission matrices | `unified-rbac.ts` |
| Token Verification | Firebase Admin SDK validates ID tokens server-side | `api-auth.ts` |
| Layout-Level Auth | Admin routes protected at layout level before render | `admin/layout.tsx` |
| Permission Matrix | Comprehensive 47-permission definitions per role | `unified-rbac.ts` |
| Client-Side Auth | All dashboard fetch calls use `useAuthFetch` with Bearer tokens | `useAuthFetch.ts`, 65 consumer files |

### Security Concerns

**Resolved Issues (9 total):** All CRITICAL security findings have been resolved — 82 unprotected API routes hardened (Session 4), OAuth CSRF + encryption fixed (Session 9), rate limiting + CAPTCHA enforced (Session 9), CAN-SPAM unsubscribe route created (Session 9), 53 bare fetch calls migrated to `authFetch` (Session 33), system status auth handshake fixed (Jan 29). See git history for details.

**Remaining Open Issues:** None — all previously identified security issues are resolved (webhook fail-closed, workflow timeouts, strict claim validation). See git history for details.

### API Route Protection Summary

**Audit Date:** March 5, 2026
**Total Routes:** 343

| Protection Type | Count | Details |
|----------------|-------|---------|
| Auth-protected (any method) | ~335 | `requireAuth`, `requireRole`, `verifyAdminRequest`, manual `verifyIdToken` |
| Intentionally public | ~8 | Public contact/forms, health check, booking, public chat, email tracking pixels |
| Webhook endpoints | varies | Signature-verified (Stripe, SendGrid, Gmail, SMS) — not token-based |

**Auth systems in use:**
- `requireAuth` from `@/lib/auth/api-auth` — primary dashboard auth (verifies Firebase token, returns `{ user }` or 401)
- `requireRole` from `@/lib/auth/api-auth` — role-gated access (extends requireAuth with role check)
- `verifyAdminRequest` from `@/lib/api/admin-auth` — admin routes (token + admin role verification)
- `requireUserRole` from `@/lib/auth/server-auth` — server-side role enforcement
- Manual `getAuth(adminApp).verifyIdToken(token)` — used in workflows and lead-scoring routes

**Utility:** `scripts/find-unprotected.ps1` — PowerShell script to scan for routes missing auth patterns

**Utility:** `scripts/nuke-demo-data.ts` — Cleanup script that wipes ALL demo/seed data from Firestore. Covers 60+ collections across Parts 1-4 plus top-level `users`. Three-layer identification: `demo-` ID prefix, `isDemo: true` flag, `(Demo)` in names. Run with `--execute` to delete (dry-run by default).

#### Demo Data Seed Scripts (4 parts, ~290 documents total)

All demo data has `isDemo: true`, `demo-` prefixed IDs, and `(Demo)` in display names for clean removal.

| Script | Collections | Docs | Coverage |
|--------|-------------|------|----------|
| `scripts/seed-demo-account.ts` (Part 1) | 8 | ~85 | CRM: contacts, leads, deals, activities, products, email campaigns, nurture sequences, analytics |
| `scripts/seed-demo-account-part2.ts` (Part 2) | 16+ | ~65 | Platform: workflows, forms, pages, blog posts, social posts, orders, team tasks, site config |
| `scripts/seed-demo-account-part3.ts` (Part 3) | 32 | ~103 | Remaining: records, members, companies, schemas, sequences, chat sessions, users, playbooks, 20+ more |
| `scripts/seed-demo-account-part4.ts` (Part 4) | 15+ | ~82 | Growth Command Center, AI Workforce, team coaching, playbooks (correct shape), A/B tests, calls, video pipeline, battlecards |

**Part 4 collections:** `growthCompetitorProfiles`, `growthCompetitorSnapshots`, `growthKeywordRankings`, `growthStrategies`, `growthAiVisibility`, `growthActivityLog`, `teams`, `members` (+5), `conversationAnalyses` (+24), `users` (+5), `playbooks` (3 correct shape), `abTests`, `calls`, `video_pipeline_projects`, `agentRepProfiles`, `agentPerformance`, `specialistImprovementRequests`, `seoResearch` (+2 battlecards), `teamTasks` (+8)

**Pre-launch cleanup:** Run `npx tsx scripts/nuke-demo-data.ts --execute` to remove all demo data across all 4 parts.

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
| `/sites/*` | Not required | Middleware rewrite |
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

### API Routes (359 Total — Updated March 15, 2026)

| Category | Count | Path Pattern | Status |
|----------|-------|--------------|--------|
| Admin | 21 | `/api/admin/*` | Mostly functional |
| Analytics | 8 | `/api/analytics/*` | Functional |
| Agent | 4 | `/api/agent/*` | Partial |
| Battlecard | 4 | `/api/battlecard/*` | Functional |
| Billing | 3 | `/api/billing/*` | Functional |
| Campaigns | 4 | `/api/campaigns/*` | Functional (NEW March 15 — Campaign Orchestration Pipeline) |
| Coaching | 2 | `/api/coaching/*` | Functional |
| CRM | 9 | `/api/crm/*` | Functional |
| Cron | 4 | `/api/cron/*` | Functional (+3 Growth crons March 2) |
| Growth | 11 | `/api/growth/*` | Functional (NEW March 2) |
| Discovery | 1 | `/api/discovery/*` | Functional |
| E-commerce | 5 | `/api/ecommerce/*` | Functional (orders path fixed Feb 12) |
| Email | 4 | `/api/email-writer/*`, `/api/email/*` | Functional |
| Health | 2 | `/api/health/*` | Functional |
| Integrations | 18 | `/api/integrations/*` | Functional |
| Lead Scoring | 3 | `/api/lead-scoring/*` | Functional |
| Leads | 3 | `/api/leads/*` (icp, discovery, feedback) | Functional |
| Lead Research | 6 | `/api/leads/research/*` (chat, url-sources, schedule, schedule/run, export, root) | Functional (NEW March 5) |
| Learning | 2 | `/api/learning/*` | Partial |
| Meetings | 1 | `/api/meetings/*` | Functional |
| Onboarding | 3 | `/api/onboarding/*` | Functional (data prefill, status checklist) |
| Orchestrator | 7 | `/api/orchestrator/*` | Functional (Sprint 18: +missions, +missions/[missionId]; Sprint 23: +stream, +cancel) |
| Outbound | 3 | `/api/outbound/*` | Functional |
| Performance | 1 | `/api/performance/*` | Functional |
| Playbook | 1 | `/api/playbook/*` | Functional |
| Proposals | 1 | `/api/proposals/*` | Functional |
| Recovery | 1 | `/api/recovery/*` | Functional |
| Reports | 1 | `/api/reports/*` | Partial |
| Risk | 1 | `/api/risk/*` | Functional |
| Schemas | 6 | `/api/schema*/*` | Functional |
| SEO | 4 | `/api/seo/*` | Functional (domain-analysis, strategy, research GET/POST) |
| Settings | 1 | `/api/settings/webhooks` | Functional (NEW Feb 12) |
| Social | 15 | `/api/social/*` | Functional (EXPANDED Feb 13 — added agent-status, activity, OAuth auth/callback, accounts verify) |
| Team | 1 | `/api/team/tasks/[taskId]` | Functional (NEW Feb 12) |
| Other | ~120 | Various | Mixed |

### Key API Endpoints

#### Orchestrator (Jasper AI)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/orchestrator/chat` | POST | Jasper conversation (now includes `missionId` in response metadata for delegation tracking) | FUNCTIONAL |
| `/api/orchestrator/missions` | POST/GET | Create mission + list missions (paginated, status filter) | FUNCTIONAL (Sprint 18) |
| `/api/orchestrator/missions/[missionId]` | GET | Get single mission for polling | FUNCTIONAL (Sprint 18) |
| `/api/orchestrator/missions/[missionId]/stream` | GET | SSE real-time mission streaming (Firestore onSnapshot) | FUNCTIONAL (Sprint 23) |
| `/api/orchestrator/missions/[missionId]/cancel` | POST | Cancel an active mission (sets FAILED + 'Cancelled by user') | FUNCTIONAL (Sprint 23) |
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

#### Entity & Feature Configuration (NEW Feb 28)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/entity-config` | GET/PUT | CRM entity toggle config (auth required, Zod validated) | FUNCTIONAL |
| `/api/features` | GET/PUT | Feature module toggles | FUNCTIONAL |
| `/api/features/business-profile` | GET/PUT | Business profile for onboarding | FUNCTIONAL |

#### Voice & AI

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/voice/*` | Various | Voice agent operations (Twilio/Telnyx) | FUNCTIONAL |
| `/api/agent/config` | GET/PUT | Agent configuration | FUNCTIONAL |
| `/api/agent/knowledge/upload` | POST | Knowledge base upload | FUNCTIONAL |

#### Video & Voice Lab (25+ routes) — Hedra-Only, Phases 1-3 COMPLETE

**Current Status: FUNCTIONAL** — Hedra sole engine. Character Studio, AI Video Director, brand preference memory, Standalone Video Editor, and Media Library all operational.

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/video/avatar-profiles` | GET/POST | Character profile CRUD (lists user + stock Hedra profiles) | FUNCTIONAL |
| `/api/video/avatar-profiles/[profileId]` | GET/PATCH/DELETE | Single profile ops | FUNCTIONAL |
| `/api/video/avatar-profiles/sync-hedra` | POST | Import Hedra characters (auto-synced on picker mount) | FUNCTIONAL |
| `/api/video/avatar-profiles/hedra-characters` | GET | Browse Hedra character library | FUNCTIONAL |
| `/api/video/voices` | GET | List ElevenLabs voices | FUNCTIONAL |
| `/api/video/voice-clone` | POST | Clone voice via ElevenLabs | FUNCTIONAL |
| `/api/video/voice-preview` | POST | Preview TTS audio | FUNCTIONAL |
| `/api/video/defaults` | GET/PUT | Default avatar/voice settings | FUNCTIONAL |
| `/api/video/generate-scenes` | POST | Generate video scenes (Hedra-only, dual TTS paths) | FUNCTIONAL |
| `/api/video/regenerate-scene` | POST | Regenerate a single failed/rejected scene | FUNCTIONAL |
| `/api/video/poll-scenes` | POST | Poll generation status | FUNCTIONAL |
| `/api/video/decompose` | POST | Decompose script to scenes | FUNCTIONAL |
| `/api/video/assemble` | POST | FFmpeg clip assembly with xfade transitions | FUNCTIONAL |
| `/api/video/brand-preferences` | GET/POST | Brand preference memory (approved/rejected prompts, style corrections) | FUNCTIONAL |
| `/api/video/tts-audio` | POST | Synthesize TTS audio (ElevenLabs/UnrealSpeech) | FUNCTIONAL |
| `/api/video/grade-scene` | POST | Auto-grade a completed scene (download → ffmpeg audio → Deepgram transcription → LCS diff) | FUNCTIONAL |
| `/api/video/scene-review` | POST | Submit human review (1-5 stars + feedback) → Training Center pipeline | FUNCTIONAL |
| `/api/video/project/*` | Various | Video project CRUD (save, list, get) | FUNCTIONAL |

#### Media Library (NEW March 10)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/media` | GET | List/search media assets with type and category filters (videos, images, audio with subcategories) | FUNCTIONAL |
| `/api/media` | POST | Upload and register a new media asset | FUNCTIONAL |
| `/api/media/[mediaId]` | GET | Retrieve a single media item by ID | FUNCTIONAL |
| `/api/media/[mediaId]` | DELETE | Delete a media item and its associated storage object | FUNCTIONAL |

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
| `/api/social/oauth/auth/[provider]` | GET | Initiate OAuth flow (Twitter PKCE, LinkedIn OAuth 2.0) | FUNCTIONAL (NEW Session 6) |
| `/api/social/oauth/callback/[provider]` | GET | OAuth callback handler with token exchange + encryption | FUNCTIONAL (NEW Session 6) |
| `/api/social/accounts/verify` | POST | Verify social account connection status | FUNCTIONAL (NEW Session 6) |

#### Growth Command Center (NEW March 2)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/growth/competitors` | GET/POST | List/add competitors | FUNCTIONAL |
| `/api/growth/competitors/discover` | POST | Discover competitors by niche via CompetitorResearcher | FUNCTIONAL |
| `/api/growth/competitors/[competitorId]` | GET/DELETE/POST | Get/remove/re-analyze competitor | FUNCTIONAL |
| `/api/growth/keywords` | GET/POST | List/add keywords for SERP tracking | FUNCTIONAL |
| `/api/growth/keywords/bulk` | POST | Bulk add keywords | FUNCTIONAL |
| `/api/growth/keywords/[keywordId]` | GET/DELETE/POST | Get/remove/check keyword ranking | FUNCTIONAL |
| `/api/growth/strategy` | GET/POST | Get latest / generate 3-tier growth strategy | FUNCTIONAL |
| `/api/growth/strategy/approve` | POST | Approve strategy tier → dispatches to Marketing Manager | FUNCTIONAL |
| `/api/growth/strategy/reject` | POST | Reject strategy with feedback | FUNCTIONAL |
| `/api/growth/ai-visibility` | GET/POST | AI search visibility history / run check | FUNCTIONAL |
| `/api/growth/activity` | GET | Activity feed with type filtering | FUNCTIONAL |
| `/api/cron/growth-keyword-tracker` | GET | Daily keyword ranking check (5AM UTC) | FUNCTIONAL |
| `/api/cron/growth-competitor-monitor` | GET | Weekly competitor scan (Mon 3AM UTC) | FUNCTIONAL |
| `/api/cron/growth-ai-visibility` | GET | Weekly AI visibility sweep (Wed 4AM UTC) | FUNCTIONAL |

#### Lead Research (NEW March 5)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/leads/research/chat` | POST | AI chat with 8-tool lead research subset (Claude 3.5 Sonnet via OpenRouter) | FUNCTIONAL |
| `/api/leads/research/url-sources` | GET/POST/DELETE | CRUD for URL sources to scrape for business intelligence | FUNCTIONAL |
| `/api/leads/research/schedule` | GET/PUT | Research schedule config (frequency, auto-approve threshold) | FUNCTIONAL |
| `/api/leads/research/schedule/run` | POST | Manually trigger discovery batch using active ICP profile | FUNCTIONAL |
| `/api/leads/research/export` | GET | CSV export of batch results with field selection and status filtering | FUNCTIONAL |

**Lead Research Tools (8-tool subset):** `scan_leads` (Apollo free-tier org search), `enrich_lead`, `score_leads`, `scrape_website`, `research_competitors`, `scan_tech_stack` (from Jasper) + `update_icp_profile`, `add_url_source` (new). Defined in `src/lib/orchestrator/lead-research-tools.ts`. AI chat uses Claude 3.5 Sonnet via OpenRouter with 5 tool-calling rounds.

**Components (13):** `LeadResearchPage`, `ResearchChatPanel`, `ChatMessageList`, `ChatMessage`, `ChatInput`, `IcpSummaryBadge`, `ResearchControls`, `ResultsPanel`, `ResultCard`, `ResultsBulkActionBar`, `UrlSourcesPanel`, `UrlSourceItem`, `IcpSettingsDrawer` — all in `src/components/lead-research/`.

**Hook:** `src/hooks/useLeadResearch.ts` — centralized state for chat, ICP profiles, batches, results, URL sources, schedule, field selections, CSV export.

#### Website Migration Pipeline (NEW Sprint 21)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/website/migrate` | POST | Website migration pipeline — clone external site via deep scrape, blueprint extraction, and AI page assembly | FUNCTIONAL (Sprint 21) |

#### SEO Research Persistence (NEW February 26, 2026)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/seo/research` | GET | List saved SEO research (filter by type/domain, paginated) | FUNCTIONAL |
| `/api/seo/research` | POST | Save new research document (Zod validated) | FUNCTIONAL |
| `/api/seo/domain-analysis` | POST | Domain analysis + fire-and-forget persist to Firestore | FUNCTIONAL (updated) |
| `/api/seo/strategy` | POST | 30-day strategy + fire-and-forget persist to Firestore | FUNCTIONAL (updated) |
| `/api/battlecard/competitor/discover` | POST | Competitor discovery + fire-and-forget persist | FUNCTIONAL (updated) |
| `/api/battlecard/generate` | POST | Battlecard generation + fire-and-forget persist | FUNCTIONAL (updated) |

**Pattern:** All SEO/competitor API routes now fire-and-forget persist results to the `seoResearch` Firestore collection after returning the response. Client pages load saved research on mount so data survives page refreshes.

### API Implementation Notes

The following endpoints have working infrastructure (rate limiting, caching, auth) but use **mock data** for core business logic:

| Endpoint | Issue | Priority |
|----------|-------|----------|
| `/api/coaching/team` | Team member query returns hardcoded IDs | **FALSE POSITIVE** — Queries Firestore teams collection with sales_rep fallback |
| ~~`/api/crm/deals/[dealId]/recommendations`~~ | **RESOLVED** — Auth user extraction + workspaceId from query param | ~~MEDIUM~~ |
| `/api/crm/deals/monitor/start` | Monitor lifecycle not fully implemented | LOW |
| `/api/webhooks/gmail` | Auto-meeting booking has TODO | LOW |
| `/api/voice/twiml` | Audio fallback uses placeholder URL | LOW |

**Resolved API Issues:** All previous gaps resolved across Sessions 7-37. See git history for details.

**Onboarding Pipeline (February 27, 2026):**

The onboarding flow now calls `POST /api/agent/process-onboarding` on Step 4 (API key setup) with enriched data:
- `industryCategory`, `industryCategoryName` — from 15-category selection
- `industryTemplateId`, `industryTemplateName` — from 50 niche template drill-down
- `injectionAnswer`, `injectionVariable` — from industry-specific injection question
- `customNiche` — freeform text for categories with no templates (e.g., Automotive)
- The route forwards these to `processOnboarding()` → `buildBaseModel()` → system prompt generation
- Injection answers are interpolated into the system prompt under "Industry-Specific Context"
- New mapping file: `src/lib/persona/category-template-map.ts` (15 categories, 50 template IDs)
- `OnboardingCategory` interface now includes `defaultEntities?: string[]` for entity config during onboarding

**Industry-Driven Configuration (March 10, 2026):**

Industry selection now drives 5 system layers automatically:
1. **Feature Modules** — `getIndustryFeatureConfig(categoryId)` enables industry-relevant modules (e.g., video for real estate, e-commerce for retail). All modules default ON; 3 always-on (CRM, conversations, workflows).
2. **Entity Config** — `buildEntityConfigForCategory(categoryId)` enables industry-specific CRM entities (e.g., `properties`/`showings` for real estate, `cases`/`billing_entries` for legal).
3. **Persona Blueprints** — `CATEGORY_TO_BLUEPRINT` mapping (15 categories → 12 blueprint IDs) enriches agent personality with industry tone, greeting variants, specialist triggers, and communication style.
4. **Industry Templates** — Auto-resolved from category when not explicitly set. 50 templates across 7 files with cognitiveLogic, tacticalExecution, knowledgeRAG, and research intelligence. MutationEngine applies conditional transformations based on onboarding answers.
5. **Dashboard Wizard** — Now uses `ONBOARDING_CATEGORIES` (15 categories) instead of 13 hardcoded options with mismatched IDs.

Key files:
- `src/lib/constants/feature-modules.ts` — `INDUSTRY_FEATURE_DEFAULTS`, `getIndustryFeatureConfig()`
- `src/lib/constants/entity-config.ts` — `CATEGORY_ENTITY_DEFAULTS`, `buildEntityConfigForCategory()`
- `src/lib/agent/onboarding-processor.ts` — `CATEGORY_TO_BLUEPRINT`, auto-resolve templateId, blueprint enrichment
- `src/lib/db/provisioner/blueprints/industry-personas.ts` — 12 persona blueprints
- `src/lib/persona/category-template-map.ts` — 15 categories, 50 template ID mappings

**Entity Configuration System (February 28, 2026):**

CRM entity visibility is now configurable per-industry. The system mirrors the feature module pattern (6 layers):
- **Types:** `src/types/entity-config.ts` — `EntityTier`, `EntityMetadata`, `EntityConfig`
- **Constants:** `src/lib/constants/entity-config.ts` — `ALWAYS_ON_ENTITIES`, `ENTITY_METADATA` (18 entries), `CATEGORY_ENTITY_DEFAULTS` (15 categories)
- **Validation:** `src/lib/validation/entity-config-schemas.ts` — `entityConfigSchema`, `updateEntityConfigSchema`
- **Service:** `src/lib/services/entity-config-service.ts` — Firestore CRUD at `settings/entity_config`
- **Store:** `src/lib/stores/entity-config-store.ts` — Zustand with `isEntityEnabled()`, backward compat (no config = all enabled)
- **Hook:** `src/hooks/useEntityConfig.ts` — auto-load on first mount
- **API:** `src/app/api/entity-config/route.ts` — GET/PUT with auth + Zod
- **UI gating:** Entity page shows "not enabled" banner; Schema Editor dims disabled entities; Settings > Features has new "CRM Entities" tab

**Admin SDK Migration (February 25, 2026):**

All 64 API routes that were using the client-side `FirestoreService` have been migrated to `AdminFirestoreService` (Firebase Admin SDK). This resolves PERMISSION_DENIED errors in production where server-side routes were incorrectly using the client SDK which is subject to Firestore security rules.

**Affected areas:** admin, analytics, agent, chat, checkout, contacts, coupons, custom-tools, ecommerce, email tracking, integrations, leads, learning, notifications, orchestrator, outbound, public, reports, settings, setup, social, subscriptions, team, training, webhooks, voice fallback.

**Smoke test:** 48/48 passing (100%) after migration.

**API Keys to Firestore:** All service API keys (OpenRouter, SendGrid, Stripe, Twilio, ElevenLabs, HeyGen, Serper, DataForSEO, Twitter/X, Slack, PageSpeed) are now stored in Firestore via `apiKeyService` rather than `.env` files. `process.env` remains as fallback for development and for system secrets (webhook verification keys, Firebase admin credentials, encryption keys).

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
| `*.spec.ts` | Playwright | `tests/e2e/` | 18 |
| `*.e2e.test.ts` | Jest | `tests/e2e/` | 3 |
| `*.test.ts` | Jest | `tests/lib/` | 3+ |

**Playwright E2E Tests (18 specs, ~165 tests):**
- `website-builder.spec.ts` (16 tests)
- `voice-engine.spec.ts` (22 tests)
- `admin-gateway.spec.ts` (Admin login/theme audit)
- `admin-content-factory.spec.ts` (Content & AI management audit)
- `admin-routes-audit.spec.ts` (46-route visual audit with trace)
- `auth-login.spec.ts` (Auth flow tests)
- `website-pages-list.spec.ts` (Website pages tests)
- `website-editor-visual.spec.ts` (Editor visual tests)
- `website-blog-system.spec.ts` (Blog system tests)
- `website-domain-seo.spec.ts` (Domain & SEO tests)
- `website-navigation-settings.spec.ts` (Nav settings tests)
- `website-templates-audit-log.spec.ts` (Templates & audit tests)
- `crm-dashboard.spec.ts` ✅ **Session 28** (24 tests: dashboard, CRM entities, navigation, empty state)
- `ecommerce-store.spec.ts` ✅ **Session 28** (29 tests: catalog, cart, checkout, success/cancel flows)
- `settings-pages.spec.ts` ✅ **Session 28** (7 suites: subscription, billing, integrations, storefront, workflows, AI agents)
- `social-analytics.spec.ts` ✅ **Session 28** (5 suites: command center, calendar, analytics, pipeline, outbound)

**Jest Unit Tests:**
- `tests/lib/pricing/subscription-tiers.test.ts` ✅ **Session 28** (24 tests)
- `tests/lib/workflow/workflow-actions.test.ts` ✅ **Session 28** (21 tests)
- `tests/lib/schema/formula-sanitization.test.ts` ✅ **Session 28** (20 tests)

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
| Test discovery | ✅ PASS (~165 Playwright tests + 65 Jest unit tests across 5 browser projects) |
| Autonomous testing | ✅ OPERATIONAL |

**Full Audit Report:** `docs/playwright-audit-2026-01-30.md`

### E2E Test Infrastructure (Supplementary)

**Playwright Activation:** ✅ OPERATIONAL (January 30, 2026). Config: `testMatch: '**/*.spec.ts'` isolates Playwright from Jest. 5 browser projects.

**E2E Cleanup Protocol:** ✅ ACTIVE. Location: `tests/helpers/e2e-cleanup-utility.ts`. All test data uses `E2E_TEMP_` prefix. `E2ECleanupTracker` handles recursive Firestore cleanup with `listCollections()` discovery. 7 protected org IDs hardcoded. Batch size: 400 ops.

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
3. Fetch lead from Firestore (`organizations/rapid-compliance-root/leads/{leadId}`) via flat collection helper
4. Evaluate routing rules by priority (`organizations/{PLATFORM_ID}/leadRoutingRules`)
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
  platformId: string;        // Always PLATFORM_ID
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

### Integration Audit (Verified February 27, 2026)

| Integration | Status | Details |
|-------------|--------|---------|
| **Twitter/X** | **REAL** | Direct API v2, OAuth2 PKCE, posting, media upload, timeline, search, mentions. Rate limit tracking with exponential backoff. |
| **LinkedIn** | **PARTIAL** | Unofficial RapidAPI wrapper (ToS risk) + manual task fallback. Needs official Marketing Developer Platform API. |
| **Facebook** | **NOT BUILT** | No code exists. Requires Meta Developer sandbox + app review. |
| **Instagram** | **NOT BUILT** | No code exists. Requires Meta Developer sandbox + app review. |
| **Stripe** | **REAL** | Full API — `checkout.sessions.create()`, `products.create()`, `prices.create()`, `paymentLinks.create()`, PaymentElement checkout (3DS), payment intents, webhook `payment_intent.succeeded`. Production-ready. |
| **Email (SendGrid)** | **REAL** | Primary provider. `@sendgrid/mail` SDK, tracking pixels, click tracking. |
| **Email (Resend)** | **STUB** | Type definitions exist but no implementation file |
| **Email (SMTP)** | **REAL** | Nodemailer — real SMTP transport (fixed Mar 10) |
| **Voice (Twilio)** | **REAL** | Twilio SDK — call initiation, control, conferencing. |
| **Voice (Telnyx)** | **REAL** | Direct API — 60-70% cheaper than Twilio. |
| **TTS (ElevenLabs)** | **REAL** | `api.elevenlabs.io/v1`, 20+ premium voices. |
| **TTS (Unreal Speech)** | **REAL** | Alternative cost-effective TTS. |
| **Video (Hedra)** | **REAL** | Hedra Character-3 API — sole video engine. Character Studio (custom + stock), dual TTS (Hedra native + ElevenLabs), AI Video Director (produce/assemble), per-scene characters, brand preference memory, scene review workflow. Phases 1-3 complete. |
| **Firebase** | **REAL** | Auth + Firestore, single-tenant `rapid-compliance-65f87`. |
| **OpenRouter** | **REAL** | AI gateway, 100+ models. |
| **Google OAuth** | **REAL** | Calendar, Gmail integration. |
| **Microsoft OAuth** | **REAL** | Outlook, Teams integration. |
| **Slack OAuth** | **REAL** | Channel notifications. |
| **Social Engagement (POST)** | **REAL** | Twitter works, LinkedIn partial. |
| **Social Engagement (REPLY/LIKE/FOLLOW/REPOST)** | **REAL (Twitter)** | Wired to Twitter API v2: likeTweet, retweet, followUser, postTweet w/ replyToTweetId. Non-Twitter platforms pending. |
| **Social OAuth (Twitter)** | **REAL** | PKCE flow with code challenge, auth URL generation, code exchange, profile fetch. AES-256-GCM token encryption. |
| **Social OAuth (LinkedIn)** | **REAL** | OAuth 2.0 authorization code flow, token exchange, profile fetch. AES-256-GCM token encryption. |
| **Email (Gmail)** | **REAL** | Google APIs OAuth2 — list, send, watch, history sync to CRM |
| **Email (Outlook)** | **REAL** | Microsoft Graph — list, send, calendar events, free/busy |
| **Slack** | **REAL** | `@slack/web-api` — channels, messages, files, users |
| **Microsoft Teams** | **REAL** | Microsoft Graph — teams, channels, messages, meetings |
| **PayPal** | **REAL** | Orders API v2, payouts API v1, OAuth token exchange |
| **Shopify** | **REAL** | Admin API 2024-01 — inventory, cart, products |
| **HubSpot** | **REAL** | CRM v3 API — contact sync |
| **Salesforce** | **REAL** | REST API v58.0 — lead creation |
| **Xero** | **REAL** | OAuth2, invoices, contacts, payments |
| **QuickBooks** | **REAL** | OAuth2, invoices, customers, company info |
| **Zoom** | **REAL** | Meetings API — create, cancel, recording, waiting room |
| **Twilio Verify** | **REAL** | OTP/2FA verification |
| **Apollo.io** | **REAL** | Free-tier org search (`/api/v1/organizations/search`), company enrichment. Person enrichment requires paid plan. |
| **Clay.com** | **KEY STORED** | API key configured. REST API deprecated by Clay — webhook-based integration only. |
| **Fal.ai** | **PLANNED** | AI Creative Studio — Flux, SDXL, Stable Diffusion image generation. BYOK. |
| **Google AI Studio** | **PLANNED** | AI Creative Studio — Gemini image models. BYOK. |
| **Kling 3.0 (Direct)** | **PLANNED** | AI Creative Studio — Direct video generation API (separate from Hedra's Kling O3 access). BYOK. |

### SEO Data Integrations (NEW: February 23, 2026)

| Service | Status | API Endpoints Used | Capabilities |
|---------|--------|--------------------|--------------|
| **DataForSEO** | **REAL** | `domain_rank/live`, `ranked_keywords/live`, `backlinks/summary/live`, `backlinks/referring_domains/live`, `competitors_domain/live`, `search_volume/live`, `serp/organic/live`, `on_page/instant_pages` | Domain traffic estimation, ranked keyword lists, backlink profiles, referring domain identification, organic competitor discovery, keyword volume/CPC, SERP analysis, on-page audit |
| **Serper** | **REAL** | `search` (Google SERP), keyword position checking | SERP results, position tracking for specific domain+keyword pairs |
| **Google PageSpeed** | **REAL** | PageSpeed Insights API v5 (mobile + desktop) | Core Web Vitals (LCP, FID, CLS, FCP, TTFB, TBT), performance/accessibility/SEO scores |
| **Google Search Console** | **REAL** | Search Analytics API, URL Inspection | Top keywords by clicks/impressions, top pages, indexing status (requires OAuth connection) |

**Routing:** Jasper detects domain analysis requests via traffic/visitor/backlink keywords + domain extraction regex → Marketing Manager → SEO Expert `domain_analysis` action → 5 concurrent DataForSEO calls.

### Jasper Mission Control (LIVE — Sprint 18 + Campaign Review)

**Routes:** `/mission-control` (live view), `/mission-control?campaign={id}` (Campaign Review), `/mission-control/history` (completed missions)

Live "Air Traffic Control" for Jasper's multi-step delegations. SSE streaming via Firestore `onSnapshot()`, cancel capability, 3-panel layout (sidebar, timeline, step detail). 13 delegation tools instrumented with `toolArgs`/`toolResult` tracking. Fire-and-forget instrumentation never breaks chat response.

**Campaign Review (NEW):** When `?campaign=` URL param is present, renders CampaignReview component showing all deliverables as cards with inline preview, approve/reject/feedback buttons, "Approve All", and progress bar. Polls for real-time updates.

**Key files:** `src/lib/orchestrator/mission-persistence.ts` (types + CRUD), `src/lib/campaign/campaign-service.ts` (campaign + deliverable CRUD), `src/hooks/useMissionStream.ts` (SSE client), `src/app/(dashboard)/mission-control/` (UI + CampaignReview).
**Firestore:** `organizations/{PLATFORM_ID}/missions/{missionId}`, `organizations/{PLATFORM_ID}/campaigns/{campaignId}` + `.../deliverables/{deliverableId}`
**Statuses:** Mission: PENDING → IN_PROGRESS → COMPLETED/FAILED. Steps: PENDING → RUNNING → COMPLETED/FAILED/AWAITING_APPROVAL. Deliverables: drafting → pending_review → approved/rejected/revision_requested → published.

### Previously Planned Integrations (NOW LIVE)

All previously planned integrations are now implemented:
- **Salesforce CRM** — REAL (lead sync via `sobjects/Lead` API)
- **HubSpot** — REAL (contact sync via CRM v3 API)
- **Xero Accounting** — REAL (OAuth, invoices, contacts)
- **PayPal Payments** — REAL (orders, capture, payouts)

### Dashboard-Swarm Connectivity

- `GET /api/system/status` exposes `SwarmStatus` with `ManagerBrief[]` from `getSwarmStatus()`
- `useSystemStatus` hook polls every 30s, consumed by `SwarmMonitorWidget`
- All agent IDs aligned between backend registry and frontend

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

### Organization Sub-Collections (37)

```
organizations/{PLATFORM_ID}/
├── records/                  # CRM records (flat, workspace nesting removed Feb 27)
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
├── settings/                 # Org settings (feature_config, business_profile, entity_config)
├── agentConfig/              # Agent configurations
├── goldenMasters/            # Golden master agents
├── signals/                  # Agent signals
├── socialAccounts/           # Social media accounts (NEW Feb 12)
├── socialMedia/              # Social media uploads (NEW Feb 12)
├── socialApprovals/          # Social approval workflow (NEW Feb 12)
├── socialListening/          # Social listening mentions (NEW Feb 12)
├── socialSettings/           # Social agent config (NEW Feb 12)
├── seoResearch/              # SEO & competitor research persistence (NEW Feb 26 — domain_analysis, strategy, competitor_discovery, battlecard)
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
├── missions/                 # Mission Control tracking (NEW Sprint 18 — user-facing delegation state)
├── growthCompetitors/        # Growth Command Center — competitor profiles (NEW March 2)
├── growthCompetitorSnapshots/ # Competitor snapshots over time (NEW March 2)
├── growthKeywords/           # Keyword tracking entries with ranking history (NEW March 2)
├── growthStrategies/         # 3-tier growth strategies (Aggressive/Competitive/Scrappy) (NEW March 2)
├── growthAiVisibility/       # AI search visibility check results (NEW March 2)
├── growthActivityLog/        # Activity feed events for Growth Command Center (NEW March 2)
├── lead-research-url-sources/ # URL sources for Lead Research page (NEW March 5)
├── lead-research-config/     # Lead Research schedule config (NEW March 5)
├── avatar_profiles/          # Character profiles — reference images, green screen clips, voice assignment (REWORKING → Character Studio)
├── custom_avatars/           # Legacy custom avatars (DEPRECATED — migrating to avatar_profiles)
├── tts_audio/                # Synthesized TTS audio clips served via /api/video/tts-audio (24hr expiry)
├── icp-profiles/             # Ideal Customer Profile definitions for lead research (NEW March 5)
└── provisionerLogs/          # Provisioning logs
```

### Total: 80+ Collections

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
- Feature visibility configurable at the platform level
- All 52 AI agents operate under the single org identity (Rule 2)
- `DEFAULT_ORG_ID` constant used by all service classes — no dynamic org resolution
- All service classes use `PLATFORM_ID` constant directly — no dynamic org parameters

### Middleware Routing Strategy

The middleware (`src/middleware.ts`) uses **Role-Based Segment Routing**:

1. All `/admin/*` paths allowed through middleware
2. Authentication & authorization handled by `/admin/layout.tsx`
3. Non-admin users redirected to workspace by layout, not middleware
4. Prevents 404s from middleware redirecting to non-existent paths

### Sidebar Architecture

> See [Rule 4: Navigation Hierarchy](#rule-4-navigation-hierarchy--consolidated-sidebar) for the authoritative 9-section navigation structure with all sidebar items and SubpageNav tab definitions.

#### Key Components

| Component | Location | Status |
|-----------|----------|--------|
| **AdminSidebar** | `src/components/admin/AdminSidebar.tsx` | 9 sections + footer |
| **SubpageNav** | `src/components/ui/SubpageNav.tsx` | 11 layouts, 21 tab arrays |
| **UnifiedSidebar** | `src/components/dashboard/UnifiedSidebar.tsx` | Admin routes only |
| **Tab Config** | `src/lib/constants/subpage-nav.ts` | Centralized tab definitions |

**Route groups:** `/(dashboard)/*` (main app), `/admin/*` (platform admin), `/sites/*`, `/store/*` — all use `PLATFORM_ID` internally.

### Theme Architecture

> See **Rule 3** for CSS variable governance. Admin and client themes use independent pipelines:
> - Admin: `useAdminTheme()` → `.admin-theme-scope` → `platform_settings/adminTheme`
> - Client: `useOrgTheme()` → `:root` → `organizations/{PLATFORM_ID}/themes/default`
> - Theme Editor: `/(dashboard)/settings/theme` (client-facing). Admin theme editor not yet built.

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
| `useOnboardingStore` | `src/lib/stores/onboarding-store.ts` | 4-step onboarding flow (industry → niche → account → apikey → complete). Tracks selectedCategory, selectedTemplate, injectionAnswer, customNiche, apiKeyConfigured |
| `useOrchestratorStore` | `src/lib/stores/orchestrator-store.ts` | AI assistant UI state |
| `usePendingMerchantStore` | `src/lib/stores/pending-merchants-store.ts` | Lead capture & abandonment tracking |

#### Sidebar Reactivity Pattern

AdminSidebar and UnifiedSidebar achieve reactivity through:
1. **Role-based filtering:** `filterNavigationByRole()` gates sections and items by role/permission
2. **Path-based active state:** `usePathname()` from Next.js with special hub route matching (Social Hub, Training Hub, Models, Analytics)
3. **CSS variable injection:** Theme changes via `container.style.setProperty()` update instantly
4. **React.memo sub-components:** Prevents unnecessary re-renders
5. **SubpageNav tabs:** `usePathname()` drives active tab state on hub pages

### Agent Communication

Agents communicate via **MemoryVault** (Firestore-backed since Feb 8, 2026):
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

> **Manager orchestration internals** (Intelligence, Marketing, Master Orchestrator pipelines, intents, saga templates, brief structures) are documented in the source code. See `src/lib/agents/*/manager.ts` files for implementation details.

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

### Standard Entity Schemas (35 total)

**Source:** `src/lib/schema/standard-schemas.ts`

The Schema Editor and entity table pages dynamically render from `STANDARD_SCHEMAS`. Each schema defines id, name, icon, and typed fields (text, email, currency, singleSelect, lookup, etc.). Picklist values for all singleSelect fields are in `PICKLIST_VALUES`.

| Category | Schemas | Count |
|----------|---------|-------|
| **CRM Core** | leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks | 10 |
| **Transportation & Compliance** | drivers, vehicles, compliance_documents | 3 |
| **Service Business** | projects, time_entries | 2 |
| **E-Commerce** | customers, inventory | 2 |
| **Real Estate** | properties, showings | 2 |
| **Legal Services** | cases, billing_entries | 2 |
| **Healthcare / Wellness** | patients, appointments | 2 |
| **Platform Core** | activities, campaigns, sequences, workflows, forms, pages, blog_posts, domains, coupons, proposals, subscriptions, email_templates | 12 |

Cross-entity references use `lookup` fields with `config: { linkedSchema: '...' }` (e.g., showings → properties, compliance_documents → drivers/vehicles, billing_entries → cases, subscriptions → contacts).

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
  role: AccountRole;  // 'owner' | 'admin' | 'manager' | 'member'
  platformId: string;       // Always PLATFORM_ID
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

> E2E tests (18 Playwright specs + 3 Jest E2E) cover auth flows, admin gateway, website builder, CRM, e-commerce, social, settings, and voice. Run via `npm run test:playwright`. See `tests/e2e/` for specs.

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
*Last updated: March 16, 2026 — AI Creative Studio planned (RenderZero-caliber cinematic content generation with multi-provider BYOK, 200+ cinematic presets, character system, image→video bridge, cost tracking, manual fallback). Style support: photorealistic, Pixar/3D animation, anime, cinematic film, stylized illustration.*

> Session changelogs, launch gap analysis, and completed roadmap details archived in `docs/archive/`.
