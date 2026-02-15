/**
 * Activity Insights API
 * GET /api/crm/activities/insights - Get intelligent insights and next best action
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getActivityInsights, getNextBestAction } from '@/lib/crm/activity-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { RelatedEntityType } from '@/types/activity';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityTypeParam = searchParams.get('entityType');
    const validEntityTypes = ['lead', 'contact', 'company', 'deal', 'opportunity'];
    const entityType: RelatedEntityType | undefined = entityTypeParam && validEntityTypes.includes(entityTypeParam)
      ? entityTypeParam as RelatedEntityType
      : undefined;
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    const [insights, nextAction] = await Promise.all([
      getActivityInsights(entityType, entityId),
      getNextBestAction(entityType, entityId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        insights,
        nextBestAction: nextAction,
      },
    });

  } catch (error) {
    logger.error('Insights GET failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

