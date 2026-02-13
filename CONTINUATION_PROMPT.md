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

### What Was Done This Session

**Fixed Jasper video routing:**
- Removed generic `'video'` and `'tutorial'` from YouTube specialist's `triggerPhrases` in `feature-manifest.ts` — YouTube no longer hijacks all video requests
- Added `create_video` tool to Jasper (`jasper-tools.ts`) — accepts description, provider, type, duration, aspect ratio; creates a project in the video library and calls the video generation service
- Added `get_video_status` tool to Jasper — checks generation progress and returns video URL when ready
- HeyGen is the default video provider (auto-select order: HeyGen > Sora > Runway)

**Rewired video service to use API Key Service:**
- Replaced all 17 `process.env` API key reads in `video-service.ts` with `getVideoProviderKey()` calls
- Video provider keys now come from Firestore via `apiKeyService.getServiceKey()` (Settings > API Keys page), matching the pattern used by ElevenLabs/Unreal Speech voice providers
- Added missing `case 'sora'` to `api-key-service.ts` (falls back to OpenAI key)
- Updated `VIDEO_SERVICE_STATUS.isAvailable` to `true`

**Added Academy section:**
- New "Academy" navigation section in sidebar (`AdminSidebar.tsx`) with Tutorials, Courses, Certifications
- Added `'academy'` to `NavigationCategory` type in `unified-rbac.ts`
- Created Academy page at `/academy` with category filtering, video player, and tutorial grid (reads from Firestore `academy_tutorials` collection)

### Files Changed (Uncommitted)
```
M  src/components/admin/AdminSidebar.tsx        (Academy nav section)
M  src/lib/api-keys/api-key-service.ts          (Added sora case)
M  src/lib/orchestrator/feature-manifest.ts     (YouTube trigger phrases)
M  src/lib/orchestrator/jasper-tools.ts         (create_video + get_video_status tools)
M  src/lib/video/video-service.ts               (API keys from Firestore, not process.env)
M  src/types/unified-rbac.ts                    (academy NavigationCategory)
A  src/app/(dashboard)/academy/page.tsx          (Academy page)
```

---

## PRIMARY TASK: Video Production Pipeline

### Goal
Tell Jasper "create a video on how to set up an email campaign" and receive a polished, professional video in the video library — with full review and approval at every step.

### Architecture: Scene-Based HeyGen with Approval Flow

**Provider:** HeyGen (default) via API. HeyGen is the rendering engine — videos are generated through their API, downloaded, and stored in our Firebase Storage. We own the files.

**Why HeyGen:** Avatar IV model produces photorealistic presenters with natural lip sync, gestures, and micro-expressions. 1080p/4K output. Ideal for tutorials, explainers, and product demos. Cost: ~$0.01/second.

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
| Jasper `create_video` tool | FUNCTIONAL | `src/lib/orchestrator/jasper-tools.ts` |
| Jasper `get_video_status` tool | FUNCTIONAL | `src/lib/orchestrator/jasper-tools.ts` |
| Video Studio UI (brief form) | FUNCTIONAL | `src/app/(dashboard)/content/video/page.tsx` |
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
| `src/app/api/video/storyboard/route.ts` | POST — generate storyboard from brief |
| `src/app/api/video/generate/route.ts` | POST — start video generation from storyboard |

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
