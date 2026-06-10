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

/**
 * A file the operator attached in the chat composer (uploaded to Storage,
 * permanent URL), an image or a video. Threaded into the Video Specialist brief
 * as a reference and (for images, plus videos where a slot fits) seeded onto the
 * first storyboard's references so it reaches the canvas.
 */
const AttachmentSchema = z.object({
  url: z.string().min(1).max(2000),
  fileName: z.string().trim().max(300).optional(),
  contentType: z.string().trim().max(200).optional(),
  kind: z.enum(['image', 'video', 'document', 'other']).optional(),
  /** The AI's read of the file's content (vision for images, transcript for A/V, text for docs). */
  aiSummary: z.string().trim().max(8000).optional(),
});

const AssistantRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  /** The content-generator tab the operator is on, e.g. '/content/video'. */
  activeTab: z.string().trim().max(120).optional(),
  /** Optional reference files (images and/or videos) the operator attached. */
  attachments: z.array(AttachmentSchema).max(100).optional(),
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

## DELEGATING THE BUILD (Video tab) — READ CAREFULLY
You do NOT build storyboards yourself. You NEVER write the storyboard, shot list, or scene breakdown in prose. You NEVER role-play a hand-off (no "@Video Specialist", no "@Asset Generator", no "PRIORITY BUILD", no "say build", no "the machine is running"). The ONE and ONLY thing that actually builds — that puts storyboards on the operator's screen — is emitting the fenced \`delegate\` block. Prose produces NOTHING.

When the operator wants it built — "make it", "make the video", "create the video", "build it", "go", "take it from here", "create the video I requested" — STOP asking questions and emit ONE short sentence + the delegate block in the SAME reply. Do NOT ask "where will this live" or "do you have art" once they've said make it — default to platform "youtube", style "cinematic", duration 30 and delegate now. Attached reference files are already understood (contents given below) — use them in the brief; NEVER ask the operator to re-attach or re-describe an attached file.

\`\`\`delegate
{"specialist":"VIDEO_SPECIALIST","brief":"<a rich creative brief in your words: the concept, who is on screen and their look (from the attached references), the emotional arc, the message, the CTA>","platform":"youtube|tiktok|instagram_reels|shorts|linkedin|generic","style":"talking_head|documentary|energetic|cinematic","targetDuration":<seconds, 15-150>,"targetAudience":"<who it's for>","callToAction":"<what they should do>","tone":"<editorial tone>","targetSceneNumber":<optional 1-based storyboard number, only when reworking ONE existing storyboard>}
\`\`\`

Write a RICH brief — the specialist turns it into a fully-specified, shot-by-shot storyboard for the operator to review. The ONLY time you withhold the block is while the operator is still openly brainstorming and has NOT asked to build. The moment they ask to build, the block is MANDATORY and questions are FORBIDDEN.

When the operator asks to rebuild / rework / fix / redo / change a SPECIFIC existing storyboard (e.g. "rebuild storyboard 5", "fix SB3", "redo the closing shot"), include \`"targetSceneNumber": N\` (the 1-based storyboard number) in the delegate block, and write \`brief\` as a SINGLE-shot description of just that one storyboard. When building a fresh full video, OMIT targetSceneNumber.`;

// ────────────────────────────────────────────────────────────────────────────
// System prompt — the Content Manager's conversational identity
// ────────────────────────────────────────────────────────────────────────────

type Attachment = z.infer<typeof AttachmentSchema>;

async function buildSystemPrompt(
  activeTab: string | undefined,
  attachments: Attachment[],
): Promise<string> {
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
- Talk like a creative director: bring a point of view, propose concrete ideas. Ask AT MOST ONE sharp clarifying question, and ONLY while the operator is still figuring out what they want — NEVER keep interrogating, and never ask anything once they've said "make it" (then you delegate immediately — see the build protocol).
- Build on what they've said; keep it tight and human — no bullet-point essays, no corporate filler.
- Stay in the tenant's brand voice (below).
- You shape the brief, then DELEGATE the build. Don't hand-write the final asset yourself.`;

  const tabBlock = `\n\n## CURRENT CONTEXT\n${describeActiveTab(activeTab)}`;
  const protocolBlock = isVideoStoryboardTab(activeTab) ? VIDEO_DELEGATION_PROTOCOL : '';

  let referenceBlock = '';
  if (attachments.length > 0) {
    const list = attachments
      .map((a) => {
        const label =
          a.kind === 'video'
            ? 'video'
            : a.kind === 'document'
              ? 'document'
              : a.kind === 'image'
                ? 'image'
                : (a.contentType ?? '').toLowerCase().startsWith('audio/')
                  ? 'audio'
                  : 'file';
        const name = a.fileName ?? a.url;
        // The AI has already READ each file — include its understanding so you can
        // reason about the actual contents, not just that a file was attached.
        return a.aiSummary
          ? `- ${name} (${label}): ${a.aiSummary}`
          : `- ${name} (${label})`;
      })
      .join('\n');
    referenceBlock = `\n\n## ATTACHED REFERENCE MATERIALS\nThe operator attached these files, and here is what each one actually contains (the AI's read of it):\n${list}\nUse this understanding directly — build the concept FROM what's in these files, not just the fact that they exist. Treat image(s) as the primary visual reference (their subject, look, and styling should anchor the concept), video(s) as motion / pacing / vibe references, and audio / documents as substance to incorporate (script, transcript, copy, data). When you delegate the build, weave the actual content into the brief (e.g. "build around the attached photo of …" / "use the script from the attached doc") so the specialist works from the real material.`;
  }
  const brandBlock = brandContext ? `\n\n## BRAND VOICE & IDENTITY (stay in this voice)\n${brandContext}` : '';

  return `${role}${tabBlock}${protocolBlock}${referenceBlock}${brandBlock}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Deterministic build trigger — the model often role-plays the hand-off in prose
// instead of emitting the delegate block, so the build never fires. When the
// operator clearly asks to build, we FORCE a structured delegate directive with a
// focused JSON-only call so a build always happens.
// ────────────────────────────────────────────────────────────────────────────

function wantsBuild(messages: { role: 'user' | 'assistant'; content: string }[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const t = (lastUser?.content ?? '').toLowerCase();
  if (!t) { return false; }
  if (/\b(make it|build it|do it|just build it|take it from here|go ahead|make the video|create the video|build the storyboards?|make the (?:f\w*ing )?video|create the video i requested|review.*create the video)\b/.test(t)) {
    return true;
  }
  return /\b(make|build|create|produce|generate|render)\b/.test(t) && /\b(video|commercial|spot|ad|storyboard)\b/.test(t);
}

async function forceDelegate(
  messages: { role: 'user' | 'assistant'; content: string }[],
  attachments: Attachment[],
): Promise<DelegateDirective | null> {
  const refBlock = attachments.length > 0
    ? `\n\nATTACHED REFERENCE FILES (build the brief FROM these — describe who is on screen using them):\n${attachments
        .map((a) => `- ${a.fileName ?? a.url}${a.aiSummary ? `: ${a.aiSummary}` : ''}`)
        .join('\n')}`
    : '';
  const sys = `You convert a conversation into ONE video-build directive. Output ONLY a JSON object — no prose, no fences, no "@Video Specialist", nothing else — matching exactly:
{"specialist":"VIDEO_SPECIALIST","brief":"<a rich creative brief: the concept, WHO is on screen and their exact look pulled from the attached references, the emotional arc, the message, the CTA>","platform":"youtube|tiktok|instagram_reels|shorts|linkedin|generic","style":"talking_head|documentary|energetic|cinematic","targetDuration":<integer 15-150>,"targetAudience":"<who it's for>","callToAction":"<what they should do>","tone":"<editorial tone>"}
Use platform "youtube", style "cinematic", targetDuration 30 unless the conversation clearly says otherwise. The brief MUST weave in the actual attached reference content.${refBlock}`;
  try {
    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [{ role: 'system', content: sys }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      temperature: 0.4,
      maxTokens: 1500,
    });
    const raw = (response.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = DelegateDirectiveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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

  const attachments = parsed.attachments ?? [];

  try {
    const systemPrompt = await buildSystemPrompt(parsed.activeTab, attachments);

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
      let directive = delegation?.directive ?? null;
      let cleanedReply = delegation?.cleanedReply ?? reply;
      // Deterministic fallback: if the operator clearly asked to build but the model
      // role-played the hand-off in prose instead of emitting a delegate block, force
      // a structured directive so the build always fires.
      if (!directive && wantsBuild(parsed.messages)) {
        directive = await forceDelegate(parsed.messages, attachments);
        if (directive) {
          cleanedReply = 'Building it now — your storyboards are on the way.';
        }
      }
      if (directive?.specialist === 'VIDEO_SPECIALIST') {
        const built = await buildStoryboardFromBrief({
          brief: directive.brief,
          platform: directive.platform,
          style: directive.style,
          targetDuration: directive.targetDuration,
          ...(directive.targetAudience ? { targetAudience: directive.targetAudience } : {}),
          ...(directive.callToAction ? { callToAction: directive.callToAction } : {}),
          ...(directive.tone ? { tone: directive.tone } : {}),
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((a) => ({
                  url: a.url,
                  ...(a.fileName ? { fileName: a.fileName } : {}),
                  ...(a.contentType ? { contentType: a.contentType } : {}),
                  ...(a.kind ? { kind: a.kind } : {}),
                  ...(a.aiSummary ? { aiSummary: a.aiSummary } : {}),
                })),
              }
            : {}),
        });
        if ('error' in built) {
          logger.warn('[ContentManager] Video Specialist delegation failed', { file: FILE, error: built.error });
          return NextResponse.json({
            success: true,
            reply: `${cleanedReply || 'I tried to build that,'} but the Video Specialist hit a problem: ${built.error}`,
          });
        }
        return NextResponse.json({
          success: true,
          reply: cleanedReply || 'Here are your storyboards — review and tweak anything.',
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
