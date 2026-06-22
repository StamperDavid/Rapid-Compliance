/**
 * /api/media-folders
 *   GET  — list all library folders (the tree is built client-side from parentFolderId).
 *   POST — create a folder { name, parentFolderId? }.
 *
 * Thin route: authenticate, Zod-validate, delegate to media-folders-service.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { createFolder, listFolders } from '@/lib/media/media-folders-service';

export const dynamic = 'force-dynamic';

const FILE = 'api/media-folders/route.ts';

const CreateSchema = z.object({
  name: z.string().trim().min(1, 'A folder name is required').max(200),
  parentFolderId: z.string().trim().min(1).nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const folders = await listFolders();
    return NextResponse.json({ success: true, folders });
  } catch (error) {
    logger.error('Listing media folders failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ success: false, error: 'Could not load folders.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const parsed = CreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid folder' },
        { status: 400 },
      );
    }
    const folder = await createFolder({
      name: parsed.data.name,
      parentFolderId: parsed.data.parentFolderId ?? null,
      createdBy: auth.user.uid,
    });
    return NextResponse.json({ success: true, folder });
  } catch (error) {
    logger.error('Creating media folder failed', error instanceof Error ? error : new Error(String(error)), { file: FILE });
    return NextResponse.json({ success: false, error: 'Could not create the folder.' }, { status: 500 });
  }
}
