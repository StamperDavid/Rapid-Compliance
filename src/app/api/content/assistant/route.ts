/**
 * Content Assistant API
 * POST /api/content/assistant
 *
 * A content-creation director (NOT the global Jasper assistant). It helps the
 * operator articulate what they want to create — image, video, music, or text —
 * by talking it through: proposing ideas and asking the clarifying questions a
 * client wouldn't think of (location, lighting, mood, extras, framing, etc.),
 * all in the tenant's brand voice.
 *
 * v1 is conversation only. Structured-field filling and hand-off to the active
 * tool come in later increments.
 *
 * Standing Rule #1 — Brand DNA: the system prompt bakes in the tenant's brand
 * voice via the SAME `buildToolSystemPrompt('voice')` pattern the video script
 * generation service uses (see script-generation-service.ts `loadBrandContext`).
 * The LLM client is the existing `OpenRouterProvider` — no new client invented.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/api-auth';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { buildToolSystemPrompt } from '@/lib/brand/brand-dna-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { CinematicConfig } from '@/types/creative-studio';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/assistant/route.ts';

// ────────────────────────────────────────────────────────────────────────────
// Request validation
// ────────────────────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(8000),
});

const AssistantRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  /** The content-generator tab the operator is on, e.g. '/content/video'. */
  activeTab: z.string().trim().max(120).optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// Storyboard actions — on the Video tab the assistant can BUILD storyboards,
// not just talk. It emits a fenced ```storyboards JSON array which we parse,
// validate, and hand back so the client drops them onto the canvas for review.
// ────────────────────────────────────────────────────────────────────────────

const EmittedStoryboardSchema = z.object({
  title: z.string().trim().max(120).optional(),
  action: z.string().trim().max(2000).optional(),
  dialogue: z.string().trim().max(2000).optional(),
  durationSeconds: z.number().min(1).max(120).optional(),
  location: z.string().trim().max(300).optional(),
  timeOfDay: z.string().trim().max(120).optional(),
  weather: z.string().trim().max(200).optional(),
  lighting: z.string().trim().max(200).optional(),
  mood: z.string().trim().max(200).optional(),
  style: z.string().trim().max(200).optional(),
  shotType: z.string().trim().max(120).optional(),
  cameraMovement: z.string().trim().max(120).optional(),
  ambience: z.string().trim().max(300).optional(),
  musicCue: z.string().trim().max(300).optional(),
  wardrobe: z.string().trim().max(300).optional(),
});

type EmittedStoryboard = z.infer<typeof EmittedStoryboardSchema>;

const EmittedStoryboardsSchema = z.array(EmittedStoryboardSchema).max(20);

/** The storyboard shape the Video tab applies to its pipeline store. */
export interface AssistantStoryboard {
  title: string;
  visualDescription: string;
  scriptText: string;
  duration: number;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  ambience?: string;
  musicCue?: string;
  wardrobe?: string;
  cinematicConfig?: Partial<CinematicConfig>;
}

function isVideoStoryboardTab(activeTab: string | undefined): boolean {
  const tab = (activeTab ?? '').toLowerCase();
  return (
    tab.includes('/content/video') &&
    !tab.includes('/editor') &&
    !tab.includes('/library')
  );
}

function toAssistantStoryboard(s: EmittedStoryboard): AssistantStoryboard {
  const cinematicConfig: Partial<CinematicConfig> = {};
  if (s.lighting) { cinematicConfig.lighting = s.lighting; }
  if (s.mood) { cinematicConfig.atmosphere = s.mood; }
  if (s.style) { cinematicConfig.movieLook = s.style; }
  if (s.shotType) { cinematicConfig.shotType = s.shotType; }
  if (s.cameraMovement) { cinematicConfig.camera = s.cameraMovement; }
  return {
    title: s.title ?? '',
    visualDescription: s.action ?? '',
    scriptText: s.dialogue ?? '',
    duration: s.durationSeconds ?? 5,
    ...(s.location ? { location: s.location } : {}),
    ...(s.timeOfDay ? { timeOfDay: s.timeOfDay } : {}),
    ...(s.weather ? { weather: s.weather } : {}),
    ...(s.ambience ? { ambience: s.ambience } : {}),
    ...(s.musicCue ? { musicCue: s.musicCue } : {}),
    ...(s.wardrobe ? { wardrobe: s.wardrobe } : {}),
    ...(Object.keys(cinematicConfig).length > 0 ? { cinematicConfig } : {}),
  };
}

/**
 * Pull a fenced ```storyboards (or ```json) array out of the reply, validate
 * it, and return the parsed storyboards plus the reply with the block removed.
 * Returns null when there's no valid block.
 */
function extractStoryboards(reply: string): { storyboards: AssistantStoryboard[]; cleanedReply: string } | null {
  const fence = /```(?:storyboards|json)?\s*([\s\S]*?)```/i.exec(reply);
  if (!fence) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fence[1].trim());
  } catch {
    return null;
  }
  const parsed = EmittedStoryboardsSchema.safeParse(raw);
  if (!parsed.success || parsed.data.length === 0) {
    return null;
  }
  return {
    storyboards: parsed.data.map(toAssistantStoryboard),
    cleanedReply: reply.replace(fence[0], '').trim(),
  };
}

const VIDEO_ACTION_BLOCK = `

## BUILDING STORYBOARDS — YOU CAN ACT HERE
On the Video tab you don't just talk, you BUILD. When the operator asks you to create / make / fill / build the storyboards (or says "you do it", "just make it", "take it from here"), you MUST output the storyboards as data so they appear on their canvas for review — never describe them in prose alone.

Output: ONE short human sentence, then a fenced code block tagged \`storyboards\` holding a JSON array — one object per storyboard, in order. Fields (all optional except action; omit what doesn't apply):
- "title": short scene name
- "action": what literally happens on screen, including who is in frame and their look — the most important field
- "dialogue": the voiceover / spoken line for this scene
- "durationSeconds": number
- "location", "timeOfDay", "weather"
- "lighting", "mood", "style"
- "shotType", "cameraMovement"
- "ambience", "musicCue", "wardrobe"

Rules:
- Keep characters CONSISTENT across scenes (same person, same wardrobe) unless told otherwise.
- Split the requested total duration across the scenes.
- Keep the human reply to ONE sentence — the detail lives in the JSON, which they'll see as filled-in fields and review.
- Only emit the block when they actually want it built. While brainstorming, just talk (no block).

Example reply:
Here are your two storyboards — review and tweak anything.
\`\`\`storyboards
[{"title":"The Stress","action":"A solo entrepreneur, mid-30s, rumpled shirt, hands gripping his hair at a cluttered desk","dialogue":"Running a business shouldn't feel like this.","durationSeconds":7,"location":"cramped home office","lighting":"harsh cool overhead","mood":"tense, claustrophobic","shotType":"tight medium shot"}]
\`\`\``;

// ────────────────────────────────────────────────────────────────────────────
// Active-tab context — tells the director which modality is in front of the
// operator so it asks the right clarifying questions.
// ────────────────────────────────────────────────────────────────────────────

function describeActiveTab(activeTab: string | undefined): string {
  const tab = (activeTab ?? '').toLowerCase();

  if (tab.includes('/content/image')) {
    return `The operator is on the **Image** generator. Focus the conversation on still imagery: subject, composition, location/setting, lighting (golden hour, studio softbox, moody low-key, etc.), color palette, mood, camera angle and lens feel, styling/wardrobe, props and extras, and aspect ratio / where the image will be used.`;
  }
  if (tab.includes('/content/voice-lab') || tab.includes('/content/audio') || tab.includes('music')) {
    return `The operator is on the **Audio Lab** (voice + music). Focus on audio: genre/style, mood and energy, tempo, instrumentation, vocal vs instrumental, reference artists or tracks, length, and where the audio will be used (ad, background, intro/outro).`;
  }
  if (tab.includes('/content/video/editor')) {
    return `The operator is in the **Video Editor**. Focus on edit-level decisions: pacing, cuts, text overlays, captions, music bed, transitions, B-roll, and the story beat each clip serves.`;
  }
  if (tab.includes('/content/video/library')) {
    return `The operator is in the **Video Library** browsing existing renders. Help them decide what to make next, repurpose, or remix from what they already have.`;
  }
  if (tab.includes('/content/video')) {
    return `The operator is on the **Video** generator. Focus on the film: the core concept and hook, characters (age, look, wardrobe — kept consistent), location/setting, lighting and color temperature, mood and emotional arc, shot framing, pacing, voiceover vs dialogue, and the call to action.`;
  }

  return `The operator is in the Content Generator. Help them decide what to create (image, video, music, or text) and then dig into the creative specifics for that modality.`;
}

// ────────────────────────────────────────────────────────────────────────────
// System prompt — content-director role + baked-in Brand DNA + tab context
// ────────────────────────────────────────────────────────────────────────────

async function buildSystemPrompt(activeTab: string | undefined): Promise<string> {
  // Standing Rule #1: bake the tenant's brand voice into the prompt via the
  // same helper the script generator uses. If brand context can't load, the
  // director still works — it just loses the brand-voice layer.
  let brandContext = '';
  try {
    brandContext = await buildToolSystemPrompt('voice');
  } catch (error) {
    logger.warn('[ContentAssistant] Failed to load brand context — continuing without', {
      file: FILE,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const role = `You are the Content Assistant — a creative director for the SalesVelocity.ai content studio.

## YOUR JOB
You help the operator figure out exactly what they want to create — an image, a video, a piece of music, or text — by TALKING IT THROUGH with them. You are a collaborator in a brainstorming chair, not a form to fill out.

## HOW YOU WORK
- Propose concrete creative ideas, not generic options. Bring a point of view.
- Ask the clarifying questions a client wouldn't think to answer on their own: location/setting, time of day, lighting, mood, color, framing, wardrobe, props, extras, pacing, music, the feeling they want the viewer to walk away with.
- Ask ONE or TWO sharp questions at a time — never a wall of questions. Keep it conversational, like you're on a call with them.
- Build on what they've already said. Reference their earlier answers so it feels like a real conversation.
- When they're vague ("make me a video about our product"), pull on the thread: who's it for, where does it live, what's the one feeling it should leave behind.
- Stay in the tenant's brand voice (below). The ideas you propose should sound like THIS brand, not a generic agency.

## WHAT YOU DO NOT DO
- You do NOT render the final image/video/music yourself — that's the operator's job when they hit Generate. You shape the brief and, on the Video tab, you BUILD the storyboards for them to review (see below).
- Don't claim a final asset is rendered or published. Building storyboards for review is fine and expected; rendering is not.
- Keep replies tight and human. No bullet-point essays, no corporate filler.`;

  const tabBlock = `\n\n## CURRENT CONTEXT\n${describeActiveTab(activeTab)}`;

  const actionBlock = isVideoStoryboardTab(activeTab) ? VIDEO_ACTION_BLOCK : '';

  const brandBlock = brandContext
    ? `\n\n## BRAND VOICE & IDENTITY (stay in this voice)\n${brandContext}`
    : '';

  return `${role}${tabBlock}${actionBlock}${brandBlock}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Route handler
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let parsed: z.infer<typeof AssistantRequestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = AssistantRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  try {
    const systemPrompt = await buildSystemPrompt(parsed.activeTab);

    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: systemPrompt },
        ...parsed.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.8,
      maxTokens: 1200,
    });

    const reply = response.content?.trim();
    if (!reply) {
      logger.warn('[ContentAssistant] LLM returned empty reply', { file: FILE });
      return NextResponse.json(
        { success: false, error: 'The assistant did not return a response. Please try again.' },
        { status: 502 },
      );
    }

    // On the Video tab, pull any storyboard data the director built so the
    // client can drop it onto the canvas for the operator to review + approve.
    if (isVideoStoryboardTab(parsed.activeTab)) {
      const extracted = extractStoryboards(reply);
      if (extracted) {
        return NextResponse.json({
          success: true,
          reply: extracted.cleanedReply || 'Here are your storyboards — review and tweak anything.',
          storyboards: extracted.storyboards,
        });
      }
    }

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    logger.error(
      '[ContentAssistant] Failed to generate reply',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, activeTab: parsed.activeTab },
    );
    return NextResponse.json(
      { success: false, error: 'The content assistant is unavailable right now. Please try again.' },
      { status: 500 },
    );
  }
}
