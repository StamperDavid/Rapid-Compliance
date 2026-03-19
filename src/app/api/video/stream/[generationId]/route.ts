/**
 * GET /api/video/stream/[generationId]
 *
 * Proxies a Hedra-generated video by re-polling the status endpoint for a
 * fresh CDN URL, then 302-redirecting the browser to it. This solves the
 * problem of Hedra's signed CDN URLs expiring after ~1 hour — our proxy URL
 * (`/api/video/stream/{id}`) never expires because it always resolves a
 * fresh link from Hedra on every request.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { getHedraVideoStatus } from '@/lib/video/hedra-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;

  if (!generationId) {
    return NextResponse.json(
      { error: 'Missing generationId' },
      { status: 400 },
    );
  }

  // Auth check — only authenticated users can stream videos
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const status = await getHedraVideoStatus(generationId);

    if (status.status !== 'completed' || !status.videoUrl) {
      logger.warn('Video stream requested but video not ready', {
        generationId,
        status: status.status,
        file: 'api/video/stream/route.ts',
      });
      return NextResponse.json(
        { error: 'Video not ready', status: status.status },
        { status: 404 },
      );
    }

    // 302 redirect to fresh Hedra CDN URL
    return NextResponse.redirect(status.videoUrl, 302);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video stream proxy failed', error as Error, {
      generationId,
      file: 'api/video/stream/route.ts',
    });
    return NextResponse.json(
      { error: msg },
      { status: 502 },
    );
  }
}
