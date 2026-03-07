/**
 * Public TTS Audio Serving Endpoint
 * GET /api/video/tts-audio/[id]
 *
 * Serves pre-synthesized ElevenLabs audio stored in Firestore.
 * Public (no auth) so video engines can download it during video generation.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !adminDb) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const doc = await adminDb
      .collection(`organizations/${PLATFORM_ID}/tts_audio`)
      .doc(id)
      .get();

    if (!doc.exists) {
      return new NextResponse('Not found', { status: 404 });
    }

    const data = doc.data();
    if (!data?.base64) {
      return new NextResponse('Invalid audio data', { status: 500 });
    }

    const audioBuffer = Buffer.from(data.base64 as string, 'base64');
    const contentType = (data.contentType as string) ?? 'audio/mpeg';

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }
}
