# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 13, 2026

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
| **Video** | BROKEN — Hedra integration uses wrong models, characters don't speak (see Content Generator Rebuild below) |
| **AI Gateway** | REAL — OpenRouter (100+ models) |
| **Apollo** | REAL — Free-tier org search, enrichment |
| **SEO/Growth** | REAL — DataForSEO, Serper, keyword tracking, competitor monitoring |
| **Image Generation** | PARTIAL — DALL-E 3 service exists (`image-generation-service.ts`), no UI, not routed through OpenRouter |

---

## CONTENT GENERATOR REBUILD PLAN

### Why This Is Needed

The video generation integration was built on wrong assumptions about Hedra's API. The current system uses a third-party text-to-video model (Kling O3 T2V) for "prompt-only" mode, which does NOT do lip-sync — characters appear on screen but don't speak. Audio plays as background narration. The user has spent weeks and significant API credits debugging this.

Additionally, the content generator is incomplete compared to industry leaders (CapCut, Canva, Descript, InVideo). Missing: image generation UI, media library collections, CapCut-level video editor, auto-captions, brand kit, templates, and more.

### What's Salvageable

These systems are provider-agnostic and remain intact:
- Pipeline UI (Request → Storyboard → Generation → Assembly → Post-Production)
- Zustand pipeline store + localStorage persistence
- Firestore project schema (PipelineProject, PipelineScene types)
- FFmpeg assembly and post-production
- Scene review workflow (approve/reject/feedback/regenerate)
- Brand preference memory service
- Avatar profile service (Firestore CRUD for character identities)
- Video editor core (timeline, clips, undo/redo, DnD)
- Media library base (Firestore CRUD, type/category system)
- Voice Lab (AIMusicStudio, VoiceDesigner, VoiceLibrary, VoiceRecorderStudio)

### What's Contaminated (18 files)

**Complete rewrite (4 files):**
- `src/lib/video/hedra-service.ts` — Wrong API, wrong models, wrong TTS flow
- `src/lib/video/scene-generator.ts` — Prompt-only vs avatar branching is wrong
- `src/lib/video/hedra-prompt-agent.ts` — System prompt says "characters don't speak"
- `src/lib/video/hedra-prompt-translator.ts` — Prompt formatting built for Kling T2V

**Significant refactor (6 files):**
- `src/app/api/video/generate-scenes/route.ts` — Engine enum, default provider
- `src/app/api/video/regenerate-scene/route.ts` — Same
- `src/app/api/video/poll-scenes/route.ts` — Provider enum
- `src/app/api/video/avatar-profiles/hedra-characters/route.ts` — Legacy `/elements` endpoint
- `src/app/api/video/avatar-profiles/sync-hedra/route.ts` — Legacy character import
- `src/lib/agents/content/video/specialist.ts` — handleRenderScenes passes wrong params

**Minor type/enum fixes (8 files):**
- `src/types/video-pipeline.ts` — VideoEngineId, VoiceProviderId enums
- `src/lib/stores/video-pipeline-store.ts` — voiceProvider type
- `src/app/(dashboard)/content/video/components/StepGeneration.tsx` — Engine display
- `src/app/(dashboard)/content/video/components/AvatarPicker.tsx` — Source badges
- `src/app/(dashboard)/content/video/components/VoicePicker.tsx` — Provider filter
- `src/app/(dashboard)/content/video/components/HedraCharacterBrowser.tsx` — Legacy API
- `src/lib/orchestrator/jasper-tools.ts` — Tool descriptions
- `src/app/api/video/defaults/route.ts` — voiceProvider enum

---

### Phase 0: Hedra V1 SDK Validation (DO THIS FIRST)

**Purpose:** Determine whether to rebuild on the Hedra V1 SDK (`hedra-node` npm package) or fix the legacy API usage. This must be answered before any code is written.

**The V1 SDK (`hedra-node` v0.1.2) offers:**
- 1-call character generation (replaces 5-step asset upload + generation dance)
- Inline TTS (`audioSource: 'tts'` + `text` + `voiceId` — no separate TTS generation step)
- Text-to-character (`avatarImageInput: { prompt: "description" }` — no portrait upload needed)
- Full TypeScript types
- Auto-retry on rate limits

**The V1 SDK risks:**
- Uses different server: `mercury.dev.dream-ai.com` instead of `api.hedra.com` — API key may not work
- No model selection (can't pick Character 3 vs Omnia vs Avatar)
- No duration control (`duration_ms` not exposed)
- No resolution control (`720p`/`1080p` not exposed)
- Young package (v0.1.2, only 2 versions published)

**Validation steps:**
1. `npm install hedra-node` in a test script (NOT in the main project yet)
2. Test `client.voices.list()` — confirms API key works against V1 endpoint
3. Test `client.characters.create()` with `audioSource: 'tts'` + text + voiceId — confirms character speaks
4. Test `client.characters.create()` with `avatarImageInput: { prompt: "..." }` — confirms text-to-character works
5. Test `client.projects.retrieve(jobId)` — confirms status polling + video URL retrieval
6. Check output: Does the character actually lip-sync? What duration/resolution is the output?
7. Compare quality/speed vs legacy API Character 3

**Decision gate:**
- If SDK works and character speaks → **Rebuild on V1 SDK** (simpler, fewer moving parts)
- If SDK fails or quality is worse → **Fix legacy API** (stop using Kling T2V, use Character 3 + `audio_generation` inline parameter for everything, test Omnia and Avatar models)

**Alternative legacy API fix (if SDK doesn't work):**
- Replace `PROMPT_T2V_MODEL_ID` (Kling O3) with Character 3 for ALL generations
- Use `audio_generation` inline parameter instead of separate TTS step
- For "no portrait" mode: use Hedra's image generation to create a portrait first, then pass to Character 3
- Test Omnia model (full body, camera control, lip-sync, 8 sec) and Avatar model (up to 5 min)

---

### Phase 1: Fix Video Generator

**Goal:** Characters speak their scripts. Every generated video has lip-synced speech.

**Based on Phase 0 decision:**

**If V1 SDK:** Rewrite `hedra-service.ts` as thin wrapper around `hedra-node` client. Simplify `scene-generator.ts` to always use `client.characters.create()`. Remove prompt-only vs avatar branching (V1 API handles both). Update all 18 contaminated files.

**If Legacy API fix:** Replace Kling T2V with Character 3/Omnia/Avatar for all generations. Use `audio_generation` inline parameter. Generate portrait images from text when no avatar is selected (use Hedra's image generation models or DALL-E 3). Update prompt agent to describe characters that SPEAK. Update all 18 contaminated files.

**Verification:** Generate 3 test videos with different configurations:
1. With a selected avatar (portrait + voice)
2. Without an avatar (text prompt only — character must still speak)
3. Multi-scene project (verify character consistency + all scenes have speech)

All 3 must produce lip-synced characters speaking the script text.

---

### Phase 2: Image Generation UI + OpenRouter Routing

**Goal:** Users can generate images from the platform. Route through existing OpenRouter key.

**Current state:** `src/lib/ai/image-generation-service.ts` exists with full DALL-E 3 integration, but:
- Hardcoded to `https://api.openai.com/v1/images/generations`
- No UI page to access it
- No OpenRouter routing (key fallback exists but hits wrong endpoint)

**Work:**
1. Update `image-generation-service.ts` to detect OpenRouter key and route to `https://openrouter.ai/api/v1/images/generations` (same request format, different base URL)
2. Build image generation page at `/content/images/create`:
   - Text prompt input with style presets (photorealistic, illustration, 3D render, etc.)
   - Aspect ratio selector (1:1, 16:9, 9:16, 4:5)
   - Quality toggle (standard vs HD)
   - Style toggle (vivid vs natural)
   - Generation history with re-generate / variations
   - Save to media library
3. Build image gallery at `/content/images`:
   - Grid view with lightbox preview
   - Download, delete, save to library
   - Filter by style, date, prompt search

---

### Phase 3: Media Library Upgrade

**Goal:** Organized content library with collections for every media type.

**Current state:** Flat list of media items in Firestore with type/category filtering. No folders, no tags, no collections.

**Work:**
1. **Collections system** — Create, rename, delete collections per media type:
   - Image collections (e.g., "Product Photos", "Social Banners", "Team Headshots")
   - Video collections (e.g., "Sales Demos", "Testimonials", "Social Clips")
   - Audio collections (e.g., "Voice Overs", "Background Music", "Sound Effects")
   - Music collections (e.g., "Upbeat", "Corporate", "Ambient")
2. **Tagging** — Add/remove tags, filter by tag
3. **Favorites** — Star/unstar, filter favorites
4. **Sort options** — Date, name, size, duration, type
5. **Bulk operations** — Multi-select, bulk delete, bulk move to collection, bulk tag
6. **Search** — Full-text search across name, tags, collection name
7. **Drag-and-drop upload** — Drop files onto library to upload
8. **Collection sharing** — Collections viewable by all team members
9. **Storage upgrade** — Move from base64 data URIs to cloud storage (Firebase Storage or S3) for proper file handling

---

### Phase 4: Video Editor → CapCut Level

**Goal:** Professional-grade video editor comparable to CapCut.

**Current state:** Basic timeline with sequential clips, 1 audio track, 3 transition types, basic text overlays, undo/redo, DnD reorder. Functional but nowhere near CapCut.

**Phase 4a — Core Editor Upgrades:**
1. **Multi-track timeline** — Multiple video layers (overlay, PiP) + 3-5 audio tracks
2. **Audio waveform visualization** — Visual audio representation on timeline
3. **Speed control** — 0.25x to 4x constant speed per clip
4. **Clip volume control** — Per-clip volume with visual indicator
5. **Audio ducking visualization** — Show ducking in waveform, adjustable per track
6. **Expanded transitions** — 15-20 types (wipe, slide, zoom, blur, glitch, etc.)
7. **Video preview player** — Real-time preview with playhead sync
8. **Export presets** — YouTube (16:9 1080p), TikTok (9:16), Instagram (1:1, 4:5, 9:16), LinkedIn (16:9, 1:1)

**Phase 4b — Advanced Features:**
1. **Keyframe animation** — Animate position, scale, rotation, opacity over time
2. **Speed ramping** — Variable speed with bezier curves
3. **Effects library** — Blur, brightness, contrast, saturation, vignette, sharpen
4. **Filter presets** — 20+ one-click color grades (cinematic, vintage, B&W, warm, cool, etc.)
5. **Text animations** — Entrance/exit effects (fade, slide, typewriter, bounce)
6. **Font selection** — Google Fonts integration, font family/weight/style
7. **Auto-captions** — Speech-to-text via Whisper API or Google Speech-to-Text, SRT/VTT export
8. **Color correction panel** — Brightness, contrast, saturation, temperature, tint, curves

**Phase 4c — Professional Features:**
1. **Picture-in-picture** — Overlay video track with position/size control
2. **Green screen / chroma key** — Background removal with key color picker
3. **Background removal** — AI-powered (photos and video)
4. **Beat sync** — Auto-detect music beats, snap cuts to drops
5. **Frame-by-frame scrubbing** — Arrow keys advance 1 frame
6. **Motion tracking** — Text/graphics follow objects in video
7. **AI auto-edit suggestions** — Scene detection, pacing recommendations

---

### Phase 5: Content Templates & Brand Kit

**Goal:** One-click branded content creation.

**Brand Kit:**
1. Logo upload (primary, secondary, icon)
2. Brand colors (primary, secondary, accent, background, text)
3. Font selection (heading, body, accent)
4. Brand voice guidelines (tone, vocabulary, phrases to use/avoid)
5. Auto-apply brand to all generated content (videos, images, presentations)

**Templates:**
1. **Video templates** — Sales pitch, product demo, testimonial, explainer, social ad, tutorial (with scene structure, timing, transitions)
2. **Image templates** — Social post (Instagram, LinkedIn, Twitter), ad banner, email header, YouTube thumbnail
3. **Presentation templates** — Pitch deck, product overview, case study
4. **Template marketplace** — Browse, preview, use, customize

---

### Phase 6: Content Distribution & Publishing

**Goal:** Complete the content lifecycle — create → publish → measure.

1. **Content calendar** — Visual calendar with scheduled posts, drag-to-reschedule
2. **Multi-platform publishing** — Post to YouTube, Instagram, LinkedIn, TikTok, Twitter/X, Facebook from one UI
3. **Auto-reframe / Magic Resize** — One video/image reformatted for all platform dimensions
4. **Platform-specific formatting** — Auto-adjust captions, aspect ratio, duration per platform
5. **Embeddable video player** — Branded player for websites and landing pages
6. **Performance analytics** — Track views, engagement, clicks per published content

---

### Phase 7: Advanced Content AI

**Goal:** AI-powered content intelligence.

1. **Blog/URL-to-Video** — Paste URL, AI generates storyboard + video from article content
2. **Long-to-Short repurposing** — Upload long video, AI extracts best 30-60 sec clips with virality scoring
3. **Audio enhancement** — AI noise removal, studio sound (make any recording sound professional)
4. **Multi-language translation & dubbing** — Translate video content + AI voiceover in target language
5. **Filler word removal** — Auto-detect and remove "um", "uh", "like" from recordings
6. **AI thumbnail generation** — Auto-generate click-worthy thumbnails from video content
7. **Stock media integration** — Pexels, Unsplash, Pixabay search within the platform (free APIs)

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
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 50 function-calling tools |
| `src/lib/video/hedra-service.ts` | **NEEDS REBUILD** — Hedra API integration (uses wrong models) |
| `src/lib/video/scene-generator.ts` | **NEEDS REBUILD** — Scene generation orchestration |
| `src/lib/video/hedra-prompt-agent.ts` | **NEEDS REBUILD** — AI prompt translation for Hedra |
| `src/lib/video/hedra-prompt-translator.ts` | **NEEDS REBUILD** — Character metadata prompt injection |
| `src/lib/video/avatar-profile-service.ts` | Character Studio — source, role, styleTag, dual TTS metadata |
| `src/lib/video/brand-preference-service.ts` | Brand preference memory — approved/rejected prompts, style corrections |
| `src/lib/ai/image-generation-service.ts` | DALL-E 3 service — exists but no UI, needs OpenRouter routing |
| `src/lib/agent/onboarding-processor.ts` | Onboarding orchestration — CATEGORY_TO_BLUEPRINT, auto-resolve templateId |
| `src/lib/constants/feature-modules.ts` | Industry feature defaults, `getIndustryFeatureConfig()` |
| `src/lib/constants/entity-config.ts` | Industry entity defaults, `buildEntityConfigForCategory()` |
| `src/lib/db/provisioner/blueprints/industry-personas.ts` | 12 persona blueprints |
| `src/lib/persona/category-template-map.ts` | 15 categories, 50 template ID mappings |
| `src/components/orchestrator/MerchantOrchestrator.tsx` | Jasper runtime — loads persona blueprint, health report, impl context |
| `src/components/dashboard/JasperTaskReminder.tsx` | Dashboard setup checklist banner |
| `src/app/api/video/brand-preferences/route.ts` | Brand preference API (POST record, GET list) |
| `src/types/video-pipeline.ts` | PipelineScene with per-scene voiceProvider field |

---

## Hedra API Reference (for rebuild)

### Legacy API (current — broken)
- **Base URL:** `https://api.hedra.com/web-app/public`
- **Auth:** `x-api-key` header
- **Models used:** Character 3 (`d1dd37a3-e39a-4854-a298-6510289f9cf2`) for avatar mode, Kling O3 T2V (`b0e156da-da25-40b2-8386-937da7f47cc3`) for prompt-only — Kling does NOT lip-sync
- **Available models that DO lip-sync:** Character 3 (5 sec clips), Omnia (8 sec, camera control, body motion), Avatar (up to 5 min uncut)
- **TTS:** Currently separate 3-step process. Legacy API supports `audio_generation` inline parameter (not used).
- **Generation type `video_with_audio`:** Exists but not used — designed for single-call speech + video.

### V1 SDK (`hedra-node` v0.1.2)
- **Base URL:** `https://mercury.dev.dream-ai.com/api`
- **Auth:** `X-API-Key` header (same key — needs validation)
- **npm:** `hedra-node`
- **Key methods:**
  - `client.characters.create({ audioSource, voiceId, text, avatarImage?, avatarImageInput?, aspectRatio })` → `{ jobId }`
  - `client.projects.retrieve(jobId)` → `{ status, videoUrl, progress, errorMessage }`
  - `client.portraits.create({ file })` → `{ url }`
  - `client.audio.create({ file })` → `{ url }`
  - `client.voices.list()` → `{ supported_voices: [...] }`
- **Voices:** Provider is `eleven` (ElevenLabs) or `cartesia` — not "hedra" branded
- **Text-to-character:** `avatarImageInput: { prompt: "description", seed?: number }` — generates portrait from text
- **Limitations:** No model selection, no duration control, no resolution control
