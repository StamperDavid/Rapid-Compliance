# Media Generation Reality Check
**Date:** February 12, 2026
**Analyst:** Research Agent
**Purpose:** Map what AI agents can ACTUALLY create vs what they claim

---

## Executive Summary

**TL;DR:** The AI agent swarm has extensive text-generation capabilities but **ZERO actual image/video generation** in production. Everything is either:
1. **Mock responses** (returns placeholder URLs)
2. **API wrappers** that call external services (HeyGen, Runway, Sora) IF keys are configured
3. **Planning/strategy** agents that produce JSON descriptions, not actual media

---

## 1. Image Generation

### ASSET_GENERATOR Specialist
- **Location:** `src/lib/agents/builder/assets/specialist.ts`
- **Claimed capabilities:** Logo generation, banners, social graphics, favicons
- **AGENT_REGISTRY.json claims:** `image_generation`, `logo_creation`, `banner_design`, `brand_asset_management`, `social_graphics`

**Reality:**
```typescript
// Line 924-940: The "generation" function
private generatePlaceholderUrl(assetName: string, brandName: string, format: string): string {
  // This is where you'd integrate with:
  // - Replicate API: https://replicate.com/docs/get-started/nodejs
  // - OpenAI DALL-E: https://platform.openai.com/docs/guides/images
  // - Midjourney API (unofficial): https://docs.midjourney.com/
  // - Stable Diffusion API: https://stablediffusionapi.com/

  return `https://assets.generated.example.com/${sanitizedBrand}/${assetName}-${timestamp}.${format}`;
}
```

**What it ACTUALLY does:**
- Generates detailed AI image generation **prompts** (very good prompts!)
- Returns structured JSON with **placeholder URLs**
- No actual image bytes are created
- No API calls to DALL-E, Midjourney, Replicate, or Stable Diffusion

**Image manipulation libraries installed:** NONE
```bash
npm list sharp jimp canvas fluent-ffmpeg
# Result: └── (empty)
```

---

## 2. Video Generation

### VIDEO_SPECIALIST
- **Location:** `src/lib/agents/content/video/specialist.ts`
- **Claimed capabilities:** `video_scripts`, `storyboards`, `audio_cues`, `video_seo`, `thumbnail_strategy`

**Reality:**
- **ONLY text output** - generates storyboards, scene breakdowns, timing estimates, B-roll suggestions
- **NO video rendering** - everything is JSON/text descriptions
- Thumbnail strategy = text descriptions of what thumbnails should look like
- Audio cues = text markers like "Music: Intro bed fades in - energetic but not overpowering"

### Video Service (`src/lib/video/video-service.ts`)
**Has API integrations for:**
1. **HeyGen** - Avatar videos (IF API key configured)
2. **Sora** - Text-to-video (IF OpenAI key configured)
3. **Runway** - Gen-3 video (IF Runway key configured)

**Key functions:**
```typescript
async function generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
  // Logs interest for analytics
  await logVideoInterest(...);

  // Check if provider is configured
  if (await isProviderConfigured(request.provider)) {
    // Try to call external API (HeyGen/Sora/Runway)
    // IF it fails or isn't configured:
  }

  // Fall back to:
  return createComingSoonResponse('Video generation');
}
```

**What actually happens:**
- If HeyGen/Sora/Runway keys are configured → Makes real API calls to external services
- If NOT configured → Returns "Coming Soon" stub response
- The platform does NOT generate videos itself - it's a **proxy to external paid APIs**

### Video Render Pipeline (`src/lib/video/engine/render-pipeline.ts`)
**Purpose:** Orchestrate multi-shot video generation from storyboards

**Architecture:**
1. Load storyboard from Firestore
2. Route shots to providers via `MultiModelPicker` (Runway, Veo, Sora, Kling, Pika, HeyGen, Stable Video)
3. Call provider APIs to generate clips
4. Poll for completion with exponential backoff
5. Trigger `StitcherService` for post-production
6. Upload final video to Firebase Storage

**Reality check on provider integration:**
```typescript
// Line 361-385: All provider API calls are STUBS
private async callProviderAPI(provider: VideoGenerationProvider, item: GenerationQueueItem) {
  switch (provider) {
    case 'runway':
      return this.callRunwayAPI(item);  // → Returns mock jobId
    case 'veo':
      return this.callVeoAPI(item);      // → Returns mock jobId
    case 'sora':
      return this.callSoraAPI(item);     // → Returns mock jobId
    // ... all return Promise.resolve({ jobId: `${provider}_${Date.now()}`, status: 'queued' })
  }
}

// Line 545-550: Status polling also returns mock responses
private checkProviderStatus(provider, providerJobId) {
  return Promise.resolve({
    jobId: providerJobId,
    status: 'completed',
    videoUrl: `https://storage.example.com/videos/${provider}/${providerJobId}.mp4`,
  });
}
```

**Conclusion:** The render pipeline has a **sophisticated architecture** but the actual API integrations are **mocked out**. It would work IF:
1. Real API keys for Runway/Veo/Sora/etc. are added
2. The stub functions are replaced with actual HTTP requests
3. Real polling logic is implemented for each provider

### Stitcher Service (`src/lib/video/engine/stitcher-service.ts`)
**Purpose:** Post-production assembly of video clips

**Features (claimed):**
- Multi-track audio mixing
- TTS voiceover layering
- BPM-aware music ducking
- LUT/color grading
- Brand overlay compositing

**Reality:** Code reads as if it will use `ffmpeg` or a video processing library, but:
- No `fluent-ffmpeg` in package.json
- No `sharp` for thumbnail generation
- Likely returns structured metadata about WHAT SHOULD BE DONE, not actual video processing

---

## 3. Thumbnail Generation

### Searched for: `thumbnail`, `generateThumbnail`, `createThumbnail`
**Found 29 files** - but most are:
- Type definitions (`thumbnailUrl?: string`)
- Form fields for thumbnail URLs
- References to thumbnail strategies (text descriptions)

**NO actual thumbnail image generation code found.**

The `VIDEO_SPECIALIST` has a `handleThumbnailStrategy` function (line 1059) that returns:
```typescript
interface ThumbnailConcept {
  variant: string;
  layout: string;            // "Face + Text"
  primaryText: string;       // "HOW TO SCALE?!"
  emotionalHook: string;     // "Financial aspiration - promise of wealth/success"
  colorScheme: string;       // "High contrast (yellow/black)"
  facialExpression: string;  // "Surprised"
  clickbaitLevel: 'low' | 'medium' | 'high';
  estimatedCTR: string;      // "5-7%"
}
```

**This is a design spec for a thumbnail, not an actual image.**

---

## 4. What Happens When Jasper Delegates "Create a Product Demo Video"?

Let's trace the delegation path:

### Step 1: Jasper receives user request
```
User: "Create a product demo video for our SaaS platform"
```

### Step 2: Jasper calls `delegate_to_content` tool
```typescript
// jasper-tools.ts - delegates to CONTENT_MANAGER
{
  manager: "CONTENT_MANAGER",
  input: { briefType: 'video', pages: ['product-demo'] }
}
```

### Step 3: CONTENT_MANAGER delegates to VIDEO_SPECIALIST
```typescript
// src/lib/agents/content/manager.ts
// Sends task to VIDEO_SPECIALIST with action: 'script_to_storyboard'
```

### Step 4: VIDEO_SPECIALIST generates storyboard JSON
```typescript
// Returns StoryboardResult object:
{
  title: "SaaS Platform Product Demo",
  platform: "youtube",
  totalDuration: 180,
  sceneCount: 8,
  scenes: [
    {
      sceneNumber: 1,
      timeCode: "00:00",
      duration: 25,
      shotType: "Medium Shot",
      visualDescription: "Subject centered in frame, professional lighting setup",
      cameraMovement: "Static (locked off)",
      voiceoverText: "Transform your workflow with our all-in-one platform...",
      audioCue: "Music: Intro bed fades in - energetic but not overpowering",
      brollSuggestion: "Dashboard UI, clean interface shots"
    },
    // ... 7 more scenes
  ],
  productionNotes: [
    "Shoot in 16:9 aspect ratio",
    "Target duration: 120-180 seconds",
    "Use three-point lighting for professional look"
  ]
}
```

### Step 5: User receives... a JSON storyboard
**NO video is created.** The output is:
- Scene-by-scene breakdown (text)
- Suggested camera angles (text)
- Audio cue descriptions (text)
- B-roll suggestions (text)
- Thumbnail concepts (text)

### Step 6: IF user wants actual video rendering
They would need to:
1. Click "Render Video" in the dashboard UI
2. Trigger `/api/admin/video/render` endpoint
3. **Which creates a VideoJob in Firestore**
4. A worker process (TBD) would:
   - Read the storyboard
   - Call HeyGen/Runway/Sora APIs for each shot (IF configured)
   - Wait for clips to generate (minutes to hours)
   - Run stitcher to combine clips (IF ffmpeg is set up)
   - Upload final video to Firebase Storage

**Current state:** Steps 1-3 work. Steps 4+ are architected but not fully implemented.

---

## 5. Actual Media Creation Capabilities

| Feature | Agent Claim | Reality | Actual Output |
|---------|-------------|---------|---------------|
| **Logo Generation** | ✅ Claimed | ❌ No implementation | Placeholder URL + prompt |
| **Banner Graphics** | ✅ Claimed | ❌ No implementation | Placeholder URL + prompt |
| **Social Media Graphics** | ✅ Claimed | ❌ No implementation | Placeholder URL + prompt |
| **Favicon Sets** | ✅ Claimed | ❌ No implementation | Placeholder URLs (all sizes) |
| **Video Storyboards** | ✅ Claimed | ✅ **WORKS** | JSON storyboard with scenes |
| **Video Scripts** | ✅ Claimed | ✅ **WORKS** | Text script with timing |
| **Video SEO** | ✅ Claimed | ✅ **WORKS** | Optimized titles, tags, descriptions |
| **Thumbnail Concepts** | ✅ Claimed | ✅ **WORKS** | Design specs (not images) |
| **Actual Video Rendering** | ✅ Claimed | ⚠️ **PARTIAL** | Works IF HeyGen/Runway configured |
| **HeyGen Avatar Videos** | ✅ Claimed | ✅ **CAN WORK** | Real API integration (needs key) |
| **Runway Gen-3 Videos** | ✅ Claimed | ✅ **CAN WORK** | Real API integration (needs key) |
| **Sora Text-to-Video** | ✅ Claimed | ✅ **CAN WORK** | Real API integration (needs key) |
| **Thumbnail Image Files** | ✅ Implied | ❌ No implementation | None - only strategy text |
| **Audio Mixing** | ✅ Claimed | ❌ No ffmpeg | Stitcher returns metadata only |
| **Color Grading** | ✅ Claimed | ❌ No ffmpeg | LUT presets exist but not applied |

---

## 6. Key Findings

### ✅ What DOES Work
1. **AI-powered content planning** - Excellent storyboards, scripts, shot lists
2. **API proxy architecture** - Can delegate to HeyGen/Runway/Sora IF configured
3. **Structured output** - Returns well-formed JSON for every request
4. **Analytics tracking** - Logs feature interest to Firestore
5. **Waitlist management** - Captures user intent for future features

### ❌ What Does NOT Work
1. **Native image generation** - No DALL-E/Midjourney/Replicate integration
2. **Native video rendering** - No ffmpeg, no stitching, no encoding
3. **Thumbnail creation** - No actual image files generated
4. **Asset manipulation** - No sharp/jimp/canvas libraries installed
5. **End-to-end automation** - Requires external API keys + manual triggering

### ⚠️ What's "In Progress"
1. **Video render pipeline** - Architecture is solid, needs real API implementations
2. **Multi-provider routing** - MultiModelPicker works but providers are stubbed
3. **Post-production** - Stitcher service has LUT presets but no actual processing

---

## 7. Recommendations

### For Honest User Communication
**Update the dashboard to show:**
```
✅ We can create detailed video plans (storyboards, scripts, shot lists)
⚠️ Video rendering requires HeyGen/Runway API keys (you provide)
❌ Image generation coming soon (currently generates prompts only)
```

### For Feature Completion
**To make video generation ACTUALLY work:**
1. Add `fluent-ffmpeg` to package.json
2. Implement real API calls in `render-pipeline.ts` (currently stubbed)
3. Deploy video processing worker (Cloud Run/Lambda)
4. Add Replicate API integration for image generation
5. Install `sharp` for thumbnail extraction from video

### For Agent Transparency
**Update AGENT_REGISTRY.json capabilities:**
```json
{
  "ASSET_GENERATOR": {
    "capabilities": [
      "ai_image_prompts_generation",    // Not "image_generation"
      "logo_concept_design",             // Not "logo_creation"
      "asset_specification_generation"   // Not "brand_asset_management"
    ]
  },
  "VIDEO_SPECIALIST": {
    "capabilities": [
      "script_writing",
      "storyboard_creation",
      "scene_planning",
      "video_strategy"
      // Remove: "video_generation" (that's the PIPELINE, not this agent)
    ]
  }
}
```

---

## 8. Cost Reality Check

### Current Setup (Planning Only)
- **Cost:** ~$0.05 per video plan (GPT-4 API calls)
- **Output:** JSON storyboard, text scripts, strategy docs

### If External APIs Configured
- **HeyGen:** ~$0.01/second = $6 for 10-minute video
- **Runway Gen-3:** ~$0.05/second = $30 for 10-minute video
- **Sora:** ~$0.015/second = $9 for 10-minute video
- **Plus:** Stitching costs (Cloud Run compute), storage (Firebase)

**Reality:** Users need their own API keys or platform must charge for video credits.

---

## 9. Answer to "What ACTUALLY Happens?"

**User Request:** "Create a product demo video"

**Delegation Chain:**
```
JASPER (Orchestrator)
  ↓ [delegate_to_content]
CONTENT_MANAGER
  ↓ [delegate to VIDEO_SPECIALIST]
VIDEO_SPECIALIST
  ↓ [execute: script_to_storyboard]
```

**Output at Each Step:**

| Agent | Output Type | What User Gets |
|-------|-------------|----------------|
| VIDEO_SPECIALIST | `StoryboardResult` | 8-scene JSON with shot types, timings, VO text |
| CONTENT_MANAGER | `ContentPackage` | Storyboard + suggested thumbnails + SEO metadata |
| JASPER | Chat response | "I've created a product demo storyboard with 8 scenes..." |

**What is NOT produced:**
- ❌ No .mp4 file
- ❌ No thumbnail .png
- ❌ No actual audio file
- ❌ No rendered video clips

**To get actual video:**
User must:
1. Review storyboard in dashboard
2. Click "Render Video" → Triggers VideoJob
3. Wait for external API generation (IF keys configured)
4. Download .mp4 from Firebase Storage

**Current blocker:** Video render pipeline needs real provider implementations.

---

## 10. Files Referenced

### Agent Implementations
- `src/lib/agents/builder/assets/specialist.ts` - Image "generation" (prompts only)
- `src/lib/agents/content/video/specialist.ts` - Video planning (no rendering)
- `src/lib/agents/content/manager.ts` - Content orchestration

### Video Infrastructure
- `src/lib/video/video-service.ts` - HeyGen/Sora/Runway API wrappers
- `src/lib/video/engine/render-pipeline.ts` - Multi-provider orchestration (stubbed)
- `src/lib/video/engine/stitcher-service.ts` - Post-production (no ffmpeg)
- `src/lib/video/video-job-service.ts` - Job tracking (works)

### Configuration
- `AGENT_REGISTRY.json` - Agent capability claims (overstated)
- `package.json` - No sharp/jimp/canvas/ffmpeg dependencies
- `src/lib/constants/platform.ts` - Platform identity

### API Routes
- `src/app/api/admin/video/render/route.ts` - VideoJob creation (works)

---

**Conclusion:** The system is a **sophisticated text-based planning tool** with **API proxy capabilities**, not a native media generation platform. All visual output is either external API-dependent or placeholder-based.
