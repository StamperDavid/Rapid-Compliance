# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 8, 2026

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **54 AI agents** (46 swarm + 6 standalone + 2 variants) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **179 physical routes**, **343 API endpoints**, **~340K lines of TypeScript**
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
| **Email** | REAL — SendGrid/Resend/SMTP, CAN-SPAM |
| **Voice** | REAL — Twilio/Telnyx, ElevenLabs TTS |
| **Video** | BROKEN — See Video System Overhaul below |
| **AI Gateway** | REAL — OpenRouter (100+ models) |
| **Apollo** | REAL — Free-tier org search, enrichment |
| **SEO/Growth** | REAL — DataForSEO, Serper, keyword tracking, competitor monitoring |

---

## PRIORITY 1: Video System Overhaul

### Background

The video system was reworked to support multiple engines (HeyGen → Kling, Hedra, Runway, Sora) with an intelligent scene classifier that routes each scene to the best engine. **This system is currently broken and unusable.** The multi-engine approach introduced 3 critical bugs that prevent any video from being generated:

1. **TTS only handles ElevenLabs** — `scene-generator.ts` skips audio synthesis when `voiceProvider` is anything other than `'elevenlabs'`, causing all avatar scenes to fail silently
2. **Stock avatar image URLs expired** — Hedra signed URLs in the seed script expired March 6, 2026
3. **`preferredEngine` override is absolute** — stock avatars force `preferredEngine: 'hedra'`, bypassing the intelligent scene classifier for ALL scene types

### Decision: Hedra-Only Engine + AI Video Director

**Owner decision (March 8, 2026):** Strip out the multi-engine approach. Hedra is the sole video generation engine. All other engines (Kling, Runway, Sora) are removed.

**Rationale:**
- Hedra can generate full character-in-action scenes (anime characters fighting, walking through environments, etc.) — not just talking heads
- Hedra produces the quality the owner wants (confirmed with actual test videos)
- Multiple engines created complexity without value — broken TTS routing, confusing engine selection, maintenance burden
- The real gap isn't the engine — it's the orchestration, stitching, and iterative review workflow

### New Architecture: Hedra + Character Studio + AI Video Director

#### Character Studio
A character library where reusable characters are defined with persistent identity:

- **Character Profile** — name, role, description, style tag (real/anime/stylized)
- **Reference Images** — frontal, side angles, full body, action poses (uploaded directly to our system, NOT pulled from Hedra)
- **Full-Body Chroma Key Video Clips** — 360° green screen footage uploaded to the platform, used as source material for character consistency
- **Voice Assignment** — ElevenLabs voice locked to the character (consistent across all scenes)
- **No Hedra character browser/sync** — characters are created and managed entirely within SalesVelocity.ai

Characters are reusable across any video project. Examples:
- "SalesVelocity Hero" — anime version of David, assigned a specific ElevenLabs voice
- "PipeDrive Bully" — fat sweaty antagonist character, different voice
- Future: full library of actors for various commercial/narrative projects

#### Video Production Agent (New Jasper Tool/Agent)
Jasper delegates video production the same way he delegates everything else. The Video Production Agent:

1. **Receives the script** from the Script Writer agent — complete with scene descriptions, dialogue, environment details, lighting cues, emotional direction
2. **Casts characters** — pulls the right character profiles from the Character Studio based on the script's character assignments
3. **Translates script → Hedra prompts** — each scene's full description (environment, lighting, mood, camera angle, character action, expression) is faithfully translated into an optimized Hedra API prompt
4. **Generates scenes via Hedra** — submits each scene as a generation job (5-second clips per Hedra call)
5. **Stitches clips** — uses FFmpeg server-side to assemble clips in script order with transitions
6. **Submits for review** — presents the assembled cut to the user
7. **Handles feedback** — user says "Scene 3 lighting is wrong, character facing wrong direction" → agent adjusts the Hedra prompt for that scene, regenerates, re-stitches, resubmits
8. **Does NOT auto-reject** — the agent never decides something is unusable on its own; it asks for approval before making corrections

#### Brand Preference Memory
Over time, the Video Production Agent learns the brand's video content preferences:
- Lighting styles that get approved vs rejected
- Camera angles that work for different scene types
- Prompt patterns that produce consistent results
- Style corrections that are always requested

Stored per-project or globally, referenced during prompt generation.

#### Technical Components Needed

| Component | Description | Status |
|---|---|---|
| **Character Profile Service** | Firestore CRUD for character profiles (replaces avatar-profile-service.ts) | NEEDS REWORK — existing avatar profile service is close but needs character-specific fields (role, style tag, multi-character support) |
| **Character Studio UI** | Upload reference images, green screen clips, assign voice, tag style | NEEDS REWORK — existing AvatarPicker needs to become a full character management UI |
| **Video Production Agent** | New Jasper agent — receives script, casts characters, prompts Hedra, stitches, manages review cycle | NEW |
| **Hedra Prompt Translator** | Converts rich scene descriptions (environment, lighting, mood, action) into optimized Hedra API prompts | NEW |
| **FFmpeg Stitching Service** | Server-side clip assembly — trim, order, transitions, output final video | PARTIALLY EXISTS — `/api/video/composite` has FFmpeg, but needs real stitching logic |
| **Review/Approval UI** | Scene-by-scene review with feedback input, per-scene regeneration, approve/reject | NEEDS REWORK — StepGeneration.tsx has progress tracking but no review workflow |
| **Brand Preference Store** | Firestore collection for learned video style preferences | NEW |
| **Jasper Video Tools** | New tool definitions in jasper-tools.ts for video production delegation | NEW |

#### What Gets Removed

| Component | Reason |
|---|---|
| Kling integration (`fal-kling-service.ts`) | Hedra is the sole engine |
| Runway integration (in `video-service.ts`) | Hedra is the sole engine |
| Sora integration (in `video-service.ts`) | Hedra is the sole engine |
| HeyGen backward-compat polling | Legacy, already dead |
| Multi-engine scene classifier (`selectEngineForScene`, `classifyScene`) | Single engine, no routing needed |
| Engine registry (`engine-registry.ts`) | Single engine |
| Engine selector UI (`EngineSelector.tsx`) | Single engine |
| Hedra character browser/sync (`sync-hedra/`, `hedra-characters/`) | Characters managed locally |
| Stock avatar seed script (`seed-hedra-avatars.ts`) | Characters created by user |

#### What Gets Kept & Fixed

| Component | Action |
|---|---|
| `hedra-service.ts` | Keep — this IS the video engine now |
| TTS synthesis | Fix — must handle ElevenLabs (primary) and UnrealSpeech; remove Hedra voice provider concept |
| Avatar/Character profiles in Firestore | Rework — expand for character studio (role, style, multi-character projects) |
| Video pipeline store (Zustand) | Keep — update for new workflow |
| Poll/status tracking | Keep — simplify for Hedra-only |
| `/api/video/tts-audio` | Keep — serves synthesized audio |
| Voice picker / voice clone | Keep — ElevenLabs voices assigned to characters |

### Implementation Order

**Phase 1: Stabilize (get videos generating again)**
1. Fix TTS to handle all voice providers (ElevenLabs as universal TTS engine)
2. Simplify scene generator to Hedra-only (remove dead engine code)
3. Fix character profile image URLs
4. Verify end-to-end: script → Hedra generation → poll → video URL returned

**Phase 2: Character Studio**
1. Expand character profile schema (role, style tag, project assignments)
2. Build character management UI (upload images, clips, assign voice)
3. Multi-character per project support
4. Character consistency validation

**Phase 3: AI Video Director**
1. Video Production Agent (new Jasper agent)
2. Hedra prompt translator (script scene → optimized Hedra prompt)
3. FFmpeg stitching service (clip assembly with transitions)
4. Review/approval workflow UI
5. Per-scene feedback and regeneration
6. Brand preference memory

**Phase 4: Polish**
1. Video library integration (save completed projects)
2. Template system (reusable scene structures)
3. Multi-character scene compositing (separate renders + layer)

---

## Open Items — Launch Punch List

See `docs/single_source_of_truth.md` "Open Items" section for the full punch list.

**Summary:** 9 Tier 1 (critical code issues), 8 Tier 2 (functional gaps), 7 Tier 3 (external blockers), 6 Tier 4 (tech debt).

### Blocked (External)

| Item | Blocker |
|------|---------|
| Facebook/Instagram | Meta Developer Portal approval |
| LinkedIn official | Marketing Developer Platform approval |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc (2000+ lines) |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 47 function-calling tools |
| `src/lib/video/hedra-service.ts` | Hedra Character-3 API — sole video generation engine |
| `src/lib/video/scene-generator.ts` | Scene generation router — NEEDS REWORK for Hedra-only |
| `src/lib/video/avatar-profile-service.ts` | Character profiles — NEEDS REWORK for Character Studio |
