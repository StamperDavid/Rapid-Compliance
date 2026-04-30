/**
 * Media Library API — list + create.
 *
 * GET  /api/media — list assets, returns `UnifiedMediaAsset[]`.
 *   Query params: type, category, tags (comma-separated), search, source,
 *                 createdAfter, createdBefore, limit, offset
 *
 * POST /api/media — create an asset (JSON body or multipart upload).
 *   Returns the created `UnifiedMediaAsset`.
 *
 * Auth: every method requires a valid Firebase Bearer token.
 *
 * Backward compatibility: legacy callers (the /content/video/library page
 * and EditorMediaPanel) use shorter category names (`voice`, `music`,
 * `clip`, `final`, `scene`). We translate those into the canonical unified
 * categories on the way in so existing UI keeps working.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  createAsset,
  listAssets,
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

function defaultCategoryForType(type: MediaAssetType): MediaAssetCategory {
  switch (type) {
    case 'audio':
      return 'sound';
    case 'video':
      return 'video-clip';
    case 'document':
      return 'other';
    case 'image':
    default:
      return 'photo';
  }
}

// ============================================================================
// POST body schema (JSON form)
// ============================================================================

const PostJsonSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'document']),
  category: z.string().optional(),
  name: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
  thumbnailUrl: z.string().url().optional(),
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
});

// ============================================================================
// GET — list assets
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = request.nextUrl;

    // type
    const rawType = searchParams.get('type');
    let type: MediaAssetType | undefined;
    if (rawType) {
      if (!ASSET_TYPES.includes(rawType as MediaAssetType)) {
        return NextResponse.json(
          { success: false, error: `Invalid type: ${rawType}` },
          { status: 400 },
        );
      }
      type = rawType as MediaAssetType;
    }

    // category (accepts unified or legacy alias)
    const rawCategory = searchParams.get('category');
    let category: MediaAssetCategory | undefined;
    if (rawCategory) {
      const normalized = normalizeCategory(rawCategory);
      if (!normalized) {
        return NextResponse.json(
          { success: false, error: `Invalid category: ${rawCategory}` },
          { status: 400 },
        );
      }
      category = normalized;
    }

    // source
    const rawSource = searchParams.get('source');
    let source: MediaAssetSource | undefined;
    if (rawSource) {
      if (!ASSET_SOURCES.includes(rawSource as MediaAssetSource)) {
        return NextResponse.json(
          { success: false, error: `Invalid source: ${rawSource}` },
          { status: 400 },
        );
      }
      source = rawSource as MediaAssetSource;
    }

    // tags (comma-separated, ANY-match)
    const rawTags = searchParams.get('tags');
    const tags = rawTags
      ? rawTags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

    const search = searchParams.get('search') ?? undefined;
    const createdAfter = searchParams.get('createdAfter') ?? undefined;
    const createdBefore = searchParams.get('createdBefore') ?? undefined;

    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.max(1, Number(limitParam)) : undefined;
    const offset = offsetParam ? Math.max(0, Number(offsetParam)) : undefined;

    const { assets, total } = await listAssets({
      type,
      category,
      source,
      tags,
      search,
      createdAfter,
      createdBefore,
      limit,
      offset,
    });

    // Legacy callers (library page, EditorMediaPanel) read `items` from the
    // response; current callers can read `assets`. Both keys point at the
    // same array for a soft migration.
    return NextResponse.json({
      success: true,
      assets,
      items: assets,
      total,
    });
  } catch (error) {
    logger.error(
      'Failed to list media assets',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to list media assets' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — create asset
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const rawType = formData.get('type');
      const rawCategory = formData.get('category');
      const rawName = formData.get('name');

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 },
        );
      }

      const type =
        typeof rawType === 'string' && ASSET_TYPES.includes(rawType as MediaAssetType)
          ? (rawType as MediaAssetType)
          : null;
      if (!type) {
        return NextResponse.json(
          { success: false, error: 'Invalid or missing type' },
          { status: 400 },
        );
      }

      let category: MediaAssetCategory = defaultCategoryForType(type);
      if (typeof rawCategory === 'string' && rawCategory.length > 0) {
        const normalized = normalizeCategory(rawCategory);
        if (!normalized) {
          return NextResponse.json(
            { success: false, error: `Invalid category: ${rawCategory}` },
            { status: 400 },
          );
        }
        category = normalized;
      }

      const name = typeof rawName === 'string' && rawName.length > 0 ? rawName : file.name;

      // Convert file to data URI. (Storage upload should be handled by
      // /api/media/persist after creation if a permanent URL is required.)
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type || 'application/octet-stream'};base64,${base64}`;

      const asset = await createAsset({
        type,
        category,
        name,
        url: dataUri,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        source: 'user-upload',
        createdBy: user.uid,
        tags: [],
        brandDnaApplied: false,
      });

      return NextResponse.json(
        { success: true, asset, item: asset },
        { status: 201 },
      );
    }

    // JSON body
    const rawBody: unknown = await request.json();
    const parsed = PostJsonSchema.safeParse(rawBody);
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

    let category: MediaAssetCategory = defaultCategoryForType(body.type);
    if (body.category) {
      const normalized = normalizeCategory(body.category);
      if (!normalized) {
        return NextResponse.json(
          { success: false, error: `Invalid category: ${body.category}` },
          { status: 400 },
        );
      }
      category = normalized;
    }

    const asset = await createAsset({
      type: body.type,
      category,
      name: body.name,
      url: body.url,
      mimeType: body.mimeType ?? 'application/octet-stream',
      fileSize: body.fileSize ?? 0,
      source: body.source ?? 'imported',
      createdBy: user.uid,
      tags: body.tags ?? [],
      ...(body.thumbnailUrl ? { thumbnailUrl: body.thumbnailUrl } : {}),
      ...(typeof body.duration === 'number' ? { duration: body.duration } : {}),
      ...(body.dimensions ? { dimensions: body.dimensions } : {}),
      ...(body.aiProvider ? { aiProvider: body.aiProvider } : {}),
      ...(body.aiPrompt ? { aiPrompt: body.aiPrompt } : {}),
      ...(body.parentAssetId ? { parentAssetId: body.parentAssetId } : {}),
      ...(body.derivedFrom ? { derivedFrom: body.derivedFrom } : {}),
      ...(body.usedInPosts ? { usedInPosts: body.usedInPosts } : {}),
      brandDnaApplied: body.brandDnaApplied === true,
    });

    return NextResponse.json(
      { success: true, asset, item: asset },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      'Failed to create media asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/media/route.ts' },
    );
    return NextResponse.json(
      { success: false, error: 'Failed to create media asset' },
      { status: 500 },
    );
  }
}
