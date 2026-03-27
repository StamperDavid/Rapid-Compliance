# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 26, 2026 (Post-audit sprint — 13 items resolved in 4 commits)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **59 AI agents** (46 swarm + 7 standalone + 1 voice + 5 QA) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions enforced on 36+ API routes
- **185 pages**, **429+ API routes**, **~1,638 TypeScript files**, **~354K+ lines**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health (Verified March 26, 2026)
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- Zero `eslint-disable` comments, zero `any` types, zero `@ts-ignore`

---

## System-Wide Scorecard (March 26, 2026 — Post-Sprint)

| System | Score | Launch Ready | Notes |
|--------|-------|-------------|-------|
| Jasper Orchestrator | 95% | YES | 46 tools, 9 delegation routes, all real |
| Mission Control | 90% | YES | SSE streaming, review links, approval gates |
| Website Builder | 85% | YES | 35+ widgets, AI gen, migration |
| Video Pipeline | 85% | YES | Music library has URL resolver, audio mixing wired |
| Voice AI | 85% | ALMOST | Twilio/Telnyx provider files unverified |
| CRM / Contacts / Deals | 90% | YES | Lead scoring, enrichment, deal pipeline |
| Email / Newsletters | 90% | YES | Campaign stats now auto-update from webhooks |
| Social Media | 70% | ALMOST | 10 platforms post (was 1). FB/IG/YT/TikTok still missing |
| Payments / E-Commerce | 90% | YES | Invoice generation live, all 12 webhooks real |
| Workflows / Automation | 90% | YES | 12 action types, cron scheduling |
| Forms | 90% | YES | Full CRUD, CRM integration |
| SEO | 75% | ALMOST | Keyword research UI and rank tracking missing |
| Coaching / Performance | 85% | YES | AI-powered with real data |
| Auth / RBAC | 95% | YES | Role changes now propagate to Firebase claims |
| Onboarding | 80% | YES | Auto-save on every step, resume on reload |
| Settings | 85% | YES | Billing page functional, team invites wired |

---

## Resolved This Session (March 26, 2026)

### Commit 1 — Launch blockers
- [x] **Sequencer test-mode bypass** — removed 5 `NODE_ENV === 'test'` guards
- [x] **8 social platforms wired** into `postToPlatform()` (Bluesky, Threads, Truth Social, Telegram, Reddit, Pinterest, WhatsApp Business, Google Business)
- [x] **Onboarding auto-save** — `PATCH /api/onboarding/progress` + useEffect on step change

### Commit 2 — Core features
- [x] **Invoice generation** — Playwright PDF, Firebase Storage upload, auto-fires on checkout, on-demand API
- [x] **Campaign DELETE** — cascade deletes deliverable subcollection + parent doc
- [x] **Email campaign stats** — webhook now atomically increments openedCount/clickedCount/etc on emailCampaigns doc

### Commit 3 — Infrastructure
- [x] **Env var validation** — Zoom and QuickBooks token refresh now throw clear errors instead of silent `undefined:undefined`
- [x] **Video cascade delete** — cleans up scene previews + Firebase Storage video files
- [x] **Music library** — added `getMusicTrackUrl()` signed URL resolver + `getAvailableMusicTrackIds()`
- [x] **Audio mixing** — replaced fake `audio://` URLs with real track URLs from stitcher

### Commit 4 — Team & payments
- [x] **Team invite flow** — UI now calls real `/api/users/invite` (role hierarchy, tokenized links, branded email)
- [x] **Role claims propagation** — PATCH /api/admin/users now updates Firebase Auth custom claims
- [x] **Razorpay refunds** — webhook events now write `paymentStatus: 'refunded'` to order document

### Verified already resolved (audit was wrong)
- [x] **Unsubscribe page** — exists at `/(public)/unsubscribe/page.tsx` with full API handler
- [x] **Click redirect** — exists at `/api/email/track/click/[linkId]/route.ts`
- [x] **Billing settings page** — fully functional (not a stub)
- [x] **Paddle subscription API** — all 4 operations implemented with real API calls
- [x] **All 9 payment webhooks** — fully implemented with signature verification + Firestore writes

---

## What Still Needs Work

### Pre-Launch (Medium Priority)
| Item | Effort | Notes |
|------|--------|-------|
| Facebook/Instagram social implementations | 2-3 days | Requires Meta Developer Portal approval |
| YouTube social implementation | 1-2 days | Requires Google API setup |
| TikTok social implementation | 1-2 days | Requires TikTok API setup |
| SEO keyword research UI | 2 days | DataForSEO API already wired |
| SEO rank tracking dashboard | 1-2 days | Service layer exists |
| Invite accept page | 1 day | `/signup` ignores `?invite=` token |
| Upload real music tracks to Firebase Storage | Half day | Paths defined, files not uploaded |

### Post-Launch Fast Follow
- Visual workflow builder (drag-drop canvas)
- Visual form builder (drag-drop editor)
- Scheduled publishing cron for website
- Multi-tenant re-enablement planning
- Dashboard data caching (reduce Firestore costs)
- MFA enforcement setup flow

---

## Completed Work (All Sessions Archived)

- **Post-Audit Sprint** (March 26) — 13 items resolved across 4 commits
- **Stub Eradication** (March 25) — 8 issues, voice providers, catalog sync, workflows, forms
- **Jasper Intelligence Layer** (March 25) — Config awareness, inline setup guidance
- **Campaign Dashboard** (March 25) — `/campaigns` page, 8 templates, analytics
- **Payment System** (March 25) — 12 providers, webhook handlers, provider-agnostic dispatcher
- **AI Creative Studio** (March 16) — 250+ cinematic presets, multi-provider
- **Campaign Orchestration** (March 15) — Layers 1-4, auto-publish, feedback loop
- **Video System** (March 10) — Hedra sole engine, Clone Wizard, auto-captions, editor
