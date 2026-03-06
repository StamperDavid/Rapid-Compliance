/**
 * AI Music Tracks API
 * GET  /api/audio/music/tracks — List previously generated tracks with filtering/sorting/pagination
 * PATCH /api/audio/music/tracks — Update track metadata (favorite, title, etc.)
 * DELETE /api/audio/music/tracks — Delete a track
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface FirestoreTrackData {
  title?: string;
  audioUrl?: string;
  duration?: number;
  style?: string;
  mood?: string[];
  tempo?: string;
  hasVocals?: boolean;
  voiceStyle?: string | null;
  lyrics?: string | null;
  prompt?: string;
  isFavorite?: boolean;
  isPreview?: boolean;
  parentPreviewId?: string | null;
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
}

const PatchSchema = z.object({
  trackId: z.string().min(1),
  isFavorite: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
});

const DeleteSchema = z.object({
  trackId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: true, tracks: [], hasMore: false });
    }

    const { searchParams } = new URL(request.url);
    const genre = searchParams.get('genre');
    const favoriteOnly = searchParams.get('favorites') === 'true';
    const sortBy = searchParams.get('sort') ?? 'newest';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const cursor = searchParams.get('cursor');
    const search = searchParams.get('search')?.toLowerCase();

    const collectionRef = adminDb.collection(`organizations/${PLATFORM_ID}/generated_music`);

    // Build query with available filters
    // Firestore composite index constraints: we can only orderBy + filter on indexed fields
    type FirestoreQuery = FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    let query: FirestoreQuery = collectionRef;

    // Apply genre filter
    if (genre && genre !== 'all') {
      query = query.where('style', '==', genre);
    }

    // Apply favorite filter
    if (favoriteOnly) {
      query = query.where('isFavorite', '==', true);
    }

    // Apply sorting
    if (sortBy === 'oldest') {
      query = query.orderBy('createdAt', 'asc');
    } else if (sortBy === 'duration') {
      query = query.orderBy('duration', 'desc');
    } else {
      // Default: newest first
      query = query.orderBy('createdAt', 'desc');
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorDoc = await collectionRef.doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // Fetch one extra to determine if there are more results
    const snapshot = await query.limit(limit + 1).get();

    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const tracks = docs.map((doc) => {
      const data = doc.data() as FirestoreTrackData;
      return {
        id: doc.id,
        title: data.title ?? 'Untitled',
        audioUrl: data.audioUrl ?? '',
        duration: data.duration ?? 0,
        style: data.style ?? '',
        mood: data.mood ?? [],
        tempo: data.tempo ?? 'medium',
        hasVocals: data.hasVocals ?? false,
        voiceStyle: data.voiceStyle ?? null,
        lyrics: data.lyrics ?? null,
        prompt: data.prompt ?? '',
        isFavorite: data.isFavorite ?? false,
        isPreview: data.isPreview ?? false,
        parentPreviewId: data.parentPreviewId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    }).filter((track) => {
      // Client-side search filter (Firestore doesn't support full-text search)
      if (search) {
        return track.title.toLowerCase().includes(search)
          || track.style.toLowerCase().includes(search)
          || track.prompt.toLowerCase().includes(search);
      }
      return true;
    });

    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

    return NextResponse.json({
      success: true,
      tracks,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to load music tracks', error instanceof Error ? error : new Error(msg), {
      file: 'audio/music/tracks/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { trackId, ...updates } = parsed.data;

    const docRef = adminDb
      .collection(`organizations/${PLATFORM_ID}/generated_music`)
      .doc(trackId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: 'Track not found' }, { status: 404 });
    }

    const updateData: Record<string, string | boolean | Date> = { updatedAt: new Date() };
    if (updates.isFavorite !== undefined) {
      updateData.isFavorite = updates.isFavorite;
    }
    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update music track', error instanceof Error ? error : new Error(msg), {
      file: 'audio/music/tracks/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const { trackId } = parsed.data;

    const docRef = adminDb
      .collection(`organizations/${PLATFORM_ID}/generated_music`)
      .doc(trackId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: 'Track not found' }, { status: 404 });
    }

    await docRef.delete();

    logger.info('Music track deleted', {
      trackId,
      file: 'audio/music/tracks/route.ts',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete music track', error instanceof Error ? error : new Error(msg), {
      file: 'audio/music/tracks/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
