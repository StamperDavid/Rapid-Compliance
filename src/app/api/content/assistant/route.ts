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
import { getActiveManagerGMByIndustry } from '@/lib/training/manager-golden-master-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { buildStoryboardFromBrief } from '@/lib/video/storyboard-build-service';
import { listAvatarProfiles, type AvatarProfile } from '@/lib/video/avatar-profile-service';
import { listAssets } from '@/lib/media/media-library-service';
import { removeBackgroundAndSave } from '@/lib/media/remove-background-asset';
import { editImageAndSave } from '@/lib/media/edit-image-asset';
import {
  type ContentIntent,
  ContentIntentSchema,
  findPriorIntent,
  isApproval,
} from '@/lib/content/content-intent';

// Re-exported for back-compat: the storyboard shape now lives in the shared service.
export type { AssistantStoryboard } from '@/lib/video/storyboard-build-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/assistant/route.ts';

// The conversational Content Manager brain lives in ONE Golden Master.
const CONTENT_MANAGER_ID = 'CONTENT_MANAGER';
const CONTENT_MANAGER_INDUSTRY = 'saas_sales_ops';

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

// The Content Assistant is a universal command bar: the operator can ask to
// build from ANY content-generator page (video, image, library, editor, voice).
// Delegation is NOT gated to a single page — the result lands in the right place
// client-side (a video build navigates to the video canvas, etc.).
function isContentGeneratorTab(activeTab: string | undefined): boolean {
  return (activeTab ?? '').toLowerCase().includes('/content');
}

// ────────────────────────────────────────────────────────────────────────────
// Approved intent → build input. The Content Manager gathers + CONFIRMS a
// structured ContentIntent in the chat (always pausing for approval first); on
// approval we turn that intent into the brief the Video Specialist builds from.
// ────────────────────────────────────────────────────────────────────────────

const BUILD_PLATFORMS = ['youtube', 'tiktok', 'instagram_reels', 'shorts', 'linkedin', 'generic'] as const;
type BuildPlatform = (typeof BUILD_PLATFORMS)[number];

function mapPlatform(platform: string | undefined): BuildPlatform {
  const p = (platform ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return BUILD_PLATFORMS.find((bp) => bp.replace(/[^a-z]/g, '') === p) ?? 'youtube';
}

/** Compose a rich, specialist-ready brief from the approved structured intent. */
function mapIntentToBrief(intent: ContentIntent): string {
  const subjectLines = intent.subjects
    .map((s) => {
      const how =
        s.fidelity === 'exact'
          ? "reproduce this exact character faithfully from the operator's reference images, only re-rendered in the requested style"
          : s.fidelity === 'inspired'
            ? 'use the references as loose inspiration — a similar but distinct character is fine'
            : 'invent this character from the description';
      const refs = s.referenceNames.length > 0 ? ` (references: ${s.referenceNames.join(', ')})` : '';
      const notes = s.notes ? ` — ${s.notes}` : '';
      return `${s.name} — ${how}${refs}${notes}`;
    })
    .join('; ');
  const hasExactSubjects = intent.subjects.some((s) => s.fidelity === 'exact');
  return [
    intent.summary,
    intent.message ? `Message: ${intent.message}.` : '',
    subjectLines ? `Characters: ${subjectLines}.` : '',
    hasExactSubjects
      ? 'CRITICAL: every person on screen must be ONE of the characters listed above, recreated from the operator\'s provided reference images by name — do NOT invent new or generic characters, and name the character explicitly in every scene where they appear.'
      : '',
    intent.beats.length > 0 ? `Beats: ${intent.beats.join(' → ')}.` : '',
    intent.style ? `Visual style: ${intent.style}.` : '',
    intent.callToAction ? `Call to action: ${intent.callToAction}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Load the operator's saved Character Library characters (+ stock characters).
 * Never throws — a lookup failure just means the chat runs without the cast block.
 */
async function loadSavedCharacters(userId: string): Promise<AvatarProfile[]> {
  try {
    return await listAvatarProfiles(userId);
  } catch (err) {
    logger.warn('[ContentManager] saved-character lookup failed', {
      file: FILE,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Render the operator's saved characters as a compact prompt block the Content
 * Manager can bind against. Each line carries the characterId + each Look's lookId
 * so the model can put them straight into the intent's subjects. Empty string when
 * the operator has no saved characters (the block is then omitted entirely).
 */
function formatSavedCharactersBlock(characters: AvatarProfile[]): string {
  if (characters.length === 0) {
    return '';
  }
  // Cap defensively so a large library can't blow out the prompt; saved characters
  // are a curated cast, so this is generous in practice.
  const lines = characters.slice(0, 40).map((c) => {
    const dna = c.description ? ` — ${c.description}` : '';
    const voice = c.voiceName ? ` Voice: ${c.voiceName}.` : '';
    const looks = (c.looks ?? [])
      .map(
        (l) =>
          `    • Look "${l.name}" (lookId: ${l.id})${l.outfitDescription ? ` — ${l.outfitDescription}` : ''}${l.isPrimary ? ' [primary]' : ''}`,
      )
      .join('\n');
    return `- "${c.name}" (characterId: ${c.id})${dna}.${voice}${looks ? `\n  Looks:\n${looks}` : ''}`;
  });
  return `\n\n## SAVED CHARACTERS — the operator's reusable cast (PREFER these)\nThese are saved characters with LOCKED identities (each carries its own face, voice, and reference images). When the operator names or clearly means one of them, treat that subject AS the saved character:\n- Set the subject's "characterId" to the matching character's id.\n- If they pick (or you choose) a specific Look — an outfit/state — set the subject's "lookId" to that Look's id. Default to the [primary] Look when they don't specify one.\n- Match by name, case-insensitive, allowing nicknames and partials (e.g. "David" → "David - Professional").\n- A saved character does NOT need attached reference files — its identity comes from the saved profile. The operator may still attach extra references, which you map as usual.\n- Copy the character's key identity details into the subject's "notes" so the build keeps them consistent.\n${lines.join('\n')}`;
}

/**
 * Backstop for the approval turn: the proposal turn is SUPPOSED to carry a parseable
 * ```intent block, but the model occasionally emits malformed JSON or the wrong fence.
 * When the operator approves and no clean block is in history, re-derive the final
 * confirmed intent from the whole conversation with a focused JSON-only call so the
 * build always fires (mirrors the spirit of the old forceDelegate).
 */
async function forceIntent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  attachments: Attachment[],
  savedCharactersBlock: string,
): Promise<ContentIntent | null> {
  const refBlock = attachments.length > 0
    ? `\n\nATTACHED REFERENCE FILES (map these to the right characters by name + content):\n${attachments
        .map((a) => `- ${a.fileName ?? a.url}${a.aiSummary ? `: ${a.aiSummary}` : ''}`)
        .join('\n')}`
    : '';
  const sys = `From the conversation below, output ONLY a JSON object (no prose, no fences) capturing the operator's FINAL confirmed request, folding in every refinement they made. Match exactly:
{"mediaType":"video|image|music|text","summary":"<plain summary>","subjects":[{"name":"<character>","referenceNames":["<attached file names depicting them>"],"fidelity":"exact|inspired|new","characterId":"<saved character id, if this subject IS a saved character>","lookId":"<chosen Look id, if any>"}],"style":"<e.g. Pixar 3D>","format":{"durationSeconds":<int>,"aspectRatio":"<e.g. 16:9>","platform":"<e.g. youtube>"},"message":"<core message>","beats":["<beat>"],"callToAction":"<ask>"}
Default fidelity "exact" for the operator's named characters. Map references using both file names and the AI's read of each file. If a character appears in MULTIPLE forms (an alter ego, a costume change, a transformation — e.g. a civilian who becomes a hero, or a businessman who becomes a villain), model them as ONE subject with ONE shared reference set and describe the forms in "notes" — they are the SAME person (identical face, hair, beard) and only clothing/state changes. When a subject IS one of the SAVED characters listed below, set its "characterId" (and "lookId" for the chosen Look); omit both fields otherwise.${savedCharactersBlock}${refBlock}`;
  try {
    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [{ role: 'system', content: sys }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      temperature: 0.3,
      maxTokens: 2500,
    });
    // Extract the JSON object even if the model wrapped it in fences or prefixed it
    // with a stray label like "intent" — take everything between the first { and last }.
    const content = (response.content ?? '').trim();
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    const raw = start >= 0 && end > start ? content.slice(start, end + 1) : content;
    const parsed = ContentIntentSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logger.warn('[ContentManager] forceIntent produced invalid intent', {
        file: FILE,
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        rawSnippet: raw.slice(0, 300),
      });
      return null;
    }
    logger.info('[ContentManager] forceIntent re-derived intent on approval', { file: FILE, mediaType: parsed.data.mediaType });
    return parsed.data;
  } catch (err) {
    logger.warn('[ContentManager] forceIntent threw', {
      file: FILE,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

type BuildAttachment = {
  url: string;
  fileName?: string;
  contentType?: string;
  kind?: 'image' | 'video' | 'document' | 'other';
  aiSummary?: string;
};

/**
 * When the chat's attachments didn't survive (e.g. a hard refresh dropped the
 * composer state), resolve the intent's referenced files from the media library
 * instead — they were uploaded as `reference-material`, so the build can still use
 * the operator's actual characters without making them re-upload.
 */
async function resolveLibraryReferences(intent: ContentIntent): Promise<BuildAttachment[]> {
  const wantedNames = intent.subjects.flatMap((s) => s.referenceNames).filter((n) => n.length > 0);
  if (wantedNames.length === 0) {
    return [];
  }
  let assets: Awaited<ReturnType<typeof listAssets>>['assets'];
  try {
    ({ assets } = await listAssets({ source: 'user-upload', limit: 300 }));
  } catch (err) {
    logger.warn('[ContentManager] library reference lookup failed', {
      file: FILE,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
  const refAssets = assets.filter(
    (a) => (a.tags ?? []).includes('reference-material') && (a.type === 'image' || a.type === 'video'),
  );
  // Normalize a filename to comparable words, KEEPING short/numeric tokens so
  // "Velocity 1" and "Velocity 2" stay distinct (the old token filter dropped the
  // number and collapsed all of a character's images into one).
  const norm = (s: string): string =>
    s.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const out: BuildAttachment[] = [];
  const seen = new Set<string>();
  for (const name of wantedNames) {
    const target = norm(name);
    if (!target) {
      continue;
    }
    // Prefer an exact normalized match; fall back to a contains-match either way.
    const match =
      refAssets.find((a) => norm(a.name) === target) ??
      refAssets.find((a) => {
        const an = norm(a.name);
        return an.includes(target) || target.includes(an);
      });
    if (match && !seen.has(match.url)) {
      seen.add(match.url);
      out.push({
        url: match.url,
        fileName: match.name,
        contentType: match.mimeType,
        kind: match.type === 'video' ? 'video' : 'image',
        ...(match.description ? { aiSummary: match.description } : {}),
      });
    }
  }
  return out;
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

// ────────────────────────────────────────────────────────────────────────────
// System prompt — loaded from the Content Manager's Golden Master (one brain)
// ────────────────────────────────────────────────────────────────────────────

type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * The Content Manager's conversational identity, intent protocol, and brand
 * voice all live in its Golden Master (managerGoldenMasters / CONTENT_MANAGER),
 * with Brand DNA baked in at seed time (Standing Rule #1). This route loads that
 * ONE GM and uses its systemPrompt verbatim, appending only per-request runtime
 * context (active tab, the operator's saved cast, attached references). There is
 * NO hardcoded identity and NO runtime Brand DNA merge here.
 *
 * Returns null when the GM is not seeded — the caller surfaces an honest error
 * rather than silently falling back to a divergent hardcoded brain.
 */
async function buildSystemPrompt(
  activeTab: string | undefined,
  attachments: Attachment[],
  savedCharactersBlock: string,
): Promise<string | null> {
  const gm = await getActiveManagerGMByIndustry(CONTENT_MANAGER_ID, CONTENT_MANAGER_INDUSTRY);
  const rawPrompt = gm?.config?.systemPrompt;
  const base = typeof rawPrompt === 'string' && rawPrompt.length > 0
    ? rawPrompt
    : (gm?.systemPromptSnapshot ?? '');
  if (!base) {
    logger.error(
      '[ContentManager] No active Content Manager GM found — run scripts/seed-content-manager-gm.js',
      undefined,
      { file: FILE },
    );
    return null;
  }

  const onContentTab = isContentGeneratorTab(activeTab);
  const tabBlock = `\n\n## CURRENT CONTEXT\n${describeActiveTab(activeTab)}`;
  // Only surface the saved cast where the intent protocol can act on it (emit
  // characterId/lookId in an intent).
  const characterBlock = onContentTab ? savedCharactersBlock : '';

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

  return `${base}${tabBlock}${characterBlock}${referenceBlock}`;
}

/**
 * Detect a clear "remove the white background / make it transparent" request.
 * Deliberately narrow so it only intercepts an explicit edit ask — never a normal
 * generation request that merely mentions a background. (Avoids matching e.g.
 * "no background music".)
 */
function isBackgroundRemovalRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(remove|strip|delete|get rid of|take out|knock out|cut out)\b[^.!?]*\bbackground\b/.test(t) ||
    /\btransparent\s+background\b/.test(t) ||
    /\bmake\s+(it|this|the\s+(image|logo|picture))\s+transparent\b/.test(t) ||
    /\bbackground\s+transparent\b/.test(t)
  );
}

const EDIT_TARGET = '(this|that|it|the\\s+(image|photo|picture|logo|pic|graphic|background))';

/**
 * Detect a request to EDIT an existing image (change part of it, keep the rest) vs.
 * create something new. Narrow on purpose: it must clearly target "this / the image",
 * and never matches a video request. Pairs with an attached image (or an explicit
 * image noun) before it acts — otherwise the flow asks which image.
 */
function isImageEditRequest(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/\bvideo\b/.test(t)) { return false; }
  return (
    new RegExp(`\\b(edit|change|modify|tweak|adjust|alter|retouch|recolou?r|recolor)\\b[^.!?]*\\b${EDIT_TARGET}\\b`).test(t) ||
    new RegExp(`\\b(make|turn)\\s+${EDIT_TARGET}\\b`).test(t) ||
    new RegExp(`\\b(remove|delete|erase|add|put|replace|swap)\\b[^.!?]*\\b${EDIT_TARGET}\\b`).test(t) ||
    /^(edit|tweak|retouch)\b/.test(t)
  );
}

function mentionsImageNoun(text: string): boolean {
  return /\b(image|photo|picture|logo|pic|graphic)\b/.test(text.toLowerCase());
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

  // Two-phase flow: the Content Manager ALWAYS proposes its understanding first
  // (Phase A) and only BUILDS once the operator approves it (Phase B). The approved
  // understanding rides through the conversation as a fenced ```intent block on the
  // proposal turn; on approval we read it back (or re-derive it via forceIntent if
  // the block didn't parse cleanly) to build.
  const onContentTab = isContentGeneratorTab(parsed.activeTab);
  const lastUser = [...parsed.messages].reverse().find((m) => m.role === 'user');
  const userApproves = onContentTab && isApproval(lastUser?.content ?? '');
  // A proposal exists if there's a prior assistant turn (the welcome is filtered out
  // client-side before sending, so this only trips on a real proposal).
  const hasPriorProposal = parsed.messages.slice(0, -1).some((m) => m.role === 'assistant');

  logger.info('[ContentManager] intent check', {
    file: FILE,
    activeTab: parsed.activeTab ?? '(none)',
    attachmentCount: attachments.length,
    userApproves,
    hasPriorProposal,
    lastUserSnippet: (lastUser?.content ?? '').slice(0, 160),
  });

  try {
    // ── Background removal — a deterministic EDIT, not generation. Intercept an
    // explicit "remove the white background / make it transparent" ask and run the
    // real editor on the referenced image instead of letting the generator redraw
    // the logo. Only fires on a clear phrase + a resolvable image; otherwise it
    // falls through to the normal flow untouched.
    if (onContentTab && isBackgroundRemovalRequest(lastUser?.content ?? '')) {
      const imageRef = attachments.find(
        (a) => a.kind === 'image' || (a.contentType ?? '').startsWith('image/'),
      );
      if (!imageRef?.url) {
        return NextResponse.json({
          success: true,
          reply:
            "Tell me which image and I'll remove the background and save a transparent copy — attach it here, or open it in your Library and click “Remove background”. I won't regenerate it.",
        });
      }
      try {
        const baseName = imageRef.fileName ? imageRef.fileName.replace(/\.[a-z0-9]+$/i, '') : 'image';
        const created = await removeBackgroundAndSave({
          imageUrl: imageRef.url,
          name: `${baseName} (transparent)`,
          userId: authResult.user.uid,
        });
        logger.info('[ContentManager] background removed via chat', { file: FILE, assetId: created.id });
        return NextResponse.json({
          success: true,
          reply: `Done — I removed the background from **${imageRef.fileName ?? 'your image'}** and saved a transparent copy, "**${created.name}**", to your Library. Refresh the Library to see it. Your original is untouched — no regeneration.`,
          mediaLibraryUpdated: true,
        });
      } catch (err) {
        logger.warn('[ContentManager] background removal failed', {
          file: FILE,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({
          success: true,
          reply: `I tried to strip the background but hit a problem: ${err instanceof Error ? err.message : 'unknown error'}. You can also use the “Remove background” button on the image in your Library.`,
        });
      }
    }

    // ── Image editing — change part of an existing image, keep the rest (Flux
    // Kontext). Narrowly detected so it never hijacks a "create new"/video request.
    // With an attached image we run it; without one we ASK which image rather than
    // guessing — a non-technical user must never hit a silent dead end.
    if (onContentTab && isImageEditRequest(lastUser?.content ?? '')) {
      const imageRef = attachments.find(
        (a) => a.kind === 'image' || (a.contentType ?? '').startsWith('image/'),
      );
      if (imageRef?.url) {
        try {
          const instruction = (lastUser?.content ?? '').trim();
          const baseName = imageRef.fileName ? imageRef.fileName.replace(/\.[a-z0-9]+$/i, '') : 'image';
          const created = await editImageAndSave({
            imageUrl: imageRef.url,
            instruction,
            name: `${baseName} (edited)`,
            userId: authResult.user.uid,
          });
          logger.info('[ContentManager] image edited via chat', { file: FILE, assetId: created.id });
          return NextResponse.json({
            success: true,
            reply: `Done — I edited **${imageRef.fileName ?? 'your image'}** and saved the new version, "**${created.name}**", to your Library (your original is untouched). It keeps everything else and changes only what you described. Want another tweak? Just tell me.`,
            mediaLibraryUpdated: true,
          });
        } catch (err) {
          logger.warn('[ContentManager] image edit failed', {
            file: FILE,
            error: err instanceof Error ? err.message : String(err),
          });
          return NextResponse.json({
            success: true,
            reply: `I tried to make that edit but hit a problem: ${err instanceof Error ? err.message : 'unknown error'}. Try rewording the change, or use the “Edit image” box on the image in your Library.`,
          });
        }
      } else if (mentionsImageNoun(lastUser?.content ?? '')) {
        // Clear edit intent but no image to act on — ASK, never silently stall.
        return NextResponse.json({
          success: true,
          reply:
            "Happy to edit it — which image do you mean? Attach it here, or open it in your Library and use the “Edit image” box. Then tell me the change (for example, “make the logo bigger” or “change the background to blue”).",
        });
      }
      // Otherwise (ambiguous, no image) fall through to the normal flow.
    }

    // Saved Character Library cast — surfaced to the model so it can bind a subject
    // to a saved character (characterId/lookId). Loaded once on content tabs; reused
    // by both the approval backstop (Phase B) and the proposal prompt (Phase A).
    const savedCharactersBlock = onContentTab
      ? formatSavedCharactersBlock(await loadSavedCharacters(authResult.user.uid))
      : '';

    // ── PHASE B — the operator approved the pending understanding. Resolve the intent
    // (parsed block first, forceIntent backstop second) and build it.
    if (userApproves && hasPriorProposal) {
      // Re-derive the final intent from the WHOLE conversation (folds in every
      // refinement — e.g. a later "make it 90 seconds"). Fall back to the latest
      // embedded block only if that synthesis fails.
      const priorIntent =
        (await forceIntent(parsed.messages, attachments, savedCharactersBlock)) ??
        findPriorIntent(parsed.messages);
      if (priorIntent?.mediaType === 'video') {
        // References come from the chat composer; if those didn't survive (e.g. a hard
        // refresh emptied it), resolve them from the media library by the intent's
        // referenceNames so the operator's characters still reach the build.
        const buildAttachments: BuildAttachment[] =
          attachments.length > 0
            ? attachments.map((a) => ({
                url: a.url,
                ...(a.fileName ? { fileName: a.fileName } : {}),
                ...(a.contentType ? { contentType: a.contentType } : {}),
                ...(a.kind ? { kind: a.kind } : {}),
                ...(a.aiSummary ? { aiSummary: a.aiSummary } : {}),
              }))
            : await resolveLibraryReferences(priorIntent);
        logger.info('[ContentManager] build references resolved', {
          file: FILE,
          fromChat: attachments.length,
          fromLibrary: attachments.length === 0 ? buildAttachments.length : 0,
          durationSeconds: priorIntent.format.durationSeconds ?? 30,
          // Subjects bound to a saved Character Library character (Step 1 binding).
          boundCharacters: priorIntent.subjects.filter((s) => s.characterId).length,
        });
        const built = await buildStoryboardFromBrief({
          brief: mapIntentToBrief(priorIntent),
          platform: mapPlatform(priorIntent.format.platform),
          style: 'cinematic',
          targetDuration:
            priorIntent.format.durationSeconds && priorIntent.format.durationSeconds >= 5
              ? priorIntent.format.durationSeconds
              : 30,
          ...(priorIntent.callToAction ? { callToAction: priorIntent.callToAction } : {}),
          ...(buildAttachments.length > 0 ? { attachments: buildAttachments } : {}),
          // Subjects carry any saved-character bindings (characterId/lookId); the build
          // resolves them to face + Look anchors and sets each scene's avatarId.
          ...(priorIntent.subjects.length > 0 ? { subjects: priorIntent.subjects } : {}),
        });
        if ('error' in built) {
          logger.warn('[ContentManager] Video build failed', { file: FILE, error: built.error });
          return NextResponse.json({
            success: true,
            reply: `I started building, but the Video Specialist hit a problem: ${built.error}`,
          });
        }
        logger.info('[ContentManager] video build complete', { file: FILE, scenes: built.storyboards.length });
        return NextResponse.json({
          success: true,
          reply: 'Building it now — your storyboards are on the way.',
          storyboards: built.storyboards,
          subjects: priorIntent.subjects,
        });
      }
      if (priorIntent?.mediaType === 'image') {
        // One image per subject. References come from the chat or, if it was emptied,
        // the library. Each request is built here; the client runs the actual
        // generations (reusing /api/content/asset-generator/generate, which persists
        // every result to the library) and then shows them.
        const refs: BuildAttachment[] =
          attachments.length > 0
            ? attachments.map((a) => ({
                url: a.url,
                ...(a.fileName ? { fileName: a.fileName } : {}),
                ...(a.kind ? { kind: a.kind } : {}),
              }))
            : await resolveLibraryReferences(priorIntent);
        const subjects =
          priorIntent.subjects.length > 0
            ? priorIntent.subjects
            : [{ name: priorIntent.summary.slice(0, 100), referenceNames: [], fidelity: 'inspired' as const, notes: undefined }];
        const tok = (x: string): string[] =>
          x.toLowerCase().replace(/\.[a-z0-9]+$/i, '').split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
        const imageRequests = subjects.map((s) => {
          const promptParts = [
            s.name,
            s.notes ?? '',
            priorIntent.message ?? '',
            priorIntent.style ? `Style: ${priorIntent.style}.` : '',
          ].filter(Boolean);
          let referenceImageUrl: string | undefined;
          if (s.fidelity !== 'new' && refs.length > 0) {
            const imgs = refs.filter((r) => r.kind !== 'video');
            const wanted = s.referenceNames.flatMap(tok);
            const match =
              imgs.find((r) => {
                const rn = tok(r.fileName ?? '');
                return wanted.some((w) => rn.some((n) => n.includes(w) || w.includes(n)));
              }) ?? imgs[0];
            referenceImageUrl = match?.url;
          }
          return {
            name: s.name,
            prompt: promptParts.join(' ').slice(0, 1000),
            fidelity: s.fidelity,
            ...(referenceImageUrl ? { referenceImageUrl } : {}),
          };
        });
        logger.info('[ContentManager] image build dispatched', { file: FILE, count: imageRequests.length });
        return NextResponse.json({
          success: true,
          reply: `On it — generating ${imageRequests.length} image${imageRequests.length === 1 ? '' : 's'} now. They'll appear in the image generator (and your library) as each one finishes.`,
          imageRequests,
        });
      }
      // Music / text builders are wired in the following phases. Until then,
      // acknowledge the approval rather than silently doing nothing.
      if (priorIntent) {
        return NextResponse.json({
          success: true,
          reply: `Got your approval — building ${priorIntent.mediaType} straight from the chat is coming next; video and image are live right now.`,
        });
      }
      // Couldn't resolve an intent (block unparseable AND forceIntent failed) — fall
      // through to Phase A and re-propose so the operator can re-confirm.
    }

    // ── PHASE A — interpret the request and PROPOSE the understanding (no build).
    const systemPrompt = await buildSystemPrompt(parsed.activeTab, attachments, savedCharactersBlock);
    if (!systemPrompt) {
      return NextResponse.json(
        { success: false, error: "The Content Manager isn't configured right now. Please try again shortly." },
        { status: 503 },
      );
    }
    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: systemPrompt },
        ...parsed.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      maxTokens: 3000,
    });

    const reply = response.content?.trim();
    if (!reply) {
      logger.warn('[ContentManager] LLM returned empty reply', { file: FILE });
      return NextResponse.json(
        { success: false, error: 'The content manager did not return a response. Please try again.' },
        { status: 502 },
      );
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
