/**
 * GET/DELETE/POST /api/growth/competitors/[competitorId]
 *
 * Get details, remove, or re-analyze a single competitor.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getCompetitorMonitorService } from '@/lib/growth/competitor-monitor';

type RouteParams = { params: Promise<{ competitorId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { competitorId } = await params;
    const service = getCompetitorMonitorService();

    const competitor = await service.getById(competitorId);
    if (!competitor) {
      return errors.notFound('Competitor not found');
    }

    const snapshots = await service.getSnapshots(competitorId, 30);

    return NextResponse.json({
      success: true,
      data: { ...competitor, snapshots },
    });
  } catch (err) {
    logger.error('Growth competitor get error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to get competitor', err instanceof Error ? err : undefined);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { competitorId } = await params;
    const service = getCompetitorMonitorService();

    await service.removeCompetitor(competitorId, authResult.user.uid);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return errors.notFound(message);
    }
    logger.error('Growth competitor remove error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to remove competitor', err instanceof Error ? err : undefined);
  }
}

/**
 * POST — re-analyze competitor (refresh metrics)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const { competitorId } = await params;
    const service = getCompetitorMonitorService();

    const updated = await service.reanalyzeCompetitor(competitorId, authResult.user.uid);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return errors.notFound(message);
    }
    logger.error('Growth competitor reanalyze error', err instanceof Error ? err : new Error(message));
    return errors.internal('Failed to re-analyze competitor', err instanceof Error ? err : undefined);
  }
}
