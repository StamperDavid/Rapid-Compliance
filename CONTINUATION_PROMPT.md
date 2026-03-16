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

## NEXT BUILD: Cinematic Content Engine (RenderZero-Caliber)

> **Priority: IMMEDIATE — This is the next thing to build.**
> **Inspiration:** RenderZero AI Studio — professional cinematic AI image/video generation with deep creative controls.
> **Goal:** Integrate RenderZero-caliber cinematic controls INTO the existing SalesVelocity.ai content system — not as a bolt-on, but woven into Video Studio, Jasper, campaigns, and the media library.

### Why This Matters

The current content system is prompt-only — users type text and hope. RenderZero gives creators actual cinematic controls: camera bodies, lighting setups, film stocks, movie looks, consistent characters, multi-angle generation. We need this level of creative control integrated directly into the tools our users already use.

**Style capabilities required:** Photorealistic cinema, Pixar/3D animation, anime/manga, stylized illustration, comic book, watercolor, oil painting, low-poly, isometric, retro/vintage, cyberpunk, fantasy, noir — the full spectrum. Users pick a style and the system handles the prompt engineering.

### Architecture Overview — INTEGRATION-FIRST

This is NOT a separate app. The cinematic engine is a **shared service layer** consumed by multiple existing features:

| Consumer | How It Uses the Cinematic Engine |
|----------|--------------------------------|
| **Video Studio** (`/content/video`) | Per-scene cinematic controls in the storyboard. Scene generation uses `buildPromptFromPresets()` instead of raw text. |
| **Image Generation** (`/content/studio`) | New page — the standalone image generation UI that was missing. Uses full cinematic controls. |
| **Jasper** (`produce_video`, `create_image`) | Jasper selects cinematic presets programmatically when creating content. Asks clarifying questions before generating. |
| **Campaign deliverables** | Images and videos created with cinematic controls auto-register as campaign deliverables. |
| **Media Library** | All generated content saves to existing media library. |
| **Character Studio** | Upgrades the existing Hedra avatar/character system — not a parallel system. |
| **Script Generation** (`script-generation-service.ts`) | AI script writer outputs per-scene cinematic recommendations, not just dialogue. |

**Shared Components (reusable across pages):**
- `CinematicControlsPanel` — The numbered sections UI (Subject, Lighting, Camera, Style, Elements). Embeddable in any page.
- `VisualPresetPicker` — The visual grid modal with preview thumbnails + search. Used by all preset selectors.
- `ConstructedPromptDisplay` — Live-updating prompt preview. Shows exactly what will be sent.
- `RenderQueuePanel` — Background generation queue with status tracking.
- `CharacterPicker` — Character selection with face/outfit/object/scene slots.

### Phase 1: Cinematic Preset Engine + Types

**Goal:** Build the data layer — all 200+ presets with prompt mappings, plus TypeScript types. This is the foundation that everything else consumes.

**Files to create:**
- `src/types/creative-studio.ts` — All types:
  ```typescript
  CinematicPreset        // { id, name, category, promptFragment, thumbnail, tags }
  PresetCategory         // 'camera' | 'lighting' | 'filmStock' | 'movieLook' | 'style' | 'composition' | 'shotType' | 'focalLength' | 'lensType' | 'filter'
  ShotType               // { id, name, promptFragment, thumbnail } — 25 options
  ViewingDirection       // 'front' | 'back' | 'left' | 'right'
  StudioGeneration       // { id, prompt, presets, provider, model, result, cost, createdAt }
  CharacterProfile       // { id, name, faceRefs[], outfitRefs[], objectRef?, sceneRef?, physicalDesc, voice, style }
  ProviderConfig         // { provider, apiKey, models[], capabilities, costPerUnit }
  GenerationRequest      // { prompt, presets, provider, model, size, quality, style, characters?, referenceImages? }
  GenerationResult       // { id, url, revisedPrompt, provider, model, cost, metadata }
  CinematicConfig        // { shotType?, viewingDirection?, lighting?, camera?, focalLength?, lensType?, filmStock?, movieLook?, photographerStyle?, filters?, aspectRatio?, temperature?, atmosphere? }
  SceneGenerationConfig  // extends CinematicConfig — adds scriptText, avatarId, voiceId (used by Video Studio per-scene)
  ```

- `src/lib/ai/cinematic-presets.ts` — The preset library (RenderZero's exact preset catalog + our additions):
  - **25 Shot Types:** Bird's Eye, Close Up, Cutaway, Dutch Angle, Establishing Shot, Extreme Close Up, Group Shot, High Angle, Low Angle, Medium Shot, Over The Shoulder, Overhead, Sniper Shot, Three Quarter Body, Tight Headshot, Wide Shot, Worm's Eye View, etc.
  - **49 Camera Bodies:** ARRI Alexa 65, Sony Venice, RED Digital Cinema, Canon C300, Hasselblad X1D, Panavision Panaflex, 8mm/16mm/35mm Film Camera, Aaton ATX, Canon EOS 5D, Fujifilm X-T4, GoPro Hero, iPhone Pro, Kodak Brownie, Leica M3, Nikon F2, Polaroid 600, Rolleiflex, VHS Camera, Webcam, Security Camera, Doorbell Cam, Old Android Phone, Compact Camera, etc.
  - **9 Focal Lengths:** 8mm Fisheye, 14mm Ultra Wide, 24mm Wide Angle, 35mm Wide, 50mm Standard, 85mm Portrait, 100mm Macro, 200mm Super Telephoto, 300mm Extreme Telephoto
  - **12 Lens Types:** Anamorphic Cinema, Dioptic (Infrared), Fisheye, Helios 44-2 Swirly Bokeh, Holga Style, Lensbaby/Selective Focus, Macro, Petzval Portrait, Soft Focus Portrait, Tilt-Shift, Toy Plastic, Voigtlander Nokton 50mm
  - **43 Lighting Setups:** Backlighting/Rim Light, Blue Hour, Bounce, Broad, Candlelight, Chiaroscuro, Color Gels, Direct Flash, Diffuse (UGC), Golden Hour, Hard Lighting, Low Key, Neon, Product Side Key, Ring Light, Rim and Soft Fill, Softbox Key, Top Down Flat Lay, etc.
  - **30 Film Stocks:** Agfa Vista, CineStill 100, CineStill 800T, Ektachrome E100, Ektar 100, Fuji Acros 100, Fuji Pro 400H, Fuji Superia 400, Fujicolor Pro, Ilford Delta, Ilford HP5 Plus, Ilford XP2 Super, Kodachrome 64, Kodak Gold 200, Kodak Portra 400, Kodak Tri-X 400, Kodak Ultramax 400, Kodak Vision3 500T, etc.
  - **19 Photographer Styles:** 7th Era, Alberto Seveso, Alec Soth, Alin Palander, Alex Strohl, Alex Webb, Alfred Stieglitz, Ando Fuchs, North Borders, etc.
  - **100+ Movie Looks:** Annihilation, Apocalypse Now, Arrival, Ash vs Evil Dead, Avatar, Back to the Future, Beetlejuice, Ben-Hur, Black Hawk Down, Blade Runner, Blade Runner 2049, Casablanca, Children of Men, Chinatown, City of God, Cleopatra, Collateral, Conan the Barbarian, Crouching Tiger, etc.
  - **40+ Filters/Effects (stackable):** Black and White, Ice Mist Filter, Bloom Glow, Bokeh, Chromatic Aberration, Collage Cutout, Color Filter, Cross-Processed, CRT Scanlines, Cyanotype, Datamosh Glitch, Desaturated Grunge, Dreamy Haze, Duotone, Film Grain, Glitch Style, HDR Tone Mapping, etc.
  - **20+ Art Styles:** Photorealistic, Pixar/3D animation, anime (Ghibli, Makoto Shinkai, shonen), comic book (Marvel, manga), watercolor, oil painting, digital illustration, low-poly, isometric, cyberpunk, fantasy concept art, noir, retro pixel art, art nouveau, pop art, etc.
  - **15+ Compositions:** Rule of thirds, golden ratio, symmetrical, Dutch angle, bird's eye, worm's eye, leading lines, frame within frame, negative space, etc.
  - **Genre Presets (full configs):** Post-Apocalyptic Film, War Film, Romantic Comedy, Found Footage (Cell Phone), Found Footage (VHS), Dark Fantasy, 80s Teen Drama, 70s Gritty Crime Drama, 60s New Wave Romance, YouTube Documentary, Hollywood Blockbuster, Spaghetti Western, 60s Historical Epic, Technicolor Movie, Modern Crime Drama, Modern Sci-Fi Film, Luxury Video

- `src/lib/ai/cinematic-presets.ts` — Export functions:
  ```typescript
  getPresetsByCategory(category: PresetCategory): CinematicPreset[]
  getPresetById(id: string): CinematicPreset | null
  buildPromptFromPresets(basePrompt: string, config: CinematicConfig): string
  buildPromptFromConfig(config: SceneGenerationConfig): string  // For Video Studio scenes
  getGenrePresets(): GenrePreset[]  // Full config combos (War Film, Noir, etc.)
  searchPresets(query: string): CinematicPreset[]
  getRecommendedPresets(context: { videoType?: string, platform?: string, audience?: string }): CinematicConfig  // AI agent uses this
  ```

**Validation:** Each preset has a `promptFragment` that gets injected into the generation prompt. `buildPromptFromPresets()` combines base prompt + all selected presets into a single optimized prompt. Handles conflicts (e.g., digital camera + film stock → warns or auto-resolves).

### Phase 2: Multi-Provider Backend + Shared Components

**Goal:** Provider router + reusable UI components that every content page can embed.

**Provider Services:**
- `src/lib/ai/provider-router.ts` — Routes generation requests to the right API:
  ```typescript
  type StudioProvider = 'fal' | 'google' | 'openai' | 'hedra' | 'kling'
  routeGeneration(request: GenerationRequest): Promise<GenerationResult>
  getAvailableProviders(): Promise<ProviderConfig[]>
  autoSelectProvider(request: GenerationRequest): StudioProvider  // Expert engine selection
  getProviderCostEstimate(provider: StudioProvider, model: string, resolution: string): number
  ```

- `src/lib/ai/providers/fal-provider.ts` — Fal.ai (Flux, SDXL): fast iteration, stylized, anime, concept art
- `src/lib/ai/providers/google-ai-provider.ts` — Google AI Studio (Imagen 3): photorealistic, natural
- `src/lib/ai/providers/kling-provider.ts` — Kling 3.0: cinematic video, complex camera movements
- Refactor `src/lib/ai/image-generation-service.ts` — Existing DALL-E 3 becomes one provider in the router
- `src/lib/ai/cost-tracker.ts` — Per-generation cost logging to Firestore

**Shared UI Components** (reusable across pages):
- `src/components/studio/CinematicControlsPanel.tsx` — The numbered sections form (01–05). Accepts `onChange(config: CinematicConfig)` callback. Embeddable in Video Studio scene editor, image generation page, or anywhere.
- `src/components/studio/VisualPresetPicker.tsx` — Visual grid modal with preview thumbnails + search/filter. Used for ALL preset categories. Takes `category`, `onSelect`, `selected` props.
- `src/components/studio/ConstructedPromptDisplay.tsx` — Live-updating prompt preview box. Shows assembled prompt + Save Preset / Edit / Copy / Reset buttons.
- `src/components/studio/RenderQueuePanel.tsx` — Background generation queue showing pending/processing/completed jobs.
- `src/components/studio/CharacterElementsTool.tsx` — Character slots (up to 4) with Face/Outfit/Object/Scene drop zones, Single/Stitch mode, Character Library button, Global Reference, Additional Reference Images (up to 14).
- `src/components/studio/GenerateEditToggle.tsx` — Generate vs Edit (Inpaint) mode toggle with Narrative Angle Prompting option.

**API routes:**
- `POST /api/studio/generate` — Submit generation request (routes to provider)
- `GET /api/studio/generate/[generationId]` — Poll generation status
- `GET /api/studio/providers` — List available providers + status
- `POST /api/studio/providers/validate` — Test a provider API key
- `GET /api/studio/cost` — Cost dashboard data
- `GET /api/studio/presets` — List presets (with category filter + search)
- `POST /api/studio/presets` — Save custom user preset to Firestore
- `GET /api/studio/characters` — List characters
- `POST /api/studio/characters` — Create/update character

**BYOK Key Management:**
- Keys stored in existing Firestore `settings/api-keys` system
- New key slots: `fal`, `google-ai-studio`, `kling`
- Settings UI at `/settings/api-keys` already exists — just add new provider cards

### Phase 3: Integration Points — Where Cinematic Controls Appear

**This is where it all comes together.** The cinematic engine is NOT a standalone page — it surfaces in multiple existing features:

#### 3A. Image Generation Page (`/content/studio`)
New page — fills the gap where image generation UI was missing. This is the closest to RenderZero's layout:

**Layout:** Left panel (CinematicControlsPanel) + Right panel (ConstructedPromptDisplay + model/resolution/cost + Queue buttons + Primary Render + Scene Variations grid)

Uses ALL shared components. Saves generated images to existing Media Library. "Send to Campaign" registers as campaign deliverable. "Send to Storyboard" creates Video Studio project.

#### 3B. Video Studio Scene Editor (upgrade `/content/video`)
Each scene in the existing storyboard gets a **collapsible "Cinematic Settings" panel** using `CinematicControlsPanel`. When the user edits a scene, they see:
- The existing script text + visual description fields
- NEW: Cinematic controls (shot type, lighting, camera, style) embedded right there
- The `SceneGenerationConfig` includes both the script AND cinematic selections
- `buildPromptFromConfig()` assembles the full prompt for Hedra/Kling

This replaces the current raw-prompt approach in `scene-generator.ts` and `hedra-prompt-agent.ts`.

#### 3C. Jasper Tool Integration
Update existing Jasper tools + add new ones:
- **Update `produce_video`** — Jasper selects cinematic presets per-scene when creating storyboards. Uses `getRecommendedPresets()` to pick appropriate settings based on video type, platform, and audience.
- **New `create_image`** — Generate image with full cinematic config. Accepts cinematicConfig param.
- **Update script generation** — `script-generation-service.ts` outputs per-scene cinematic recommendations (not just dialogue/visuals).

**Agent Intelligence — Prompt Refinement Loop:**
Before generating, Jasper checks if the request has enough detail. If vague:
1. Asks clarifying questions through chat (tone? audience? style? platform? characters?)
2. Presents a creative brief summary with selected presets
3. User confirms → THEN generates
4. Jasper knows which engine is best for what (Fal for anime/concept, Google for photorealistic, Hedra for avatar lip-sync, Kling for cinematic video)
5. Zero wasted generations on half-baked prompts

#### 3D. Character System (upgrade existing)
Upgrades the existing Character Studio in Firestore — NOT a separate system:
- Existing Hedra avatar profiles get extended with the RenderZero-style fields (Face, Outfit, Object, Scene references with Single/Stitch mode)
- Character Library modal accessible from CinematicControlsPanel AND from Video Studio scene editor
- Characters saved to `organizations/{PLATFORM_ID}/studio/characters/{characterId}` (or extend existing avatar profiles collection)
- Import existing Hedra avatars into the upgraded system

#### 3E. Campaign Integration
- Images/videos generated through cinematic controls can be registered as campaign deliverables
- Campaign Review shows cinematic settings used (for revision context)
- Feedback loop includes the CinematicConfig so revisions maintain the same look

### Phase 4: Video-Specific Cinematic Controls

**Goal:** Camera MOVEMENT presets for video (separate from still-image camera presets).

- Camera movement presets: dolly in, truck left, crane up, handheld shake, steadicam, orbit, push-in, pull-out, whip pan, rack focus
- These apply to video generation only (Kling 3.0, Hedra)
- Integrated into Video Studio storyboard per-scene AND into `/content/studio` video tab
- Video tab in Studio: Text to Video, Image to Video, Audio Driven Video, Reference to Video, Start + End Frame

### Phase 5: Cost Tracking + Manual Fallback

**Cost Dashboard:**
- Tab within `/content/studio` or `/settings/usage`
- Total spend, spend by provider, spend by content type, per-project/campaign cost
- Budget setting + alerts
- Individual generation log
- Firestore: `organizations/{PLATFORM_ID}/studio/cost-log/{entryId}`

**Manual Fallback:**
- All cinematic presets browsable without any API call (they're local TypeScript data)
- Prompt Builder constructs full prompt from selections without AI
- "Copy Prompt" button for use in external tools
- Generation queue with auto-retry when providers are down
- Provider health indicators (green/yellow/red)
- Pro Mode: raw JSON view, direct prompt editing, custom preset creation

---

## Build Order Summary

| Phase | Name | Dependencies | What Changes |
|-------|------|-------------|-------------|
| 1 | Cinematic Preset Engine + Types | None | New types file + preset data library. Foundation for everything. |
| 2 | Multi-Provider Backend + Shared Components | Phase 1 | Provider services, router, cost tracker, 8 API routes, 6 shared UI components |
| 3A | Image Generation Page | Phases 1+2 | New `/content/studio` page using shared components. Fills the missing image gen UI gap. |
| 3B | Video Studio Upgrade | Phases 1+2 | Per-scene cinematic controls embedded in existing storyboard. Replaces raw prompts. |
| 3C | Jasper Integration | Phases 1+2 | Update `produce_video`, new `create_image`, prompt refinement loop, expert engine selection |
| 3D | Character System Upgrade | Phases 1+2 | Extend existing avatars with RenderZero-style Face/Outfit/Object/Scene + Library |
| 3E | Campaign Integration | Phase 3A | Cinematic config flows into campaign deliverables + revision context |
| 4 | Video Movement Controls | Phase 3B | Camera movement presets for video generation, video tab in Studio |
| 5 | Cost Tracking + Manual Fallback | Phase 2 | Cost dashboard UI, prompt builder, queue/retry, provider health |

**Start with Phase 1 + Phase 2 in parallel.** Then Phase 3A-3E can be built incrementally — each one is independently valuable. Phases 4-5 are polish.

---

## Jasper Cinematography Intelligence (Built into Phase 3C)

Jasper's system prompt must include deep cinematographic knowledge:
- **WHY** Rembrandt lighting works for testimonials but not product demos
- **WHY** Kodak Portra 400 for warm skin tones but CineStill 800T for night scenes
- **WHY** 35mm creates intimacy but 85mm creates authority
- **WHY** handheld sells authenticity but dolly sells production value
- **WHICH** engine for what: Fal.ai for anime/concept art, Google for photorealistic, Hedra for avatar lip-sync, Kling for cinematic video
- **WHEN** to push back: "You asked for anime targeting Fortune 500 CFOs — photorealistic would land better. Want both?"
- **WHEN** to ask for more info vs just generate: confidence threshold based on prompt detail level
- **ALWAYS** recommend presets based on content type + platform + audience — not just pass through raw text

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
| `src/app/(dashboard)/content/studio/page.tsx` | **NEW** — Image generation page (fills missing UI gap) |
| `src/components/studio/CinematicControlsPanel.tsx` | **NEW** — Reusable cinematic controls (embeddable in Video Studio + Studio page) |
| `src/components/studio/VisualPresetPicker.tsx` | **NEW** — Visual grid modal for preset selection (used everywhere) |
| `src/components/studio/ConstructedPromptDisplay.tsx` | **NEW** — Live prompt preview panel |
| `src/lib/video/scene-generator.ts` | **UPGRADE** — Uses cinematic presets instead of raw prompts |
| `src/lib/video/script-generation-service.ts` | **UPGRADE** — Outputs per-scene cinematic recommendations |

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
