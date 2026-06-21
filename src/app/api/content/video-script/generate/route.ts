/**
 * POST /api/content/video-script/generate
 *
 * Stage 1 of the video front door (VP-C entry point). Runs the Screenwriter/
 * Director agent (`generateScript`) to turn a plain-language creative brief into a
 * complete, contract-valid TIMED `ScriptDocument` — the editable face of which is
 * the RenderZero-styled `VideoScriptForm`.
 *
 * This route is intentionally THIN: authenticate, Zod-validate the body, delegate
 * all the work to the screenwriter specialist (the service layer), and return the
 * validated script. It does NO Brand DNA loading and NO prompt assembly — the agent
 * owns its Golden Master (Standing Rule #1). On any failure it returns a plain-
 * English message (the end-users are non-technical SMB operators), never a silent
 * error.
 *
 * The browser awaits this directly (unlike the long-running Shot Doc build): a
 * single LLM script generation completes in seconds, and the operator is staring
 * at a loading state on the form waiting for the draft to come back.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { generateScript } from '@/lib/agents/content/screenwriter/specialist';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/video-script/generate/route.ts';

const BodySchema = z.object({
  /** The creative brief / prompt, in plain language. */
  brief: z.string().trim().min(1, 'Describe the video you want to make').max(8000),
  /** Optional title hint for the script. */
  title: z.string().trim().max(300).optional(),
  /** Target platforms, e.g. ["youtube", "tiktok"]. The screenwriter decides if omitted. */
  platforms: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  /** Desired tone / vibe hint. */
  tone: z.string().trim().max(500).optional(),
  /** Saved Character-Library characters the operator EXPLICITLY chose to cast. */
  selectedCharacterIds: z.array(z.string().trim().min(1)).max(50).optional(),
  /** Saved Location-Library locations the operator EXPLICITLY chose. */
  selectedLocationIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { brief, title, platforms, tone, selectedCharacterIds, selectedLocationIds } = parsed.data;

    const script = await generateScript({
      brief,
      userId: user.uid,
      ...(title ? { title } : {}),
      ...(platforms && platforms.length > 0 ? { platforms } : {}),
      ...(tone ? { tone } : {}),
      ...(selectedCharacterIds && selectedCharacterIds.length > 0 ? { selectedCharacterIds } : {}),
      ...(selectedLocationIds && selectedLocationIds.length > 0 ? { selectedLocationIds } : {}),
    });

    logger.info('[video-script/generate] script drafted', {
      file: FILE,
      userId: user.uid,
      scenes: script.scenes.length,
      totalSeconds: script.totalSeconds,
    });

    return NextResponse.json({ success: true, script });
  } catch (error) {
    logger.error(
      'Video script generation failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `We couldn't draft your script: ${error.message}`
            : "We couldn't draft your script. Please try again.",
      },
      { status: 500 },
    );
  }
}
