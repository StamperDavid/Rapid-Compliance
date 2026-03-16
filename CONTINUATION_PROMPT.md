# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 15, 2026

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **54 AI agents** (46 swarm + 6 standalone + 2 variants) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **180 physical routes**, **359 API endpoints**, **~340K lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES**

### Integration Status

| Integration | Status |
|---|---|
| **Twitter/X** | REAL — API v2, OAuth2 PKCE, full engagement |
| **LinkedIn** | PARTIAL — RapidAPI wrapper (official API blocked) |
| **Stripe** | REAL — PaymentElement, 3DS, webhooks |
| **Email** | REAL — SendGrid/Resend/SMTP (nodemailer), CAN-SPAM |
| **Voice** | REAL — Twilio/Telnyx, ElevenLabs TTS |
| **Video** | REAL — Hedra (inline `audio_generation`), Kling O3 T2V + Character 3 avatar |
| **AI Gateway** | REAL — OpenRouter (100+ models) |
| **Apollo** | REAL — Free-tier org search, enrichment |
| **SEO/Growth** | REAL — DataForSEO, Serper, keyword tracking, competitor monitoring |
| **Image Generation** | PARTIAL — DALL-E 3 service exists, no UI, not routed through OpenRouter |

---

## Video System — Working

Hedra is the sole video engine. Inline `audio_generation` replaces 3-step TTS. Two modes: prompt-only (Kling O3 T2V) and avatar (Character 3 + portrait + inline TTS). 87 models, 69 voices. See `docs/single_source_of_truth.md` for full Hedra API reference.

**Still needs work:**
- Voice cloning integration — wire `type: "voice_clone"` into Voice Lab
- End-to-end pipeline test (UI → API → Hedra → poll → display)

---

## Campaign Orchestration Pipeline

### Completed: Layers 1–4 (March 15, 2026)

Campaign + CampaignDeliverable models built with full CRUD, API routes, Jasper integration, Mission Control UI, auto-publish pipeline, and feedback loop.

**What's built:**
- `src/types/campaign.ts` — Campaign + CampaignDeliverable types with Zod schemas (incl. `publishedAt`, `revisionMissionId`)
- `src/lib/campaign/campaign-service.ts` — Full Firestore CRUD (Admin SDK), auto-status promotion, auto-publish pipeline, feedback loop
- 4 API routes: `/api/campaigns`, `/api/campaigns/[campaignId]`, `/api/campaigns/[campaignId]/deliverables`, `/api/campaigns/[campaignId]/deliverables/[deliverableId]`
- `create_campaign` Jasper tool — creates campaigns for multi-content requests
- `produce_video`, `save_blog_draft`, `social_post` accept `campaignId` and auto-register deliverables
- Campaign Review UI at `/mission-control?campaign={id}` — deliverable cards with approve/reject/feedback, "Approve All", progress bar
- Jasper system prompt updated with campaign orchestration instructions

**Layer 3 — Auto-Publish Pipeline (wired into `updateDeliverable()`):**
- Blog approved → blog post status updated from 'draft' to 'published' in Firestore
- Social post approved → posted via `AutonomousPostingAgent` (skips if already posted via actionId)
- Video approved → saved to media library if `videoUrl` in previewData
- Image approved → saved to media library
- Deliverable status auto-promoted to 'published'; campaign to 'published' when all deliverables published

**Layer 4 — Feedback Loop (wired into `updateDeliverable()`):**
- Rejected/revision_requested with feedback → auto-creates Jasper revision mission via `mission-persistence.ts`
- Mission includes original previewData + client feedback + campaignId for same-campaign delivery
- `revisionMissionId` linked back to the rejected deliverable

**Firestore:**
- `organizations/{PLATFORM_ID}/campaigns/{campaignId}` — Campaign docs
- `organizations/{PLATFORM_ID}/campaigns/{campaignId}/deliverables/{deliverableId}` — Deliverable docs

---

## Future Phases (Roadmap)

### Image Generation UI + OpenRouter Routing
DALL-E 3 service exists (`image-generation-service.ts`) but needs OpenRouter routing and UI pages (`/content/images/create`, `/content/images`).

### Media Library Upgrade
Collections, tagging, favorites, bulk operations, search, drag-and-drop upload, cloud storage migration (currently base64 data URIs).

### Video Editor Upgrades
Multi-track timeline, audio waveforms, speed control, expanded transitions, keyframe animation, effects/filters, auto-captions, PiP, chroma key, beat sync.

### Content Templates & Brand Kit
Logo/colors/fonts upload, brand voice guidelines, auto-apply brand to generated content, video/image/presentation templates.

### Content Distribution & Publishing
Content calendar, multi-platform publishing, auto-reframe/magic resize, embeddable video player, performance analytics.

### Advanced Content AI
Blog/URL-to-video, long-to-short repurposing, audio enhancement, multi-language dubbing, filler word removal, AI thumbnails, stock media integration.

---

## Onboarding System

Two flows: 4-step signup + 24-step dashboard wizard. Industry-driven 5-layer config (feature modules, entity config, persona blueprints, industry templates, dashboard wizard). MerchantOrchestrator injects blueprint into Jasper's system prompt.

---

## Blocked (External)

| Item | Blocker |
|------|---------|
| Facebook/Instagram | Meta Developer Portal approval |
| LinkedIn official | Marketing Developer Platform approval |
| Stripe go-live | Production API keys (bank account setup) |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 51 function-calling tools (incl. create_campaign) |
| `src/lib/campaign/campaign-service.ts` | Campaign + deliverable CRUD |
| `src/types/campaign.ts` | Campaign/CampaignDeliverable types + Zod schemas |
| `src/lib/video/hedra-service.ts` | Hedra video generation (inline audio_generation) |
| `src/lib/orchestrator/mission-persistence.ts` | Mission tracking (Firestore) |
| `src/lib/ai/image-generation-service.ts` | DALL-E 3 service — needs OpenRouter routing + UI |

---

## Hedra API Reference

- **Base URL:** `https://api.hedra.com/web-app/public` (auth: `x-api-key`)
- **Prompt-only:** Kling O3 Standard T2V — speaking characters from text prompt, up to 15s 720p
- **Avatar:** Character 3 — portrait + inline TTS, up to 1080p auto duration
- **Inline TTS:** `audio_generation: { type: "text_to_speech", voice_id, text }`
- **Voice cloning:** `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **Elements API:** `https://api.hedra.com/web-app/elements` (read-only, 156 stock elements)
- **87 models** (58 video, 29 image), **69 voices** (ElevenLabs, MiniMax, custom clones)
- **hedra-node SDK rejected** — outdated, use direct API
