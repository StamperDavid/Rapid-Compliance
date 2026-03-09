# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 9, 2026

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
| **Video** | FUNCTIONAL — Hedra-only, Character Studio, AI Video Director |
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
A character library with two character sources and persistent identity:

**Premium Characters (user-created):**
- Created in Character Studio — upload reference images, green screen clips, full identity control
- **Voice Assignment** — ElevenLabs voice clone or custom voice (premium experience)
- If no voice assigned, Hedra assigns a default voice — always changeable later
- Used as branded characters: "SalesVelocity Hero", "PipeDrive Bully", etc.

**Hedra Library Characters (stock extras):**
- Pre-built characters from Hedra's character library with built-in voices
- Used as extras, talking heads, background actors in commercials
- Come ready to use — just give them a script and go
- Voice comes from Hedra's catalog, used via native TTS (no ElevenLabs needed)
- Voice can be swapped to any other Hedra voice or overridden with ElevenLabs

**Two TTS Generation Paths:**
- **Hedra voice** → `audio_generation: { type: "text_to_speech", voice_id, text }` — Hedra handles TTS internally
- **ElevenLabs/UnrealSpeech voice** → synthesize audio ourselves → upload as asset → `audio_id`
- Voice is fully decoupled from character image at the API level — any voice works with any character

**Character Profile Fields:**
- Name, role (hero/villain/extra/narrator), style tag (real/anime/stylized)
- Reference images — frontal, side angles, full body, action poses
- Full-body chroma key video clips — green screen footage for character consistency
- Voice assignment — ElevenLabs, Hedra, or UnrealSpeech (always changeable)
- Source — 'custom' (user-created) or 'hedra' (imported from Hedra library)

Characters are reusable across any video project. Examples:
- "SalesVelocity Hero" — anime version of David, assigned a custom ElevenLabs voice clone
- "PipeDrive Bully" — fat sweaty antagonist character, different voice
- Stock Hedra extras — background actors with Hedra built-in voices
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
| **Character Profile Service** | Firestore CRUD with source, role, styleTag, dual TTS paths | DONE — `avatar-profile-service.ts` fully reworked |
| **Character Studio UI** | Source badges, role/style selectors, Hedra character browser, voice indicators | DONE — AvatarPicker, AvatarUpload, HedraCharacterBrowser updated |
| **Video Production Agent** | `produce_video` Jasper tool — creates project, assigns characters, generates, stitches | DONE — full dispatch in `jasper-tools.ts` |
| **Hedra Prompt Translator** | Enhances visual descriptions with character role/style metadata | DONE — `hedra-prompt-translator.ts` integrated into scene-generator |
| **Per-Scene Character Assignment** | Each scene can override project-level character/voice | DONE — PipelineScene has voiceProvider, SceneEditor has picker |
| **FFmpeg Stitching Service** | Server-side clip assembly — trim, order, transitions, output final video | PARTIALLY EXISTS — `/api/video/composite` has FFmpeg, needs enhancement |
| **Review/Approval UI** | Scene-by-scene review with feedback input, per-scene regeneration, approve/reject | NEEDS REWORK — StepGeneration.tsx has progress tracking but no review workflow |
| **Brand Preference Store** | Firestore collection for learned video style preferences | FUTURE |

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
| Stock avatar seed script (`seed-hedra-avatars.ts`) | Characters created by user or imported from Hedra |

#### What Gets Kept & Fixed

| Component | Action |
|---|---|
| `hedra-service.ts` | Keep — this IS the video engine now |
| TTS synthesis | Two paths — Hedra native TTS (voice_id + text) for Hedra voices; ElevenLabs/UnrealSpeech upload for custom voices |
| Avatar/Character profiles in Firestore | Rework — expand for character studio (role, style, multi-character projects) |
| Video pipeline store (Zustand) | Keep — update for new workflow |
| Poll/status tracking | Keep — simplify for Hedra-only |
| `/api/video/tts-audio` | Keep — serves synthesized audio |
| Voice picker / voice clone | Keep — ElevenLabs voices assigned to characters |

### Implementation Order

**Phase 1: Stabilize (get videos generating again)** — COMPLETE
1. ~~Fix TTS to handle all voice providers~~ DONE
2. ~~Simplify scene generator to Hedra-only~~ DONE
3. ~~Fix character profile image URLs~~ DONE
4. ~~Verify end-to-end: script → Hedra generation → poll → video URL returned~~ DONE

**Phase 2: Character Studio** — COMPLETE
1. ~~Expand character profile schema (source, role, styleTag, hedraCharacterId)~~ DONE
2. ~~Build character management UI (source badges, role/style selectors)~~ DONE
3. ~~Dual TTS paths (Hedra native + ElevenLabs upload)~~ DONE
4. ~~Hedra character browser stays for stock extras~~ DONE

**Phase 3: AI Video Director** — COMPLETE (core), remaining: stitching enhancement + review UI
1. ~~Per-scene character assignment (scene-level avatarId/voiceId/voiceProvider)~~ DONE
2. ~~Hedra prompt translator (character metadata → enhanced Hedra prompts)~~ DONE
3. ~~produce_video Jasper tool (full pipeline: create → cast → generate)~~ DONE
4. ~~Updated create_video/generate_video/get_video_status descriptions~~ DONE
5. FFmpeg stitching service enhancement — NEXT
6. Review/approval workflow UI — NEXT
7. Brand preference memory — FUTURE

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
| `src/lib/video/hedra-service.ts` | Hedra Character-3 API — sole video generation engine, dual TTS paths |
| `src/lib/video/scene-generator.ts` | Scene generation — per-scene character overrides, prompt translation |
| `src/lib/video/avatar-profile-service.ts` | Character Studio — source, role, styleTag, dual TTS metadata |
| `src/lib/video/hedra-prompt-translator.ts` | Enhances visual descriptions with character metadata for Hedra |
| `src/types/video-pipeline.ts` | PipelineScene with per-scene voiceProvider field |
