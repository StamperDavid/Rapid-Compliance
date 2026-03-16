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
- "Content Generator Hub" with tabs: Video | Image Generator | Editor | Library | Voice Lab
- Constant renamed from `VIDEO_TABS` to `CONTENT_GENERATOR_TABS`

**Backend**:
- 7 API routes at `/api/studio/*` (generate, status polling, providers, presets CRUD, characters CRUD, cost)
- Provider router: Fal.ai (Flux), Google Imagen 3, OpenAI DALL-E 3, Kling 3.0 — auto-selection based on style
- Cost tracker logging to Firestore per generation
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

### What Needs to Change

**Mission Control UI** (`src/app/(dashboard)/mission-control/`):
- Rebuild the layout to match the plan → steps → outputs hierarchy
- Each step must show: delegated agent name, task description, status, output preview, link to full output
- Clicking a mission expands to show all steps
- Clicking a step navigates to the output (storyboard page, blog editor, etc.)
- The existing 3-panel layout, SSE streaming, approval gates, and agent avatars are KEPT

**Jasper Tools** (`src/lib/orchestrator/jasper-tools.ts`):
- `produce_video` needs to orchestrate the full chain (research → strategy → script → cinematic → thumbnails) instead of jumping straight to decompose
- Each delegation step must write to mission-persistence so Mission Control tracks it
- The final step should link to the storyboard page, not navigate directly

**New: Cinematic Director delegation** — After script generation, Jasper delegates cinematic config selection per scene. This could be a tool call that uses `getRecommendedPresets()` or an AI agent that picks settings based on scene content.

**New: Auto-thumbnail generation** — After cinematic configs are set, automatically generate preview images for each scene via `/api/studio/generate` and save URLs to `scene.screenshotUrl`.

**Dashboard Links** (`mission-control/_components/dashboard-links.ts`):
- Update mappings to include the new routes:
  - `produce_video` / `create_video` → `/content/video` (storyboard step)
  - `create_image` → `/content/image-generator`
  - All existing mappings stay

### Existing Infrastructure (DO NOT REBUILD)

These are all production-ready and just need the UX/orchestration upgrades:

| Component | Status | File |
|-----------|--------|------|
| Mission Firestore persistence | ✅ Working | `src/lib/orchestrator/mission-persistence.ts` |
| Mission CRUD API (create, list, get) | ✅ Working | `src/app/api/orchestrator/missions/` |
| SSE streaming for real-time updates | ✅ Working | `src/app/api/orchestrator/missions/[id]/stream/` |
| Mission cancellation | ✅ Working | `src/app/api/orchestrator/missions/[id]/cancel/` |
| Approval gates | ✅ Working | `src/app/api/orchestrator/approvals/` |
| `useMissionStream` SSE hook | ✅ Working | `src/hooks/useMissionStream.ts` |
| MissionTimeline component | ✅ Working | `mission-control/_components/MissionTimeline.tsx` |
| MissionSidebar component | ✅ Working | `mission-control/_components/MissionSidebar.tsx` |
| ApprovalCard component | ✅ Working | `mission-control/_components/ApprovalCard.tsx` |
| AgentAvatar component | ✅ Working | `mission-control/_components/AgentAvatar.tsx` |
| Dashboard link mappings | ✅ Working | `mission-control/_components/dashboard-links.ts` |
| Jasper tool step tracking | ✅ Working | `src/lib/orchestrator/jasper-tools.ts` (fire-and-forget) |
| E2E tests | ✅ Passing | `tests/e2e/mission-control.spec.ts` |

### Build Order (ALL COMPLETE)

1. **Mission Control UI overhaul** — DONE. Rich output previews (research chips, strategy angles, thumbnail strips, cinematic grids), type-specific detail rendering, new agent avatars, dynamic review links.
2. **Jasper `produce_video` orchestration chain** — DONE. 6-step sequential chain with mission step tracking per step.
3. **Cinematic Director tool** — DONE. LLM-powered per-scene cinematography selection (shot type, lighting, camera, film stock, art style, focal length, composition).
4. **Auto-thumbnail generation** — DONE. Generates preview images per scene via provider-router with cinematic presets, saves to `scene.screenshotUrl`.
5. **Dashboard link updates** — DONE. New tool→route mappings for all orchestration steps + human-readable step names.
6. **Test end-to-end** — TODO: Give Jasper a vague prompt, verify the full chain executes and Mission Control shows all steps with clickable outputs.

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 51 function-calling tools |
| `src/lib/orchestrator/mission-persistence.ts` | Mission tracking (Firestore) |
| `src/lib/video/scene-generator.ts` | Hedra scene generation (uses cinematicConfig) |
| `src/lib/video/hedra-prompt-agent.ts` | AI prompt optimizer (includes cinematicConfig) |
| `src/lib/ai/cinematic-presets.ts` | 250+ cinematic preset library |
| `src/lib/ai/provider-router.ts` | Multi-provider generation router |
| `src/types/creative-studio.ts` | Creative Studio types (presets, generations, characters) |
| `src/types/video-pipeline.ts` | Video pipeline types (includes CinematicConfig per scene) |
| `src/components/studio/CinematicControlsPanel.tsx` | Reusable cinematic controls |
| `src/app/(dashboard)/content/video/components/StudioModePanel.tsx` | Full RenderZero UI (step 1 of pipeline) |
| `src/app/(dashboard)/content/video/components/StepStoryboard.tsx` | Storyboard with per-scene cinematic controls |
| `src/app/(dashboard)/mission-control/page.tsx` | Mission Control dashboard |
| `src/hooks/useMissionStream.ts` | SSE streaming hook for real-time mission updates |

---

## Hedra API Reference

- **Base URL:** `https://api.hedra.com/web-app/public` (auth: `x-api-key`)
- **Prompt-only:** Kling O3 Standard T2V — speaking characters from text prompt, up to 15s 720p
- **Avatar:** Character 3 — portrait + inline TTS, up to 1080p auto duration
- **Inline TTS:** `audio_generation: { type: "text_to_speech", voice_id, text }`
- **Voice cloning:** `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **87 models** (58 video, 29 image), **69 voices**

---

## Blocked (External)

| Item | Blocker |
|------|---------|
| Facebook/Instagram | Meta Developer Portal approval |
| LinkedIn official | Marketing Developer Platform approval |
| Stripe go-live | Production API keys (bank account setup) |
