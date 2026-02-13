# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 12, 2026

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **160 physical routes**, **231 API endpoints**, **430K+ lines of TypeScript**
- **NOT yet deployed to production** — everything is dev branch only

### Code Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES (production build succeeds)**

### Recently Completed
- Jasper video routing fixed — `create_video` and `get_video_status` tools working, HeyGen default provider
- Video service rewired to pull API keys from Firestore (not `process.env`)
- Academy section added (`/academy` page, sidebar nav)
- **Multi-engine video selector implemented** — per-scene engine dropdown in Approval step (HeyGen/Runway/Sora selectable, Kling/Luma coming-soon)
- Engine registry with cost metadata, provider-status API, scene-generator multi-engine routing
- `heygenVideoId` → `providerVideoId` refactor across all types and components

---

## PRIMARY TASK: Video Production Pipeline

### Goal
Tell Jasper "create a video on how to set up an email campaign" and receive a polished, professional video in the video library — with full review and approval at every step.

### Architecture: Scene-Based HeyGen with Approval Flow

**Default Provider:** HeyGen via API for avatar-based content. HeyGen is the rendering engine for talking-head and presenter videos — generated through their API, downloaded, and stored in our Firebase Storage. We own the files.

**Why HeyGen for avatars:** Avatar IV model produces photorealistic presenters with natural lip sync, gestures, and micro-expressions. 1080p/4K output. Ideal for tutorials, explainers, and product demos. Cost: ~$0.01/second.

### Multi-Engine Orchestrator (Phase 1 Complete)

The system supports multiple video generation engines. Users can select a video engine per scene during the Approval step. Phase 1 (manual selection with availability status) is complete. Phase 2 (AI-powered auto-selection) is planned.

#### Supported Engines

| Engine | Strengths | Best For |
|--------|-----------|----------|
| **HeyGen** | Photorealistic avatars, lip sync, gestures | Talking heads, presenters, tutorials with a host |
| **Runway (Gen-3/Gen-4 Turbo)** | Style consistency, mature API, camera control | Stylized content, consistent multi-scene videos, transitions |
| **Luma Dream Machine (Ray2)** | Realistic motion, precise physics, camera control | Tutorials, product demos, UI walkthroughs |
| **Kling (v2/v2.1)** | Natural human motion/expression, competitive pricing | People-centric scenes, gestures, talking heads (non-avatar) |
| **OpenAI Sora 2** | Best prompt comprehension, handles complex descriptions | Conceptual scenes, nuanced/abstract prompts |

#### Auto-Selection Logic

The AI agent analyzes each scene and selects the recommended engine based on weighted factors:

| Factor | Influence |
|--------|-----------|
| Scene type (talking head, b-roll, demo, etc.) | Primary driver |
| Desired style (realistic vs. stylized) | Narrows options |
| Human presence & motion complexity | Favors Kling |
| Physics/product interaction | Favors Luma |
| Prompt complexity / abstraction | Favors Sora |
| Style consistency across scenes | Favors Runway |
| Avatar requirement (lip-synced presenter) | Favors HeyGen |
| Cost sensitivity (user preference) | Compares pricing |
| Speed priority | Compares generation times |

User can configure a **cost mode** that influences auto-selection:
- **Quality First** — best engine per scene regardless of cost
- **Balanced** — best engine unless a cheaper one is within ~90% quality match
- **Budget** — cheapest engine that meets a minimum quality threshold

#### User Override + Cost Preview

1. AI presents storyboard with recommended engine per scene + cost estimate in **actual USD**
2. User can swap the engine on any scene via dropdown
3. On swap, the **cost preview updates in real-time** showing the delta ("this change adds $0.20" / "this saves $0.15")
4. User confirms and generation begins

**Pricing model:** Actual currency (USD) displayed — no credits abstraction, no markup on usage costs. Pass-through pricing with full transparency.

#### Live Cost Dashboard (Session Tracker)

Every action that costs money shows the price **before** the user confirms it. A running session cost meter is always visible during generation:

```
Session: Product Tutorial Video
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Original Estimate:    $0.85
Current Spent:        $1.15  ██████████████░░░░
  ├─ Scene 1 (Kling)     $0.42  ✓
  ├─ Scene 2 (Luma)      $0.30  ✓
  ├─ Scene 2 regen       $0.30  ✓  ← regeneration
  └─ Scene 3 (Runway)    $0.13  ⏳ generating...
Projected Total:      $1.28
                      ──────
Over estimate by:     +$0.43 (1 regeneration)
```

Key behaviors:
- **Pre-generation:** Show per-scene cost for every available engine
- **During generation:** Running total of actual spend
- **On regeneration:** Cost added to session total, meter ticks up, user sees progression
- **On engine swap:** Immediate cost delta preview before confirming
- **Session summary:** Final cost breakdown by engine, scene, and regeneration count

#### Cost Calculation

All engines price on deterministic inputs known at storyboard time: duration (seconds), resolution (720p/1080p/4K), quality tier (standard/pro), and model version. No variable complexity surcharge — cost is fully calculable before generation.

Approximate pricing (store as config, not hardcoded — rates change):

| Engine | ~Cost per 5s clip | Notes |
|--------|-------------------|-------|
| HeyGen | ~$0.05 | Avatar-based, cheapest for talking head |
| Runway Gen-3 Turbo | ~$0.25 | Fast, cheapest Runway tier |
| Runway Gen-3 Alpha | ~$0.50 | Higher quality |
| Luma Dream Machine | ~$0.30 | Per generation |
| Kling Standard | ~$0.10-0.20 | Very competitive |
| Kling Pro | ~$0.30-0.50 | Better quality |
| Sora | ~$0.50+ | Pricing varies |

#### Regeneration Intelligence

Track historical success rates per engine over time. An engine that is cheaper per-clip but needs multiple regeneration attempts may cost more than a pricier engine that nails it first try. Over time, auto-selection factors in **average attempts per engine per scene type** for more accurate cost projections.

#### Architecture Notes

- All engines take the same basic inputs (text prompt, optional reference image, duration, aspect ratio) and produce the same output (MP4)
- Orchestration layer normalizes prompt format per engine (each has different prompt best practices)
- API auth managed per provider via existing `api-key-service.ts`
- Async generation + polling is standard across all engines
- Output funnels into the existing assembly pipeline regardless of source engine
- Existing scene-based pipeline already decomposes videos — engine selection is a per-scene property, not per-video

### The Flow

```
1. USER → JASPER (natural language request)
   "Create a video on how to set up an email campaign"
        ↓
2. JASPER decomposes the request:
   - Identifies video type (platform tutorial)
   - Determines which pages/routes are involved
   - Identifies asset requirements (screenshots for tutorials)
   - Delegates to planning agents
        ↓
3. PRE-PRODUCTION (planning agents):
   a. Screenshot Service captures actual UI pages via Puppeteer/Playwright
      - /outbound/campaigns (list view)
      - /outbound/campaigns/new (editor)
      - etc.
   b. Video Specialist writes scene-by-scene script
   c. Avatar + voice recommendations selected
   d. Draft storyboard assembled with real screenshots attached to each scene
        ↓
4. APPROVAL (Video Studio UI at /content/video):
   - User reviews every scene: script text, screenshot, avatar, voice
   - User can EDIT individual scenes (change script, swap screenshot, adjust timing)
   - User can reorder or delete scenes
   - User selects avatar and voice from HeyGen library
   - Nothing goes to HeyGen until user clicks "Approve & Generate"
        ↓
5. GENERATION (HeyGen API, scene-by-scene):
   - Each approved scene → separate HeyGen API call
   - Avatar presents script with screenshot as background per scene
   - Progress tracking in Video Studio
   - Individual scene re-generation if quality is off (not entire video)
        ↓
6. ASSEMBLY + REVIEW:
   - Scenes stitched together (ffmpeg.wasm or server-side ffmpeg)
   - Clean cuts or fade transitions between scenes
   - Final video stored in video library (Firebase Storage)
   - User previews the complete video
        ↓
7. POST-PRODUCTION (in-house editor):
   - If a scene needs fixing: edit script → re-generate just that scene → re-stitch
   - Basic editing: trim, reorder scenes, adjust transitions
   - Scene-level granularity — surgical control over quality
```

### What's Built vs What's Needed

#### Already Working
| Component | Status | Location |
|-----------|--------|----------|
| Video Specialist (script/storyboard generation) | FUNCTIONAL | `src/lib/agents/content/video/specialist.ts` |
| Director Service (storyboard from brief) | FUNCTIONAL | `src/lib/video/engine/director-service.ts` |
| HeyGen API integration (generate video) | FUNCTIONAL (needs API key) | `src/lib/video/video-service.ts` |
| Sora API integration | FUNCTIONAL (needs API key) | `src/lib/video/video-service.ts` |
| Runway API integration | FUNCTIONAL (needs API key) | `src/lib/video/video-service.ts` |
| Luma Dream Machine integration | NOT STARTED | Marked coming-soon in engine registry |
| Kling integration | NOT STARTED | Marked coming-soon in engine registry |
| Multi-engine selector (per-scene) | FUNCTIONAL | `EngineSelector.tsx`, `engine-registry.ts`, `scene-generator.ts` |
| Provider status API (API key check) | FUNCTIONAL | `src/app/api/video/provider-status/route.ts` |
| Engine registry (cost/metadata) | FUNCTIONAL | `src/lib/video/engine-registry.ts` |
| Scene generator (multi-engine routing) | FUNCTIONAL | `src/lib/video/scene-generator.ts` |
| Jasper `create_video` tool | FUNCTIONAL | `src/lib/orchestrator/jasper-tools.ts` |
| Jasper `get_video_status` tool | FUNCTIONAL | `src/lib/orchestrator/jasper-tools.ts` |
| Video Studio UI (7-step pipeline) | FUNCTIONAL | `src/app/(dashboard)/content/video/` components |
| Storyboard preview panel | FUNCTIONAL | `src/app/(dashboard)/content/video/page.tsx` |
| API Keys page (HeyGen, Runway, Sora entries) | FUNCTIONAL | `src/app/(dashboard)/settings/api-keys/page.tsx` |
| TTS voice generation (ElevenLabs/Unreal Speech) | FUNCTIONAL | `src/lib/voice/tts/` |
| Video library Firestore storage | FUNCTIONAL | `video-service.ts` (projects, templates) |
| Academy page (tutorial video library) | FUNCTIONAL | `src/app/(dashboard)/academy/page.tsx` |

#### Needs to Be Built

| Component | Priority | Description |
|-----------|----------|-------------|
| **Screenshot capture tool** | HIGH | Puppeteer/Playwright service that captures UI pages at specified routes. Jasper needs a `capture_screenshot` tool. For platform tutorials, the video must show real UI — not AI approximations. |
| **Scene-level editing in Video Studio** | HIGH | Edit script per scene, reorder scenes, delete scenes in the storyboard preview. Currently can only regenerate from scratch. |
| **Avatar picker** | HIGH | Fetch HeyGen avatars via `listHeyGenAvatars()` (API exists) and display in Video Studio for user selection. |
| **Voice picker** | HIGH | Fetch HeyGen voices via `listHeyGenVoices()` (API exists) and display in Video Studio for user selection. |
| **Storyboard → HeyGen bridge** | HIGH | Convert approved storyboard into scene-by-scene HeyGen API calls. Currently the "Start Generation" button calls the mock render pipeline instead of `video-service.ts`. |
| **UI action highlighting in screenshots** | HIGH | During tutorial scene descriptions, highlight/annotate the relevant buttons and UI elements in screenshots so viewers can follow along. |
| **Scene-by-scene generation** | MEDIUM | Generate each scene as a separate HeyGen API call (avatar + script + screenshot background). Track progress per scene. Allow re-generation of individual scenes. |
| **Scene stitching** | MEDIUM | Assemble individual scene videos into final video. ffmpeg.wasm (client-side) or server-side ffmpeg. Handle transitions (cuts, fades). |
| **Video editor (scene manager)** | MEDIUM | Timeline view of scenes. Preview each scene. Reorder, trim, re-generate individual scenes. Not a full NLE — a scene manager with surgical re-generation. |
| **Jasper video producer logic** | MEDIUM | Jasper's reasoning layer for decomposing video requests: identify type (tutorial vs promo vs explainer), determine required assets, delegate to correct agents, assemble the draft. |
| **AI auto-selection logic** | MEDIUM | AI agent that analyzes scene characteristics and recommends optimal engine per scene. Phase 2 of multi-engine orchestrator. |
| **Luma Dream Machine API integration** | MEDIUM | Add Luma Ray2 to `video-service.ts` following existing HeyGen/Sora/Runway pattern. Unwire coming-soon status in engine registry. |
| **Kling API integration** | MEDIUM | Add Kling v2 to `video-service.ts` following existing pattern. Unwire coming-soon status in engine registry. |
| **Engine pricing config (Firestore)** | LOW | Move pricing from `engine-registry.ts` constants to Firestore config so rates can be updated without deploys. |
| **Live cost dashboard** | MEDIUM | Session-level cost tracker showing per-scene spend, regeneration costs, running total — all in actual USD. Phase 2 feature. |
| **Engine swap cost delta preview** | LOW | On engine change, show "+$0.20" / "-$0.15" delta before confirming. Currently shows absolute cost per engine. |

### Video Production Pipeline — Key Files

| File | Purpose |
|------|---------|
| `src/lib/video/video-service.ts` | HeyGen/Sora/Runway API integrations (API keys from Firestore) |
| `src/lib/video/engine/director-service.ts` | Storyboard generation from video briefs |
| `src/lib/video/engine/render-pipeline.ts` | Render orchestration (currently ALL MOCKED — needs to be rewired to video-service.ts) |
| `src/lib/video/engine/stitcher-service.ts` | Post-production assembly (TTS works, video stitching stubbed) |
| `src/lib/video/engine/multi-model-picker.ts` | Provider routing logic (real logic, routes to mocked endpoints) |
| `src/lib/video/engine/style-guide-integrator.ts` | Brand style analysis (real CSS/color analysis, text-only output) |
| `src/lib/video/video-job-service.ts` | Video job tracking in Firestore |
| `src/lib/agents/content/video/specialist.ts` | Video Specialist agent (scripts, storyboards, SEO — all functional, text-only) |
| `src/lib/agents/builder/assets/specialist.ts` | Asset Generator (SHELL — generates prompts, no actual image generation) |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's tools including create_video, get_video_status |
| `src/lib/orchestrator/feature-manifest.ts` | 11 specialists + trigger phrases |
| `src/app/(dashboard)/content/video/page.tsx` | Video Studio UI |
| `src/app/(dashboard)/content/video/components/EngineSelector.tsx` | Per-scene engine dropdown with availability states |
| `src/app/(dashboard)/content/video/components/StepApproval.tsx` | Storyboard review with engine selection and dynamic cost |
| `src/app/(dashboard)/content/video/components/StepGeneration.tsx` | Multi-engine scene generation with progress tracking |
| `src/lib/video/engine-registry.ts` | Engine metadata, costs, integration status, helper functions |
| `src/lib/video/scene-generator.ts` | Multi-engine scene router (HeyGen/Runway/Sora dispatch) |
| `src/hooks/useVideoProviderStatus.ts` | Client hook for provider API key status |
| `src/app/api/video/provider-status/route.ts` | GET — check which engines have configured API keys |
| `src/app/api/video/storyboard/route.ts` | POST — generate storyboard from brief |
| `src/app/api/video/generate/route.ts` | POST — start video generation from storyboard |
| `src/app/api/video/generate-scenes/route.ts` | POST — generate scenes with per-scene engine selection |
| `src/app/api/video/regenerate-scene/route.ts` | POST — regenerate single scene with engine |

### Important Architecture Notes

**Render Pipeline is fully mocked.** Every provider call in `render-pipeline.ts` returns `Promise.resolve({ jobId: 'mock_123' })`. The real HeyGen/Sora/Runway integrations are in `video-service.ts`. The "Start Generation" button in Video Studio calls the mock pipeline, not the real service. This needs to be rewired.

**Asset Generator is a shell.** `src/lib/agents/builder/assets/specialist.ts` claims to generate logos, banners, and graphics but returns placeholder URLs. No image generation API is integrated. For video thumbnails and marketing graphics, we need a real image generation integration (DALL-E, Flux, etc.) — but this is separate from the video pipeline.

**No ffmpeg installed.** Video stitching requires ffmpeg. Options: `ffmpeg.wasm` (runs in browser, ~30MB), server-side ffmpeg on a Cloud Run worker, or using HeyGen's multi-scene API to avoid stitching entirely.

---

## Known Issues

| Issue | Details |
|-------|---------|
| 3 service tests failing | Missing Firestore composite indexes. Fix: `firebase login --reauth` then `firebase deploy --only firestore:indexes` |
| Render pipeline fully mocked | `render-pipeline.ts` returns fake responses. Real integrations are in `video-service.ts` |
| Asset Generator is a shell | Returns placeholder URLs, no actual image generation |
| No screenshot capture service | Needed for platform tutorial videos |
| Outbound webhooks are scaffolding | Settings UI exists but backend dispatch not implemented |
| Playbook missing API endpoints | `/api/playbook/list` and `/api/playbook/{id}/metrics` return 404 |

---

## Key Files (General)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestration/event-router.ts` | Declarative rules engine — 25+ event rules |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge store (Firestore-backed) |
| `src/lib/api-keys/api-key-service.ts` | Centralized API key retrieval from Firestore |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 36+ function-calling tools |
| `src/lib/orchestrator/feature-manifest.ts` | 11 specialists + capabilities + trigger phrases |
| `vercel.json` | 7 cron entries for autonomous operations |
