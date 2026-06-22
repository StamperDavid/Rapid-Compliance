/**
 * /api/media-folders/[id]
 *   PATCH  — rename and/or reparent a folder { name?, parentFolderId? } (null = move to root).
 *   DELETE — delete a folder; its direct child folders + assets are reparented to its parent.
 *
 * Thin route: authenticate, Zod-validate, delegate to media-folders-service. Cycle/own-parent
 * attempts return a plain-English 400.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { deleteFolder, updateFolder } from '@/lib/media/media-folders-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/media-folders/[id]/route.ts';

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    parentFolderId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((p) => p.name !== undefined || 'parentFolderId' in p, {
    message: 'Nothing to update',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { id } = await params;
    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid update' },
        { status: 400 },
      );
    }
    const folder = await updateFolder(id, parsed.data);
    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, folder });
  } catch (error) {
    // Cycle / own-parent guards throw a plain-English message — surface as 400.
    const message = error instanceof Error ? error.message : 'Could not update the folder.';
    const isGuard = /parent|subfolder/i.test(message);
    logger.error('Updating media folder failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ success: false, error: message }, { status: isGuard ? 400 : 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { id } = await params;
    const ok = await deleteFolder(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Folder not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Deleting media folder failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ success: false, error: 'Could not delete the folder.' }, { status: 500 });
  }
}
