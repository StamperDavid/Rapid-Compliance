/**
 * GET/DELETE/POST /api/growth/keywords/[keywordId]
 *
 * Get details, remove, or re-check ranking for a single keyword.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getKeywordTrackerService } from '@/lib/growth/keyword-tracker';

type RouteParams = { params: Promise<{ keywordId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { keywordId } = await params;
    const service = getKeywordTrackerService();

    const keyword = await service.getById(keywordId);
    if (!keyword) {
      return errors.notFound('Keyword not found');
    }

    return NextResponse.json({ success: true, data: keyword });
  } catch (err) {
    logger.error('Growth keyword get error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to get keyword', err instanceof Error ? err : undefined);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { keywordId } = await params;
    const service = getKeywordTrackerService();

    await service.removeKeyword(keywordId, authResult.user.uid);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return errors.notFound(message);
    }
    logger.error('Growth keyword remove error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to remove keyword', err instanceof Error ? err : undefined);
  }
}

/**
 * POST — check ranking for this keyword now
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { keywordId } = await params;
    const service = getKeywordTrackerService();

    const updated = await service.checkRanking(keywordId);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return errors.notFound(message);
    }
    logger.error('Growth keyword check error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to check keyword ranking', err instanceof Error ? err : undefined);
  }
}
