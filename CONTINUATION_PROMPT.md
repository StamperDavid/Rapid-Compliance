# SalesVelocity.ai — Continuation Prompt

**Always** review CLAUDE.md rules before starting a task.

## Context

- **Repository:** https://github.com/StamperDavid/Rapid-Compliance
- **Branch:** dev
- **Last Updated:** March 2, 2026

## Platform State

| Metric | Value |
|--------|-------|
| Physical Routes (page.tsx) | 178 |
| API Endpoints (route.ts) | 329 |
| TypeScript Files | 1,439 |
| AI Agents (FUNCTIONAL) | 54 (46 swarm + 6 standalone + 2 Growth Analyst variants) |
| RBAC | 4-role (`owner`/`admin`/`manager`/`member`) in code; Firestore rules binary (`isAdmin`/`isAuthenticated`) |
| Hosting | Vercel (rapidcompliance.us) — brand is SalesVelocity.ai |

### Build Health

- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero warnings)**
- `npm run build` — **PASSES**
- 16 justified `eslint-disable` comments (ratcheted)

## Recent Work (March 2026)

- **Demo seed Part 4** — Growth, AI Workforce, Team Coaching, Playbooks, A/B Tests, Calls, Video Pipeline, Battlecards (~110 docs across 15+ collections)
- **Nuke script updated** — covers 60+ collections across all 4 seed parts + top-level users
- **Growth Command Center** — 6 pages, 11 API routes, 3 crons, 5 services (fully operational)
- **SEO system seeded** — Brand DNA, Website SEO, SEO Lab Training, llms.txt
- **Golden Masters extended** to swarm specialists with versioned snapshots
- **Coaching unified** into Training Center with 7-tab layout
- **SalesVelocity.ai rebrand** — all Jasper prompts, domain references corrected

## Demo Data

All demo data has `isDemo: true`, `demo-` prefixed IDs, and `(Demo)` in names. Removal command:
```bash
npx tsx scripts/nuke-demo-data.ts           # dry-run (preview)
npx tsx scripts/nuke-demo-data.ts --execute  # delete all demo data
```

---

## Launch Punch List

### Tier 1 — CRITICAL (Code fixes we can do NOW)

These are actively harmful bugs or dead features that would embarrass during a demo.

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| 1 | **Facebook agent returns Math.random() fake metrics** written to MemoryVault as "real data" with 85-95% confidence | `src/lib/agents/marketing/facebook/specialist.ts` (lines 991, 1042, 1161, 1218, 1280) | Jasper quotes fake numbers as facts |
| 2 | **Twitter agent returns hardcoded fake analytics** written to MemoryVault as "real data" | `src/lib/agents/marketing/twitter/specialist.ts` (lines 1031, 1094, 1137, 1181) | Jasper quotes fake numbers as facts |
| 3 | **CRM event triggers completely disabled** — `getApplicableWorkflows()` returns `Promise.resolve([])` | `src/lib/crm/event-triggers.ts` (line 113) | Zero CRM automation works |
| 4 | **Email tracking not recorded** — open/click events log to console only, never saved | `src/lib/email/email-tracking.ts` (lines 219, 229, 248) | Campaign stats always null |
| 5 | **Workflow execution is simulated** — `simulateExecution()` instead of real agent dispatch | `src/lib/agents/builder/workflow/specialist.ts` (line 1157) | Workflows don't actually do anything |
| 6 | **Cross-manager command routing simulated** — returns hardcoded SUCCESS without executing | `src/lib/agents/orchestrator/manager.ts` (lines 1199-1211) | Agent coordination is fake |
| 7 | **Social posting DEV MODE** — Twitter/LinkedIn return mock 200 success without posting | `src/app/api/admin/social/post/route.ts` (lines 130, 281) | Posts appear to succeed but nothing goes out |
| 8 | **Commerce payment creates fake checkout session** — uses `cs_${Date.now()}` instead of Stripe | `src/lib/agents/commerce/payment/specialist.ts` (lines 308-324) | Payment flow is broken |
| 9 | **Voice outreach channel blocked** — returns BLOCKED with "not implemented" | `src/lib/agents/outreach/manager.ts` (lines 936-943) | Any sequence with voice step fails |

### Tier 2 — FUNCTIONAL GAPS (Should fix, lower urgency)

Silent failures — features that return empty/zero instead of real data.

| # | Issue | File(s) |
|---|-------|---------|
| 10 | Lead nurturing enrollment doesn't schedule emails | `src/lib/analytics/lead-nurturing.ts` (line 234) |
| 11 | Lead enrichment always returns empty `{ enrichedData: {} }` | `src/lib/analytics/lead-nurturing.ts` (line 257) |
| 12 | Deal pipeline time series always returns `[]` | `src/lib/analytics/dashboard/analytics-engine.ts` (line 737) |
| 13 | GMB competitor analysis returns hardcoded fake competitor | `src/lib/agents/trust/gmb/specialist.ts` (lines 1349, 1516) |
| 14 | Review trend report always returns all zeros | `src/lib/agents/trust/review-manager/specialist.ts` (line 1230) |
| 15 | Catalog sync returns `syncedCount: 0` | `src/lib/agents/commerce/catalog/specialist.ts` (line 642) |
| 16 | Vertex AI fine-tuning fully simulated (fake job IDs) | `src/lib/ai/fine-tuning/vertex-tuner.ts` (line 67) |
| 17 | Video pipeline: assembly + post-production all stubs | `src/lib/video/engine/stitcher-service.ts` |
| 18 | Firestore/schedule triggers never deploy Cloud Functions | `src/lib/workflows/triggers/firestore-trigger.ts` (line 25) |

### Tier 3 — EXTERNAL BLOCKERS (Need credentials or third-party action)

| # | Area | What's Needed |
|---|------|---------------|
| 19 | **Stripe** | Production API keys (bank account setup), create products/prices |
| 20 | **Facebook/Instagram** | Meta Developer Portal approval |
| 21 | **LinkedIn** | Marketing Developer Platform approval (currently unofficial RapidAPI) |
| 22 | **Twilio** | Account verification for voice calls |
| 23 | **Email DNS** | SPF/DKIM/DMARC records for salesvelocity.ai |
| 24 | **Domain** | CNAME/A records to Vercel, SSL verification |
| 25 | **OAuth apps** | Register Google, Microsoft, Twitter, LinkedIn with production redirect URIs |
| 26 | **Vercel env vars** | All production env vars (see `.env.example`) |
| 27 | **SEO flip** | Run `npx tsx scripts/seo-launch.ts` when ready |
| 28 | **GA4** | Verify analytics script injection on public pages |

### Tier 4 — TECHNICAL DEBT (Post-launch OK)

| # | Issue | Severity |
|---|-------|----------|
| 29 | 115 placeholder tests (`expect(true).toBe(true)`) | HIGH |
| 30 | ~49% Zod validation coverage on API routes | MEDIUM |
| 31 | 37 skipped tests (need external services) | LOW |
| 32 | Search uses Firestore full-scan (no Algolia/Typesense) | LOW |
| 33 | Admin DAL `verifyAccess()` is a no-op | LOW |
| 34 | Scraper queue/cache in-memory (lost on restart) | LOW |

---

## What's Fully Operational

- All 178 dashboard pages render without errors
- Growth Command Center (6 pages, 6 collections, all seeded)
- AI Workforce Command Center (live telemetry, 54 agents)
- Coaching dashboard with AI-powered insights
- CRM (contacts, leads, deals, activities — all seeded)
- Team leaderboard with 8 members
- Playbooks (3 correct-shape playbooks)
- A/B testing page with 3 seeded tests
- Call log with 5 seeded records
- Website builder (12 pages)
- Settings (14 pages)
- Social media (8 pages)
- Email campaigns (3 pages)
- E-commerce (products, orders, storefront)
- Sequences and nurture campaigns
- Analytics dashboard
- Onboarding flow
- Firebase Auth + RBAC

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations |
| `src/lib/constants/platform.ts` | PLATFORM_ID and identity |
| `.env.example` | All required environment variables |
| `scripts/nuke-demo-data.ts` | Remove all demo data (60+ collections) |
