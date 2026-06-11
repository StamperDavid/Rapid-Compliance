/**
 * POST /api/content/image/remove-background
 *
 * True image EDITING (not generation): take an existing image — by library
 * `assetId` or by `imageUrl` — strip its solid white/near-white background to
 * full transparency, and save the result as a NEW transparent PNG in the library.
 * The source artwork is preserved pixel-for-pixel (see lib/media/background-removal).
 *
 * This is the capability the Content Manager should use when an operator asks to
 * "remove the background" / "make it transparent" — instead of regenerating the
 * image, which redraws it.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { removeBackgroundAndSave } from '@/lib/media/remove-background-asset';

export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    assetId: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    name: z.string().trim().max(120).optional(),
    /** Override the white-detection threshold (0-255) for stubborn near-white plates. */
    whiteThreshold: z.number().int().min(0).max(255).optional(),
  })
  .refine((b) => b.assetId ?? b.imageUrl, {
    message: 'Provide either assetId or imageUrl',
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
    const body = parsed.data;

    const asset = await removeBackgroundAndSave({
      ...(body.assetId ? { assetId: body.assetId } : {}),
      ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.whiteThreshold !== undefined ? { whiteThreshold: body.whiteThreshold } : {}),
      userId: user.uid,
    });

    logger.info('[remove-background] transparent asset created', {
      file: 'api/content/image/remove-background/route.ts',
      assetId: asset.id,
    });

    return NextResponse.json({ success: true, asset, item: asset });
  } catch (error) {
    logger.error(
      'Background removal failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/content/image/remove-background/route.ts' },
    );
    return NextResponse.json({ success: false, error: 'Background removal failed' }, { status: 500 });
  }
}
