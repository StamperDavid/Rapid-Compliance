/**
 * GET  /api/video/voice-favorites — Get user's favorite voice IDs
 * POST /api/video/voice-favorites — Toggle a voice favorite
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

const COLLECTION_PATH = `organizations/${PLATFORM_ID}/voice_favorites`;

const ToggleFavoriteSchema = z.object({
  voiceId: z.string().min(1),
  isFavorite: z.boolean(),
});

// ============================================================================
// GET — Fetch all favorite voice IDs for this user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { user } = authResult;
    const userId = String(user.uid);

    if (!adminDb) {
      return NextResponse.json({ success: true, favoriteIds: [] });
    }

    const snapshot = await adminDb
      .collection(COLLECTION_PATH)
      .where('userId', '==', userId)
      .get();

    const favoriteIds = snapshot.docs.map((doc) => doc.data().voiceId as string);

    return NextResponse.json({ success: true, favoriteIds });
  } catch (error) {
    logger.error(
      'Failed to fetch voice favorites',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/voice-favorites/route.ts' }
    );
    return NextResponse.json({ success: true, favoriteIds: [] });
  }
}

// ============================================================================
// POST — Toggle a voice favorite
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { user } = authResult;
    const userId = String(user.uid);

    const body: unknown = await request.json();
    const parseResult = ToggleFavoriteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { voiceId, isFavorite } = parseResult.data;

    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }

    // Use a composite doc ID to ensure uniqueness per user+voice
    const docId = `${userId}_${voiceId}`;

    if (isFavorite) {
      await adminDb.collection(COLLECTION_PATH).doc(docId).set({
        userId,
        voiceId,
        createdAt: new Date().toISOString(),
      });
    } else {
      await adminDb.collection(COLLECTION_PATH).doc(docId).delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Failed to toggle voice favorite',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/video/voice-favorites/route.ts' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update favorite' },
      { status: 500 }
    );
  }
}
