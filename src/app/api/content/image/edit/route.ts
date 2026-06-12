/**
 * POST /api/content/image/edit
 *
 * Instruction-based image editing (Flux Kontext): change part of an existing image —
 * by library `assetId` or by `imageUrl` — per a plain-language instruction, keeping
 * the rest intact. Saves the result as a NEW transparent-or-opaque library asset;
 * the original is preserved. See lib/media/edit-image-asset.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { editImageAndSave } from '@/lib/media/edit-image-asset';

export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    assetId: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    instruction: z.string().trim().min(1, 'Tell me what to change').max(800),
    name: z.string().trim().max(120).optional(),
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

    const asset = await editImageAndSave({
      ...(body.assetId ? { assetId: body.assetId } : {}),
      ...(body.imageUrl ? { imageUrl: body.imageUrl } : {}),
      instruction: body.instruction,
      ...(body.name ? { name: body.name } : {}),
      userId: user.uid,
    });

    logger.info('[image-edit] edited asset created', {
      file: 'api/content/image/edit/route.ts',
      assetId: asset.id,
    });

    return NextResponse.json({ success: true, asset, item: asset });
  } catch (error) {
    logger.error(
      'Image edit failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/content/image/edit/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Image edit failed' },
      { status: 500 },
    );
  }
}
