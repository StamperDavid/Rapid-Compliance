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

## WHAT YOU DO NOT DO (v1)
- You do NOT generate the final asset yourself, and you do NOT run any tools yet — this is a conversation. (Filling the creation form and handing off to the active tool comes later.)
- Don't claim you've created or queued anything. You're helping them shape the brief.
- Keep replies tight and human. No bullet-point essays, no corporate filler.`;

  const tabBlock = `\n\n## CURRENT CONTEXT\n${describeActiveTab(activeTab)}`;

  const brandBlock = brandContext
    ? `\n\n## BRAND VOICE & IDENTITY (stay in this voice)\n${brandContext}`
    : '';

  return `${role}${tabBlock}${brandBlock}`;
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
