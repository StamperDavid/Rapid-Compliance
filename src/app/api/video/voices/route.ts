import { type NextRequest, NextResponse } from 'next/server';
import { listHeyGenVoices } from '@/lib/video/video-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') ?? undefined;

    const result = await listHeyGenVoices(language);
    const voices = 'voices' in result ? result.voices : [];

    return NextResponse.json({ success: true, voices: voices ?? [] });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voices API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage, voices: [] },
      { status: 500 }
    );
  }
}
