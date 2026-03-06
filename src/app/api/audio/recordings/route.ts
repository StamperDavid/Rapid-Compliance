/**
 * Audio Recordings API
 * POST /api/audio/recordings — Save a voice recording to Firestore
 * GET  /api/audio/recordings — List saved recordings
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const SaveRecordingSchema = z.object({
  name: z.string().min(1).max(100),
  base64: z.string().min(1),
  contentType: z.string().min(1),
  duration: z.number().min(0).max(300),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const parsed = SaveRecordingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    // Check size (~2MB base64 limit for Firestore docs)
    const estimatedBytes = (parsed.data.base64.length * 3) / 4;
    if (estimatedBytes > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Recording too large. Maximum ~2MB. Try a shorter recording.' },
        { status: 400 },
      );
    }

    const docRef = await adminDb
      .collection(`organizations/${PLATFORM_ID}/voice_recordings`)
      .add({
        name: parsed.data.name,
        base64: parsed.data.base64,
        contentType: parsed.data.contentType,
        duration: parsed.data.duration,
        createdBy: authResult.user.uid,
        createdAt: new Date(),
      });

    logger.info('Voice recording saved', {
      id: docRef.id,
      name: parsed.data.name,
      duration: parsed.data.duration,
      file: 'audio/recordings/route.ts',
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save recording', error instanceof Error ? error : new Error(msg), {
      file: 'audio/recordings/route.ts',
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDb) {
      return NextResponse.json({ success: true, recordings: [] });
    }

    const snapshot = await adminDb
      .collection(`organizations/${PLATFORM_ID}/voice_recordings`)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const recordings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name as string,
        duration: data.duration as number,
        contentType: data.contentType as string,
        createdBy: data.createdBy as string,
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
        // Don't include base64 in list response — too heavy
      };
    });

    return NextResponse.json({ success: true, recordings });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
