import { type NextRequest, NextResponse } from 'next/server';
import { listHeyGenAvatars } from '@/lib/video/video-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const result = await listHeyGenAvatars();
    const avatars = 'avatars' in result ? result.avatars : [];

    return NextResponse.json({ success: true, avatars: avatars ?? [] });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Avatars API failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: errorMessage, avatars: [] },
      { status: 500 }
    );
  }
}
