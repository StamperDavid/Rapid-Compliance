# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 16, 2026

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
| **Image Generation** | PARTIAL — DALL-E 3 service exists, being replaced by AI Creative Studio |
| **Fal.ai** | PLANNED — AI Creative Studio provider (Flux, SDXL, Stable Diffusion) |
| **Google AI Studio** | PLANNED — AI Creative Studio provider (Gemini image models) |
| **Kling 3.0** | PLANNED — AI Creative Studio video provider (direct API) |

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

## NEXT BUILD: AI Creative Studio (RenderZero-Caliber)

> **Priority: IMMEDIATE — This is the next thing to build.**
> **Inspiration:** RenderZero AI Studio — professional cinematic AI image/video generation with deep creative controls.
> **Goal:** Web-native equivalent inside SalesVelocity.ai that matches or exceeds RenderZero's desktop app.

### Why This Matters

The current Video Studio is prompt-only — users type text and hope. RenderZero gives creators actual cinematic controls: camera bodies, lighting setups, film stocks, movie looks, consistent characters, multi-angle generation. We need this level of creative control built into our platform as a web-native experience.

**Style capabilities required:** Photorealistic cinema, Pixar/3D animation, anime/manga, stylized illustration, comic book, watercolor, oil painting, low-poly, isometric, retro/vintage, cyberpunk, fantasy, noir — the full spectrum. Users pick a style and the system handles the prompt engineering.

### Architecture Overview

**Route:** `/content/studio` — The AI Creative Studio
**Relationship to Video Studio:** The Creative Studio is the **generation engine** (images + video with cinematic controls). The existing Video Studio (`/content/video`) remains for the 5-step storyboard pipeline but will use the Creative Studio's generation backend instead of raw Hedra calls.

### Phase 1: Cinematic Preset Engine + Types

**Goal:** Build the data layer — all 200+ presets with prompt mappings, plus TypeScript types.

**Files to create:**
- `src/types/creative-studio.ts` — All types:
  ```typescript
  // Core types needed:
  CinematicPreset        // { id, name, category, promptFragment, thumbnail, tags }
  PresetCategory         // 'camera' | 'lighting' | 'filmStock' | 'movieLook' | 'style' | 'composition'
  StudioGeneration       // { id, prompt, presets, provider, model, result, cost, createdAt }
  CharacterProfile       // { id, name, faceRefs[], clothingDesc, personality, voice, style }
  ProviderConfig         // { provider, apiKey, models[], capabilities, costPerUnit }
  GenerationRequest      // { prompt, presets, provider, model, size, quality, style, character? }
  GenerationResult       // { id, url, revisedPrompt, provider, model, cost, metadata }
  StylePreset            // { id, name, category, promptModifier, exampleThumbnail }
  ```

- `src/lib/ai/cinematic-presets.ts` — The preset library:
  - **49 Camera Bodies:** ARRI Alexa 65, RED V-Raptor, Sony Venice, Panavision Millennium, Canon C500, Blackmagic URSA, IMAX 70mm, Aaton Penelope, etc. Each maps to prompt language (e.g., "shot on ARRI Alexa 65, shallow depth of field, organic highlight rolloff")
  - **43 Lighting Setups:** Chiaroscuro, Rembrandt, butterfly, split, loop, broad, short, golden hour, blue hour, neon noir, studio 3-point, moonlight, candlelight, overcast soft, backlit silhouette, ring light, Fresnel spot, etc.
  - **30 Film Stocks:** Kodak Portra 400, Kodak Ektar 100, Fuji Velvia 50, Fuji Pro 400H, CineStill 800T, Kodak Vision3 500T, Kodak Tri-X 400, Ilford HP5, Kodak Gold 200, etc.
  - **100+ Movie Looks:** "Blade Runner 2049", "Wes Anderson Grand Budapest", "Christopher Nolan IMAX", "Roger Deakins naturalistic", "Spielberg warm", "Kubrick symmetry", "Denis Villeneuve sci-fi", "Coen Brothers midwest", "Tarantino grindhouse", etc.
  - **20+ Art Styles:** Photorealistic, Pixar/3D animation, anime (Ghibli, Makoto Shinkai, shonen), comic book (Marvel, manga), watercolor, oil painting, digital illustration, low-poly, isometric, cyberpunk, fantasy concept art, noir, retro pixel art, art nouveau, pop art, etc.
  - **15+ Composition Presets:** Rule of thirds, golden ratio, symmetrical, Dutch angle, bird's eye, worm's eye, leading lines, frame within frame, negative space, etc.

- `src/lib/ai/cinematic-presets.ts` — Export functions:
  ```typescript
  getPresetsByCategory(category: PresetCategory): CinematicPreset[]
  getPresetById(id: string): CinematicPreset | null
  buildPromptFromPresets(basePrompt: string, presets: CinematicPreset[]): string
  getStylePresets(): StylePreset[]
  searchPresets(query: string): CinematicPreset[]
  ```

**Validation:** Each preset has a `promptFragment` that gets injected into the generation prompt. `buildPromptFromPresets()` combines base prompt + camera + lighting + film stock + look + style + composition into a single optimized prompt.

### Phase 2: Multi-Provider Backend

**Goal:** Provider router that sends generation requests to the right API based on user selection or auto-routing.

**Files to create:**
- `src/lib/ai/provider-router.ts` — Provider orchestration:
  ```typescript
  // Supported providers:
  type StudioProvider = 'fal' | 'google' | 'openai' | 'hedra' | 'kling'

  // Router functions:
  routeGeneration(request: GenerationRequest): Promise<GenerationResult>
  getAvailableProviders(): Promise<ProviderConfig[]>
  getProviderStatus(provider: StudioProvider): Promise<{ available: boolean, latency?: number }>
  autoSelectProvider(request: GenerationRequest): StudioProvider
  ```

- `src/lib/ai/providers/fal-provider.ts` — Fal.ai integration:
  - Flux Pro, Flux Schnell (fast), SDXL, Stable Diffusion 3
  - Text-to-image + image-to-image
  - REST API with queue-based async generation
  - Docs: https://fal.ai/docs

- `src/lib/ai/providers/google-ai-provider.ts` — Google AI Studio:
  - Gemini image generation (Imagen 3)
  - Text-to-image
  - REST API
  - Docs: https://ai.google.dev/docs

- `src/lib/ai/providers/kling-provider.ts` — Kling 3.0 direct:
  - Text-to-video, image-to-video
  - High-quality cinematic video
  - REST API (via kie.ai or direct)

- Update `src/lib/ai/image-generation-service.ts` — Refactor existing DALL-E 3 service to use provider router

- `src/lib/ai/cost-tracker.ts` — Cost logging:
  ```typescript
  logGeneration(generation: StudioGeneration): Promise<void>
  getCostSummary(period: 'day' | 'week' | 'month'): Promise<CostSummary>
  getProjectCost(projectId: string): Promise<number>
  getBudgetStatus(): Promise<{ spent: number, budget: number, remaining: number }>
  ```

**API routes to create:**
- `POST /api/studio/generate` — Submit generation request (routes to provider)
- `GET /api/studio/generate/[generationId]` — Poll generation status
- `GET /api/studio/providers` — List available providers + status
- `POST /api/studio/providers/validate` — Test a provider API key
- `GET /api/studio/cost` — Cost dashboard data
- `GET /api/studio/presets` — List all presets (with category filter)
- `GET /api/studio/presets/search` — Search presets

**BYOK Key Management:**
- Keys stored in existing Firestore `settings/api-keys` system
- New key slots: `fal`, `google-ai-studio`, `kling`
- Settings UI at `/settings/api-keys` already exists — just add new provider cards

### Phase 3: Studio UI — Image Generation

**Goal:** The main creative workspace UI. This is the flagship experience.

**File to create:** `src/app/(dashboard)/content/studio/page.tsx`

**Layout (3-panel):**

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR: Style selector, Provider picker, Manual mode  │
├──────────────┬──────────────────────┬───────────────────┤
│              │                      │                   │
│  CONTROLS    │    CANVAS/PREVIEW    │    HISTORY        │
│              │                      │                   │
│  • Prompt    │  [Generated Image]   │  • Recent gens    │
│  • Camera    │                      │  • Thumbnails     │
│  • Lighting  │  [Compare / Zoom]    │  • Re-use params  │
│  • Film Stock│                      │  • Favorites      │
│  • Movie Look│  [Animate button]    │  • Cost per gen   │
│  • Style     │                      │                   │
│  • Character │                      │                   │
│  • Size/Res  │                      │                   │
│              │                      │                   │
├──────────────┴──────────────────────┴───────────────────┤
│  BATCH BAR: Queue multiple variations, multi-angle gen  │
└─────────────────────────────────────────────────────────┘
```

**Left Panel — Controls:**
- **Prompt textarea** — Main creative input (with token count)
- **Style Picker** — Visual grid of art styles (photorealistic, Pixar, anime, etc.) with preview thumbnails
- **Camera dropdown** — 49 camera bodies, grouped by manufacturer
- **Lighting dropdown** — 43 setups, grouped by type (dramatic, natural, studio, creative)
- **Film Stock dropdown** — 30 stocks, grouped by brand (Kodak, Fuji, Ilford, CineStill, digital)
- **Movie Look dropdown** — 100+ looks, searchable, with director/film reference
- **Composition dropdown** — 15+ composition rules
- **Character selector** — Pick from Character Library or create new
- **Size/Resolution** — Aspect ratio (16:9, 9:16, 1:1, 4:3, 21:9) + resolution
- **Quality** — Standard / HD / Ultra
- **Provider** — Auto (best for style) or manual selection
- **Negative prompt** — What to exclude (collapsible)

**Center Panel — Canvas:**
- Large preview of generated image
- Zoom / pan controls
- Before/after comparison (for iterations)
- "Animate This" button → sends to video generation (Phase 5)
- "Send to Campaign" button → creates deliverable
- "Save to Media Library" button
- Download button (original resolution)

**Right Panel — History:**
- Scrollable grid of all generations (this session + past)
- Each thumbnail shows: preview, provider icon, cost badge
- Click to re-load parameters (prompt + all presets)
- Favorite / unfavorite
- Delete
- "Use as reference" (for img2img / character consistency)

**Toolbar:**
- **Easy Mode / Pro Mode toggle** — Easy mode shows curated presets as visual cards; Pro mode shows all dropdowns + raw prompt editor
- **Style quick-switch** — Top-level style tabs (Photorealistic, 3D/Pixar, Anime, Illustration, Cinema)
- **Provider indicator** — Shows which provider will be used + estimated cost
- **Manual Mode** — All AI-assisted features disabled; pure dropdown → prompt builder

**Batch Bar (bottom):**
- "Generate 4 variations" button — same prompt, slight randomization
- "Multi-angle" button — same scene, different camera presets simultaneously
- Queue indicator showing pending/processing/completed count

### Phase 4: Character System (Upgraded)

**Goal:** Full character profiles with face consistency across unlimited generations.

**Files to create:**
- `src/app/(dashboard)/content/studio/characters/page.tsx` — Character library page
- `src/lib/ai/character-service.ts` — Character CRUD + consistency engine

**Character Profile structure:**
```typescript
interface CharacterProfile {
  id: string
  name: string
  faceReferences: string[]       // Multiple angles of the same face
  bodyReference?: string         // Full-body shot for proportions
  clothingDescriptions: {        // Wardrobe system
    id: string
    name: string                 // "Business suit", "Casual Friday", "Workout"
    description: string          // Detailed clothing prompt fragment
    referenceImage?: string
  }[]
  physicalDescription: string    // Hair color, eye color, build, distinguishing features
  personality?: string           // For AI-driven expressions/poses
  defaultVoice?: string          // Voice ID for video generation
  defaultStyle?: string          // Preferred art style (photorealistic, anime, etc.)
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

**Character Library UI:**
- Grid of character cards with face preview
- Create new character:
  1. Upload face photo(s) — multiple angles encouraged
  2. AI extracts physical description automatically
  3. Add wardrobe items with descriptions
  4. Set default voice (for video)
  5. Set default art style
- Edit existing characters
- "Use in Studio" button → pre-loads character into generation controls
- Import from existing Hedra avatars

**Face Consistency Engine:**
- When a character is selected in the Studio, the face reference images + physical description are injected into the prompt
- For providers that support img2img / IP-adapter (Fal.ai), the face reference is passed as a control image
- The prompt includes "consistent character: [physical description], maintaining exact facial features from reference"

**Firestore:** `organizations/{PLATFORM_ID}/studio/characters/{characterId}`

### Phase 5: Image → Video Bridge

**Goal:** Seamless transition from generated still image to animated video.

**Workflow:**
1. User generates image in Studio
2. Clicks "Animate This"
3. Modal opens with video options:
   - Duration (5s, 10s, 15s, 30s)
   - Motion type (camera pan, zoom, character animation, full scene animation)
   - Audio (TTS script, background music, or silent)
   - Provider (Kling 3.0, Hedra)
4. Video generates asynchronously
5. Result appears in History panel

**Multi-Angle Generation:**
- User clicks "Multi-Angle" in batch bar
- System generates same scene with 3-4 different camera presets simultaneously
- Results displayed as a comparison grid
- User picks the best angle
- Remaining angles saved to history

**Integration with Video Studio:**
- "Send to Storyboard" button → creates a new Video Studio project with the image as scene 1
- Character + style settings carry over automatically
- Scene-level cinematic presets from Studio apply to video generation

### Phase 6: Studio UI — Video Controls

**Goal:** Apply cinematic controls to video generation, not just images.

- Video generation tab in Studio (alongside image tab)
- Camera **movement** presets (dolly in, truck left, crane up, handheld shake, steadicam)
- Scene-level cinematic controls in the existing Video Studio storyboard
- Each storyboard scene gets a "Cinematic Settings" panel with camera/lighting/style dropdowns
- The script-generation AI (`script-generation-service.ts`) incorporates selected presets

### Phase 7: Cost Tracking Dashboard

**Goal:** Transparent spend tracking across all providers.

**Route:** `/content/studio/costs` (tab within Studio, or standalone)

**Dashboard shows:**
- Total spend (today / this week / this month / all time)
- Spend by provider (pie chart)
- Spend by content type (image vs video)
- Spend per project/campaign
- Generation count + average cost
- Budget setting + alerts (Firestore-persisted)
- Individual generation log (sortable table): timestamp, prompt preview, provider, model, resolution, cost

**Firestore:** `organizations/{PLATFORM_ID}/studio/cost-log/{entryId}`

### Phase 8: Manual Fallback Mode

**Goal:** System works even when AI providers are down.

**Manual Mode features:**
- All cinematic presets browsable offline (they're local data, not API-dependent)
- Prompt Builder constructs the full prompt from dropdown selections without any AI call
- "Copy Prompt" button — copies the constructed prompt for use in external tools
- Generation queue with auto-retry — if a provider returns 503, queue the job and poll
- Provider health indicators (green/yellow/red) on the toolbar
- Graceful degradation — if selected provider is down, offer alternatives

**Pro Mode (for power users):**
- Raw JSON view of generation parameters
- Direct prompt editing with all preset fragments visible and editable
- API response inspector (see exactly what the provider returned)
- Custom preset creation — user defines their own camera/lighting/style presets

---

## Build Order Summary

| Phase | Name | Dependencies | Estimated Scope |
|-------|------|-------------|----------------|
| 1 | Cinematic Preset Engine + Types | None | Types file + preset data library (~2,000 lines of preset data) |
| 2 | Multi-Provider Backend | Phase 1 types | Provider services + router + cost tracker + 7 API routes |
| 3 | Studio UI — Image Gen | Phases 1+2 | Main studio page + all UI panels |
| 4 | Character System | Phases 1+2 | Character service + library page + face consistency |
| 5 | Image → Video Bridge | Phases 1-3 | Animate button + multi-angle + storyboard integration |
| 6 | Video Controls | Phases 1-5 | Camera movement presets + storyboard cinematic panel |
| 7 | Cost Dashboard | Phase 2 (cost tracker) | Cost UI page + charts |
| 8 | Manual Fallback | Phases 1-3 | Offline presets + prompt builder + queue + retry |

**Start with Phase 1 + Phase 2 in parallel** (types/presets have no dependency on providers). Then Phase 3 (the UI). Phases 4-8 can be built incrementally.

---

## Jasper Integration (After Phase 3)

New Jasper tools to add to `jasper-tools.ts`:
- `create_image` — Generate image via Studio with cinematic presets
- `create_cinematic_video` — Generate video with full cinematic controls
- `manage_characters` — CRUD operations on character profiles
- Update `produce_video` to use Studio's cinematic preset engine instead of raw prompts

---

## Future Phases (Roadmap)

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
| `src/lib/ai/image-generation-service.ts` | DALL-E 3 service — being replaced by Creative Studio |
| `src/types/creative-studio.ts` | **NEW** — Creative Studio types (presets, generations, characters, providers) |
| `src/lib/ai/cinematic-presets.ts` | **NEW** — 200+ cinematic preset library |
| `src/lib/ai/provider-router.ts` | **NEW** — Multi-provider generation router |
| `src/app/(dashboard)/content/studio/page.tsx` | **NEW** — AI Creative Studio UI |

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
