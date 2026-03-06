/**
 * AI Music Tracks API
 * GET /api/audio/music/tracks — List previously generated tracks
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    if (!adminDb) {
      return NextResponse.json({ success: true, tracks: [] });
    }

    const snapshot = await adminDb
      .collection(`organizations/${PLATFORM_ID}/generated_music`)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const tracks = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: (data.title as string) ?? 'Untitled',
        audioUrl: (data.audioUrl as string) ?? '',
        duration: (data.duration as number) ?? 0,
        style: (data.style as string) ?? '',
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
