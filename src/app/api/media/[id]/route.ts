/**
 * Single Media Asset API.
 *
 * GET    /api/media/[id] — fetch one asset
 * PATCH  /api/media/[id] — update mutable fields (tags, name,
 *                               thumbnailUrl, dimensions, derivedFrom,
 *                               usedInPosts, etc.)
 * DELETE /api/media/[id] — remove the asset
 *
 * Auth: every method requires a valid Firebase Bearer token.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  deleteAsset,
  getAsset,
  updateAsset,
} from '@/lib/media/media-library-service';
import {
  MEDIA_CATEGORIES,
  legacyCategoryToUnified,
  type MediaAssetCategory,
  type MediaAssetSource,
  type MediaAssetType,
  type MediaCategory,
} from '@/types/media-library';

export const dynamic = 'force-dynamic';

const ASSET_TYPES: MediaAssetType[] = ['image', 'video', 'audio', 'document'];
const ASSET_SOURCES: MediaAssetSource[] = [
  'ai-generated',
  'user-upload',
  'imported',
  'derived',
];
const LEGACY_CATEGORIES: MediaCategory[] = [
  'sound',
  'voice',
  'music',
  'photo',
  'graphic',
  'screenshot',
  'thumbnail',
  'clip',
  'final',
  'scene',
];

function isUnifiedCategory(value: string): value is MediaAssetCategory {
  return (MEDIA_CATEGORIES as readonly string[]).includes(value);
}
function isLegacyCategory(value: string): value is MediaCategory {
  return (LEGACY_CATEGORIES as readonly string[]).includes(value);
}
function normalizeCategory(value: string): MediaAssetCategory | null {
  if (isUnifiedCategory(value)) {
    return value;
  }
  if (isLegacyCategory(value)) {
    return legacyCategoryToUnified(value);
  }
  return null;
}

const PatchSchema = z
  .object({
    type: z.enum(['image', 'video', 'audio', 'document']).optional(),
    category: z.string().optional(),
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    mimeType: z.string().optional(),
    fileSize: z.number().nonnegative().optional(),
    duration: z.number().nonnegative().optional(),
    dimensions: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    source: z
      .enum(['ai-generated', 'user-upload', 'imported', 'derived'])
      .optional(),
    tags: z.array(z.string()).optional(),
    aiProvider: z.string().optional(),
    aiPrompt: z.string().optional(),
    parentAssetId: z.string().optional(),
    derivedFrom: z.array(z.string()).optional(),
    usedInPosts: z.array(z.string()).optional(),
    brandDnaApplied: z.boolean().optional(),
  })
  .strict();

// ============================================================================
// GET
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const asset = await getAsset(id);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, asset, item: asset });
  } catch (error) {
    logger.error(
      'Failed to get media asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/[id]/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to get media asset' },
      { status: 500 },
    );
  }
}

// ============================================================================
// PATCH
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const rawBody: unknown = await request.json();
    const parsed = PatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors.map((e) => ({
            path: e.path.join('.') || 'unknown',
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    const body = parsed.data;

    let normalizedCategory: MediaAssetCategory | undefined;
    if (body.category) {
      const normalized = normalizeCategory(body.category);
      if (!normalized) {
        return NextResponse.json(
          { success: false, error: `Invalid category: ${body.category}` },
          { status: 400 },
        );
      }
      normalizedCategory = normalized;
    }

    const patch: Parameters<typeof updateAsset>[1] = {
      ...(body.type && ASSET_TYPES.includes(body.type as MediaAssetType)
        ? { type: body.type as MediaAssetType }
        : {}),
      ...(normalizedCategory ? { category: normalizedCategory } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.url ? { url: body.url } : {}),
      ...(body.thumbnailUrl ? { thumbnailUrl: body.thumbnailUrl } : {}),
      ...(body.mimeType ? { mimeType: body.mimeType } : {}),
      ...(typeof body.fileSize === 'number' ? { fileSize: body.fileSize } : {}),
      ...(typeof body.duration === 'number' ? { duration: body.duration } : {}),
      ...(body.dimensions ? { dimensions: body.dimensions } : {}),
      ...(body.source && ASSET_SOURCES.includes(body.source as MediaAssetSource)
        ? { source: body.source as MediaAssetSource }
        : {}),
      ...(body.tags ? { tags: body.tags } : {}),
      ...(body.aiProvider ? { aiProvider: body.aiProvider } : {}),
      ...(body.aiPrompt ? { aiPrompt: body.aiPrompt } : {}),
      ...(body.parentAssetId ? { parentAssetId: body.parentAssetId } : {}),
      ...(body.derivedFrom ? { derivedFrom: body.derivedFrom } : {}),
      ...(body.usedInPosts ? { usedInPosts: body.usedInPosts } : {}),
      ...(typeof body.brandDnaApplied === 'boolean'
        ? { brandDnaApplied: body.brandDnaApplied }
        : {}),
    };

    const updated = await updateAsset(id, patch);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, asset: updated, item: updated });
  } catch (error) {
    logger.error(
      'Failed to update media asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/[id]/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update media asset' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const ok = await deleteAsset(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to delete media asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/[id]/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to delete media asset' },
      { status: 500 },
    );
  }
}
