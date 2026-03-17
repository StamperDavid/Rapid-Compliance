# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 17, 2026 (Session 3)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **54 AI agents** (46 swarm + 6 standalone + 2 variants) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **182 physical routes**, **380 API endpoints**, **~340K lines of TypeScript**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**

---

## COMPLETED: Cinematic Content Engine (March 16, 2026)

The RenderZero-caliber cinematic controls are BUILT and INTEGRATED into the video pipeline. This is NOT a bolt-on — it IS the video system now.

### What Was Built

**Shared Components** (`src/components/studio/`):
- `CinematicControlsPanel` — 5 numbered sections (Subject & Framing, Lighting & Mood, Camera Gear, Style & Aesthetics, Elements Tool). Accepts subject/environment/renderElements props. Compact mode for embedding.
- `VisualPresetPicker` — Visual grid modal with search for all 250+ presets
- `ConstructedPromptDisplay` — Live prompt preview with edit/copy/save/reset
- `CharacterElementsTool` — Up to 4 characters with Face/Outfit/Object/Scene slots, Single/Stitch mode, Character Library (wired to Firestore), Global Reference, Additional References (14 slots)
- `GenerateEditToggle` — Generate vs Edit (Inpaint) mode + Narrative Angle Prompting
- `RenderQueuePanel` — Queue with status tracking, cancel/retry/select
- `CharacterLibraryModal` — Save/load characters from `/api/studio/characters`
- `PresetLibraryModal` — Save/load custom presets from `/api/studio/presets`

**Video Pipeline Integration** (`/content/video`):
- Pipeline stepper: **Studio → Storyboard → Generate → Assembly → Post-Production**
- Studio step (step 1) = full RenderZero UI (StudioModePanel) — describe concept, set cinematic style
- Storyboard step (step 2) = scene grid with per-scene cinematic controls:
  - Each scene card is clickable → opens detail editor below
  - Left: title, script/dialogue (screenplay format), visual description, background, duration
  - Right: full CinematicControlsPanel in compact mode (per-scene overrides)
  - "Generate All Previews" button batch-generates thumbnails via `/api/studio/generate`
- CinematicConfig flows end-to-end:
  - `PipelineScene.cinematicConfig` field (src/types/video-pipeline.ts)
  - `/api/video/generate-scenes` accepts cinematicConfig per scene (Zod validated)
  - `/api/video/regenerate-scene` same
  - `/api/video/project/save` persists cinematicConfig to Firestore
  - `scene-generator.ts:buildHedraTextPrompt` calls `buildPromptFromPresets()` when cinematicConfig present
  - `hedra-prompt-agent.ts` includes cinematicConfig in storyboard context for AI prompt optimization

**Image Generator** (`/content/image-generator`):
- Standalone page using StudioModePanel for single-shot image/video generation
- Same cinematic controls, provider selection, render queue

**Navigation** (`src/lib/constants/subpage-nav.ts`):
- "Content Generator Hub" with tabs: Video | Image | Editor | Library | Audio Lab
- Sidebar label: "Content Generator" (under Marketing) — isActive covers all `/content/` paths
- Constant renamed from `VIDEO_TABS` to `CONTENT_GENERATOR_TABS`

**Backend**:
- 7 API routes at `/api/studio/*` (generate, status polling, providers, presets CRUD, characters CRUD, cost)
- Provider router: **Hedra (primary for images)**, Fal.ai (Flux), Google Imagen 3, OpenAI DALL-E 3, Kling 3.0 — fallback chain with retry-on-auth-failure
- Generated images auto-added to media library (`organizations/{id}/media`) with projectId/campaignId metadata
- Cost tracker logging to Firestore per generation (fire-and-forget — never crashes the response)
- 250+ cinematic presets with prompt fragment assembly

---

## COMPLETED: Jasper Orchestration Pipeline + Mission Control Overhaul (March 16, 2026)

> **Status: BUILT** — All 6 orchestration steps implemented and Mission Control UI overhauled.
> Jasper orchestrates multi-step content creation (research → strategy → script → cinematic design → thumbnails → ready for review) and Mission Control shows every step with rich output previews.

### The Problem

Jasper currently passes user prompts straight to the script generator without research or enrichment. The user should be able to say something as simple as *"Build a video about how SalesVelocity.ai helps small business owners"* and receive a fully researched, scripted, cinematically designed, thumbnail-previewed storyboard ready for review and approval.

Mission Control exists (full backend + UI) but doesn't match the user's vision: a project dashboard where each request shows its delegation steps, which agent did what, and clicking a step takes you to its completed output.

### Jasper's Orchestration Chain (for video creation)

Jasper is the CONDUCTOR. He delegates ALL work to specialists. He never writes scripts, picks camera angles, or generates images. He routes and waits.

```
User: "Build a video about how SalesVelocity.ai helps small business owners"

Step 1: Jasper → Research Agent
  "Research SalesVelocity.ai features and how they help small business owners.
   Include pain points, competitive advantages, key value propositions."
  Agent returns: research findings document

Step 2: Jasper → Strategy Agent (uses research output)
  "Using this research, determine the top 3-5 ways SalesVelocity.ai helps
   small business owners. Identify the strongest narrative angle for a video."
  Agent returns: messaging strategy + narrative angle

Step 3: Jasper → Video Specialist (uses strategy output)
  "Create a 30-second commercial script targeting small business owners.
   Key messages: [from strategy]. Tone: professional but approachable."
  Agent returns: scenes with scripts, visual descriptions, backgrounds

Step 4: Jasper → Cinematic Director (NEW — uses scenes)
  "For each scene, select appropriate shot type, camera body, lighting,
   film stock, and style to create a cohesive commercial feel."
  Agent returns: cinematicConfig per scene

Step 5: Jasper → Image Generator (uses scenes + cinematic configs)
  "Generate preview thumbnails for each scene using the cinematic settings."
  Thumbnails generated via /api/studio/generate

Step 6: Jasper → User
  "Your video storyboard is ready for review: [link to Mission Control]"
  Storyboard is COMPLETE — scripts, cinematic settings, AND thumbnails already generated.
```

**CRITICAL:** Thumbnails MUST be generated BEFORE the user sees the storyboard. They are part of the deliverable, not an afterthought. The user needs visual previews to make informed approve/reject decisions.

### Mission Control Overhaul

**Current state:** Mission Control exists with full backend (Firestore persistence, SSE streaming, approval gates, mission CRUD) and UI (3-panel layout, timeline, step cards, agent avatars). But the UX doesn't match what's needed.

**Target UX:**
```
Mission Control
├─ Request: "Video — SalesVelocity for Small Business"
│  Status: Complete · 6/6 steps
│  ├─ ✅ Step 1: Research (Research Agent)         → click → research findings
│  ├─ ✅ Step 2: Strategy (Strategy Agent)          → click → messaging doc
│  ├─ ✅ Step 3: Script Writing (Video Specialist) → click → scripts per scene
│  ├─ ✅ Step 4: Cinematic Design (Cinematic Dir)  → click → settings summary
│  ├─ ✅ Step 5: Thumbnail Gen (Image Generator)   → click → preview gallery
│  └─ ✅ Step 6: Ready for Review                  → click → /content/video (storyboard)
│
├─ Request: "Blog post about AI in sales"
│  Status: In Progress · 2/4 steps
│  ├─ ✅ Step 1: Research (Research Agent)          → click → research findings
│  ├─ 🔄 Step 2: Writing (Content Agent)           → in progress...
│  ├─ ⏳ Step 3: SEO Optimization                   → pending
│  └─ ⏳ Step 4: Ready for Review                   → pending
```

**Key requirements:**
1. Each mission (request) shows ALL steps with agent attribution
2. Clicking a step shows the agent's actual output (not just a summary)
3. Clicking "Ready for Review" navigates to the completed product's page
4. Works for ANY task type (video, blog, campaign, social, email — not just video)
5. Real-time updates via existing SSE streaming
6. This is where Jasper sends users for ALL review — not directly to product pages

### What Was Built (March 16, 2026 — Session 2)

**Mission Control UI Overhaul:**
- Fixed `trackMissionStep` stepId bug — RUNNING/COMPLETED now share same stepId via Map
- Rich output previews in step cards (research chips, strategy angles, thumbnail strips, cinematic badges)
- Type-specific detail rendering in right panel (formatted research, strategy docs, cinematic grids, thumbnail galleries, storyboard review buttons)
- 8 new agent avatars for orchestration chain (Research, Strategy, Script Writer, Cinematic Director, Image Generator, Video Director, Content, Commerce, Outreach, Intelligence)
- Dashboard-links with orchestration step mappings, human-readable step names, dynamic review links from toolResult

**Jasper 6-Step Orchestration Chain (produce_video):**
- Step 1: Research Agent — LLM-powered topic research with key insights extraction
- Step 2: Strategy Agent — Narrative angle, key messages, audience, tone, CTA
- Step 3: Script Writing — Video Specialist creates enriched storyboard using strategy context
- Step 4: Cinematic Director — LLM selects per-scene cinematography (shot type, lighting, camera, film stock, art style)
- Step 5: Thumbnails — Auto-generates preview images per scene via provider-router with cinematic presets
- Step 6: Ready for Review — Complete storyboard link with full orchestration metadata
- Each step writes independently to mission-persistence for real-time SSE streaming
- Non-fatal steps (research/strategy/cinematic/thumbnails) fail gracefully — chain continues

**UI/Navigation Fixes:**
- Sidebar: "Video" → "Content Generator" (isActive covers all `/content/` paths)
- Tab: "Image Generator" → "Image"
- Tab: "Voice Lab" → "Audio Lab", page heading updated, inner tab "Studio" → "Voice Studio"
- Upload slots accept `image/*,video/*` instead of image-only

---

## COMPLETED: Hedra Integration + Pipeline Hardening + Media Library (March 17, 2026 — Session 3)

### Hedra as Primary Image Provider
- `generateHedraImage()` added to `hedra-service.ts` — same `/generations` endpoint, `type: 'image'`, auto-discovers image model from `/models` API
- Hedra is now the DEFAULT image provider for all generation (no additional API keys needed)
- Image fallback chain: hedra → google → fal → openai (with retry-on-auth-failure)
- Hedra image results are stored as assets — polling fetches asset URL from `/assets?type=image` list
- Image model ID cached for 10 minutes to avoid repeated `/models` calls

### Hedra Video Generation — Two Modes Documented
- **Kling O3 T2V (prompt-only, no avatar):** Generates everything from text. Audio is NATIVE — no inline TTS. Speech text appended as dialogue in prompt.
- **Character 3 (avatar mode):** Portrait + voice + script → lip-synced video. Uses inline `audio_generation` for TTS.
- Script generation service updated with full Hedra expertise — agent understands both modes and writes scripts accordingly

### Mission Control Review Page
- New route: `/mission-control/review?mission=xxx&step=yyy`
- Type-specific renderers: research findings, strategy docs, cinematic configs, thumbnail galleries, draft summaries
- "Review Details" links on both step cards and detail panel for all completed steps

### Pipeline Fixes (All Were Silent Failures)
- **Truncation removed:** All 31 `.slice(0, 2000)` on `toolResult` removed — full output stored
- **Cinematic design (Step 4):** Fixed JSON parsing (robust fence stripping + regex fallback), sceneNumber type mismatch (Number() conversion), undefined values filtered before Firestore write, actual errors reported instead of silent "default settings"
- **Cinematic preset IDs:** Step 4 prompt now outputs exact preset IDs matching the catalog (e.g., `shot-tracking`, `cam-sony-venice`)
- **PresetSelector fallback:** Displays raw value title-cased when no exact preset ID match exists
- **Thumbnail failures:** Per-scene errors captured and reported in mission step + Jasper response
- **Cost logging:** Made fire-and-forget — `undefined` campaignId no longer crashes the route
- **Character consistency:** Script agent rule 8 — when no character described, invent ONE specific protagonist for all scenes

### Media Library Integration
- Every image generated via `/api/studio/generate` auto-creates a media library record
- Metadata includes: provider, model, generationId, projectId, campaignId
- Media API fallback for missing composite index (queries without orderBy when index not built)
- Backfilled 8 existing storyboard images into media library

### Storyboard UX
- Preview error banner (dismissible) shows actual error message instead of silent swallow
- SceneCard `forwardRef` fix for framer-motion AnimatePresence warning
- Auto-refresh project data on tab focus (picks up background changes)
- `?load=` URL param always works (removed stale `autoLoadAttempted` ref)

### Known Issues for Next Session
- **Preview images not sticking in storyboard UI** — `screenshotUrl` values are in Firestore but the Zustand store doesn't reflect them after page load. Needs investigation into how `loadProject` populates scenes.
- **Hedra credits exhausted** — 4/8 video scenes generated successfully, remaining 4 need credits top-up
- **Hedra CDN URL expiration** — signed URLs expire (~1hr). Need to either refresh on access or persist images to our own storage.
- **Media library composite index** — `type + createdAt` index needed in Firebase Console for sorted queries (fallback works but unsorted)

---

## NEXT BUILD: Per-Scene Audio Cues + Pipeline Audio Integration

> **Priority: NEXT**
> **Goal:** Video scripts can include diegetic audio direction (music characters hear, radio, sound design) per scene. MiniMax generates matching tracks. Multi-scene continuous audio is handled in the Video Editor post-production.

### Architecture Decision

**Per-scene audio (automated in pipeline):**
- `audioCue` text field on `PipelineScene` — describes what audio plays in that scene
- AI script writer naturally writes audio cues when the story calls for it (not forced)
- Examples: "80s hip-hop blasting from car stereo", "soft piano underscore", "radio newscast interrupts"
- MiniMax generates a matching track per scene during orchestration
- Single-scene only — audio starts and ends with the scene

**Multi-scene continuous audio (manual in editor):**
- Background music spanning multiple scenes is handled in Video Editor post-production
- User lays a continuous track over the assembled timeline
- No per-scene restart — proper timeline-based audio mixing
- This already has infrastructure: `EditorAudioTrack` type, FFmpeg audio-mix API

### Build Order

1. **Add `audioCue` field to `PipelineScene` type** — optional string field for audio direction
2. **Update Video Specialist prompt** — teach it that audio cues are available; let it decide when to include them
3. **Update scene generation** — parse and save `audioCue` from AI script output
4. **Add MiniMax generation step to orchestration chain** — after scripts, generate audio for scenes with cues
5. **Add audio cue UI to storyboard scene cards** — text field to edit/add/clear audio direction, audio player for generated track
6. **Wire per-scene audio into assembly** — FFmpeg mixes individual scene audio during stitching
7. **Test end-to-end** — Script with audio cues → MiniMax generation → preview in storyboard → assembly with audio

### Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 51 tools + orchestration chain |
| `src/lib/orchestrator/mission-persistence.ts` | Mission tracking (Firestore) |
| `src/types/video-pipeline.ts` | PipelineScene type (add audioCue here) |
| `src/lib/video/scene-generator.ts` | Scene generation (parse audioCue) |
| `src/lib/agents/content/video/specialist.ts` | Video Specialist (update prompt) |
| `src/app/api/audio/music/generate/route.ts` | MiniMax music generation API |
| `src/app/(dashboard)/content/video/components/StepStoryboard.tsx` | Storyboard UI (add audio field) |
| `src/lib/ai/cinematic-presets.ts` | 250+ cinematic preset library |
| `src/lib/ai/provider-router.ts` | Multi-provider generation router |
| `src/app/(dashboard)/mission-control/page.tsx` | Mission Control dashboard |
| `src/hooks/useMissionStream.ts` | SSE streaming hook |

---

## Hedra API Reference

- **Base URL:** `https://api.hedra.com/web-app/public` (auth: `x-api-key`)
- **Image generation:** `POST /generations { type: "image", ai_model_id, text_prompt, aspect_ratio }` — model auto-discovered from `GET /models` (type=image). Result stored as asset — fetch URL from `GET /assets?type=image`.
- **Prompt-only video:** Kling O3 Standard T2V (`b0e156da...`) — generates characters + audio natively from text prompt. Does NOT support `audio_generation` (inline TTS). Up to 15s 720p.
- **Avatar video:** Character 3 (`d1dd37a3...`) — portrait + inline TTS, up to 1080p auto duration.
- **Inline TTS (Character 3 ONLY):** `audio_generation: { type: "text_to_speech", voice_id, text }`
- **Voice cloning:** `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **87 models** (58 video, 29 image), **69 voices**
- **Image model:** `Nano Banana Pro T2I` (`96d9d17d...`) — discovered dynamically, cached 10min
- **CDN:** `imagedelivery.net` — signed URLs with `exp=` parameter (expire ~1hr)

---

## Blocked (External)

| Item | Blocker |
|------|---------|
| Facebook/Instagram | Meta Developer Portal approval |
| LinkedIn official | Marketing Developer Platform approval |
| Stripe go-live | Production API keys (bank account setup) |
