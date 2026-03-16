# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 15, 2026

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
| **Video** | FIXED (March 15) — Inline `audio_generation` replaces 3-step TTS. Kling O3 T2V confirmed producing speaking characters. Character 3 for avatar mode with inline TTS. See Campaign Orchestration Pipeline below. |
| **AI Gateway** | REAL — OpenRouter (100+ models) |
| **Apollo** | REAL — Free-tier org search, enrichment |
| **SEO/Growth** | REAL — DataForSEO, Serper, keyword tracking, competitor monitoring |
| **Image Generation** | PARTIAL — DALL-E 3 service exists (`image-generation-service.ts`), no UI, not routed through OpenRouter |

---

## VIDEO SYSTEM — FIXED (March 15, 2026)

### What Was Fixed
- **hedra-service.ts**: Replaced 3-step TTS dance (generate → poll → attach `audio_id`) with inline `audio_generation` parameter. Single API call, Hedra handles TTS server-side.
- **Kling O3 T2V confirmed working**: Produces speaking characters from prompt alone (verified by owner). No portrait needed for prompt-only mode.
- **Character 3 avatar mode**: Uses portrait + inline TTS for controlled lip-sync with exact script.
- **hedra-node SDK rejected**: Outdated (v0.1.2), points at legacy `mercury.dev.dream-ai.com`, missing model/resolution/duration control. Direct API is superior.
- **Removed ~100 lines** of dead TTS polling code (`generateHedraTTS`, `waitForTTSCompletion`).

### Hedra API — Corrected Understanding
- **Base URL:** `https://api.hedra.com/web-app/public` (generation, assets, models, voices)
- **Elements API:** `https://api.hedra.com/web-app/elements` (read-only via API key — returns 156 stock characters/styles/environments/outfits)
- **Element creation:** Requires JWT session auth, NOT available via API key. Custom characters must be stored in our Firestore.
- **Voice cloning:** Available via `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **87 models available:** 58 video, 29 image. Key lip-sync models: Character 3 (auto duration), Hedra Omnia (8s), Hedra Avatar (600s/10min), VEED Fabric (300s/5min), Omnihuman 1.5 (60s), Kling AI Avatar v2 (60s)
- **69 voices** including ElevenLabs, MiniMax, and custom clones
- **Inline TTS:** `audio_generation: { type: "text_to_speech", voice_id, text }` on video generation payload — confirmed working from Hedra's official starter code
- **Two generation modes:** Prompt-only (Kling O3 T2V, native audio) and Character mode (Character 3 + portrait + inline TTS)

### What Still Needs Work
- **hedra-prompt-agent.ts** — System prompt references "characters don't speak" (wrong — they do)
- **hedra-prompt-translator.ts** — Prompt formatting could be improved for cinema-quality output
- **Hedra prompting expertise** — Research best practices for Hedra prompt engineering, train the prompt agent to be an expert
- **Voice cloning integration** — Wire `type: "voice_clone"` into Voice Lab so cloned voices are usable in video generation
- **Test end-to-end** — Verify inline TTS works through the full pipeline (UI → API → Hedra → poll → display)

---

## CAMPAIGN ORCHESTRATION PIPELINE (Next Major Feature)

### Why This Is The Next Priority

Video generation is a **core revenue feature**. Clients create AI clones of themselves (face + voice) to automate daily video content at a fraction of traditional ad costs. They want cinema-quality enterprise ads without ever stepping in front of a camera after initial clone setup.

But video alone isn't enough. The real value is **full campaign orchestration**: Jasper researches a topic, builds a marketing strategy, then produces ALL content types (blog, video, social posts, images, email) — all prepared for review and approval in one place.

### The Vision

```
Client: "Research competitor X, then build a campaign around our advantages"
         ↓
    Jasper decomposes into a Campaign:
         ↓
    ┌─ Research (competitor analysis, market data)
    ├─ Strategy (positioning, messaging, target audience)
    ├─ Blog post (long-form thought leadership)
    ├─ Video (character-driven ad using their AI clone)
    ├─ Social posts (platform-specific variants)
    ├─ Images (ad creatives, thumbnails)
    └─ Email sequence (nurture campaign)
         ↓
    ALL land in Mission Review for approval
         ↓
    Client reviews each piece → approve / reject / feedback
         ↓
    Approved items auto-publish or schedule
```

### What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| Jasper delegation to agent teams | ✓ Working | `jasper-tools.ts` (73 tools) |
| Mission persistence | ✓ Working | `mission-persistence.ts`, Firestore `missions/` |
| Mission Control page | ✓ Working | `/mission-control` (3-panel: sidebar, timeline, detail) |
| Mission step tracking | ✓ Working | `MissionStep` with status, toolName, delegatedTo |
| Approval system (in-memory) | ✓ Working | `jasper-command-authority.ts` (PendingApproval) |
| Social media approvals | ✓ Working | `approval-service.ts`, `/social/approvals` page |
| Video storyboard review | ✓ Working | SceneProgressCard with approve/reject/feedback |
| Review link routing | ✓ Working | `REVIEW_LINK_MAP` (16 tool→page mappings) |
| Campaign ID on video projects | ✓ Partial | `VideoProject.campaignId` field exists, no lifecycle |

### What's Missing

1. **Unified Campaign model** — No entity ties blog + video + social + email together as one campaign
2. **Campaign Review page** — Each content type has isolated review. No single page to see all deliverables
3. **Deliverable status tracking** — Mission steps track tool execution, not content review states
4. **Cross-content approval gates** — Video has approve/reject, but blog/social/email don't have the same gate
5. **Auto-publish pipeline** — Approved items don't automatically schedule/post
6. **Feedback loop** — Rejected items don't go back to Jasper for revision automatically

### Implementation Plan — 4 Layers

#### Layer 1: Unified Mission Review (MVP)

**Goal:** Single page where the client reviews ALL deliverables from a Jasper mission.

**Data Model:**
```typescript
interface CampaignDeliverable {
  id: string;
  campaignId: string;
  missionId: string;
  type: 'blog' | 'video' | 'social_post' | 'image' | 'email' | 'research' | 'strategy';
  title: string;
  status: 'drafting' | 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | 'published';
  previewData: Record<string, unknown>;  // Type-specific preview content
  reviewLink: string;                     // Deep link to full editor/viewer
  feedback?: string;                      // Client's rejection notes
  createdAt: Timestamp;
  updatedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
}
```

**Firestore:** `organizations/{PLATFORM_ID}/campaigns/{campaignId}/deliverables/{deliverableId}`

**UI Changes:**
- Redesign Mission Control into a Campaign Review dashboard
- Each deliverable = a card with inline preview + approve/reject/feedback buttons
- Video card shows scene thumbnails, blog card shows title + excerpt, social shows post preview
- "Approve All" button for when everything looks good
- Review button in Jasper's chat navigates to Campaign Review (not video storyboard directly)

**Jasper Changes:**
- When Jasper delegates work, each tool result creates a `CampaignDeliverable` record
- `produce_video` → creates video deliverable with `previewData: { projectId, sceneCount, scenes }`
- `save_blog_draft` → creates blog deliverable with `previewData: { title, excerpt, wordCount }`
- `social_post` → creates social deliverable with `previewData: { platform, copy, imageUrl }`
- Jasper's response includes link to Campaign Review page, not individual tool pages

#### Layer 2: Campaign Model

**Goal:** Tie multiple deliverables together under one brief with shared strategy context.

**Data Model:**
```typescript
interface Campaign {
  id: string;
  missionId: string;
  brief: string;                    // Original client request
  research?: Record<string, unknown>;  // Findings from research phase
  strategy?: Record<string, unknown>;  // Positioning, messaging, audience
  deliverables: string[];           // Deliverable IDs
  status: 'researching' | 'strategizing' | 'producing' | 'pending_review' | 'approved' | 'published';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Firestore:** `organizations/{PLATFORM_ID}/campaigns/{campaignId}`

**Jasper Changes:**
- Complex requests create a Campaign first, then populate deliverables
- Research results stored on the Campaign, shared across all content generation
- Strategy decisions (messaging, audience, tone) passed to every content tool

#### Layer 3: Auto-Publish Pipeline

**Goal:** Approved deliverables automatically schedule/post via existing integrations.

- Blog approved → auto-publish to website builder or WordPress
- Social approved → schedule via social posting system (Twitter/X, LinkedIn, etc.)
- Email approved → queue in email sequence system
- Video approved → upload to media library, generate platform-specific variants
- Images approved → save to media library, attach to social posts

#### Layer 4: Feedback Loop & Iteration

**Goal:** Rejected items return to Jasper with notes for automatic revision.

- Client rejects a deliverable with feedback text
- System creates a new Jasper mission: "Revise [deliverable type] based on feedback: [notes]"
- Jasper regenerates with the client's direction
- New version appears in Campaign Review for re-approval
- History of versions preserved (v1 rejected → v2 approved)

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
| `src/lib/video/hedra-service.ts` | **FIXED** — Inline `audio_generation`, removed 3-step TTS |
| `src/lib/video/scene-generator.ts` | Working — prompt-only (Kling T2V) + avatar (Character 3) |
| `src/lib/video/hedra-prompt-agent.ts` | Needs update — system prompt references wrong assumptions |
| `src/lib/video/hedra-prompt-translator.ts` | Needs update — improve for cinema-quality prompts |
| `src/lib/orchestrator/mission-persistence.ts` | Mission tracking — Campaign Orchestration Pipeline builds on this |
| `src/lib/orchestrator/jasper-command-authority.ts` | Approval system — will be extended for Campaign deliverables |
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

## Hedra API Reference (Corrected March 15, 2026)

### Public API (current — working)
- **Base URL:** `https://api.hedra.com/web-app/public`
- **Auth:** `x-api-key` header
- **Models used:**
  - **Prompt-only:** Kling O3 Standard T2V (`b0e156da...`) — generates speaking characters with native audio from text prompt. Up to 15s, 720p.
  - **Avatar mode:** Character 3 (`d1dd37a3...`) — lip-synced talking head from portrait + inline TTS. Up to 1080p, auto duration.
- **Inline TTS:** `audio_generation: { type: "text_to_speech", voice_id, text }` on video generation payload. Single API call — Hedra handles TTS server-side. Confirmed working from official starter code.
- **Voice cloning:** `POST /generations { type: "voice_clone", voice_clone: { audio_id, name } }`
- **Image generation:** `POST /generations { type: "image", ai_model_id, text_prompt }` — 29 image models available for portrait generation
- **87 total models:** 58 video, 29 image. Key lip-sync models: Character 3 (auto), Omnia (8s), Avatar (10min), VEED Fabric (5min), Omnihuman 1.5 (60s)
- **69 voices** including ElevenLabs, MiniMax, and custom clones

### Elements API (read-only via API key)
- **Base URL:** `https://api.hedra.com/web-app/elements`
- **Auth:** `x-api-key` header (read-only — returns PUBLIC stock elements only)
- **156 stock elements:** 100+ characters, styles, environments, outfits
- **Element creation:** Requires JWT session auth (web app login). NOT available via API key. This means custom characters must be stored in our Firestore Character Studio.
- **Client character library is ours to own** — Hedra is the rendering engine, SalesVelocity is the character library.

### V1 SDK — REJECTED
- `hedra-node` v0.1.2 is outdated (last update July 2025), points at legacy `mercury.dev.dream-ai.com`, missing model/resolution/duration control, 104 downloads/month. Direct API integration is superior.
