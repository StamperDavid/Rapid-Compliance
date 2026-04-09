/**
 * Single Media Item API
 * GET    /api/media/[mediaId] — Get a single media item
 * DELETE /api/media/[mediaId] — Delete a media item
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { MediaType, MediaCategory, MediaItem } from '@/types/media-library';

export const dynamic = 'force-dynamic';

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
// GET — Single media item
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { mediaId } = await params;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 },
      );
    }

    const doc = await adminDb.collection(COLLECTION).doc(mediaId).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Media item not found' },
        { status: 404 },
      );
    }

    const data = doc.data() as MediaDocData;
    const item: MediaItem = {
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

    return NextResponse.json({ success: true, item });
  } catch (error) {
    logger.error('Failed to get media item', error as Error, {
      file: 'api/media/[mediaId]/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to get media item' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Remove media item
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { mediaId } = await params;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 },
      );
    }

    const docRef = adminDb.collection(COLLECTION).doc(mediaId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: 'Media item not found' },
        { status: 404 },
      );
    }

    await docRef.delete();

    logger.info('Media item deleted', {
      file: 'api/media/[mediaId]/route.ts',
      mediaId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete media item', error as Error, {
      file: 'api/media/[mediaId]/route.ts',
    });
    return NextResponse.json(
      { success: false, error: 'Failed to delete media item' },
      { status: 500 },
    );
  }
}
