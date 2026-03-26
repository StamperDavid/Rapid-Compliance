# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 26, 2026 (Full System Audit — honest launch-readiness assessment)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **59 AI agents** (46 swarm + 7 standalone + 1 voice + 5 QA) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions enforced on 36+ API routes
- **185 pages**, **429+ API routes**, **~1,638 TypeScript files**, **~354K+ lines**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health (Verified March 25, 2026)
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- Zero `eslint-disable` comments, zero `any` types, zero `@ts-ignore`

---

## System-Wide Audit Results (March 26, 2026)

Full code audit performed by 12 parallel agents reading actual source code. Scores below reflect **real implementation state**, not documentation claims.

| System | Score | Launch Ready | Key Issue |
|--------|-------|-------------|-----------|
| Jasper Orchestrator | 95% | YES | 2 minor stub tools (redirect to other endpoints) |
| Mission Control | 90% | YES | No output editing/revision cycle (read-only review) |
| Website Builder | 85% | YES | Scheduled publish cron missing, image upload gap |
| Video Pipeline | 80% | ALMOST | Music library placeholder URLs, audio mixing stub |
| Voice AI | 85% | ALMOST | Twilio/Telnyx provider class files unverified |
| CRM / Contacts / Deals | 90% | YES | Firestore composite indexes need manual setup |
| Email / Newsletters | 85% | ALMOST | Campaign stats don't auto-update from webhooks |
| Social Media | 40% | NO | Only Twitter posts; FB/IG/YT/TikTok have zero code |
| Payments / E-Commerce | 85% | ALMOST | Invoice generation not implemented |
| Workflows / Automation | 90% | YES | No visual builder (functional via config) |
| Forms | 90% | YES | No drag-drop builder (functional via config) |
| SEO | 75% | ALMOST | Keyword research UI and rank tracking dashboard missing |
| Coaching / Performance | 85% | YES | AI-powered with real Firestore data |
| Auth / RBAC | 95% | YES | MFA defined but not enforced |
| Onboarding | 60% | NO | No mid-flight saves — data loss on browser close |
| Settings | 70% | PARTIAL | Billing page stub, team management incomplete |

---

## Launch Blockers (Must Fix)

### 1. Social Media — Only Twitter Actually Posts
- `postToPlatform()` in `autonomous-posting-agent.ts` returns `"Unsupported platform"` for everything except Twitter
- 8 platforms have real API service files (Bluesky, Threads, Truth Social, Telegram, Reddit, Pinterest, WhatsApp, Google Business) but are NOT wired into the posting dispatcher
- 4 platforms have ZERO implementation: Facebook, Instagram, YouTube, TikTok
- **Fix:** Wire the 8 existing services into `postToPlatform()`. Defer FB/IG/YT/TikTok.

### 2. Onboarding — No Mid-Flight Save
- 24-step wizard only saves on final submission (step 24)
- Browser crash/close = all data lost
- No step validation, no progress bar, no resume capability
- **Fix:** Auto-save to Firestore every step. Add progress indicator. Allow resume.

### 3. Sequencer Test Mode Bypass
- `src/lib/services/sequencer.ts` lines 816-1001 check `process.env.NODE_ENV === 'test'` and skip real email/LinkedIn/SMS/phone execution
- If test env vars leak to production, sequences silently do nothing
- **Fix:** Remove test guards or replace with explicit `process.env.SKIP_OUTREACH === 'true'` flag.

### 4. Invoice Generation — Not Implemented
- E-commerce checkout works, orders created, Stripe payments succeed — but no invoice PDF, no invoice storage, no invoice email
- Required for B2B clients and legally required in many jurisdictions
- **Fix:** Create `src/lib/ecommerce/invoice-service.ts` with PDF generation, add `/api/orders/{orderId}/invoice` endpoint.

### 5. Email Unsubscribe Page Missing
- CAN-SPAM footer generates unsubscribe URLs pointing to `/unsubscribe`
- That route does not exist — links 404
- Campaign stats don't auto-aggregate from webhook tracking events
- **Fix:** Create unsubscribe page + click redirect endpoint. Add webhook-to-stats aggregation job.

---

## High Priority (Pre-Launch)

| Issue | File(s) | Effort |
|-------|---------|--------|
| Wire 8 social platforms into `postToPlatform()` | `autonomous-posting-agent.ts` | 3-4 days |
| Missing env var validation in token refresh | `integration-manager.ts` lines 163-323 | Half day |
| Video music library URLs are placeholders | `music-library.ts` | 1 day |
| Audio mixing returns placeholder | `stitcher-service.ts` lines 415, 467 | 1 day |
| Campaign DELETE endpoint missing | `/api/campaigns/[campaignId]/route.ts` | Half day |
| Video project cascade delete (orphaned scenes) | `/api/video/project/[projectId]/route.ts` | Half day |
| 8 payment provider webhook stubs | `/api/webhooks/{provider}/route.ts` | 2-3 days |
| Billing settings page is a stub | `/settings/billing/page.tsx` | 1-2 days |
| Team management (invite flow, role reassignment) | `/settings/team/` | 2 days |
| Paddle subscription API (create/cancel) | `subscription-provider-service.ts` | 1 day |

---

## Completed Work (Archived)

All previously tracked items are complete:
- **Stub Eradication** (March 25) — 8 issues fully implemented (voice providers, video frame extraction, catalog sync, Vertex AI, workflow triggers, form templates)
- **Jasper Intelligence Layer** (March 25) — Config awareness, inline setup guidance, feature-aware onboarding
- **Campaign Dashboard** (March 25) — `/campaigns` page, 8 templates, analytics, template picker
- **Payment System** (March 25) — 12 providers, 12 webhook handlers, provider-agnostic dispatcher
- **AI Creative Studio** (March 16) — 250+ cinematic presets, multi-provider, full UI
- **Campaign Orchestration** (March 15) — Layers 1-4 complete, auto-publish pipeline, feedback loop
- **Video System** (March 10) — Hedra sole engine, Clone Wizard, auto-captions, editor, media library

---

## Recommended Priority Order (Next 2 Weeks)

**Week 1:**
1. Wire 8 social platforms into `postToPlatform()` (3-4 days)
2. Onboarding auto-save + progress bar + resume (1-2 days)
3. Unsubscribe page + click redirect endpoint (1 day)
4. Remove sequencer test guards + add env var validation (half day)

**Week 2:**
5. Invoice generation service + API endpoint (2-3 days)
6. Wire campaign stats from webhook events (1 day)
7. Campaign DELETE endpoint (half day)
8. Populate music library or remove from UI (1 day)
9. Billing settings page (1 day)

**Post-Launch Fast Follow:**
- Facebook/Instagram/YouTube/TikTok social implementations
- Visual workflow builder
- Visual form builder
- SEO keyword research dashboard + rank tracking
- Team invitation email flow
- Multi-tenant re-enablement planning
