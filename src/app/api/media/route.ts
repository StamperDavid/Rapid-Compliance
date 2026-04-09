/**
 * Media Library API
 * GET  /api/media — List media items (query: type, category, limit, offset)
 * POST /api/media — Create a media record or upload a file
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { z } from 'zod';
import type { MediaType, MediaCategory, MediaItem } from '@/types/media-library';

export const dynamic = 'force-dynamic';

const VALID_TYPES: MediaType[] = ['video', 'image', 'audio'];

const MediaJsonBodySchema = z.object({
  type: z.enum(['video', 'image', 'audio']),
  category: z.enum(['sound', 'voice', 'music', 'photo', 'graphic', 'screenshot', 'thumbnail', 'clip', 'final', 'scene']).optional(),
  name: z.string().min(1),
  url: z.string().url(),
  thumbnailUrl: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  duration: z.number().optional(),
  metadata: z.record(z.string()).optional(),
});

const COLLECTION = getSubCollection('media');

// ============================================================================
// Firestore document shape
// ============================================================================

interface FirestoreTimestamp {
  toDate(): Date;
}

interface MediaDocData {
  type: MediaType;
  category: MediaCategory;
  name: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  fileSize?: number;
  duration?: number | null;
  metadata?: Record<string, string>;
  createdAt?: FirestoreTimestamp | null;
  updatedAt?: FirestoreTimestamp | null;
  createdBy: string;
}

// ============================================================================
// GET — List media items
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 },
      );
    }

    const { searchParams } = request.nextUrl;
    const typeFilter = searchParams.get('type') as MediaType | null;
    const categoryFilter = searchParams.get('category') as MediaCategory | null;
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

    let query: FirebaseFirestore.Query = adminDb.collection(COLLECTION);

    if (typeFilter && VALID_TYPES.includes(typeFilter)) {
      query = query.where('type', '==', typeFilter);
    }
    if (categoryFilter) {
      query = query.where('category', '==', categoryFilter);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (indexErr: unknown) {
      // Fallback: if composite index is missing, query without orderBy
      const errMsg = indexErr instanceof Error ? indexErr.message : '';
      if (errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('requires an index')) {
        logger.warn('Media query missing composite index, falling back to unordered query', {
          file: 'api/media/route.ts',
        });
        let fallbackQuery: FirebaseFirestore.Query = adminDb.collection(COLLECTION);
        if (typeFilter && VALID_TYPES.includes(typeFilter)) {
          fallbackQuery = fallbackQuery.where('type', '==', typeFilter);
        }
        if (categoryFilter) {
          fallbackQuery = fallbackQuery.where('category', '==', categoryFilter);
        }
        snapshot = await fallbackQuery.limit(limit).get();
      } else {
        throw indexErr;
      }
    }
    const items: MediaItem[] = snapshot.docs.map((doc) => {
      const data = doc.data() as MediaDocData;
      return {
        id: doc.id,
        type: data.type,
        category: data.category,
        name: data.name,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl ?? null,
        mimeType: data.mimeType,
        fileSize: data.fileSize ?? 0,
        duration: data.duration ?? null,
        metadata: data.metadata ?? {},
        createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
        createdBy: data.createdBy,
      };
    });

    return NextResponse.json({
      success: true,
      items,
      total: items.length,
    });
  } catch (error) {
    logger.error('Failed to list media items', error as Error, {
      file: 'api/media/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to list media items' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Create media record (JSON body with URL, or FormData with file)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 },
      );
    }

    const contentType = request.headers.get('content-type') ?? '';
    let mediaData: {
      type: MediaType;
      category: MediaCategory;
      name: string;
      url: string;
      thumbnailUrl?: string;
      mimeType: string;
      fileSize: number;
      duration?: number;
      metadata?: Record<string, string>;
    };

    if (contentType.includes('multipart/form-data')) {
      // File upload — store as base64 data URI in Firestore
      const formData = await request.formData();
      const file = formData.get('file');
      const type = formData.get('type') as MediaType;
      const category = formData.get('category') as MediaCategory;
      const name = formData.get('name') as string;

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 },
        );
      }

      if (!type || !VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { success: false, error: 'Invalid media type' },
          { status: 400 },
        );
      }

      // Convert to base64 data URI
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type};base64,${base64}`;

      mediaData = {
        type,
        category: category ?? (type === 'audio' ? 'sound' : type === 'image' ? 'photo' : 'clip'),
        name: name ?? file.name,
        url: dataUri,
        mimeType: file.type,
        fileSize: file.size,
      };
    } else {
      // JSON body — external URL
      const rawBody: unknown = await request.json();
      const result = MediaJsonBodySchema.safeParse(rawBody);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: result.error.errors.map((e) => ({
              path: e.path.join('.') || 'unknown',
              message: e.message || 'Validation error',
            })),
          },
          { status: 400 },
        );
      }

      const body = result.data;
      mediaData = {
        type: body.type,
        category: body.category ?? (body.type === 'audio' ? 'sound' : body.type === 'image' ? 'photo' : 'clip'),
        name: body.name,
        url: body.url,
        thumbnailUrl: body.thumbnailUrl,
        mimeType: body.mimeType ?? 'application/octet-stream',
        fileSize: body.fileSize ?? 0,
        duration: body.duration,
        metadata: body.metadata,
      };
    }

    const now = new Date();
    const docRef = adminDb.collection(COLLECTION).doc();
    const record = {
      type: mediaData.type,
      category: mediaData.category,
      name: mediaData.name,
      url: mediaData.url,
      thumbnailUrl: mediaData.thumbnailUrl ?? null,
      mimeType: mediaData.mimeType,
      fileSize: mediaData.fileSize,
      duration: mediaData.duration ?? null,
      metadata: mediaData.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
    };

    await docRef.set(record);

    logger.info('Media item created', {
      file: 'api/media/route.ts',
      mediaId: docRef.id,
      type: mediaData.type,
      category: mediaData.category,
    });

    const item: MediaItem = {
      id: docRef.id,
      ...record,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create media item', error as Error, {
      file: 'api/media/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create media item' },
      { status: 500 },
    );
  }
}
