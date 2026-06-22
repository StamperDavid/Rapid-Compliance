/**
 * POST /api/video-project/from-script
 *
 * VP-D handoff: turn an operator-approved (and possibly edited) timed
 * `ScriptDocument` — authored on the front-door form (VP-C) — into a persisted
 * multi-document `VideoProject` (one Shot Doc per scene, stills rendered, no video
 * yet). The script IS the segmentation, so this never runs a second segmentation
 * LLM call; it delegates straight to `generateProjectDocsFromScript`.
 *
 * Thin route: authenticate, Zod-validate the script against its canonical contract,
 * delegate, map errors to plain-English HTTP. LONG-RUNNING (authoring + still
 * renders per scene) — the browser shows a working state while it runs.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { ScriptDocumentSchema } from '@/types/video-script';
import { generateProjectDocsFromScript } from '@/lib/video/video-project-segmentation-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/video-project/from-script/route.ts';

const BodySchema = z.object({
  /** The operator-approved timed script — validated against its canonical contract. */
  script: ScriptDocumentSchema,
  /** Of the script cast, the ids that are real saved Character-Library characters. */
  savedCharacterIds: z.array(z.string().trim().min(1)).max(50).optional(),
  /** Optional id → display-name map (readability of the per-scene brief only). */
  characterNames: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid script' },
        { status: 400 },
      );
    }

    const project = await generateProjectDocsFromScript({
      script: parsed.data.script,
      userId: authResult.user.uid,
      ...(parsed.data.savedCharacterIds && parsed.data.savedCharacterIds.length > 0
        ? { savedCharacterIds: parsed.data.savedCharacterIds }
        : {}),
      ...(parsed.data.characterNames ? { characterNames: parsed.data.characterNames } : {}),
    });

    logger.info('[video-project/from-script] project created from script', {
      file: FILE,
      projectId: project.id,
      docs: project.docs.length,
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    logger.error(
      'Video project creation from script failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? `We couldn't build the videos from your script: ${error.message}`
            : "We couldn't build the videos from your script. Please try again.",
      },
      { status: 500 },
    );
  }
}
