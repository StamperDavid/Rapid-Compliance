/**
 * GET /api/growth/activity
 *
 * Get the growth activity feed.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { logger } from '@/lib/logger/logger';
import { getGrowthActivityLogger } from '@/lib/growth/growth-activity-logger';
import { ActivityListQuerySchema } from '@/lib/growth/growth-validation';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {return authResult;}

  try {
    const url = new URL(request.url);
    const parsed = ActivityListQuerySchema.safeParse({
      type: url.searchParams.get('type') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid query' },
        { status: 400 }
      );
    }

    const activityLogger = getGrowthActivityLogger();
    const events = await activityLogger.getRecentActivity({
      type: parsed.data.type,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: events });
  } catch (err) {
    logger.error('Growth activity list error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal('Failed to list activity', err instanceof Error ? err : undefined);
  }
}
