# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 10, 2026

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **54 AI agents** (46 swarm + 6 standalone + 2 variants) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **180 physical routes**, **355 API endpoints**, **~340K lines of TypeScript**
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
| **Video** | REAL — Hedra-only engine, Character Studio, AI Video Director, brand preference memory |
| **AI Gateway** | REAL — OpenRouter (100+ models) |
| **Apollo** | REAL — Free-tier org search, enrichment |
| **SEO/Growth** | REAL — DataForSEO, Serper, keyword tracking, competitor monitoring |

---

## Video System — Current Architecture

### Engine
**Hedra is the sole video generation engine.** All other engines (Kling, Runway, Sora, HeyGen) were removed in Phase 1. Hedra generates full character-in-action scenes (not just talking heads). 5-second clip limit per generation — FFmpeg stitching assembles final videos.

### Character Studio (Phase 2 — COMPLETE)
Two character sources with persistent identity:
- **Custom characters** (user-created) — reference images, green screen clips, ElevenLabs voice clones
- **Hedra stock characters** — auto-synced from Hedra's library on avatar picker mount, built-in Hedra voices

**Dual TTS paths:**
- Hedra voice → `audio_generation: { type: "text_to_speech", voice_id, text }` (Hedra handles TTS)
- ElevenLabs/UnrealSpeech → synthesize audio ourselves → upload as `audio_id`

Voice is fully decoupled from character image — any voice works with any character.

### AI Video Director (Phase 3 — COMPLETE)
- **`produce_video`** Jasper tool — full pipeline: create project → cast characters → generate scenes → track progress
- **`assemble_video`** Jasper tool — loads scene URLs, calls `/api/video/assemble` (FFmpeg), saves `finalVideoUrl` to project
- **Per-scene character assignment** — each PipelineScene has `avatarId`, `voiceId`, `voiceProvider` overrides
- **Hedra prompt translator** — `hedra-prompt-translator.ts` enhances visual descriptions with character metadata
- **Scene review workflow** — approve/reject buttons, inline video preview, feedback textarea, regenerate with direction
- **Brand preference memory** — `brand-preference-service.ts` records approved/rejected prompts, style corrections. Integrated into prompt translator via `translatePromptWithBrandMemory()`.

### Phase 4: Polish (TODO)
1. Video library integration (save completed projects)
2. Template system (reusable scene structures)
3. Multi-character scene compositing (separate renders + layer)

### Recent Fixes (March 10, 2026)
- **Retry race condition** — Fixed: clearing old `providerVideoId` before regenerating prevents polling from re-failing the scene instantly
- **Auto-sync Hedra avatars** — AvatarPicker now auto-imports all un-imported Hedra characters on mount
- **Image error fallback** — AvatarCard handles expired Cloudflare image URLs with graceful fallback to placeholder icon

---

## Onboarding System — Current Architecture

### Two Flows
1. **4-step signup** (`/onboarding/industry` → niche → account → setup) — initial account creation
2. **24-step dashboard wizard** (`/dashboard/onboarding`) — detailed training configuration

### Industry-Driven 5-Layer Configuration
Industry selection drives ALL system configuration automatically:
1. **Feature Modules** — `getIndustryFeatureConfig(categoryId)` — enables industry-relevant modules
2. **Entity Config** — `buildEntityConfigForCategory(categoryId)` — enables industry-specific CRM entities
3. **Persona Blueprints** — `CATEGORY_TO_BLUEPRINT` (15 categories → 12 blueprints) — tone, communication style, specialist triggers
4. **Industry Templates** — Auto-resolved from category. 50 templates across 7 files. MutationEngine applies conditional transformations.
5. **Dashboard Wizard** — Uses `ONBOARDING_CATEGORIES` (15 categories) with correct IDs

### Runtime Integration
- MerchantOrchestrator loads `agentPersona/current` from Firestore and injects `industryBlueprint` data (tone, decision style, communication style, key phrases, role title) into Jasper's system prompt
- Dashboard wizard pre-fills from stored onboarding data via `/api/onboarding/data`
- JasperTaskReminder shows setup checklist on dashboard via `/api/onboarding/status`

---

## Open Items — Launch Punch List

See `docs/single_source_of_truth.md` "Open Items" section for the full punch list.

### Blocked (External)

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
| `docs/single_source_of_truth.md` | Authoritative architecture doc (2000+ lines) |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 48 function-calling tools |
| `src/lib/video/hedra-service.ts` | Hedra Character-3 API — sole video generation engine, dual TTS paths |
| `src/lib/video/scene-generator.ts` | Scene generation — per-scene character overrides, prompt translation |
| `src/lib/video/avatar-profile-service.ts` | Character Studio — source, role, styleTag, dual TTS metadata |
| `src/lib/video/hedra-prompt-translator.ts` | Enhances visual descriptions with character metadata for Hedra |
| `src/lib/video/brand-preference-service.ts` | Brand preference memory — approved/rejected prompts, style corrections |
| `src/lib/agent/onboarding-processor.ts` | Onboarding orchestration — CATEGORY_TO_BLUEPRINT, auto-resolve templateId |
| `src/lib/constants/feature-modules.ts` | Industry feature defaults, `getIndustryFeatureConfig()` |
| `src/lib/constants/entity-config.ts` | Industry entity defaults, `buildEntityConfigForCategory()` |
| `src/lib/db/provisioner/blueprints/industry-personas.ts` | 12 persona blueprints |
| `src/lib/persona/category-template-map.ts` | 15 categories, 50 template ID mappings |
| `src/components/orchestrator/MerchantOrchestrator.tsx` | Jasper runtime — loads persona blueprint, health report, impl context |
| `src/components/dashboard/JasperTaskReminder.tsx` | Dashboard setup checklist banner |
| `src/app/api/video/brand-preferences/route.ts` | Brand preference API (POST record, GET list) |
| `src/types/video-pipeline.ts` | PipelineScene with per-scene voiceProvider field |
