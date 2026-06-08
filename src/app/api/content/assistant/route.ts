/**
 * Content Manager — conversational front-end.
 * POST /api/content/assistant
 *
 * This is NOT a separate "assistant" agent. It is the conversational front-end
 * of the Content Manager: it talks the operator through what they want, then
 * DELEGATES the actual build to the right specialist — exactly what the Content
 * Manager already does. On the Video tab the build is delegated to the real,
 * Golden-Master-governed Video Specialist (script_to_storyboard); its
 * shot-by-shot storyboard is mapped onto the canvas for the operator to review.
 *
 * Standing Rule #1 — Brand DNA: brand voice is baked into the conversation via
 * buildToolSystemPrompt('voice'); the delegated specialist loads its own GM with
 * Brand DNA baked in. No runtime Brand DNA merge in this route's output.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth/api-auth';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { buildToolSystemPrompt } from '@/lib/brand/brand-dna-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { buildStoryboardFromBrief } from '@/lib/video/storyboard-build-service';

// Re-exported for back-compat: the storyboard shape now lives in the shared service.
export type { AssistantStoryboard } from '@/lib/video/storyboard-build-service';

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

function isVideoStoryboardTab(activeTab: string | undefined): boolean {
  const tab = (activeTab ?? '').toLowerCase();
  return tab.includes('/content/video') && !tab.includes('/editor') && !tab.includes('/library');
}

// ────────────────────────────────────────────────────────────────────────────
// Delegation directive — the Content Manager hands the build to a specialist.
// ────────────────────────────────────────────────────────────────────────────

const DelegateDirectiveSchema = z.object({
  specialist: z.literal('VIDEO_SPECIALIST'),
  brief: z.string().trim().min(1).max(4000),
  platform: z.enum(['youtube', 'tiktok', 'instagram_reels', 'shorts', 'linkedin', 'generic']).default('youtube'),
  style: z.enum(['talking_head', 'documentary', 'energetic', 'cinematic']).default('cinematic'),
  targetDuration: z.number().int().min(15).max(150).default(30),
  targetAudience: z.string().trim().max(500).optional(),
  callToAction: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(300).optional(),
  /** When reworking ONE existing storyboard, the 1-based number to replace. Omit for a fresh full build. */
  targetSceneNumber: z.number().int().min(1).max(50).optional(),
});

type DelegateDirective = z.infer<typeof DelegateDirectiveSchema>;

/** Pull a fenced ```delegate (or ```json) directive out of the reply. */
function extractDelegateDirective(reply: string): { directive: DelegateDirective; cleanedReply: string } | null {
  const fence = /```(?:delegate|json)?\s*([\s\S]*?)```/i.exec(reply);
  if (!fence) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fence[1].trim());
  } catch {
    return null;
  }
  const parsed = DelegateDirectiveSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return { directive: parsed.data, cleanedReply: reply.replace(fence[0], '').trim() };
}

// ────────────────────────────────────────────────────────────────────────────
// Active-tab context
// ────────────────────────────────────────────────────────────────────────────

function describeActiveTab(activeTab: string | undefined): string {
  const tab = (activeTab ?? '').toLowerCase();
  if (tab.includes('/content/image')) {
    return `The operator is on the **Image** generator. Focus on still imagery: subject, composition, location/setting, lighting, color palette, mood, camera angle, styling/wardrobe, props, and where the image will be used. (Delegation to the Asset Generator from here is coming — for now, shape the brief with them.)`;
  }
  if (tab.includes('/content/voice-lab') || tab.includes('/content/audio') || tab.includes('music')) {
    return `The operator is in the **Audio Lab**. Focus on audio: genre/style, mood, tempo, instrumentation, vocal vs instrumental, references, length, and where it will be used. (Delegation to the Music Planner from here is coming.)`;
  }
  if (tab.includes('/content/video/editor')) {
    return `The operator is in the **Video Editor**. Focus on edit-level decisions: pacing, cuts, captions, music bed, transitions, B-roll.`;
  }
  if (tab.includes('/content/video/library')) {
    return `The operator is in the **Video Library**. Help them decide what to make next or repurpose.`;
  }
  if (tab.includes('/content/video')) {
    return `The operator is on the **Video** tab — the storyboard builder. Shape the concept (hook, characters, location, mood, arc, voiceover, CTA), then delegate the build to the Video Specialist.`;
  }
  return `The operator is in the Content Generator. Help them decide what to create, then delegate to the right specialist.`;
}

const VIDEO_DELEGATION_PROTOCOL = `

## DELEGATING THE BUILD (Video tab)
You do NOT build storyboards yourself — you delegate to your Video Specialist, the expert. Converse to pin down the concept (who's on screen, the emotional arc, the message, platform, length, tone). When the operator clearly wants it built ("make it", "build the storyboards", "take it from here"), reply with ONE short sentence, then a fenced \`delegate\` block:

\`\`\`delegate
{"specialist":"VIDEO_SPECIALIST","brief":"<a rich creative brief in your words: the concept, who is on screen and their look, the emotional arc, the message, the CTA>","platform":"youtube|tiktok|instagram_reels|shorts|linkedin|generic","style":"talking_head|documentary|energetic|cinematic","targetDuration":<seconds, 15-150>,"targetAudience":"<who it's for>","callToAction":"<what they should do>","tone":"<editorial tone>","targetSceneNumber":<optional 1-based storyboard number, only when reworking ONE existing storyboard>}
\`\`\`

Write a RICH brief — the specialist turns it into a fully-specified, shot-by-shot storyboard (every field filled) for the operator to review and approve. Pick the platform/style/duration that fit what they asked for. Only emit the block when they actually want it built; while brainstorming, just talk (no block).

When the operator asks to rebuild / rework / fix / redo / change a SPECIFIC existing storyboard (e.g. "rebuild storyboard 5", "fix SB3", "redo the closing shot"), include \`"targetSceneNumber": N\` (the 1-based storyboard number) in the delegate block, and write \`brief\` as a SINGLE-shot description of just that one storyboard. When building a fresh full video, OMIT targetSceneNumber.`;

// ────────────────────────────────────────────────────────────────────────────
// System prompt — the Content Manager's conversational identity
// ────────────────────────────────────────────────────────────────────────────

async function buildSystemPrompt(activeTab: string | undefined): Promise<string> {
  let brandContext = '';
  try {
    brandContext = await buildToolSystemPrompt('voice');
  } catch (error) {
    logger.warn('[ContentManager] Failed to load brand context — continuing without', {
      file: FILE,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const role = `You are the Content Manager for SalesVelocity.ai — the content director who turns a request into finished content by DELEGATING to your team of specialists. You do not do the production yourself; you understand what the operator wants and hand it to the right specialist:
- **Video Specialist** — shot-by-shot storyboards (Video tab)
- **Copywriter** — headlines, ad copy, scripts, email copy
- **Asset Generator** — images
- **Music Planner** — music & soundtrack

## HOW YOU WORK
- Talk like a creative director: bring a point of view, propose concrete ideas, ask the ONE or TWO sharp clarifying questions a client wouldn't think of (who it's for, where it lives, the one feeling it should leave behind).
- Build on what they've said; keep it tight and human — no bullet-point essays, no corporate filler.
- Stay in the tenant's brand voice (below).
- You shape the brief, then DELEGATE the build. Don't hand-write the final asset yourself.`;

  const tabBlock = `\n\n## CURRENT CONTEXT\n${describeActiveTab(activeTab)}`;
  const protocolBlock = isVideoStoryboardTab(activeTab) ? VIDEO_DELEGATION_PROTOCOL : '';
  const brandBlock = brandContext ? `\n\n## BRAND VOICE & IDENTITY (stay in this voice)\n${brandContext}` : '';

  return `${role}${tabBlock}${protocolBlock}${brandBlock}`;
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
      return NextResponse.json({ success: false, error: 'Invalid request', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
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
      maxTokens: 1500,
    });

    const reply = response.content?.trim();
    if (!reply) {
      logger.warn('[ContentManager] LLM returned empty reply', { file: FILE });
      return NextResponse.json(
        { success: false, error: 'The content manager did not return a response. Please try again.' },
        { status: 502 },
      );
    }

    // On the Video tab, if the Content Manager decided to build, delegate to the
    // Video Specialist and return the storyboards for the canvas.
    if (isVideoStoryboardTab(parsed.activeTab)) {
      const delegation = extractDelegateDirective(reply);
      if (delegation?.directive.specialist === 'VIDEO_SPECIALIST') {
        const { directive } = delegation;
        const built = await buildStoryboardFromBrief({
          brief: directive.brief,
          platform: directive.platform,
          style: directive.style,
          targetDuration: directive.targetDuration,
          ...(directive.targetAudience ? { targetAudience: directive.targetAudience } : {}),
          ...(directive.callToAction ? { callToAction: directive.callToAction } : {}),
          ...(directive.tone ? { tone: directive.tone } : {}),
        });
        if ('error' in built) {
          logger.warn('[ContentManager] Video Specialist delegation failed', { file: FILE, error: built.error });
          return NextResponse.json({
            success: true,
            reply: `${delegation.cleanedReply || 'I tried to build that,'} but the Video Specialist hit a problem: ${built.error}`,
          });
        }
        return NextResponse.json({
          success: true,
          reply: delegation.cleanedReply || 'Here are your storyboards — review and tweak anything.',
          storyboards: built.storyboards,
          ...(directive.targetSceneNumber ? { targetSceneNumber: directive.targetSceneNumber } : {}),
        });
      }
    }

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    logger.error(
      '[ContentManager] Failed to generate reply',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE, activeTab: parsed.activeTab },
    );
    return NextResponse.json(
      { success: false, error: 'The content manager is unavailable right now. Please try again.' },
      { status: 500 },
    );
  }
}
